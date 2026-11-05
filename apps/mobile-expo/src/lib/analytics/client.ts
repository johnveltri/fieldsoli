import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AnalyticsConsentStatus } from '@fieldsolo/api-client';

import { createNoopAdapter, createPostHogAdapter } from './adapters';
import {
  ANALYTICS_SCHEMA_VERSION,
  analyticsConfig,
  type AnalyticsConfig,
} from './config';
import { sanitizeProperties } from './utils';
import { eventId, QUEUE_KEY } from './queue';
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

export class AnalyticsClient {
  private adapter: AnalyticsAdapter = createNoopAdapter('consent_not_granted');
  private anonymousId: string | null = null;
  private appSessionId: string | null = null;
  private currentScreen: AnalyticsScreenName | null = null;
  private userId: string | null = null;
  private consentGranted = false;
  private consentOwner: string | null = null;
  private granting: Promise<void> | null = null;
  private grantingOwner: string | null = null;
  private backgroundAt: number | null = null;
  private lastSession: string | null = null;
  private milestones: Promise<unknown> = Promise.resolve();
  private readonly milestoneKey = 'fieldsoli.analytics.progress.v2';
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

  async applyConsent(status: AnalyticsConsentStatus | null, owner?: string): Promise<void> {
    if (status === 'granted') {
      await this.grantConsent(owner);
      return;
    }
    await this.disable(status === 'withdrawn');
  }

  async grantConsent(owner?: string): Promise<void> {
    if (this.consentGranted && (!owner || this.consentOwner === owner)) return;
    if (this.consentGranted) await this.disable(true);
    if (this.granting) {
      if ((owner ?? null) === this.grantingOwner) return this.granting;
      await this.disable(true);
    }
    this.grantingOwner = owner ?? null;
    const generation = this.consentGeneration;
    this.granting = (async () => {
      await this.ensureAnonymousId();
      if (generation !== this.consentGeneration) return;
      this.adapter = createAdapter(this.config);
      this.appSessionId = eventId();
      this.currentScreen = null;
      this.consentOwner = owner ?? null;
      this.consentGranted = true;
    })();
    try { await this.granting; } finally { this.granting = null; }
  }

  async withdrawConsent(): Promise<void> {
    await this.disable(true);
  }

  async onSignOut(): Promise<void> {
    this.userId = null;
    this.currentScreen = null;
    await this.disable(true);
  }

  capture<Name extends AnalyticsEventName>(
    event: Name,
    properties: AnalyticsEventPayloads[Name] = {},
  ): void {
    if (!this.consentGranted || !this.userId) return;
    if ((event === 'app_opened' || event === 'app_became_active') && this.userId) {
      this.resolveAcquisition(this.userId);
    }
    const payload = this.withEnvelope(properties);
    try {
      this.adapter.capture(event, payload);
      this.recordProgress(event, properties);
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
    if ((this.consentOwner && this.consentOwner !== userId) || (this.userId && this.userId !== userId)) {
      // A new account must resolve its own consent before collection resumes.
      void this.disable(true).catch(() => {});
      return;
    }
    this.userId = userId;
    try {
      this.adapter.identify(userId, this.clean(traits));
      this.resolveAcquisition(userId);
      if (this.lastSession !== this.appSessionId) {
        this.lastSession = this.appSessionId;
        this.capture('app_session_started', { reason: 'consented_app_ready' });
      }
    } catch {
      // no-op
    }
  }

  reset(): void {
    void this.disable(true).catch(() => {});
  }

  screen(name: AnalyticsScreenName, properties: AnalyticsProperties = {}): void {
    if (!this.consentGranted || !this.userId) return;
    if (this.currentScreen === name) return;
    this.currentScreen = name;
    this.capture('screen_viewed', { ...properties, screen: name });
  }

  getCurrentScreen(): AnalyticsScreenName | null {
    return this.currentScreen;
  }

  private async disable(clearAnonymousId: boolean): Promise<void> {
    this.consentGeneration += 1;
    this.consentGranted = false;
    this.consentOwner = null;
    this.userId = null;
    this.appSessionId = null;
    this.anonymousId = null;
    const previousAdapter = this.adapter;
    this.currentScreen = null;
    this.lastSession = null;
    this.backgroundAt = null;
    this.adapter = createNoopAdapter(
      clearAnonymousId ? 'consent_withdrawn' : 'consent_not_granted',
    );
    this.acquisition.stop();
    await previousAdapter.reset();
    // Also purge a dormant queue when no adapter was activated this process.
    await AsyncStorage.removeItem(QUEUE_KEY);
    await this.granting;
    this.anonymousId = null;
    await this.milestones.catch(() => {});
    if (clearAnonymousId) {
      await AsyncStorage.removeItem(this.milestoneKey);
      await Promise.allSettled([
        this.acquisition.withdraw(), AsyncStorage.removeItem(ANONYMOUS_ID_KEY),
      ]);
    }
  }

  private withEnvelope(properties: AnalyticsProperties): AnalyticsProperties {
    const { session_id: visitId, ...safeProperties } = properties;
    return this.clean({
      ...safeProperties,
      ...(visitId == null ? {} : { visit_id: visitId }),
      ...this.acquisition.properties(),
      user_id: this.userId,
      anonymous_id: this.anonymousId,
      session_id: this.appSessionId,
      app_session_id: this.appSessionId,
      app_version: this.config.appVersion,
      build_number: this.config.buildNumber,
      platform: this.config.platform,
      environment: this.config.environment,
      is_testflight: this.config.isTestflight,
      analytics_schema_version: ANALYTICS_SCHEMA_VERSION,
      current_screen: this.currentScreen,
      debug_rich_enabled: this.config.debugRichEnabled,
    });
  }

  onAppState(state: string): void {
    if (!this.consentGranted || !this.userId) return;
    if (state !== 'active') {
      if (this.backgroundAt == null) this.backgroundAt = Date.now();
      void this.adapter.flush?.();
      return;
    }
    if (this.backgroundAt != null && Date.now() - this.backgroundAt >= 30 * 60 * 1000) {
      this.appSessionId = eventId();
      this.currentScreen = null;
      this.lastSession = this.appSessionId;
      this.capture('app_session_started', { reason: 'inactivity' });
    }
    this.backgroundAt = null;
    void this.adapter.flush?.();
  }

  getDiagnostics() { return this.adapter.diagnostics?.() ?? { pending: 0, dropped: 0, storageFailures: 0, lastResult: 'disabled' }; }

  async flush(): Promise<void> {
    await this.milestones.catch(() => {});
    await this.adapter.flush?.();
  }

  private recordProgress(event: AnalyticsEventName, properties: AnalyticsProperties): void {
    const meaningful = (event === 'job_created' && properties.placeholder === false)
      || (event === 'job_saved' && properties.has_work_description === true);
    const useful = ['live_session_ended', 'manual_session_created', 'note_created',
      'material_created', 'other_cost_created', 'document_created', 'job_work_saved'].includes(event);
    if (!meaningful && !useful) return;
    const owner = this.userId;
    const generation = this.consentGeneration;
    const session = this.appSessionId;
    const timestamp = new Date().toISOString();
    const envelope = this.withEnvelope({});
    const actionRef = properties.document_ref ?? properties.session_id ?? properties.note_id ?? properties.material_id;
    const jobRef = properties.job_id ?? properties.job_ref;
    const job = typeof jobRef === 'string' ? jobRef : null;
    this.milestones = this.milestones.catch(() => {}).then(async () => {
      if (!owner || generation !== this.consentGeneration) return;
      const raw = await AsyncStorage.getItem(this.milestoneKey);
      if (generation !== this.consentGeneration) return;
      let state: { owner: string; jobs: string[]; firstUseful?: string; firstSession?: string | null; lastReturn?: string; actions?: string[] } = { owner, jobs: [] };
      try {
        const saved = raw ? JSON.parse(raw) : null;
        if (saved?.owner === owner && Array.isArray(saved.jobs)) state = saved;
      } catch { /* Ignore corrupt local progress. */ }
      const emit = (name: AnalyticsEventName, extra: AnalyticsProperties) => {
        this.adapter.capture(name, this.clean({ ...extra, ...envelope }));
      };
      if (job && !state.jobs.includes(job)) {
        state.jobs = [...state.jobs, job].slice(-1000);
        emit('job_became_meaningful', { job_id: job, basis: meaningful ? 'description' : event });
      }
      const actionKey = typeof actionRef === 'string' ? `${event}:${actionRef}` : null;
      if (useful && (!actionKey || !state.actions?.includes(actionKey))) {
        if (actionKey) state.actions = [...(state.actions ?? []), actionKey].slice(-1000);
        emit('useful_action_completed', { action: event, ...(job ? { job_id: job } : {}) });
        const day = timestamp.slice(0, 10);
        if (state.firstUseful && state.firstUseful.slice(0, 10) !== day
          && state.firstSession !== session && state.lastReturn !== day) {
          emit('meaningful_return', { window: Date.parse(timestamp) - Date.parse(state.firstUseful) <= 7 * 86400000 ? 'within_7_days' : 'after_7_days' });
          state.lastReturn = day;
        }
        if (!state.firstUseful) { state.firstUseful = timestamp; state.firstSession = session; }
      }
      await AsyncStorage.setItem(this.milestoneKey, JSON.stringify(state));
    }).catch(() => { /* Local milestone persistence must not affect product use. */ });
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
