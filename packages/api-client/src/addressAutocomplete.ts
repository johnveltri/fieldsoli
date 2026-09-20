import type { FieldSoloSupabaseClient } from './client';

export type AddressSuggestion = {
  token: string;
  displayAddress: string;
  addressLine1?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  countryCode?: string;
};

export type AddressAutocompleteErrorCode =
  | 'unauthorized'
  | 'invalid_request'
  | 'rate_limited'
  | 'unavailable';

export type AddressAutocompleteResult =
  | { status: 'ok'; suggestions: AddressSuggestion[] }
  | { status: 'error'; code: AddressAutocompleteErrorCode };

export async function fetchAddressSuggestions(
  client: FieldSoloSupabaseClient,
  query: string,
  options?: { countryCode?: 'us'; limit?: number },
): Promise<AddressAutocompleteResult> {
  const { data, error } = await client.functions.invoke('address-autocomplete', {
    body: {
      query,
      countryCode: options?.countryCode ?? 'us',
      limit: options?.limit ?? 5,
    },
  });

  if (error) {
    return { status: 'error', code: 'unavailable' };
  }

  const payload = data as
    | { status?: string; suggestions?: AddressSuggestion[]; error?: AddressAutocompleteErrorCode }
    | null;

  if (!payload) {
    return { status: 'error', code: 'unavailable' };
  }
  if (payload.status === 'ok' && Array.isArray(payload.suggestions)) {
    return { status: 'ok', suggestions: payload.suggestions };
  }
  const code = payload.error ?? 'unavailable';
  return { status: 'error', code };
}
