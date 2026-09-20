import React from 'react';
import { waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockFetchLatestLegalAcceptanceVersions = jest.fn(async () => ({
  privacy_policy: '2026-01-01',
  terms: '2026-01-01',
}));
const mockNeedsLegalReacceptance = jest.fn(() => true);
const mockResolveAnalyticsConsentForUser = jest.fn(async () => 'granted');
const mockCacheLegalAcceptance = jest.fn(async () => undefined);
const mockHasCachedLegalAcceptance = jest.fn(async () => false);
const mockAnalyticsCapture = jest.fn();
const mockAnalyticsIdentify = jest.fn();
const mockAnalyticsScreen = jest.fn();

jest.mock('@fieldsolo/api-client', () => ({
  fetchLatestLegalAcceptanceVersions: (...args: unknown[]) =>
    mockFetchLatestLegalAcceptanceVersions(...(args as [])),
  needsLegalReacceptance: (...args: unknown[]) =>
    mockNeedsLegalReacceptance(...(args as [])),
}));

jest.mock('./src/lib/analytics/consentSync', () => ({
  resolveAnalyticsConsentForUser: (...args: unknown[]) =>
    mockResolveAnalyticsConsentForUser(...(args as [])),
}));

jest.mock('./src/lib/legalAcceptanceStorage', () => ({
  cacheLegalAcceptance: (...args: unknown[]) =>
    mockCacheLegalAcceptance(...(args as [])),
  hasCachedLegalAcceptance: (...args: unknown[]) =>
    mockHasCachedLegalAcceptance(...(args as [])),
}));

jest.mock('./src/components/AnalyticsConsentPromptModal', () => ({
  AnalyticsConsentPromptModal: () => null,
}));

jest.mock('./src/components/LegalReacceptanceModal', () => ({
  LegalReacceptanceModal: ({ visible }: { visible: boolean }) => {
    const { Text } = require('react-native');
    return visible ? (
      <Text testID="legal-reacceptance-modal">Updated legal terms</Text>
    ) : null;
  },
}));

jest.mock('./src/lib/supabase', () => ({
  isSupabaseConfigured: jest.fn(() => true),
  supabase: {},
}));

jest.mock('./src/lib/analytics', () => ({
  analytics: {
    capture: (...args: unknown[]) => mockAnalyticsCapture(...args),
    identify: (...args: unknown[]) => mockAnalyticsIdentify(...args),
    screen: (...args: unknown[]) => mockAnalyticsScreen(...args),
    onSignOut: jest.fn(async () => undefined),
    applyConsent: jest.fn(async () => undefined),
    isConsentGranted: jest.fn(() => true),
  },
  emailProperties: () => ({}),
}));

jest.mock('./src/context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({
    loading: false,
    signupLegalPending: false,
    setSignupLegalPending: jest.fn(),
    session: { user: { id: 'user-77', email: 'tech@example.com' } },
  }),
}));

jest.mock('./src/context/LiveSessionContext', () => ({
  LiveSessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useLiveSession: () => ({
    liveSession: null,
    hydrating: false,
    hasLiveSession: false,
    refresh: jest.fn(),
  }),
}));

jest.mock('./src/components/LiveSessionOverlay', () => ({
  LiveSessionOverlay: () => null,
}));

jest.mock('./src/screens/SignInScreen', () => ({
  SignInScreen: () => {
    const { Text } = require('react-native');
    return <Text>SignInScreen</Text>;
  },
}));

jest.mock('./src/screens/HomeScreen', () => ({
  HomeScreen: () => {
    const { Text } = require('react-native');
    return <Text testID="home-screen">HomeScreen</Text>;
  },
}));

jest.mock('./src/screens/JobsScreen', () => ({
  JobsScreen: () => {
    const { Text } = require('react-native');
    return <Text testID="jobs-screen">JobsScreen</Text>;
  },
}));

jest.mock('./src/screens/EarningsScreen', () => ({
  EarningsScreen: () => {
    const { Text } = require('react-native');
    return <Text testID="earnings-screen">EarningsScreen</Text>;
  },
}));

jest.mock('./src/screens/ProfileScreen', () => ({
  ProfileScreen: () => {
    const { Text } = require('react-native');
    return <Text testID="profile-screen">ProfileScreen</Text>;
  },
}));

jest.mock('./src/screens/InboxScreen', () => ({
  InboxScreen: () => null,
}));

jest.mock('./src/screens/JobDetailScreen', () => ({
  JobDetailScreen: () => null,
}));

jest.mock('./src/components/shell/PrimaryActionOverlay', () => ({
  PrimaryActionOverlay: () => null,
}));

jest.mock('./src/shell/QuickActionsFlowContext', () => ({
  QuickActionsFlowProvider: ({ children }: { children: React.ReactNode }) => children,
  useQuickActionsFlow: () => ({
    handlePrimaryAction: jest.fn(),
    quickActionsVisible: false,
  }),
}));

describe('App legal reacceptance gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNeedsLegalReacceptance.mockReturnValue(true);
    mockResolveAnalyticsConsentForUser.mockResolvedValue('granted');
    mockHasCachedLegalAcceptance.mockResolvedValue(false);
  });

  it('shows the reacceptance modal when required versions are not accepted', async () => {
    const screen = renderRouter('./app', { initialUrl: '/' });

    await waitFor(() => {
      expect(screen.getByTestId('legal-reacceptance-modal')).toBeTruthy();
    });
    expect(mockFetchLatestLegalAcceptanceVersions).toHaveBeenCalled();
    expect(mockNeedsLegalReacceptance).toHaveBeenCalled();
  });

  it('uses a current cached acceptance when the server is temporarily unavailable', async () => {
    mockFetchLatestLegalAcceptanceVersions.mockRejectedValueOnce(
      new Error('network unavailable'),
    );
    mockHasCachedLegalAcceptance.mockResolvedValueOnce(true);

    const screen = renderRouter('./app', { initialUrl: '/' });

    await waitFor(() => {
      expect(screen.getByTestId('home-screen')).toBeTruthy();
    });
    expect(mockHasCachedLegalAcceptance).toHaveBeenCalledWith({
      userId: 'user-77',
      privacyVersion: '2026-09-20',
      termsVersion: '2026-08-30',
    });
    expect(screen.queryByTestId('legal-reacceptance-modal')).toBeNull();
  });

  it('fails closed when neither the server nor a current cache can verify acceptance', async () => {
    mockFetchLatestLegalAcceptanceVersions.mockRejectedValueOnce(
      new Error('network unavailable'),
    );

    const screen = renderRouter('./app', { initialUrl: '/' });

    await waitFor(() => {
      expect(screen.getByTestId('legal-reacceptance-modal')).toBeTruthy();
    });
    expect(mockHasCachedLegalAcceptance).toHaveBeenCalled();
  });

  it('identifies the user after asynchronous analytics consent resolution', async () => {
    mockNeedsLegalReacceptance.mockReturnValue(false);
    let resolveConsent!: (value: string) => void;
    mockResolveAnalyticsConsentForUser.mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveConsent = resolve;
      }),
    );

    renderRouter('./app', { initialUrl: '/' });

    await waitFor(() => {
      expect(mockResolveAnalyticsConsentForUser).toHaveBeenCalledWith('user-77');
    });
    expect(mockAnalyticsIdentify).not.toHaveBeenCalled();

    resolveConsent('granted');

    await waitFor(() => {
      expect(mockAnalyticsIdentify).toHaveBeenCalledWith(
        'user-77',
        expect.objectContaining({ auth_provider: 'supabase' }),
      );
      expect(mockAnalyticsScreen).toHaveBeenCalled();
      expect(mockAnalyticsCapture).toHaveBeenCalledWith(
        'app_opened',
        expect.objectContaining({ auth_state: 'authenticated' }),
      );
    });
  });
});
