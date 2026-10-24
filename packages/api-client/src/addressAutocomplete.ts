import type { FieldSoloSupabaseClient } from './client';

export const ADDRESS_SUGGESTION_LIMIT = 4;
const REQUEST_TIMEOUT_MS = 8000;

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
  // Bound the complete lookup, including error response parsing. Native fetch or
  // an unavailable endpoint must never leave the address panel searching forever.
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unavailable: AddressAutocompleteResult = { status: 'error', code: 'unavailable' };
  try {
    return await Promise.race([
      (async (): Promise<AddressAutocompleteResult> => {
        const { data, error } = await client.functions.invoke('address-autocomplete', {
          signal: controller.signal,
          body: {
            query,
            countryCode: options?.countryCode ?? 'us',
            limit: options?.limit ?? ADDRESS_SUGGESTION_LIMIT,
          },
        });
        const fromData = resultFromPayload(data);
        if (fromData) return fromData;
        return (await resultFromInvokeError(error)) ?? unavailable;
      })(),
      new Promise<AddressAutocompleteResult>((resolve) => {
        timer = setTimeout(() => {
          controller.abort();
          resolve(unavailable);
        }, REQUEST_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return unavailable;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
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
