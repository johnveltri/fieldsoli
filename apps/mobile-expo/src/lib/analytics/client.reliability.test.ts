import AsyncStorage from '@react-native-async-storage/async-storage';
const mockCapture = jest.fn();
const mockReset = jest.fn(async () => {});
jest.mock('./adapters', () => ({
  createNoopAdapter: () => ({ capture: jest.fn(), identify: jest.fn(), reset: jest.fn(), screen: jest.fn() }),
  createPostHogAdapter: () => ({ capture: mockCapture, identify: jest.fn(), reset: mockReset, screen: jest.fn() }),
}));
jest.mock('./appleAds', () => ({ createAppleAdsAttribution: () => ({ resolve: jest.fn(), stop: jest.fn(), withdraw: jest.fn(), properties: () => ({}) }) }));
jest.mock('./config', () => ({ ANALYTICS_SCHEMA_VERSION: 2, analyticsConfig: {} }));
import { AnalyticsClient } from './client';
import type { AnalyticsConfig } from './config';
const config: AnalyticsConfig = { provider: 'posthog', posthogKey: 'test', posthogHost: 'https://invalid', debugRichEnabled: false, environment: 'test', isTestflight: false, appVersion: '1.2', buildNumber: '42', platform: 'ios' };
const names = () => mockCapture.mock.calls.map(call => call[0]);

describe('consented journey semantics', () => {
  beforeEach(async () => { await AsyncStorage.clear(); jest.clearAllMocks(); jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  it('synthetic journey excludes placeholder activation, records useful value and a later meaningful return', async () => {
    const client = new AnalyticsClient(config);
    client.capture('job_created', { job_id: 'before', placeholder: false });
    await client.grantConsent(); client.identify('a');
    client.capture('job_created', { job_id: 'blank', placeholder: true });
    await client.flush();
    expect(names()).not.toContain('job_became_meaningful');
    client.capture('job_created', { job_id: 'useful', placeholder: false });
    client.capture('manual_session_created', { job_id: 'useful', session_id: 'visit-1' });
    client.captureForUser('a', 'document_created', { job_ref: 'useful', document_ref: 'doc-1', document_type: 'invoice' });
    client.captureForUser('a', 'document_created', { job_ref: 'useful', document_ref: 'doc-1', document_type: 'invoice' });
    await client.flush();
    expect(names().filter(n => n === 'job_became_meaningful')).toHaveLength(1);
    expect(names().filter(n => n === 'useful_action_completed')).toHaveLength(2);
    client.onAppState('background'); jest.setSystemTime(Date.now() + 86400000); client.onAppState('active');
    client.capture('note_created', { job_id: 'useful', note_id: 'note-1' });
    await client.flush();
    expect(names().filter(n => n === 'meaningful_return')).toHaveLength(1);
    await client.withdrawConsent();
  });

  it('deduplicates screens and protects app session IDs from work-visit properties', async () => {
    const client = new AnalyticsClient(config); await client.grantConsent(); client.identify('a');
    client.screen('home'); client.screen('home'); client.screen('jobs');
    expect(names().filter(n => n === 'screen_viewed')).toHaveLength(2);
    client.capture('manual_session_created', { session_id: 'visit-1', user_id: 'spoofed', app_session_id: 'spoofed' });
    const payload = mockCapture.mock.calls.find(call => call[0] === 'manual_session_created')![1];
    expect(payload).toMatchObject({ user_id: 'a', visit_id: 'visit-1', build_number: '42' });
    expect(payload.session_id).toBe(payload.app_session_id);
    expect(payload.session_id).not.toBe('visit-1');
    await client.withdrawConsent();
  });

  it('rejects old-account completions and does not inherit consent on direct account switching', async () => {
    const client = new AnalyticsClient(config); await client.grantConsent(); client.identify('a');
    client.identify('b');
    expect(client.isConsentGranted()).toBe(false);
    await client.onSignOut(); await client.grantConsent(); client.identify('b');
    mockCapture.mockClear();
    client.captureForUser('a', 'document_created', { document_ref: 'old' });
    expect(mockCapture).not.toHaveBeenCalled();
    await client.withdrawConsent(); client.capture('app_opened');
    expect(mockCapture).not.toHaveBeenCalled(); expect(mockReset).toHaveBeenCalled();
  });

  it('requires the consenting account identity even before the first identify', async () => {
    const client = new AnalyticsClient(config);
    await client.applyConsent('granted', 'a');
    client.identify('b');
    expect(client.isConsentGranted()).toBe(false);
    expect(names()).not.toContain('app_session_started');
    await client.onSignOut();
  });

  it('restores observed progress after process restart without backfilling old jobs', async () => {
    const first = new AnalyticsClient(config); await first.grantConsent(); first.identify('a');
    first.capture('job_created', { job_id: 'j1', placeholder: false }); await first.flush();
    mockCapture.mockClear();
    const second = new AnalyticsClient(config); await second.grantConsent(); second.identify('a');
    second.capture('job_saved', { job_id: 'j1', has_work_description: true }); await second.flush();
    expect(names()).not.toContain('job_became_meaningful'); await second.withdrawConsent();
  });
});
