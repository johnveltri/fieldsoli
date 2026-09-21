import { describe, expect, it } from 'vitest';

import {
  mapGeoapifyFeatures,
  mapGeoapifyResults,
  validateAddressAutocompleteRequest,
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
