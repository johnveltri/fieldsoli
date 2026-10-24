export type AddressAutocompleteRequest = {
  query: string;
  countryCode: 'us';
  limit: number;
  proximity?: AddressProximity;
};

export type AddressProximity = { latitude: number; longitude: number };
export type BusinessProximityRequest = { action: 'resolve_business_proximity' };

export function roundedProximity(input: unknown): AddressProximity | null {
  if (!input || typeof input !== 'object') return null;
  const { latitude, longitude } = input as Record<string, unknown>;
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || Math.abs(latitude) > 90
    || typeof longitude !== 'number' || !Number.isFinite(longitude) || Math.abs(longitude) > 180) return null;
  return { latitude: Math.round(latitude * 100) / 100, longitude: Math.round(longitude * 100) / 100 };
}

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
const MAX_LIMIT = 4;
const UPSTREAM_TIMEOUT_MS = 12000;

export function validateAddressAutocompleteRequest(
  input: unknown,
): AddressAutocompleteRequest | BusinessProximityRequest | AddressAutocompleteResponse {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { status: 'error', error: 'invalid_request' };
  }
  const body = input as Record<string, unknown>;
  if (body.action === 'resolve_business_proximity') {
    if (Object.keys(body).some((key) => key !== 'action')) {
      return { status: 'error', error: 'invalid_request' };
    }
    return { action: 'resolve_business_proximity' };
  }
  if (body.action !== undefined) return { status: 'error', error: 'invalid_request' };
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
  const proximity = body.proximity === undefined ? undefined : roundedProximity(body.proximity);
  if (proximity === null) return { status: 'error', error: 'invalid_request' };
  return { query, countryCode: 'us', limit, ...(proximity ? { proximity } : {}) };
}

type GeoapifyAddressFields = {
  formatted?: string;
  address_line1?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country_code?: string;
};

type GeoapifyFeature = {
  properties?: GeoapifyAddressFields;
};

type GeoapifyResult = GeoapifyAddressFields;

function stripUsCountrySuffix(formatted: string): string {
  return formatted
    .replace(/,\s*United States of America$/i, '')
    .replace(/,\s*USA$/i, '')
    .trim();
}

function mapGeoapifyAddressFields(
  fields: GeoapifyAddressFields | undefined,
  index: number,
): AddressSuggestion | null {
  const formatted = fields?.formatted?.trim();
  if (!formatted) return null;
  const displayAddress = stripUsCountrySuffix(formatted);
  if (!displayAddress) return null;
  return {
    token: `g${index}`,
    displayAddress,
    addressLine1: fields?.address_line1 ?? undefined,
    city: fields?.city ?? undefined,
    region: fields?.state ?? undefined,
    postalCode: fields?.postcode ?? undefined,
    countryCode: fields?.country_code?.toLowerCase() ?? undefined,
  };
}

export function mapGeoapifyFeatures(
  features: GeoapifyFeature[],
  limit: number,
): AddressSuggestion[] {
  const suggestions: AddressSuggestion[] = [];
  for (let index = 0; index < features.length && suggestions.length < limit; index += 1) {
    const mapped = mapGeoapifyAddressFields(features[index]?.properties, index);
    if (mapped) suggestions.push(mapped);
  }
  return suggestions;
}

export function mapGeoapifyResults(
  results: GeoapifyResult[],
  limit: number,
): AddressSuggestion[] {
  const suggestions: AddressSuggestion[] = [];
  for (let index = 0; index < results.length && suggestions.length < limit; index += 1) {
    const mapped = mapGeoapifyAddressFields(results[index], index);
    if (mapped) suggestions.push(mapped);
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
  if (request.proximity) {
    url.searchParams.set('bias', `proximity:${request.proximity.longitude},${request.proximity.latitude}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`geoapify_status_${response.status}`);
    }
    const payload = await response.json() as {
      features?: GeoapifyFeature[];
      results?: GeoapifyResult[];
    };
    if (Array.isArray(payload.results) && payload.results.length > 0) {
      return mapGeoapifyResults(payload.results, request.limit);
    }
    return mapGeoapifyFeatures(payload.features ?? [], request.limit);
  } finally {
    clearTimeout(timeout);
  }
}

type GeocodedBusiness = {
  lat?: number;
  lon?: number;
  result_type?: string;
  rank?: { confidence?: number };
};

export function businessProximityFromResults(results: GeocodedBusiness[]): AddressProximity | null {
  const points = results
    .filter((result) => (result.rank?.confidence ?? 0) >= 0.9
      && ['building', 'street', 'postcode', 'city'].includes(result.result_type ?? ''))
    .map((result) => roundedProximity({ latitude: result.lat, longitude: result.lon }))
    .filter((point): point is AddressProximity => point !== null);
  if (!points.length) return null;
  const first = points[0];
  return points.every((point) => point.latitude === first.latitude && point.longitude === first.longitude)
    ? first : null;
}

export async function fetchBusinessAddressProximity(
  apiKey: string,
  address: string,
): Promise<AddressProximity | null> {
  const url = new URL('https://api.geoapify.com/v1/geocode/search');
  url.searchParams.set('text', address);
  url.searchParams.set('format', 'json');
  url.searchParams.set('filter', 'countrycode:us');
  url.searchParams.set('limit', '2');
  url.searchParams.set('apiKey', apiKey);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) throw new Error(`geoapify_status_${response.status}`);
    const payload = await response.json() as { results?: GeocodedBusiness[] };
    return businessProximityFromResults(Array.isArray(payload.results) ? payload.results : []);
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

/** Safe operational diagnostics; never return upstream text, query, URL or key. */
export function addressAutocompleteFailureReason(error: unknown): string {
  if (!(error instanceof Error)) return 'unknown';
  if (error.name === 'AbortError' || error.name === 'TimeoutError') return 'provider_timeout';
  if (/^geoapify_status_(401|403)$/.test(error.message)) return 'provider_auth';
  if (error.message === 'geoapify_status_429') return 'provider_rate_limited';
  if (/^geoapify_status_\d{3}$/.test(error.message)) return 'provider_http_error';
  if (error instanceof TypeError) return 'provider_network';
  return 'unknown';
}
