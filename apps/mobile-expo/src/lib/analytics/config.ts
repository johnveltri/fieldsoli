import { Platform } from 'react-native';

export const ANALYTICS_SCHEMA_VERSION = 1;

export type AnalyticsProviderName = 'posthog' | 'none';

export type AnalyticsConfig = {
  provider: AnalyticsProviderName;
  posthogKey: string;
  posthogHost: string;
  debugRichEnabled: boolean;
  environment: string;
  isTestflight: boolean;
  appVersion: string;
  buildNumber: string;
  platform: string;
  appleAdsAttributionEnabled?: boolean;
};

function boolFromEnv(value: string | undefined, fallback = false): boolean {
  if (value == null || value.trim() === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function providerFromEnv(value: string | undefined): AnalyticsProviderName {
  return value === 'posthog' ? 'posthog' : 'none';
}

export const analyticsConfig: AnalyticsConfig = {
  provider: providerFromEnv(process.env.EXPO_PUBLIC_ANALYTICS_PROVIDER),
  posthogKey: (process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '').trim(),
  posthogHost: (process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com').trim(),
  debugRichEnabled: boolFromEnv(process.env.EXPO_PUBLIC_ANALYTICS_DEBUG_RICH, false),
  environment: (process.env.EXPO_PUBLIC_APP_ENV ?? process.env.NODE_ENV ?? 'development').trim(),
  isTestflight: boolFromEnv(process.env.EXPO_PUBLIC_IS_TESTFLIGHT, false),
  appVersion: (process.env.EXPO_PUBLIC_APP_VERSION ?? '1.0.0').trim(),
  buildNumber: (process.env.EXPO_PUBLIC_BUILD_NUMBER ?? 'dev').trim(),
  platform: Platform.OS,
  // Enable in the release environment only after attribution disclosures are approved.
  appleAdsAttributionEnabled: boolFromEnv(process.env.EXPO_PUBLIC_APPLE_ADS_ATTRIBUTION_ENABLED, false),
};
