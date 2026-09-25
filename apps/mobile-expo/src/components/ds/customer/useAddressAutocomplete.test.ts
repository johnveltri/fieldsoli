import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { fetchAddressSuggestions } from '@fieldsolo/api-client';

import { useAddressAutocomplete } from './useAddressAutocomplete';

jest.mock('@fieldsolo/api-client', () => ({
  ADDRESS_SUGGESTION_LIMIT: 4,
  fetchAddressSuggestions: jest.fn(),
}));

const mockFetch = fetchAddressSuggestions as jest.MockedFunction<typeof fetchAddressSuggestions>;
const client = {} as Parameters<typeof useAddressAutocomplete>[0];

describe('useAddressAutocomplete', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockFetch.mockReset();
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
});
