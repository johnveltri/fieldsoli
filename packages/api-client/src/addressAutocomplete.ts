import type { FieldSoloSupabaseClient } from './client';

export const ADDRESS_SUGGESTION_LIMIT = 4;
export type AddressProximity = { latitude: number; longitude: number };
// Allow the authenticated Edge hop and its bounded 12-second provider lookup.
const REQUEST_TIMEOUT_MS = 18000;

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
  options?: { countryCode?: 'us'; limit?: number; proximity?: AddressProximity },
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
            ...(options?.proximity ? { proximity: options.proximity } : {}),
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

/** Resolves only the authenticated user's saved business address on the server. */
export async function resolveBusinessProximity(
  client: FieldSoloSupabaseClient,
): Promise<AddressProximity | null> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const { data, error } = await client.functions.invoke('address-autocomplete', {
          signal: controller.signal,
          body: { action: 'resolve_business_proximity' },
        });
        const point = data?.proximity;
        if (error || data?.status !== 'ok' || !point
          || typeof point.latitude !== 'number' || !Number.isFinite(point.latitude)
          || Math.abs(point.latitude) > 90
          || typeof point.longitude !== 'number' || !Number.isFinite(point.longitude)
          || Math.abs(point.longitude) > 180) return null;
        return {
          latitude: Math.round(point.latitude * 100) / 100,
          longitude: Math.round(point.longitude * 100) / 100,
        };
      })(),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => { controller.abort(); resolve(null); }, REQUEST_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return null;
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
