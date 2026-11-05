import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAppleAdsToken } from './appleAdsNative';
import type { AnalyticsProperties } from './types';

const CACHE_KEY = 'fieldsoli.apple_ads.v1';
const ENDPOINT = 'https://api-adservices.apple.com/api/v1/';
type Result = { status: 'attributed' | 'unattributed'; properties: AnalyticsProperties };
type Cache = Result & { owner: string };

// Only known IDs/enums leave this boundary. Raw Apple payloads, tokens, dates,
// customer content and device identifiers never enter analytics or storage.
export function parseAppleAdsResponse(value: unknown): Result | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  if (data.attribution === false) return { status: 'unattributed', properties: {} };
  if (data.attribution !== true) return null;
  const properties: AnalyticsProperties = {};
  for (const [source, target] of Object.entries({
    orgId: 'apple_ads_org_id', campaignId: 'apple_ads_campaign_id',
    adGroupId: 'apple_ads_ad_group_id', keywordId: 'apple_ads_keyword_id', adId: 'apple_ads_ad_id',
  })) {
    const id = data[source];
    if (typeof id === 'number' && Number.isSafeInteger(id) && id > 0) properties[target] = String(id);
  }
  for (const [source, target, allowed] of [
    ['conversionType', 'apple_ads_conversion_type', ['Download', 'Redownload']],
    ['claimType', 'apple_ads_claim_type', ['Click', 'Impression']],
    ['supplyPlacement', 'apple_ads_placement', ['APPSTORE_SEARCH_RESULTS', 'APPSTORE_SEARCH_TAB', 'APPSTORE_TODAY_TAB', 'APPSTORE_PRODUCT_PAGES']],
  ] as const) {
    if (typeof data[source] === 'string' && (allowed as readonly string[]).includes(data[source] as string)) {
      properties[target] = data[source] as string;
    }
  }
  return { status: 'attributed', properties };
}

export type AppleAdsDependencies = {
  storage: Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>;
  token: typeof getAppleAdsToken;
  fetch: typeof fetch;
  wait: (ms: number, signal: AbortSignal) => Promise<void>;
};

const wait: AppleAdsDependencies['wait'] = (ms, signal) => new Promise((resolve, reject) => {
  const abort = () => { clearTimeout(timer); reject(new Error('cancelled')); };
  const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
  if (signal.aborted) abort();
  else signal.addEventListener('abort', abort, { once: true });
});

/** Activated only by a consented, identified analytics client. No pre-consent queue. */
export class AppleAdsAttribution {
  private controller: AbortController | null = null;
  private pending: Promise<void> | null = null;
  private owner: string | null = null;
  private generation = 0;
  private attemptedAt = 0;
  private current: AnalyticsProperties = { acquisition_status: 'unknown' };

  constructor(private readonly deps: AppleAdsDependencies, private readonly eligible: boolean) {}

  properties(): AnalyticsProperties { return { ...this.current }; }

  resolve(owner: string, onResolved: (properties: AnalyticsProperties) => void): Promise<void> {
    if (this.owner === owner && this.pending) return this.pending;
    if (this.owner === owner && ['attributed', 'unattributed', 'unsupported'].includes(String(this.current.acquisition_status))) {
      return Promise.resolve();
    }
    if (this.owner === owner && Date.now() - this.attemptedAt < 60_000) return Promise.resolve();
    this.stop();
    this.owner = owner;
    this.attemptedAt = Date.now();
    if (!this.eligible) {
      this.current = { acquisition_status: 'unsupported' };
      return Promise.resolve();
    }
    const generation = this.generation;
    const controller = new AbortController();
    this.controller = controller;
    const active = () => this.generation === generation && !controller.signal.aborted;
    const finish = (properties: AnalyticsProperties) => {
      if (!active()) return;
      this.current = properties;
      onResolved(this.properties());
    };
    const task = (async () => {
      try {
        const stored = await this.deps.storage.getItem(CACHE_KEY);
        if (!active()) return;
        if (stored) {
          const cached = JSON.parse(stored) as Cache | { disabled: true };
          if ('disabled' in cached) {
            finish({ acquisition_status: 'unknown', acquisition_reason: 'consent_reset' });
            return;
          }
          if (cached.owner !== owner) {
            finish({ acquisition_status: 'unknown', acquisition_reason: 'different_account' });
            return;
          }
          // Revalidate the persisted payload rather than spreading arbitrary stored properties.
          if ((cached.status === 'attributed' || cached.status === 'unattributed') && cached.properties) {
            const safe: AnalyticsProperties = {};
            for (const [key, value] of Object.entries(cached.properties)) {
              if (/^apple_ads_(org_id|campaign_id|ad_group_id|keyword_id|ad_id|conversion_type|claim_type|placement)$/.test(key)
                && typeof value === 'string' && value.length <= 64) safe[key] = value;
            }
            finish({ acquisition_status: cached.status, acquisition_source: cached.status === 'attributed' ? 'apple_ads' : 'unattributed', ...safe });
            return;
          }
          // A corrupt cache is unknown; do not accidentally assign an install to another account.
          finish({ acquisition_status: 'unknown', acquisition_reason: 'invalid_cache' });
          return;
        }
        const token = await this.deps.token();
        if (!active()) return;
        if (!token) { finish({ acquisition_status: 'unsupported', acquisition_reason: 'native_unavailable' }); return; }
        for (let attempt = 0; attempt < 4; attempt += 1) {
          if (!active()) return;
          const timeout = setTimeout(() => controller.abort(), 10_000);
          let response: Response;
          let body: unknown = null;
          try {
            response = await this.deps.fetch(ENDPOINT, {
              method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: token, signal: controller.signal,
            });
            if (response.ok) body = await response.json();
          } finally { clearTimeout(timeout); }
          if (!active()) return;
          if (response.status === 404 || response.status === 429 || response.status >= 500) {
            if (attempt < 3) { await this.deps.wait(5_000, controller.signal); continue; }
          }
          if (!response.ok) { finish({ acquisition_status: 'unknown', acquisition_reason: 'lookup_failed' }); return; }
          const result = parseAppleAdsResponse(body);
          if (!active()) return;
          if (!result) { finish({ acquisition_status: 'unknown', acquisition_reason: 'invalid_response' }); return; }
          await this.deps.storage.setItem(CACHE_KEY, JSON.stringify({ owner, ...result }));
          finish({ acquisition_status: result.status, acquisition_source: result.status === 'attributed' ? 'apple_ads' : 'unattributed', ...result.properties });
          return;
        }
      } catch {
        if (this.generation === generation) {
          // Includes timeout, storage errors and malformed JSON. Never call these organic.
          this.current = { acquisition_status: 'unknown', acquisition_reason: 'lookup_failed' };
          onResolved(this.properties());
        }
      }
    })();
    this.pending = task;
    void task.finally(() => { if (this.pending === task) this.pending = null; });
    return task;
  }

  stop(): void {
    this.generation += 1;
    this.controller?.abort();
    this.controller = null;
    this.owner = null;
    this.current = { acquisition_status: 'unknown' };
  }

  async withdraw(): Promise<void> {
    const pending = this.pending;
    this.stop();
    // Wait out any in-flight storage write before replacing it. Tombstone has no identity
    // or attribution and prevents resurrecting previously withdrawn install information.
    await pending;
    const stored = await this.deps.storage.getItem(CACHE_KEY);
    // Declining before any lookup must not prevent a later first-time grant.
    if (stored || pending) {
      try {
        await this.deps.storage.setItem(CACHE_KEY, JSON.stringify({ disabled: true }));
      } catch {
        // A full store must not leave a previous payload behind just because the
        // identity-free tombstone cannot be written.
        await this.deps.storage.removeItem(CACHE_KEY);
      }
    }
  }
}

export function createAppleAdsAttribution(eligible: boolean): AppleAdsAttribution {
  return new AppleAdsAttribution({ storage: AsyncStorage, token: getAppleAdsToken, fetch: (...args) => fetch(...args), wait }, eligible);
}
