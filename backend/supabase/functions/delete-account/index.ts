// Edge Function: delete the currently-authenticated user.
//
// The Supabase JS client cannot directly call `auth.admin.deleteUser` because
// that endpoint requires the service-role key. This function:
//   1. Reads the caller's JWT from the Authorization header.
//   2. Resolves the user via the anon-key client.
//   3. Best-effort: queues PostHog person/event deletion when configured.
//   4. Uses a service-role client to call `auth.admin.deleteUser(user.id)`.
//
// Cascade FKs on `public.profiles` (this migration), and on `jobs` /
// `sessions` / `notes` / `material_entries` / `attachments` /
// `job_activity_events` (existing migrations) clean up all related rows.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

import { buildExportDeletionPlan } from '../_shared/job-export-deletion.ts';
import { queuePostHogPersonDeletion } from './posthog.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return jsonResponse({ error: 'server_misconfigured' }, 500);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return jsonResponse({ error: 'missing_bearer_token' }, 401);
  }

  // Resolve the caller using their JWT (anon-key client + Authorization header).
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonResponse(
      { error: 'invalid_token', detail: userErr?.message ?? null },
      401,
    );
  }

  const userId = userData.user.id;

  const posthogResult = await queuePostHogPersonDeletion(userId);
  if (posthogResult.status === 'failed') {
    console.warn(
      '[delete-account] PostHog deletion request failed:',
      posthogResult.detail,
    );
  }

  // Service-role client for the privileged delete.
  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Export artifacts are intentionally private and are not covered by the
  // database FK cascade. Revoke every request before inspecting Storage so a
  // claimed worker sees the revocation before it can publish new state.
  const revokedAt = new Date().toISOString();
  const { error: revokeErr } = await adminClient
    .from('job_export_requests')
    .update({ delivery_state: 'revoked', token_hash: null, expires_at: revokedAt })
    .eq('user_id', userId);
  if (revokeErr) {
    return jsonResponse({ error: 'export_cleanup_failed' }, 500);
  }

  const { data: exportRows, error: exportsErr } = await adminClient
    .from('job_export_requests')
    .select('id, object_path, generation_state')
    .eq('user_id', userId);
  if (exportsErr) {
    return jsonResponse({ error: 'export_cleanup_failed' }, 500);
  }

  const plan = buildExportDeletionPlan(userId, exportRows ?? []);
  if (plan.generationInFlight) {
    // The worker will observe delivery_state=revoked, remove any upload, and
    // leave generation_state=deleted. Retrying account deletion is then safe.
    return jsonResponse({ error: 'export_cleanup_pending' }, 409);
  }

  if (plan.objectPaths.length > 0) {
    const { error: removeErr } = await adminClient.storage.from('job-exports').remove(plan.objectPaths);
    if (removeErr && !/not found|does not exist|404/i.test(removeErr.message ?? '')) {
      return jsonResponse({ error: 'export_cleanup_failed' }, 500);
    }
  }

  const { error: documentLinkErr } = await userClient.rpc('revoke_owner_document_links');
  if (documentLinkErr) {
    return jsonResponse({ error: 'export_cleanup_failed' }, 500);
  }

  const { error: deleteErr } = await adminClient.auth.admin.deleteUser(userId);
  if (deleteErr) {
    return jsonResponse(
      { error: 'delete_failed', detail: deleteErr.message },
      500,
    );
  }

  return jsonResponse({ ok: true }, 200);
});
