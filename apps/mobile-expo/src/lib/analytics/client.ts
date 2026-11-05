import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AnalyticsConsentStatus } from '@fieldsolo/api-client';

import { createNoopAdapter, createPostHogAdapter } from './adapters';
import {
  ANALYTICS_SCHEMA_VERSION,
  analyticsConfig,
  type AnalyticsConfig,
} from './config';
import { sanitizeProperties } from './utils';
import { createAppleAdsAttribution } from './appleAds';
import { migrateStorageKey } from '../storageMigration';
import {
  FIELD_SOLO_ANALYTICS_ANONYMOUS_ID_KEY,
  LEGACY_FIELD_BOOK_ANALYTICS_ANONYMOUS_ID_KEY,
} from '../storageKeys';
import type {
  AnalyticsAdapter,
  AnalyticsEventName,
  AnalyticsEventPayloads,
  AnalyticsProperties,
  AnalyticsScreenName,
  AnalyticsUserTraits,
} from './types';

const ANONYMOUS_ID_KEY = FIELD_SOLO_ANALYTICS_ANONYMOUS_ID_KEY;

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function createAdapter(config: AnalyticsConfig): AnalyticsAdapter {
  if (config.provider === 'posthog' && config.posthogKey.length > 0) {
    return createPostHogAdapter({
      apiKey: config.posthogKey,
      host: config.posthogHost,
      onDrop: () => {},
    });
  }
  return createNoopAdapter(config.provider === 'posthog' ? 'posthog_unconfigured' : 'noop');
}

class AnalyticsClient {
  private adapter: AnalyticsAdapter = createNoopAdapter('consent_not_granted');
  private anonymousId: string | null = null;
  private appSessionId: string | null = null;
  private currentScreen: AnalyticsScreenName | null = null;
  private userId: string | null = null;
  private consentGranted = false;
  private consentGeneration = 0;
  private readonly acquisition;

  constructor(private readonly config: AnalyticsConfig) {
    this.acquisition = createAppleAdsAttribution(
      config.platform === 'ios' && config.environment === 'production'
      && config.appleAdsAttributionEnabled === true && !config.isTestflight
      && config.provider === 'posthog' && config.posthogKey.length > 0,
    );
  }

  isConsentGranted(): boolean {
    return this.consentGranted;
  }

  async applyConsent(status: AnalyticsConsentStatus | null): Promise<void> {
    if (status === 'granted') {
      await this.grantConsent();
      return;
    }
    await this.disable(status === 'withdrawn');
  }

  async grantConsent(): Promise<void> {
    if (this.consentGranted) return;
    this.consentGranted = true;
    this.adapter = createAdapter(this.config);
    this.appSessionId = makeId('session');
    await this.ensureAnonymousId();
  }

  async withdrawConsent(): Promise<void> {
    await this.disable(true);
  }

  async onSignOut(): Promise<void> {
    this.userId = null;
    this.currentScreen = null;
    await this.disable(false);
  }

  capture<Name extends AnalyticsEventName>(
    event: Name,
    properties: AnalyticsEventPayloads[Name] = {},
  ): void {
    if (!this.consentGranted) return;
    if ((event === 'app_opened' || event === 'app_became_active') && this.userId) {
      this.resolveAcquisition(this.userId);
    }
    const payload = this.withEnvelope(properties);
    try {
      this.adapter.capture(event, payload);
    } catch {
      // Analytics must never break product flows.
    }
  }

  captureForUser<Name extends AnalyticsEventName>(
    userId: string | null, event: Name, properties: AnalyticsEventPayloads[Name],
  ): void {
    if (!userId || userId !== this.userId) return;
    this.capture(event, properties);
  }

  identify(userId: string, traits: AnalyticsUserTraits = {}): void {
    if (!this.consentGranted) return;
    this.userId = userId;
    try {
      this.adapter.identify(userId, this.clean(traits));
      this.resolveAcquisition(userId);
    } catch {
      // no-op
    }
  }

  reset(): void {
    if (!this.consentGranted) return;
    this.userId = null;
    this.consentGeneration += 1;
    this.acquisition.stop();
    this.appSessionId = makeId('session');
    try {
      this.adapter.reset();
    } catch {
      // no-op
    }
  }

  screen(name: AnalyticsScreenName, properties: AnalyticsProperties = {}): void {
    if (!this.consentGranted) return;
    this.currentScreen = name;
    const payload = this.withEnvelope({ screen: name, ...properties });
    try {
      this.adapter.screen(name, payload);
    } catch {
      // no-op
    }
    this.capture('screen_viewed', { screen: name, ...properties });
  }

  getCurrentScreen(): AnalyticsScreenName | null {
    return this.currentScreen;
  }

  private async disable(clearAnonymousId: boolean): Promise<void> {
    this.consentGeneration += 1;
    this.consentGranted = false;
    this.userId = null;
    this.appSessionId = null;
    this.anonymousId = null;
    this.adapter = createNoopAdapter(
      clearAnonymousId ? 'consent_withdrawn' : 'consent_not_granted',
    );
    this.acquisition.stop();
    if (clearAnonymousId) {
      await Promise.allSettled([
        this.acquisition.withdraw(), AsyncStorage.removeItem(ANONYMOUS_ID_KEY),
      ]);
    }
  }

  private withEnvelope(properties: AnalyticsProperties): AnalyticsProperties {
    return this.clean({
      user_id: this.userId,
      anonymous_id: this.anonymousId,
      session_id: this.appSessionId,
      app_version: this.config.appVersion,
      build_number: this.config.buildNumber,
      platform: this.config.platform,
      environment: this.config.environment,
      is_testflight: this.config.isTestflight,
      analytics_schema_version: ANALYTICS_SCHEMA_VERSION,
      current_screen: this.currentScreen,
      debug_rich_enabled: this.config.debugRichEnabled,
      ...properties,
      ...this.acquisition.properties(),
    });
  }

  private resolveAcquisition(userId: string): void {
    const generation = this.consentGeneration;
    void this.acquisition.resolve(userId, (properties) => {
      if (!this.consentGranted || this.userId !== userId || generation !== this.consentGeneration) return;
      try {
        this.adapter.identify(userId, {
          acquisition_source: null, acquisition_reason: null,
          apple_ads_org_id: null, apple_ads_campaign_id: null,
          apple_ads_ad_group_id: null, apple_ads_keyword_id: null, apple_ads_ad_id: null,
          apple_ads_conversion_type: null, apple_ads_claim_type: null, apple_ads_placement: null,
          ...properties,
        });
        this.capture('acquisition_resolved', properties);
      } catch {
        // Attribution must never affect app use.
      }
    });
  }

  private clean(properties: AnalyticsProperties): AnalyticsProperties {
    return sanitizeProperties(properties, this.config.debugRichEnabled);
  }

  private async ensureAnonymousId(): Promise<void> {
    try {
      await migrateStorageKey(AsyncStorage, {
        oldKey: LEGACY_FIELD_BOOK_ANALYTICS_ANONYMOUS_ID_KEY,
        newKey: ANONYMOUS_ID_KEY,
      });
      const stored = await AsyncStorage.getItem(ANONYMOUS_ID_KEY);
      if (stored) {
        this.anonymousId = stored;
        return;
      }
      const nextId = makeId('anon');
      this.anonymousId = nextId;
      await AsyncStorage.setItem(ANONYMOUS_ID_KEY, nextId);
    } catch {
      this.anonymousId = makeId('anon');
    }
  }
}

export const analytics = new AnalyticsClient(analyticsConfig);
