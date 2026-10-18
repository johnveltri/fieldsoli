import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  createLiveSession,
  deleteSession,
  endLiveSession,
  fetchActiveLiveSessionForCurrentUser,
  updateLiveSessionStart,
} from '@fieldsolo/api-client';
import type { ActiveLiveSession } from '@fieldsolo/shared-types';

import { analytics, errorProperties } from '../lib/analytics';
import { clearAnalyticsConsentCache } from '../lib/analytics/consentStorage';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useJobsListInvalidation } from './JobsListInvalidationContext';

/**
 * UI presentation mode for the live session. Decoupled from the wire-state
 * so we can hold a hydrated session in memory while the user is on a
 * different screen with the bar minimized.
 */
type PresentationMode = 'hidden' | 'sheet' | 'minimized' | 'editSheet';

type LiveSessionContextValue = {
  /** Hydrated session row, or `null` when there is no active live session. */
  liveSession: ActiveLiveSession | null;
  /** True only during the initial fetchActive on mount / sign-in. */
  hydrating: boolean;
  /** Convenience flag for screens that want to know "is there a live session at all?". */
  hasLiveSession: boolean;
  /** Current overlay presentation mode. */
  mode: PresentationMode;

  /**
   * Start a new live session for `jobId`. Optimistically opens the sheet on
   * success. Rejects (without opening anything) when:
   *   - Supabase is not configured (dev w/o env vars), or
   *   - There is already an in-progress session — caller should re-fetch via
   *     `refresh()` and surface the existing one.
   *
   * `jobShortDescription` populates the floating bar / counter immediately;
   * pass `job.shortDescription` from the JobDetail view model.
   */
  startLiveSession: (input: {
    jobId: string;
    jobShortDescription: string;
  }) => Promise<ActiveLiveSession>;

  /** Open the full sheet (no-op if no live session). */
  openSheet: () => void;
  /** Switch from full sheet → floating minimized bar (no-op if no live session). */
  minimize: () => void;
  /** Open the Edit Live Session sub-sheet. */
  openEditSheet: () => void;
  /** Close the Edit sheet, returning to the full Live Session sheet. */
  closeEditSheet: () => void;
  /** Switch from Edit sheet straight to minimized (e.g. user swipes the edit sheet down). */
  minimizeFromEdit: () => void;

  /** End the session (sets ended_at, clears local state, returns the ended session for callers that want to navigate). */
  endLiveSessionNow: (input?: { endedAt?: string }) => Promise<ActiveLiveSession | null>;
  /** Update only the start time of the active session (resets the live counter from the new start). */
  updateLiveSessionStartedAt: (input: { startedAt: string }) => Promise<void>;
  /** Hard-delete the active live session (used by the Edit sheet's trash icon). */
  deleteLiveSessionNow: () => Promise<ActiveLiveSession | null>;

  /**
   * Push an updated job description into the active live session's local
   * payload (used by JobDetailScreen after the Edit Job sheet renames the
   * job). No-op when:
   *   - There is no active live session, or
   *   - The active session is for a different job, or
   *   - The new description is identical (avoids unnecessary re-renders).
   *
   * Purely client-side — the source of truth (`public.jobs.short_description`)
   * already reflects the change; this just keeps the floating bar / counter
   * sheet in sync without forcing a `refresh()` round-trip.
   */
  updateLiveSessionJobShortDescription: (input: {
    jobId: string;
    jobShortDescription: string;
  }) => void;

  /**
   * Force a re-fetch of the active live session (e.g. after an external
   * mutation). Returns whether a session was found so callers can branch
   * on the recovery outcome (e.g. surface an explicit error when a 23505
   * is hit but no session belonging to the current user exists).
   */
  refresh: () => Promise<ActiveLiveSession | null>;
};

const LiveSessionContext = createContext<LiveSessionContextValue | null>(null);

type LiveSessionProviderProps = {
  children: ReactNode;
};

/**
 * Owns the global "is there a live session in progress?" state, including:
 *
 *   - Auto-resume on app launch (and on subsequent foreground events) by
 *     calling `fetchActiveLiveSessionForCurrentUser`. If the server-side
 *     midnight job has already ended the row by the time the user returns,
 *     this clears local state cleanly.
 *   - Optimistic UI: starting/ending a session updates local state before
 *     waiting for the network response so the floating bar / counter feels
 *     instant.
 *   - The presentation state machine (`hidden | sheet | minimized | editSheet`)
 *     consumed by `LiveSessionOverlay`.
 *
 * Sign-out clears local state immediately so the next user does not see the
 * previous user's session.
 */
export function LiveSessionProvider({ children }: LiveSessionProviderProps) {
  const { session: authSession, loading: authLoading } = useAuth();
  const { invalidateJobsList } = useJobsListInvalidation();
  const userId = authSession?.user.id ?? null;

  const [liveSession, setLiveSession] = useState<ActiveLiveSession | null>(null);
  const [hydrating, setHydrating] = useState(false);
  const [mode, setMode] = useState<PresentationMode>('hidden');

  /** Idempotent refresh — safe to call from focus, foreground, or after a mutation. */
  const refresh = useCallback<LiveSessionContextValue['refresh']>(async () => {
    if (!isSupabaseConfigured() || !userId) {
      setLiveSession(null);
      setMode('hidden');
      return null;
    }
    try {
      const next = await fetchActiveLiveSessionForCurrentUser(supabase);
      setLiveSession(next);
      setMode((prev) => {
        if (!next) return 'hidden';
        // Auto-open the full sheet on first hydrate (per spec: "if the user
        // closes the app and then reopens, the bottom sheet should
        // immediately open"). On subsequent refreshes (e.g. foregrounding
        // with the bar already minimized) we preserve the user's choice.
        if (prev === 'hidden') return 'sheet';
        return prev;
      });
      return next;
    } catch (err) {
      // Stale-JWT case (typically after a `supabase db reset` wiped
      // auth.users while the device still holds the old token): the auth
      // layer is the right place to handle this, not us. Force a sign-out
      // so the user lands on the SignInScreen and re-authenticates against
      // the fresh database, and SUPPRESS the dev-only red box because it
      // is an expected, recoverable state.
      if (isStaleJwtError(err)) {
        if (analytics.isConsentGranted()) {
          analytics.capture('stale_auth_session_detected', {
            source_operation: 'refresh_live_session',
            recovery_action: 'sign_out',
            ...errorProperties(err),
          });
          analytics.capture('signed_out', { source: 'session_expired' });
        }
        try {
          await supabase.auth.signOut();
        } catch {
          // ignore — local state will clear via onAuthStateChange anyway
        }
        setLiveSession(null);
        setMode('hidden');
        await analytics.onSignOut();
        await clearAnalyticsConsentCache();
        return null;
      }
      // Don't crash the app on other (network / transient) errors — just
      // log and leave whatever is currently in local state alone.
      // Returning null lets callers decide whether to surface a fallback
      // to the user.
      // eslint-disable-next-line no-console
      console.error('[LiveSession] refresh failed', err);
      return null;
    }
  }, [userId]);

  // Auto-resume on sign-in / mount.
  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      setLiveSession(null);
      setMode('hidden');
      return;
    }
    let cancelled = false;
    setHydrating(true);
    void (async () => {
      await refresh();
      if (!cancelled) setHydrating(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, refresh, userId]);

  // Refresh whenever the app comes back to the foreground — covers the
  // server-side midnight job ending the session while the app was
  // backgrounded.
  useEffect(() => {
    const handle = (next: AppStateStatus) => {
      if (next === 'active') void refresh();
    };
    const sub = AppState.addEventListener('change', handle);
    return () => sub.remove();
  }, [refresh]);

  const startLiveSession = useCallback<LiveSessionContextValue['startLiveSession']>(
    async ({ jobId, jobShortDescription }) => {
      if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured — cannot start live visit.');
      }
      const created = await createLiveSession(supabase, {
        jobId,
        jobShortDescription,
      });
      setLiveSession(created);
      setMode('sheet');
      return created;
    },
    [],
  );

  const openSheet = useCallback(() => {
    setMode((prev) => (liveSession ? 'sheet' : prev));
  }, [liveSession]);
  const minimize = useCallback(() => {
    setMode((prev) => (liveSession ? 'minimized' : prev));
  }, [liveSession]);
  const openEditSheet = useCallback(() => {
    setMode((prev) => (liveSession ? 'editSheet' : prev));
  }, [liveSession]);
  const closeEditSheet = useCallback(() => {
    setMode((prev) => (liveSession ? 'sheet' : prev));
  }, [liveSession]);
  const minimizeFromEdit = useCallback(() => {
    setMode((prev) => (liveSession ? 'minimized' : prev));
  }, [liveSession]);

  const endLiveSessionNow = useCallback<
    LiveSessionContextValue['endLiveSessionNow']
  >(
    async (input) => {
      if (!liveSession) return null;
      const ended = liveSession;
      setLiveSession(null);
      setMode('hidden');
      try {
        await endLiveSession(supabase, ended.id, { endedAt: input?.endedAt });
        invalidateJobsList();
      } catch (err) {
        // Restore so the bar reappears and the user can retry.
        setLiveSession(ended);
        setMode('minimized');
        throw err;
      }
      return ended;
    },
    [invalidateJobsList, liveSession],
  );

  const updateLiveSessionStartedAt = useCallback<
    LiveSessionContextValue['updateLiveSessionStartedAt']
  >(
    async ({ startedAt }) => {
      if (!liveSession) return;
      const previous = liveSession;
      const optimistic: ActiveLiveSession = { ...previous, startedAt };
      setLiveSession(optimistic);
      try {
        await updateLiveSessionStart(supabase, previous.id, { startedAt });
      } catch (err) {
        setLiveSession(previous);
        throw err;
      }
    },
    [liveSession],
  );

  const updateLiveSessionJobShortDescription = useCallback<
    LiveSessionContextValue['updateLiveSessionJobShortDescription']
  >(({ jobId, jobShortDescription }) => {
    setLiveSession((prev) => {
      if (!prev) return prev;
      if (prev.jobId !== jobId) return prev;
      if (prev.jobShortDescription === jobShortDescription) return prev;
      return { ...prev, jobShortDescription };
    });
  }, []);

  const deleteLiveSessionNow = useCallback<
    LiveSessionContextValue['deleteLiveSessionNow']
  >(async () => {
    if (!liveSession) return null;
    const deleted = liveSession;
    setLiveSession(null);
    setMode('hidden');
    try {
      await deleteSession(supabase, deleted.id);
      invalidateJobsList();
    } catch (err) {
      setLiveSession(deleted);
      setMode('minimized');
      throw err;
    }
    return deleted;
  }, [invalidateJobsList, liveSession]);

  const value = useMemo<LiveSessionContextValue>(
    () => ({
      liveSession,
      hydrating,
      hasLiveSession: !!liveSession,
      mode,
      startLiveSession,
      openSheet,
      minimize,
      openEditSheet,
      closeEditSheet,
      minimizeFromEdit,
      endLiveSessionNow,
      updateLiveSessionStartedAt,
      deleteLiveSessionNow,
      updateLiveSessionJobShortDescription,
      refresh,
    }),
    [
      closeEditSheet,
      deleteLiveSessionNow,
      endLiveSessionNow,
      hydrating,
      liveSession,
      minimize,
      minimizeFromEdit,
      mode,
      openEditSheet,
      openSheet,
      refresh,
      startLiveSession,
      updateLiveSessionJobShortDescription,
      updateLiveSessionStartedAt,
    ],
  );

  return (
    <LiveSessionContext.Provider value={value}>{children}</LiveSessionContext.Provider>
  );
}

export function useLiveSession(): LiveSessionContextValue {
  const ctx = useContext(LiveSessionContext);
  if (!ctx) {
    throw new Error('useLiveSession must be used within LiveSessionProvider');
  }
  return ctx;
}

/**
 * Hook for components that only need to know whether to suppress their
 * own floating UI (e.g. JobsScreen's FAB). Avoids a re-render every second
 * for callers that don't care about the timer.
 */
export function useHasLiveSession(): boolean {
  return useLiveSession().hasLiveSession;
}

/**
 * Detects Supabase auth errors that indicate the device's cached JWT no
 * longer matches a real auth.users row — typically after a local
 * `supabase db reset`, but also covers expired/revoked/garbage tokens.
 * The right recovery is always "drop the session and re-sign-in", so the
 * caller should `supabase.auth.signOut()` rather than retry.
 */
export function isStaleJwtError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: unknown; status?: unknown; message?: unknown };
  const name = typeof e.name === 'string' ? e.name : '';
  const status = typeof e.status === 'number' ? e.status : 0;
  const message = typeof e.message === 'string' ? e.message : '';
  if (name === 'AuthApiError' && (status === 401 || status === 403)) return true;
  // Belt-and-suspenders text matches for the messages we have actually seen
  // surface from supabase-js. Keep these conservative — false positives here
  // would log the user out unexpectedly.
  if (/JWT/i.test(message) && /(expired|invalid|sub claim)/i.test(message)) {
    return true;
  }
  if (/User from sub claim in JWT does not exist/i.test(message)) return true;
  return false;
}
