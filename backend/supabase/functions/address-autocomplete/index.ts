import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

import {
  fetchGeoapifySuggestions,
  redactAddressAutocompleteError,
  validateAddressAutocompleteRequest,
  type AddressAutocompleteResponse,
} from '../_shared/address-autocomplete.ts';
import { json, requiredEnv } from '../_shared/job-export.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') {
    return json({ status: 'error', error: 'invalid_request' } satisfies AddressAutocompleteResponse, 405, CORS);
  }

  const authorization = request.headers.get('authorization') ?? '';
  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return json({ status: 'error', error: 'unauthorized' } satisfies AddressAutocompleteResponse, 401, CORS);
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return json({ status: 'error', error: 'invalid_request' } satisfies AddressAutocompleteResponse, 422, CORS);
  }

  const validated = validateAddressAutocompleteRequest(parsed);
  if ('status' in validated) {
    return json(validated, 422, CORS);
  }

  const url = requiredEnv('SUPABASE_URL');
  const anonKey = requiredEnv('SUPABASE_ANON_KEY');
  const serviceKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) {
    return json({ status: 'error', error: 'unauthorized' } satisfies AddressAutocompleteResponse, 401, CORS);
  }

  const { data: budgetOk, error: budgetError } = await serviceClient.rpc(
    'consume_address_autocomplete_budget',
    { p_user_id: authData.user.id },
  );
  if (budgetError || budgetOk !== true) {
    return json({ status: 'error', error: 'rate_limited' } satisfies AddressAutocompleteResponse, 429, CORS);
  }

  const apiKey = Deno.env.get('GEOAPIFY_API_KEY');
  if (!apiKey) {
    return json({ status: 'error', error: 'unavailable' } satisfies AddressAutocompleteResponse, 503, CORS);
  }

  try {
    const suggestions = await fetchGeoapifySuggestions(apiKey, validated);
    return json({ status: 'ok', suggestions } satisfies AddressAutocompleteResponse, 200, CORS);
  } catch (error) {
    console.error('address_autocomplete_unavailable', redactAddressAutocompleteError(error));
    return json(
      { status: 'error', error: redactAddressAutocompleteError(error) } satisfies AddressAutocompleteResponse,
      503,
      CORS,
    );
  }
});
