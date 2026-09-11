import type { ActiveLiveSession, JobId } from '@fieldsolo/shared-types';

import type { FieldSoloSupabaseClient } from './client';
import { tryBumpJobToInProgressIfNotStarted } from './jobs';
import type { SessionId } from './sessions';

export type CreateLiveSessionInput = {
  jobId: JobId;
  /**
   * Job description for the floating bar / live counter UI. Passed in by the
   * caller (which already has it in hand) so the INSERT round-trip stays a
   * simple `select('id')` rather than an embedded join — embeds were
   * dropping the row on some Supabase configurations.
   */
  jobShortDescription: string;
  /** ISO 8601 timestamp the session started. Defaults to `new Date().toISOString()`. */
  startedAt?: string;
  /**
   * IANA timezone of the device at start (e.g. `"America/Chicago"`). Used by the
   * server-side auto-end-at-midnight job to anchor the cutoff at the user's
   * local 23:59:59. Defaults to `Intl.DateTimeFormat().resolvedOptions().timeZone`.
   */
  startedTz?: string;
};

type LiveSessionRowWithJob = {
  id: string;
  job_id: string;
  started_at: string;
  started_tz: string | null;
  jobs: { short_description: string } | { short_description: string }[] | null;
};

function deviceTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && typeof tz === 'string' && tz.length > 0 ? tz : 'UTC';
  } catch {
    return 'UTC';
  }
}

function pickJobShortDescription(
  jobs: LiveSessionRowWithJob['jobs'],
): string {
  if (!jobs) return '';
  if (Array.isArray(jobs)) {
    return jobs[0]?.short_description ?? '';
  }
  return jobs.short_description ?? '';
}

/**
 * Starts a new "live" (in-progress) session for the given job and returns the
 * full active-session payload (so callers can hydrate the floating bar /
 * bottom sheet without a follow-up fetch).
 *
 * Server enforces one in-progress session per user via
 * `sessions_one_active_per_user_idx` — a duplicate insert raises
 * `23505 (unique_violation)`. Callers should treat that as "you already have
 * a live session, refetch and surface it" rather than a hard failure.
 *
 * The optional `started_tz` column is set when present in the schema. If the
 * column is missing (e.g. local DB has not been reset to apply the
 * 20260425120000_live_sessions migration), the function transparently retries
 * without it so the live session still starts and the timezone column
 * back-fills the next time the migration runs.
 */
export async function createLiveSession(
  client: FieldSoloSupabaseClient,
  input: CreateLiveSessionInput,
): Promise<ActiveLiveSession> {
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  const userId = authData.user?.id;
  if (!userId) {
    throw new Error('No authenticated user available to start a live session.');
  }

  const startedAt = input.startedAt ?? new Date().toISOString();
  const startedTz = input.startedTz ?? deviceTimezone();

  // Insert + select 'id' — minimal payload that mirrors createManualSession.
  // The hydrated payload is built locally from the inputs so we don't depend
  // on PostgREST's INSERT...RETURNING + relationship embed semantics, which
  // were intermittently dropping the joined row.
  let inserted = await client
    .from('sessions')
    .insert({
      job_id: input.jobId,
      user_id: userId,
      entry_mode: 'live',
      session_status: 'in_progress',
      started_at: startedAt,
      started_tz: startedTz,
      // Live timer start is a real clock — Job Detail View shows it.
      clock_start_explicit: true,
      clock_times_explicit: true,
      calendar_date_explicit: true,
    })
    .select('id')
    .single();

  // Soft-fallback when the migration has not yet been applied — the
  // database returns SQLSTATE 42703 ("undefined_column") on an unknown
  // started_tz. Retry without that column so the live session still starts
  // (the column will back-fill once the migration is run).
  if (
    inserted.error &&
    typeof inserted.error.message === 'string' &&
    /started_tz/i.test(inserted.error.message)
  ) {
    inserted = await client
      .from('sessions')
      .insert({
        job_id: input.jobId,
        user_id: userId,
        entry_mode: 'live',
        session_status: 'in_progress',
        started_at: startedAt,
        clock_start_explicit: true,
        clock_times_explicit: true,
        calendar_date_explicit: true,
      })
      .select('id')
      .single();
  }

  if (inserted.error) throw inserted.error;
  const row = inserted.data as { id: string };

  await tryBumpJobToInProgressIfNotStarted(client, input.jobId);

  return {
    id: row.id,
    jobId: input.jobId,
    startedAt,
    startedTz,
    jobShortDescription: input.jobShortDescription,
  };
}

/**
 * Returns the current user's active live session (if any) — used on app
 * launch / foreground to auto-restore the floating bar.
 *
 * Returns `null` when there is no in-progress session, or when the previously
 * active session was auto-ended by the server-side midnight job between the
 * last open and now.
 *
 * Like `createLiveSession`, this function transparently retries without the
 * optional `started_tz` column when the database has not yet had the
 * 20260425120000_live_sessions migration applied. The `startedTz` value
 * falls back to the device timezone in that case.
 */
export async function fetchActiveLiveSessionForCurrentUser(
  client: FieldSoloSupabaseClient,
): Promise<ActiveLiveSession | null> {
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  const userId = authData.user?.id;
  if (!userId) return null;

  let result = await client
    .from('sessions')
    .select(
      'id, job_id, started_at, started_tz, jobs!sessions_job_owner_fkey(short_description)',
    )
    .eq('user_id', userId)
    .eq('session_status', 'in_progress')
    .is('deleted_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Soft-fallback: dev DB hasn't been reset to apply the new migration yet
  // (missing `started_tz` column → SQLSTATE 42703). Re-query without it so
  // the active live session still hydrates and the floating bar / sheet
  // can come back. The timezone falls back to the device's local zone.
  if (
    result.error &&
    typeof result.error.message === 'string' &&
    /started_tz/i.test(result.error.message)
  ) {
    result = await client
      .from('sessions')
      .select('id, job_id, started_at, jobs!sessions_job_owner_fkey(short_description)')
      .eq('user_id', userId)
      .eq('session_status', 'in_progress')
      .is('deleted_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
  }

  if (result.error) throw result.error;
  if (!result.data) return null;
  const row = result.data as unknown as LiveSessionRowWithJob;

  return {
    id: row.id,
    jobId: row.job_id,
    startedAt: row.started_at,
    startedTz: row.started_tz ?? deviceTimezone(),
    jobShortDescription: pickJobShortDescription(row.jobs),
  };
}

export type EndLiveSessionInput = {
  /** ISO 8601 timestamp. Defaults to `new Date().toISOString()`. */
  endedAt?: string;
};

/**
 * Ends a live (in-progress) session by transitioning it to `ended` with an
 * `ended_at` timestamp. No-ops if the session is already ended/deleted (the
 * server-side midnight job may have ended it first).
 */
export async function endLiveSession(
  client: FieldSoloSupabaseClient,
  sessionId: SessionId,
  input: EndLiveSessionInput = {},
): Promise<void> {
  const endedAt = input.endedAt ?? new Date().toISOString();

  const { data, error } = await client
    .from('sessions')
    .update({
      session_status: 'ended',
      ended_at: endedAt,
      // Ending a live timer stamps a real end clock for Job Detail View.
      clock_end_explicit: true,
      clock_times_explicit: true,
    })
    .eq('id', sessionId)
    .eq('session_status', 'in_progress')
    .select('id')
    .maybeSingle();

  if (error) throw error;
  // No row updated when the session was already ended/deleted — treat as
  // success because the caller's intent (the live session is now over) holds.
  if (!data) return;
}

export type UpdateLiveSessionStartInput = {
  /** ISO 8601 timestamp. */
  startedAt: string;
};

/**
 * Updates only the `started_at` of an active live session — used by the
 * Edit Live Session sheet's "Save Changes (without end time)" path so the
 * counter resumes from the new start.
 *
 * Status remains `in_progress`; date can shift backward / forward but the
 * `sessions_end_after_start_check` constraint does not apply (ended_at is
 * still null).
 */
export async function updateLiveSessionStart(
  client: FieldSoloSupabaseClient,
  sessionId: SessionId,
  input: UpdateLiveSessionStartInput,
): Promise<void> {
  const t = new Date(input.startedAt).getTime();
  if (!Number.isFinite(t)) {
    throw new Error('startedAt must be a valid ISO timestamp.');
  }

  const { data, error } = await client
    .from('sessions')
    .update({
      started_at: input.startedAt,
      clock_start_explicit: true,
      clock_times_explicit: true,
      calendar_date_explicit: true,
    })
    .eq('id', sessionId)
    .eq('session_status', 'in_progress')
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error(
      'Update affected no in-progress rows (session may have ended already).',
    );
  }
}
