import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { AuthError, Session, User } from '@supabase/supabase-js';
import {
  deleteCurrentAccount,
  updateCurrentUserPassword,
} from '@fieldsolo/api-client';

import { analytics, errorProperties } from '../lib/analytics';
import { clearAnalyticsConsentCache } from '../lib/analytics/consentStorage';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { AUTH_CONFIRM_URL, AUTH_RESET_PASSWORD_URL } from '../lib/authUrls';
import { newPasswordPolicyError } from '../lib/passwordPolicy';
import { observeAddressLocationLifecycle, setAddressLocationAccount } from '../lib/addressLocation';

export type SignUpProfileSeed = {
  firstName: string;
  lastName: string;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** True while signup is finishing legal acceptance writes (blocks main shell). */
  signupLegalPending: boolean;
  setSignupLegalPending: (pending: boolean) => void;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: AuthError | null; session: Session | null }>;
  /**
   * Creates a new auth.users row. When `profile` is provided, first / last
   * name are written to `raw_user_meta_data`, which the `handle_new_user`
   * trigger reads to seed the matching `public.profiles` row. The same
   * Supabase signUp call also creates the user's session in dev (email
   * confirmations disabled), so a follow-up sign-in is usually unnecessary.
   */
  signUp: (
    email: string,
    password: string,
    profile?: SignUpProfileSeed,
  ) => Promise<{ error: Error | null; session: Session | null }>;
  signOut: () => Promise<void>;
  /** Sends a password recovery email (anti-enumeration: always treat as success in UI). */
  requestPasswordReset: (email: string) => Promise<{ error: Error | null }>;
  /** Wraps `auth.updateUser({ password })`. Throws on failure. */
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  /**
   * Calls the `delete-account` Edge Function. On success the local session
   * is signed out so `AuthenticatedShell` reroutes to the sign-in screen.
   */
  deleteAccount: () => Promise<{ error: Error | null }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  useEffect(observeAddressLocationLifecycle, []);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [signupLegalPending, setSignupLegalPending] = useState(false);
  const signedOutCleanupRef = useRef<Promise<void> | null>(null);
  const signedOutAnalyticsClearedRef = useRef(false);

  const clearSignedOutAnalyticsState = useCallback(() => {
    if (signedOutAnalyticsClearedRef.current) {
      return signedOutCleanupRef.current ?? Promise.resolve();
    }
    if (signedOutCleanupRef.current) return signedOutCleanupRef.current;

    signedOutAnalyticsClearedRef.current = true;
    const cleanup = Promise.allSettled([analytics.onSignOut(), clearAnalyticsConsentCache()]).then(
      () => undefined,
    );
    signedOutCleanupRef.current = cleanup;
    void cleanup.finally(() => {
      if (signedOutCleanupRef.current === cleanup) {
        signedOutCleanupRef.current = null;
      }
    });
    return cleanup;
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    let mounted = true;

    void supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        if (mounted) {
          setAddressLocationAccount(s?.user.id ?? null);
          setSession(s);
          if (s === null) {
            void clearSignedOutAnalyticsState();
          } else {
            signedOutAnalyticsClearedRef.current = false;
          }
        }
      })
      .catch(() => {
        if (mounted) {
          setAddressLocationAccount(null);
          setSession(null);
          void clearSignedOutAnalyticsState();
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!mounted) return;
      setAddressLocationAccount(next?.user.id ?? null);
      setSession(next);
      if (next === null) {
        void clearSignedOutAnalyticsState();
      } else {
        signedOutAnalyticsClearedRef.current = false;
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [clearSignedOutAnalyticsState]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signupLegalPending,
      setSignupLegalPending,
      signIn: async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        return { error, session: data.session };
      },
      signUp: async (email, password, profile) => {
        const policyError = newPasswordPolicyError(password);
        if (policyError) return { error: new Error(policyError), session: null };
        const signUpOptions: {
          emailRedirectTo: string;
          data?: { first_name: string; last_name: string };
        } = {
          emailRedirectTo: AUTH_CONFIRM_URL,
        };
        if (profile) {
          signUpOptions.data = {
            first_name: profile.firstName.trim(),
            last_name: profile.lastName.trim(),
          };
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: signUpOptions,
        });
        return { error, session: data.session };
      },
      signOut: async () => {
        if (analytics.isConsentGranted()) {
          analytics.capture('signed_out', { source: 'manual' });
        }
        await supabase.auth.signOut();
        await clearSignedOutAnalyticsState();
      },
      requestPasswordReset: async (email) => {
        const trimmed = email.trim().toLowerCase();
        const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
          redirectTo: AUTH_RESET_PASSWORD_URL,
        });
        return {
          error: error ? new Error(error.message) : null,
        };
      },
      updatePassword: async (newPassword) => {
        const policyError = newPasswordPolicyError(newPassword);
        if (policyError) return { error: new Error(policyError) };
        try {
          await updateCurrentUserPassword(supabase, newPassword);
          return { error: null };
        } catch (e) {
          return {
            error:
              e instanceof Error
                ? e
                : new Error(typeof e === 'string' ? e : 'Could not update password.'),
          };
        }
      },
      deleteAccount: async () => {
        try {
          await deleteCurrentAccount(supabase);
          if (analytics.isConsentGranted()) {
            analytics.capture('account_delete_succeeded', { source: 'profile' });
          }
          await supabase.auth.signOut();
          await clearSignedOutAnalyticsState();
          return { error: null };
        } catch (e) {
          if (analytics.isConsentGranted()) {
            analytics.capture('account_delete_failed', {
              source: 'profile',
              ...errorProperties(e),
            });
          }
          return {
            error:
              e instanceof Error
                ? e
                : new Error(typeof e === 'string' ? e : 'Could not delete account.'),
          };
        }
      },
    }),
    [clearSignedOutAnalyticsState, session, loading, signupLegalPending],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
