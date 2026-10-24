import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import { previewFinancialDocument, type DocumentPreview } from '@fieldsolo/api-client';

import { usePreparedDocumentPreview } from './usePreparedDocumentPreview';

jest.mock('@fieldsolo/api-client', () => ({
  deviceIanaTimeZone: () => 'America/Chicago',
  previewFinancialDocument: jest.fn(),
}));
const mockPreview = jest.mocked(previewFinancialDocument);
const preview = { fingerprint: 'source-a', gaps: [], payload: { documentType: 'estimate' } } as DocumentPreview;
const newer = { ...preview, fingerprint: 'source-b' };
const options = {
  client: {} as Parameters<typeof usePreparedDocumentPreview>[0]['client'],
  ownerId: 'owner-a', jobId: 'job-a', type: 'estimate' as const,
  revision: {}, enabled: true,
};
function deferred() {
  let resolve!: (value: DocumentPreview) => void;
  const promise = new Promise<DocumentPreview>((accept) => { resolve = accept; });
  return { promise, resolve };
}
const flush = async () => { await act(async () => undefined); };

describe('usePreparedDocumentPreview', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockPreview.mockReset().mockResolvedValue(preview);
  });
  afterEach(() => jest.useRealTimers());

  it('warms once and reuses the same in-flight read and completed result', async () => {
    const pending = deferred();
    mockPreview.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => usePreparedDocumentPreview(options));
    const first = result.current.read();
    expect(result.current.read()).toBe(first);
    expect(mockPreview).toHaveBeenCalledTimes(1);
    expect(mockPreview).toHaveBeenCalledWith(options.client, { jobId: 'job-a', type: 'estimate', timezone: 'America/Chicago' });
    await act(async () => pending.resolve(preview));
    expect(await first).toBe(preview);
    expect(await result.current.read()).toBe(preview);
    expect(mockPreview).toHaveBeenCalledTimes(1);
  });

  it('expires 30 seconds after completion rather than request start', async () => {
    const pending = deferred();
    mockPreview.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => usePreparedDocumentPreview(options));
    await act(async () => jest.advanceTimersByTime(10_000));
    await act(async () => pending.resolve(preview));
    await act(async () => jest.advanceTimersByTime(29_999));
    expect(await result.current.read()).toBe(preview);
    expect(mockPreview).toHaveBeenCalledTimes(1);
    await act(async () => jest.advanceTimersByTime(1));
    mockPreview.mockResolvedValueOnce(newer);
    expect(await result.current.read()).toBe(newer);
    expect(mockPreview).toHaveBeenCalledTimes(2);
  });

  it('does not speculate or reuse completed previews while disabled', async () => {
    const { result } = renderHook(() => usePreparedDocumentPreview({ ...options, enabled: false }));
    expect(mockPreview).not.toHaveBeenCalled();
    expect(await result.current.read()).toBe(preview);
    mockPreview.mockResolvedValueOnce(newer);
    expect(await result.current.read()).toBe(newer);
    expect(mockPreview).toHaveBeenCalledTimes(2);
  });

  it.each(['ownerId', 'jobId', 'type', 'revision', 'client', 'enabled'] as const)('isolates a changed %s from a late prior read', async (key) => {
    const pending = deferred();
    mockPreview.mockReturnValueOnce(pending.promise);
    const { result, rerender } = renderHook((props) => usePreparedDocumentPreview(props), { initialProps: { ...options, type: options.type as 'estimate' | 'invoice' } });
    const oldRead = result.current.read().catch((error: Error) => error.message);
    const replacement = { ownerId: 'owner-b', jobId: 'job-b', type: 'invoice', revision: {}, client: {}, enabled: false }[key];
    mockPreview.mockResolvedValue(newer);
    rerender({ ...options, [key]: replacement });
    await flush();
    await act(async () => pending.resolve(preview));
    expect(await oldRead).toBe('document_preview_superseded');
    expect(await result.current.read()).toBe(newer);
  });

  it('invalidates completed data and warms a replacement immediately', async () => {
    const { result } = renderHook(() => usePreparedDocumentPreview(options));
    await flush();
    mockPreview.mockResolvedValueOnce(newer);
    act(() => result.current.invalidate());
    await flush();
    expect(await result.current.read()).toBe(newer);
    expect(mockPreview).toHaveBeenCalledTimes(2);
  });

  it('does not allow an invalidated speculative request to overwrite its replacement', async () => {
    const pending = deferred();
    mockPreview.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => usePreparedDocumentPreview(options));
    const oldRead = result.current.read().catch((error: Error) => error.message);
    mockPreview.mockResolvedValueOnce(newer);
    act(() => result.current.invalidate());
    await flush();
    await act(async () => pending.resolve(preview));
    expect(await oldRead).toBe('document_preview_superseded');
    expect(await result.current.read()).toBe(newer);
    expect(mockPreview).toHaveBeenCalledTimes(2);
  });

  it('silently settles a speculative timeout and retries the next explicit read', async () => {
    const pending = deferred();
    mockPreview.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => usePreparedDocumentPreview(options));
    const expired = result.current.read().catch((error: Error) => error.message);
    await act(async () => jest.advanceTimersByTime(15_000));
    expect(await expired).toBe('document_read_timeout');
    mockPreview.mockResolvedValueOnce(newer);
    expect(await result.current.read()).toBe(newer);
    await act(async () => pending.resolve(preview));
    expect(await result.current.read()).toBe(newer);
    expect(mockPreview).toHaveBeenCalledTimes(2);
  });

  it('retries after speculative rejection without caching the failure', async () => {
    mockPreview.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => usePreparedDocumentPreview(options));
    await flush();
    expect(await result.current.read()).toBe(preview);
    expect(mockPreview).toHaveBeenCalledTimes(2);
  });

  it('isolates completion after unmount and refuses retained stale read callbacks', async () => {
    const pending = deferred();
    mockPreview.mockReturnValueOnce(pending.promise);
    const { result, unmount } = renderHook(() => usePreparedDocumentPreview(options));
    const retainedRead = result.current.read;
    const oldRead = retainedRead().catch((error: Error) => error.message);
    unmount();
    await act(async () => pending.resolve(preview));
    expect(await oldRead).toBe('document_preview_superseded');
    await expect(retainedRead()).rejects.toThrow('document_preview_superseded');
    expect(mockPreview).toHaveBeenCalledTimes(1);
  });
});
