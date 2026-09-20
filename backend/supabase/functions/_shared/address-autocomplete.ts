export type AddressAutocompleteRequest = {
  query: string;
  countryCode: 'us';
  limit: number;
};

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

export type AddressAutocompleteResponse =
  | { status: 'ok'; suggestions: AddressSuggestion[] }
  | { status: 'error'; error: AddressAutocompleteErrorCode };

const MAX_QUERY_LENGTH = 120;
const MIN_QUERY_LENGTH = 5;
const MAX_LIMIT = 5;
const UPSTREAM_TIMEOUT_MS = 2500;

export function validateAddressAutocompleteRequest(
  input: unknown,
): AddressAutocompleteRequest | AddressAutocompleteResponse {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { status: 'error', error: 'invalid_request' };
  }
  const body = input as Record<string, unknown>;
  if (body.countryCode !== 'us') {
    return { status: 'error', error: 'invalid_request' };
  }
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  const limit = typeof body.limit === 'number' ? body.limit : NaN;
  if (query.length < MIN_QUERY_LENGTH || query.length > MAX_QUERY_LENGTH) {
    return { status: 'error', error: 'invalid_request' };
  }
  const letters = query.match(/[A-Za-z]/g);
  if ((letters?.length ?? 0) < 2) {
    return { status: 'error', error: 'invalid_request' };
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return { status: 'error', error: 'invalid_request' };
  }
  return { query, countryCode: 'us', limit };
}

type GeoapifyFeature = {
  properties?: {
    formatted?: string;
    address_line1?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country_code?: string;
  };
};

export function mapGeoapifyFeatures(
  features: GeoapifyFeature[],
  limit: number,
): AddressSuggestion[] {
  const suggestions: AddressSuggestion[] = [];
  for (let index = 0; index < features.length && suggestions.length < limit; index += 1) {
    const props = features[index]?.properties;
    const displayAddress = props?.formatted?.trim();
    if (!displayAddress) continue;
    suggestions.push({
      token: `g${index}`,
      displayAddress,
      addressLine1: props?.address_line1 ?? undefined,
      city: props?.city ?? undefined,
      region: props?.state ?? undefined,
      postalCode: props?.postcode ?? undefined,
      countryCode: props?.country_code?.toLowerCase() ?? undefined,
    });
  }
  return suggestions;
}

export async function fetchGeoapifySuggestions(
  apiKey: string,
  request: AddressAutocompleteRequest,
): Promise<AddressSuggestion[]> {
  const url = new URL('https://api.geoapify.com/v1/geocode/autocomplete');
  url.searchParams.set('text', request.query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('filter', `countrycode:${request.countryCode}`);
  url.searchParams.set('limit', String(request.limit));
  url.searchParams.set('apiKey', apiKey);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`geoapify_status_${response.status}`);
    }
    const payload = await response.json() as { features?: GeoapifyFeature[] };
    return mapGeoapifyFeatures(payload.features ?? [], request.limit);
  } finally {
    clearTimeout(timeout);
  }
}

export function redactAddressAutocompleteError(error: unknown): AddressAutocompleteErrorCode {
  if (error instanceof Error && error.message.includes('geoapify_status_429')) {
    return 'rate_limited';
  }
  return 'unavailable';
}
