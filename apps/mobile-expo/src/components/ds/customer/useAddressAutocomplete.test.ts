import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { fetchAddressSuggestions } from '@fieldsolo/api-client';

import { useAddressAutocomplete } from './useAddressAutocomplete';
import { businessAddressProximity, deviceAddressProximity } from '../../../lib/addressLocation';

jest.mock('../../../lib/addressLocation', () => ({
  deviceAddressProximity: jest.fn<() => Promise<unknown>>().mockResolvedValue(null),
  businessAddressProximity: jest.fn<() => Promise<unknown>>().mockResolvedValue(null),
  subscribeAddressProximity: () => () => {},
}));

jest.mock('@fieldsolo/api-client', () => ({
  ADDRESS_SUGGESTION_LIMIT: 4,
  fetchAddressSuggestions: jest.fn(),
}));

const mockFetch = fetchAddressSuggestions as jest.MockedFunction<typeof fetchAddressSuggestions>;
const client = {} as Parameters<typeof useAddressAutocomplete>[0];

describe('useAddressAutocomplete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockFetch.mockReset();
    jest.mocked(deviceAddressProximity).mockResolvedValue(null);
    jest.mocked(businessAddressProximity).mockResolvedValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows Searching before matches', async () => {
    let resolveLookup: (value: Awaited<ReturnType<typeof fetchAddressSuggestions>>) => void =
      () => {};
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLookup = resolve;
        }),
    );

    const { result } = renderHook(
      ({ query, enabled }) => useAddressAutocomplete(client, query, enabled),
      { initialProps: { query: '123 Main', enabled: true } },
    );

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.showPanel).toBe(true);
    expect(result.current.noResults).toBe(false);

    await act(async () => {
      resolveLookup({
        status: 'ok',
        suggestions: [{ token: 'g0', displayAddress: '123 Main St, Chicago, IL 60601' }],
      });
    });

    await waitFor(() => {
      expect(result.current.suggestions).toHaveLength(1);
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.noResults).toBe(false);
    expect(result.current.showPanel).toBe(true);
  });

  it('asks for location on focus even with an empty query, without searching yet', async () => {
    renderHook(() => useAddressAutocomplete(client, '', true));
    await act(async () => { jest.advanceTimersByTime(300); });
    expect(deviceAddressProximity).toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('uses device proximity before the business fallback', async () => {
    const point = { latitude: 41.88, longitude: -87.63 };
    jest.mocked(deviceAddressProximity).mockResolvedValue(point);
    mockFetch.mockResolvedValue({ status: 'ok', suggestions: [] });
    renderHook(() => useAddressAutocomplete(client, '123 Main', true));
    await act(async () => {});
    await act(async () => { jest.advanceTimersByTime(300); });
    expect(mockFetch).toHaveBeenLastCalledWith(client, '123 Main', { countryCode: 'us', limit: 4, proximity: point });
    expect(businessAddressProximity).not.toHaveBeenCalled();
  });

  it('uses business proximity when device location is unavailable', async () => {
    const point = { latitude: 40.71, longitude: -74.01 };
    jest.mocked(businessAddressProximity).mockResolvedValue(point);
    mockFetch.mockResolvedValue({ status: 'ok', suggestions: [] });
    renderHook(() => useAddressAutocomplete(client, '123 Main', true));
    await act(async () => {});
    await act(async () => { jest.advanceTimersByTime(300); });
    expect(mockFetch).toHaveBeenLastCalledWith(client, '123 Main', { countryCode: 'us', limit: 4, proximity: point });
  });

  it('ignores a late location after the address field loses focus', async () => {
    let resolve!: (point: { latitude: number; longitude: number }) => void;
    jest.mocked(deviceAddressProximity).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const { rerender } = renderHook(({ enabled }) => useAddressAutocomplete(client, '123 Main', enabled), {
      initialProps: { enabled: true },
    });
    rerender({ enabled: false });
    await act(async () => { resolve({ latitude: 1, longitude: 2 }); jest.advanceTimersByTime(500); });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('shows Searching before No results', async () => {
    let resolveLookup: (value: Awaited<ReturnType<typeof fetchAddressSuggestions>>) => void =
      () => {};
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLookup = resolve;
        }),
    );

    const { result } = renderHook(
      ({ query, enabled }) => useAddressAutocomplete(client, query, enabled),
      { initialProps: { query: '123 Main', enabled: true } },
    );

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.noResults).toBe(false);
    expect(result.current.showPanel).toBe(true);

    await act(async () => {
      resolveLookup({ status: 'ok', suggestions: [] });
    });

    await waitFor(() => {
      expect(result.current.noResults).toBe(true);
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.showPanel).toBe(true);
  });

  it('hides the panel on errors and does not show No results', async () => {
    mockFetch.mockResolvedValue({ status: 'error', code: 'unavailable' });

    const { result } = renderHook(
      ({ query, enabled }) => useAddressAutocomplete(client, query, enabled),
      { initialProps: { query: '123 Main', enabled: true } },
    );

    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    expect(result.current.noResults).toBe(false);
    expect(result.current.loading).toBe(false);
    expect(result.current.showPanel).toBe(false);
  });

  it('does not keep searching after the user hits the daily limit', async () => {
    mockFetch.mockResolvedValue({ status: 'error', code: 'rate_limited' });

    const { result, rerender } = renderHook(
      ({ query, enabled }) => useAddressAutocomplete(client, query, enabled),
      { initialProps: { query: '123 Main', enabled: true } },
    );

    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    rerender({ query: '123 Main St', enabled: true });
    await act(async () => {
      jest.advanceTimersByTime(700);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.current.showPanel).toBe(false);
  });

  it('recovers with matches after an error', async () => {
    mockFetch
      .mockResolvedValueOnce({ status: 'error', code: 'unavailable' })
      .mockResolvedValueOnce({
        status: 'ok',
        suggestions: [{ token: 'g0', displayAddress: '123 Main St' }],
      });

    const { result, rerender } = renderHook(
      ({ query, enabled }) => useAddressAutocomplete(client, query, enabled),
      { initialProps: { query: '123 Main', enabled: true } },
    );

    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    rerender({ query: '123 Main St', enabled: true });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.suggestions).toHaveLength(1);
    });
    expect(result.current.showPanel).toBe(true);
  });
  it('settles a rejected lookup and recovers for the next query', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ status: 'ok', suggestions: [] });
    const { result, rerender } = renderHook(
      ({ query }) => useAddressAutocomplete(client, query, true),
      { initialProps: { query: '123 Main' } },
    );
    await act(async () => { jest.advanceTimersByTime(300); });
    expect(result.current.loading).toBe(false);
    expect(result.current.showPanel).toBe(false);
    rerender({ query: '456 Broad' });
    await act(async () => { jest.advanceTimersByTime(300); });
    expect(result.current.noResults).toBe(true);
  });

  it('ignores stale responses after a new query and after disabling', async () => {
    const resolvers: ((value: Awaited<ReturnType<typeof fetchAddressSuggestions>>) => void)[] = [];
    mockFetch.mockImplementation(() => new Promise((resolve) => { resolvers.push(resolve); }));
    const { result, rerender } = renderHook(
      ({ query, enabled }) => useAddressAutocomplete(client, query, enabled),
      { initialProps: { query: '123 Main', enabled: true } },
    );
    await act(async () => { jest.advanceTimersByTime(300); });
    rerender({ query: '456 Broad', enabled: true });
    await act(async () => {
      resolvers[0]?.({ status: 'ok', suggestions: [{ token: 'old', displayAddress: '123 Main St' }] });
    });
    expect(result.current.suggestions).toEqual([]);
    await act(async () => { jest.advanceTimersByTime(300); });
    rerender({ query: '456 Broad', enabled: false });
    await act(async () => { resolvers[1]?.({ status: 'ok', suggestions: [] }); });
    expect(result.current.loading).toBe(false);
    expect(result.current.showPanel).toBe(false);
  });

  it('debounces edits and skips queries below the threshold', async () => {
    mockFetch.mockResolvedValue({ status: 'ok', suggestions: [] });
    const { rerender } = renderHook(
      ({ query }) => useAddressAutocomplete(client, query, true),
      { initialProps: { query: '1234' } },
    );
    await act(async () => { jest.advanceTimersByTime(500); });
    expect(mockFetch).not.toHaveBeenCalled();
    rerender({ query: '123 Main' });
    await act(async () => { jest.advanceTimersByTime(299); });
    rerender({ query: '123 Main St' });
    await act(async () => { jest.advanceTimersByTime(300); });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(client, '123 Main St', { countryCode: 'us', limit: 4 });
  });

});
