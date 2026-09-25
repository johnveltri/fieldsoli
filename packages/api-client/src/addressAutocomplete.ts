import type { FieldSoloSupabaseClient } from './client';

export const ADDRESS_SUGGESTION_LIMIT = 4;

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
      limit: options?.limit ?? ADDRESS_SUGGESTION_LIMIT,
    },
  });

  const fromData = resultFromPayload(data);
  if (fromData) return fromData;

  const fromError = await resultFromInvokeError(error);
  if (fromError) return fromError;

  return { status: 'error', code: 'unavailable' };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function resultFromPayload(payload: unknown): AddressAutocompleteResult | null {
  if (!isRecord(payload)) return null;
  if (payload.status === 'ok' && Array.isArray(payload.suggestions)) {
    return { status: 'ok', suggestions: payload.suggestions as AddressSuggestion[] };
  }
  if (payload.status === 'error') {
    const code = payload.error;
    if (
      code === 'unauthorized' ||
      code === 'invalid_request' ||
      code === 'rate_limited' ||
      code === 'unavailable'
    ) {
      return { status: 'error', code };
    }
    return { status: 'error', code: 'unavailable' };
  }
  return null;
}

async function resultFromInvokeError(error: unknown): Promise<AddressAutocompleteResult | null> {
  const context = isRecord(error) && 'context' in error ? error.context : null;
  if (!context || typeof (context as Response).json !== 'function') return null;
  try {
    return resultFromPayload(await (context as Response).json());
  } catch {
    return null;
  }
}
