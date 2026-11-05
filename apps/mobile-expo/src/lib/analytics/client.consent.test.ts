import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { FIELD_SOLO_ANALYTICS_ANONYMOUS_ID_KEY } from '../storageKeys';

const mockCapture = jest.fn();
const mockIdentify = jest.fn();
const mockScreen = jest.fn();
const mockReset = jest.fn();

jest.mock('./adapters', () => {
  const actual = jest.requireActual<typeof import('./adapters')>('./adapters');
  return {
    ...actual,
    createPostHogAdapter: jest.fn(() => ({
      capture: mockCapture,
      identify: mockIdentify,
      screen: mockScreen,
      reset: mockReset,
    })),
  };
});

jest.mock('./config', () => ({
  ANALYTICS_SCHEMA_VERSION: 1,
  analyticsConfig: {
    provider: 'posthog',
    posthogKey: 'ph_test',
    posthogHost: 'https://us.i.posthog.com',
    debugRichEnabled: false,
    environment: 'test',
    isTestflight: false,
    appVersion: '1.0.0',
    buildNumber: 'test',
    platform: 'ios',
  },
}));

import { analytics } from './client';

describe('analytics consent gating', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    await analytics.onSignOut();
  });

  it('does not send events before consent is granted', () => {
    analytics.capture('app_opened', {});
    analytics.identify('user-1', { email_domain: 'example.com' });
    analytics.screen('home', {});

    expect(mockCapture).not.toHaveBeenCalled();
    expect(mockIdentify).not.toHaveBeenCalled();
    expect(mockScreen).not.toHaveBeenCalled();
    expect(analytics.isConsentGranted()).toBe(false);
  });

  it('sends events after consent is granted', async () => {
    await analytics.grantConsent();
    analytics.identify('user-1');
    analytics.capture('app_opened', { auth_state: 'authenticated' });

    expect(mockCapture).toHaveBeenCalledWith(
      'app_opened',
      expect.objectContaining({ auth_state: 'authenticated' }),
    );
    expect(await AsyncStorage.getItem(FIELD_SOLO_ANALYTICS_ANONYMOUS_ID_KEY)).toBeTruthy();
  });

  it('withdrawConsent clears persisted anonymous id and stops events', async () => {
    await analytics.grantConsent();
    analytics.capture('app_opened', {});
    expect(await AsyncStorage.getItem(FIELD_SOLO_ANALYTICS_ANONYMOUS_ID_KEY)).toBeTruthy();

    mockCapture.mockClear();
    await analytics.withdrawConsent();

    expect(await AsyncStorage.getItem(FIELD_SOLO_ANALYTICS_ANONYMOUS_ID_KEY)).toBeNull();
    analytics.capture('app_opened', {});
    expect(mockCapture).not.toHaveBeenCalled();
    expect(analytics.isConsentGranted()).toBe(false);
  });

  it('applyConsent grants or disables based on server status', async () => {
    await analytics.applyConsent('granted');
    expect(analytics.isConsentGranted()).toBe(true);

    await analytics.applyConsent('withdrawn');
    expect(analytics.isConsentGranted()).toBe(false);
    expect(await AsyncStorage.getItem(FIELD_SOLO_ANALYTICS_ANONYMOUS_ID_KEY)).toBeNull();
  });
});
