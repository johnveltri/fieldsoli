import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  mapGeoapifyFeatures,
  addressAutocompleteFailureReason,
  mapGeoapifyResults,
  validateAddressAutocompleteRequest,
  businessProximityFromResults,
  fetchGeoapifySuggestions,
  fetchBusinessAddressProximity,
} from './address-autocomplete';

describe('address-autocomplete shared contract', () => {
  it('rejects anonymous-shaped invalid requests', () => {
    expect(validateAddressAutocompleteRequest(null)).toEqual({
      status: 'error',
      error: 'invalid_request',
    });
    expect(validateAddressAutocompleteRequest({ query: 'ab', countryCode: 'us', limit: 4 })).toEqual({
      status: 'error',
      error: 'invalid_request',
    });
    expect(validateAddressAutocompleteRequest({ query: '12345', countryCode: 'us', limit: 4 })).toEqual({
      status: 'error',
      error: 'invalid_request',
    });
    expect(validateAddressAutocompleteRequest({ query: '123 Main', countryCode: 'us', limit: 5 })).toEqual({
      status: 'error',
      error: 'invalid_request',
    });
  });

  it('accepts valid US requests and maps provider features without raw payloads', () => {
    const validated = validateAddressAutocompleteRequest({
      query: '123 Main',
      countryCode: 'us',
      limit: 4,
    });
    expect(validated).toEqual({ query: '123 Main', countryCode: 'us', limit: 4 });

    const suggestions = mapGeoapifyFeatures(
      [
        {
          properties: {
            formatted: '123 Main St, Chicago, IL 60601, United States of America',
            address_line1: '123 Main St',
            city: 'Chicago',
            state: 'Illinois',
            postcode: '60601',
            country_code: 'US',
          },
        },
      ],
      3,
    );
    expect(suggestions).toEqual([
      {
        token: 'g0',
        displayAddress: '123 Main St, Chicago, IL 60601',
        addressLine1: '123 Main St',
        city: 'Chicago',
        region: 'Illinois',
        postalCode: '60601',
        countryCode: 'us',
      },
    ]);
    expect(JSON.stringify(suggestions)).not.toContain('geoapify');
  });

  it('maps Geoapify format=json results payloads', () => {
    const suggestions = mapGeoapifyResults(
      [
        {
          formatted: 'Steuart Street, San Francisco, CA 94105, USA',
          address_line1: 'Steuart Street',
          city: 'San Francisco',
          state: 'California',
          postcode: '94105',
          country_code: 'us',
        },
      ],
      3,
    );
    expect(suggestions[0]?.displayAddress).toBe('Steuart Street, San Francisco, CA 94105');
    expect(suggestions[0]?.region).toBe('California');
  });
});

describe('proximity ranking', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('validates and rounds coordinates, including zero and boundary values', () => {
    const base = { query: '123 Main', countryCode: 'us', limit: 4 };
    expect(validateAddressAutocompleteRequest({ ...base, proximity: { latitude: 41.8781, longitude: -87.6298 } }))
      .toEqual({ ...base, proximity: { latitude: 41.88, longitude: -87.63 } });
    expect(validateAddressAutocompleteRequest({ ...base, proximity: { latitude: 0, longitude: 180 } }))
      .toEqual({ ...base, proximity: { latitude: 0, longitude: 180 } });
    for (const proximity of [null, {}, { latitude: NaN, longitude: 0 }, { latitude: 91, longitude: 0 },
      { latitude: 0, longitude: Infinity }, { latitude: '1', longitude: 0 }, { latitude: 0, longitude: -181 }]) {
      expect(validateAddressAutocompleteRequest({ ...base, proximity })).toEqual({ status: 'error', error: 'invalid_request' });
    }
  });

  it('accepts only a server-resolved business operation with no caller identifiers or address', () => {
    expect(validateAddressAutocompleteRequest({ action: 'resolve_business_proximity' }))
      .toEqual({ action: 'resolve_business_proximity' });
    for (const extras of [{ userId: 'other' }, { address: '123 Main' }]) {
      expect(validateAddressAutocompleteRequest({ action: 'resolve_business_proximity', ...extras }))
        .toEqual({ status: 'error', error: 'invalid_request' });
    }
  });

  it('adds longitude-first bias only when provided and keeps US filtering', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) });
    vi.stubGlobal('fetch', fetch);
    const request = { query: '123 Main', countryCode: 'us' as const, limit: 4 };
    await fetchGeoapifySuggestions('secret', request);
    expect(new URL(fetch.mock.calls[0][0]).searchParams.has('bias')).toBe(false);
    await fetchGeoapifySuggestions('secret', { ...request, proximity: { latitude: 41.88, longitude: -87.63 } });
    const params = new URL(fetch.mock.calls[1][0]).searchParams;
    expect(params.get('bias')).toBe('proximity:-87.63,41.88');
    expect(params.get('filter')).toBe('countrycode:us');
  });

  it('rejects absent, weak, broad, malformed or ambiguous geocoding matches', () => {
    const match = { lat: 41.8781, lon: -87.6298, result_type: 'building', rank: { confidence: 0.9 } };
    expect(businessProximityFromResults([match])).toEqual({ latitude: 41.88, longitude: -87.63 });
    expect(businessProximityFromResults([match, { ...match, lat: 41.879 }])).toEqual({ latitude: 41.88, longitude: -87.63 });
    for (const results of [[], [{ ...match, rank: { confidence: 0.89 } }], [{ ...match, result_type: 'state' }],
      [{ ...match, lat: 91 }], [match, { ...match, lat: 40.71 }]]) {
      expect(businessProximityFromResults(results)).toBeNull();
    }
  });

  it('geocodes the saved business address using two candidates without raw response fields', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [
      { lat: 41.8781, lon: -87.6298, result_type: 'city', rank: { confidence: 1 }, place_id: 'private' },
    ] }) });
    vi.stubGlobal('fetch', fetch);
    expect(await fetchBusinessAddressProximity('secret', 'Chicago, IL')).toEqual({ latitude: 41.88, longitude: -87.63 });
    const url = new URL(fetch.mock.calls[0][0]);
    expect(url.pathname).toBe('/v1/geocode/search');
    expect(url.searchParams.get('limit')).toBe('2');
    expect(url.searchParams.get('text')).toBe('Chicago, IL');
  });
});

it('logs only bounded provider failure reasons, never upstream details', () => {
  const aborted = new Error('URL with private key'); aborted.name = 'AbortError';
  expect(addressAutocompleteFailureReason(aborted)).toBe('provider_timeout');
  expect(addressAutocompleteFailureReason(new Error('geoapify_status_403'))).toBe('provider_auth');
  expect(addressAutocompleteFailureReason(new Error('geoapify_status_429'))).toBe('provider_rate_limited');
  expect(addressAutocompleteFailureReason(new Error('geoapify_status_503'))).toBe('provider_http_error');
  expect(addressAutocompleteFailureReason(new TypeError('private address or URL'))).toBe('provider_network');
  expect(addressAutocompleteFailureReason(new Error('private address or URL'))).toBe('unknown');
  expect(addressAutocompleteFailureReason({ message: 'geoapify_status_403' })).toBe('unknown');
});
