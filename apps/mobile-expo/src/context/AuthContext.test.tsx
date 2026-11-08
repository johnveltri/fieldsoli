import { clearPendingSignup, readPendingSignup, savePendingSignup } from '../lib/pendingSignup';
import type { Session } from '@supabase/supabase-js';
import { act, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Text } from 'react-native';

import { AuthProvider, useAuth } from './AuthContext';

const mockGetSession = jest.fn<() => Promise<{ data: { session: Session | null } }>>();
const mockSignOut = jest.fn<() => Promise<void>>(async () => undefined);
const mockUnsubscribe = jest.fn();
const mockAnalyticsOnSignOut = jest.fn<() => Promise<void>>(async () => undefined);
const mockClearAnalyticsConsentCache = jest.fn<() => Promise<void>>(async () => undefined);
const mockWithdrawAnalytics = jest.fn<() => Promise<void>>(async () => undefined);
const mockDeleteAccount = jest.fn<() => Promise<void>>(async () => undefined);
const mockCommitPasswordAutofill = jest.fn<() => Promise<void>>(async () => undefined);
const mockSignInWithPassword = jest.fn<() => Promise<{
  data: { session: Session | null };
  error: Error | null;
}>>();
let mockAuthStateChange: ((event: string, session: Session | null) => void) | null = null;

jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: (callback: (event: string, session: Session | null) => void) => {
        mockAuthStateChange = callback;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      },
      signOut: () => mockSignOut(),
      signInWithPassword: () => mockSignInWithPassword(),
    },
  },
}));

jest.mock('../lib/passwordAutofill', () => ({
  commitPasswordAutofill: () => mockCommitPasswordAutofill(),
}));

jest.mock('../lib/analytics', () => ({
  analytics: {
    capture: jest.fn(),
    isConsentGranted: () => false,
    onSignOut: () => mockAnalyticsOnSignOut(),
    withdrawConsent: () => mockWithdrawAnalytics(),
  },
  errorProperties: () => ({}),
}));

jest.mock('../lib/analytics/consentStorage', () => ({
  clearAnalyticsConsentCache: () => mockClearAnalyticsConsentCache(),
}));

jest.mock('@fieldsolo/api-client', () => ({
  deleteCurrentAccount: () => mockDeleteAccount(),
  updateCurrentUserPassword: jest.fn(),
}));

const signedInSession = {
  user: { id: 'user-1' },
} as Session;

function SessionState() {
  const { session } = useAuth();
  return <Text>{session ? 'signed in' : 'signed out'}</Text>;
}

let deleteAccount!: ReturnType<typeof useAuth>['deleteAccount'];
let signIn!: ReturnType<typeof useAuth>['signIn'];
function DeletionHarness() {
  const auth = useAuth();
  deleteAccount = auth.deleteAccount;
  signIn = auth.signIn;
  return <Text>{auth.session ? 'ready' : 'out'}</Text>;
}

describe('AuthProvider', () => {
  beforeEach(async () => {
    await clearPendingSignup();
    jest.clearAllMocks();
    mockAuthStateChange = null;
    mockGetSession.mockResolvedValue({ data: { session: signedInSession } });
    mockSignInWithPassword.mockResolvedValue({ data: { session: signedInSession }, error: null });
  });

  it('finishes Android autofill only after successful password sign-in', async () => {
    const screen = render(<AuthProvider><DeletionHarness /></AuthProvider>);
    await screen.findByText('ready');

    await act(async () => { await signIn('tech@example.com', 'Password123!'); });
    expect(mockCommitPasswordAutofill).toHaveBeenCalledTimes(1);

    mockSignInWithPassword.mockResolvedValueOnce({
      data: { session: null },
      error: new Error('Invalid login credentials'),
    });
    await act(async () => { await signIn('tech@example.com', 'wrong'); });
    expect(mockCommitPasswordAutofill).toHaveBeenCalledTimes(1);
  });

  it('clears local analytics before remote account deletion and sign-out', async () => {
    const screen = render(<AuthProvider><DeletionHarness /></AuthProvider>);
    await screen.findByText('ready');
    await act(async () => { await deleteAccount(); });
    expect(mockWithdrawAnalytics.mock.invocationCallOrder[0]).toBeLessThan(mockDeleteAccount.mock.invocationCallOrder[0]);
    expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
    expect(mockWithdrawAnalytics).toHaveBeenCalledTimes(1);
    expect(mockWithdrawAnalytics.mock.invocationCallOrder[0]).toBeLessThan(mockSignOut.mock.invocationCallOrder[0]);
  });

  it('clears analytics identity and cached consent after an automatic sign-out', async () => {
    const screen = render(
      <AuthProvider>
        <SessionState />
      </AuthProvider>,
    );

    await screen.findByText('signed in');
    expect(mockAnalyticsOnSignOut).not.toHaveBeenCalled();
    expect(mockClearAnalyticsConsentCache).not.toHaveBeenCalled();

    act(() => {
      mockAuthStateChange?.('SIGNED_OUT', null);
    });

    await waitFor(() => {
      expect(screen.getByText('signed out')).toBeTruthy();
      expect(mockAnalyticsOnSignOut).toHaveBeenCalledTimes(1);
      expect(mockClearAnalyticsConsentCache).toHaveBeenCalledTimes(1);
    });
  });
  it('clears the signup navigation hint when an existing session is restored', async () => {
    await savePendingSignup('pending@example.com');
    const screen = render(<AuthProvider><SessionState /></AuthProvider>);
    await screen.findByText('signed in');
    await expect(readPendingSignup()).resolves.toBeNull();
  });

  it('keeps pending verification while signed out and clears it on authentication', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });
    await savePendingSignup('pending@example.com');
    const screen = render(<AuthProvider><SessionState /></AuthProvider>);
    await act(async () => {});
    await expect(readPendingSignup()).resolves.toBe('pending@example.com');
    act(() => { mockAuthStateChange?.('SIGNED_IN', signedInSession); });
    await screen.findByText('signed in');
    await expect(readPendingSignup()).resolves.toBeNull();
  });

});
