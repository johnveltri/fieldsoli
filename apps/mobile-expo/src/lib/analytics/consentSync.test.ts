import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockUpsertAnalyticsConsentStatus = jest.fn(async () => undefined);
const mockWriteAnalyticsConsentCache = jest.fn(async () => undefined);
const mockGrantConsent = jest.fn(async () => undefined);
const mockIdentify = jest.fn();
const mockWithdraw = jest.fn(async () => undefined);
const mockApply = jest.fn(async (_status: unknown) => undefined);
const mockRead = jest.fn<() => Promise<{userId: string; status: 'withdrawn'} | null>>(async () => null);
const mockFetch = jest.fn<() => Promise<'granted' | 'withdrawn' | null>>(async () => null);

jest.mock('@fieldsolo/api-client', () => ({
  fetchAnalyticsConsentStatus: () => mockFetch(),
  upsertAnalyticsConsentStatus: (...args: unknown[]) =>
    mockUpsertAnalyticsConsentStatus(...(args as [])),
}));

jest.mock('../supabase', () => ({ supabase: {} }));

jest.mock('./consentStorage', () => ({
  clearAnalyticsConsentCache: jest.fn(),
  readAnalyticsConsentCache: () => mockRead(),
  writeAnalyticsConsentCache: (...args: unknown[]) =>
    mockWriteAnalyticsConsentCache(...(args as [])),
}));

jest.mock('./client', () => ({
  analytics: {
    applyConsent: (status: unknown) => mockApply(status),
    grantConsent: () => mockGrantConsent(),
    identify: (userId: string) => mockIdentify(userId),
    withdrawConsent: () => mockWithdraw(),
  },
}));

import { grantAnalyticsConsent, withdrawAnalyticsConsent, resolveAnalyticsConsentForUser } from './consentSync';

describe('analytics consent sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRead.mockResolvedValue(null);
    mockFetch.mockResolvedValue(null);
  });

  it('stops collection and persists withdrawal before waiting on the server', async () => {
    await withdrawAnalyticsConsent('user-1');
    expect(mockWithdraw.mock.invocationCallOrder[0]).toBeLessThan(mockWriteAnalyticsConsentCache.mock.invocationCallOrder[0]);
    expect(mockWriteAnalyticsConsentCache.mock.invocationCallOrder[0]).toBeLessThan(mockUpsertAnalyticsConsentStatus.mock.invocationCallOrder[0]);
  });

  it('does not let a stale server grant reverse an offline local withdrawal', async () => {
    mockRead.mockResolvedValue({ userId: 'user-1', status: 'withdrawn' });
    mockFetch.mockResolvedValue('granted');
    expect(await resolveAnalyticsConsentForUser('user-1')).toBe('withdrawn');
    expect(mockApply).not.toHaveBeenCalledWith('granted');
    expect(mockUpsertAnalyticsConsentStatus).toHaveBeenCalledWith(expect.anything(), 'withdrawn');
  });

  it('identifies the authenticated user immediately after granting consent', async () => {
    await grantAnalyticsConsent('user-1');

    expect(mockUpsertAnalyticsConsentStatus).toHaveBeenCalledWith(
      expect.anything(),
      'granted',
    );
    expect(mockWriteAnalyticsConsentCache).toHaveBeenCalledWith('user-1', 'granted');
    expect(mockGrantConsent).toHaveBeenCalled();
    expect(mockIdentify).toHaveBeenCalledWith('user-1');
  });

  it('applies granted consent locally when the server upsert fails', async () => {
    mockUpsertAnalyticsConsentStatus.mockRejectedValueOnce(new Error('offline'));

    await grantAnalyticsConsent('user-1');

    expect(mockWriteAnalyticsConsentCache).toHaveBeenCalledWith('user-1', 'granted');
    expect(mockGrantConsent).toHaveBeenCalled();
    expect(mockIdentify).toHaveBeenCalledWith('user-1');
  });
});
