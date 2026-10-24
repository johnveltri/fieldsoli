import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FieldSoloSupabaseClient } from './client';
import { fetchAddressSuggestions, resolveBusinessProximity } from './addressAutocomplete';

function clientWith(invoke: ReturnType<typeof vi.fn>) {
  return { functions: { invoke } } as unknown as FieldSoloSupabaseClient;
}

afterEach(() => vi.useRealTimers());

describe('fetchAddressSuggestions', () => {
  it('passes optional proximity without changing the suggestion response', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { status: 'ok', suggestions: [] }, error: null });
    const proximity = { latitude: 41.88, longitude: -87.63 };
    await fetchAddressSuggestions(clientWith(invoke), '123 Main', { proximity });
    expect(invoke.mock.calls[0][1].body).toEqual({ query: '123 Main', countryCode: 'us', limit: 4, proximity });
  });
  it('calls the authenticated endpoint with the shared result limit', async () => {
    const suggestions = [{ token: 'g0', displayAddress: '123 Main St' }];
    const invoke = vi.fn().mockResolvedValue({ data: { status: 'ok', suggestions }, error: null });
    expect(await fetchAddressSuggestions(clientWith(invoke), '123 Main')).toEqual({ status: 'ok', suggestions });
    expect(invoke).toHaveBeenCalledWith('address-autocomplete', {
      body: { query: '123 Main', countryCode: 'us', limit: 4 },
      signal: expect.any(AbortSignal),
    });
  });

  it.each(['unauthorized', 'rate_limited', 'invalid_request', 'unavailable'])('preserves endpoint %s errors', async (code) => {
    const invoke = vi.fn().mockResolvedValue({ data: null, error: { context: { json: async () => ({ status: 'error', error: code }) } } });
    expect(await fetchAddressSuggestions(clientWith(invoke), '123 Main')).toEqual({ status: 'error', code });
  });

  it('settles network exceptions and missing-function gateway responses', async () => {
    const invoke = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ data: null, error: { context: { json: async () => ({ code: 'NOT_FOUND', message: 'Function not found' }) } } });
    const client = clientWith(invoke);
    expect(await fetchAddressSuggestions(client, '123 Main')).toEqual({ status: 'error', code: 'unavailable' });
    expect(await fetchAddressSuggestions(client, '123 Main')).toEqual({ status: 'error', code: 'unavailable' });
  });

  it('bounds a lookup that never resolves and aborts its native request', async () => {
    vi.useFakeTimers();
    const invoke = vi.fn().mockImplementation(() => new Promise(() => {}));
    const pending = fetchAddressSuggestions(clientWith(invoke), '123 Main');
    await vi.advanceTimersByTimeAsync(18000);
    expect(await pending).toEqual({ status: 'error', code: 'unavailable' });
    expect(invoke.mock.calls[0]?.[1].signal.aborted).toBe(true);
  });

  it('bounds an error body that never resolves', async () => {
    vi.useFakeTimers();
    const invoke = vi.fn().mockResolvedValue({ data: null, error: { context: { json: () => new Promise(() => {}) } } });
    const pending = fetchAddressSuggestions(clientWith(invoke), '123 Main');
    await vi.advanceTimersByTimeAsync(18000);
    expect(await pending).toEqual({ status: 'error', code: 'unavailable' });
  });
});

describe('resolveBusinessProximity', () => {
  it('sends no user or address and returns only rounded coordinates', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: {
      status: 'ok', proximity: { latitude: 41.8781, longitude: -87.6298, place_id: 'private' },
    }, error: null });
    expect(await resolveBusinessProximity(clientWith(invoke))).toEqual({ latitude: 41.88, longitude: -87.63 });
    expect(invoke.mock.calls[0][1].body).toEqual({ action: 'resolve_business_proximity' });
  });

  it.each([null, {}, { latitude: '1', longitude: 0 }, { latitude: 91, longitude: 0 }, { latitude: 0, longitude: Infinity }])(
    'falls back safely for missing or invalid coordinates %j', async (proximity) => {
      const invoke = vi.fn().mockResolvedValue({ data: { status: 'ok', proximity }, error: null });
      expect(await resolveBusinessProximity(clientWith(invoke))).toBeNull();
    },
  );

  it('falls back for unavailable endpoints and bounded timeouts', async () => {
    const invoke = vi.fn().mockRejectedValueOnce(new Error('offline')).mockImplementation(() => new Promise(() => {}));
    expect(await resolveBusinessProximity(clientWith(invoke))).toBeNull();
    vi.useFakeTimers();
    const pending = resolveBusinessProximity(clientWith(invoke));
    await vi.advanceTimersByTimeAsync(18000);
    expect(await pending).toBeNull();
    expect(invoke.mock.calls[1][1].signal.aborted).toBe(true);
  });
});
