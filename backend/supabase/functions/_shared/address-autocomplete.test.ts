import { describe, expect, it } from 'vitest';

import {
  mapGeoapifyFeatures,
  validateAddressAutocompleteRequest,
} from './address-autocomplete';

describe('address-autocomplete shared contract', () => {
  it('rejects anonymous-shaped invalid requests', () => {
    expect(validateAddressAutocompleteRequest(null)).toEqual({
      status: 'error',
      error: 'invalid_request',
    });
    expect(validateAddressAutocompleteRequest({ query: 'ab', countryCode: 'us', limit: 5 })).toEqual({
      status: 'error',
      error: 'invalid_request',
    });
    expect(validateAddressAutocompleteRequest({ query: '12345', countryCode: 'us', limit: 5 })).toEqual({
      status: 'error',
      error: 'invalid_request',
    });
  });

  it('accepts valid US requests and maps provider features without raw payloads', () => {
    const validated = validateAddressAutocompleteRequest({
      query: '123 Main',
      countryCode: 'us',
      limit: 5,
    });
    expect(validated).toEqual({ query: '123 Main', countryCode: 'us', limit: 5 });

    const suggestions = mapGeoapifyFeatures(
      [
        {
          properties: {
            formatted: '123 Main St, Chicago, IL 60601, USA',
            address_line1: '123 Main St',
            city: 'Chicago',
            state: 'Illinois',
            postcode: '60601',
            country_code: 'US',
          },
        },
      ],
      5,
    );
    expect(suggestions).toEqual([
      {
        token: 'g0',
        displayAddress: '123 Main St, Chicago, IL 60601, USA',
        addressLine1: '123 Main St',
        city: 'Chicago',
        region: 'Illinois',
        postalCode: '60601',
        countryCode: 'us',
      },
    ]);
    expect(JSON.stringify(suggestions)).not.toContain('geoapify');
  });
});
