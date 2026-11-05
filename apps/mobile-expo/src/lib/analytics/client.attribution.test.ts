const mockResolve = jest.fn();
const mockStop = jest.fn();
const mockWithdraw = jest.fn(async () => {});
const mockCapture = jest.fn();
const mockIdentify = jest.fn();
let mockProperties: Record<string, unknown> = { acquisition_status: 'unknown' };

jest.mock('./appleAds', () => ({ createAppleAdsAttribution: () => ({
  resolve: (...args: unknown[]) => mockResolve(...args),
  stop: () => mockStop(), withdraw: () => mockWithdraw(), properties: () => mockProperties,
}) }));
jest.mock('./adapters', () => ({
  createNoopAdapter: () => ({ capture: jest.fn(), identify: jest.fn(), reset: jest.fn(), screen: jest.fn() }),
  createPostHogAdapter: () => ({ capture: mockCapture, identify: mockIdentify, reset: jest.fn(), screen: jest.fn() }),
}));
jest.mock('./config', () => ({ ANALYTICS_SCHEMA_VERSION: 1, analyticsConfig: {
  provider: 'posthog', posthogKey: 'test', posthogHost: 'https://example.invalid',
  environment: 'production', platform: 'ios', isTestflight: false, appleAdsAttributionEnabled: true,
} }));

import { analytics } from './client';

describe('consented attribution wiring', () => {
  beforeEach(async () => {
    await analytics.onSignOut();
    jest.clearAllMocks();
    mockResolve.mockResolvedValue(undefined);
    mockProperties = { acquisition_status: 'unknown' };
  });

  it('does not start acquisition before consent, or before an account is identified', async () => {
    analytics.identify('u1');
    analytics.capture('app_opened');
    expect(mockResolve).not.toHaveBeenCalled();
    await analytics.grantConsent();
    expect(mockResolve).not.toHaveBeenCalled();
    analytics.identify('u1');
    expect(mockResolve).toHaveBeenCalledWith('u1', expect.any(Function));
  });

  it('enriches subsequent job/document/return events and updates the person for earlier-event reporting', async () => {
    await analytics.grantConsent();
    analytics.identify('u1');
    const resolved = mockResolve.mock.calls[0][1];
    mockProperties = { acquisition_status: 'attributed', acquisition_source: 'apple_ads', apple_ads_campaign_id: '123' };
    resolved(mockProperties);
    analytics.capture('job_created', { job_id: 'j1' });
    analytics.captureForUser('u1', 'document_created', { document_type: 'invoice', document_ref: 'd1' });
    analytics.capture('app_became_active');
    for (const name of ['job_created', 'document_created', 'app_became_active']) {
      expect(mockCapture).toHaveBeenCalledWith(name, expect.objectContaining({ user_id: 'u1', apple_ads_campaign_id: '123' }));
    }
    expect(mockIdentify).toHaveBeenCalledWith('u1', expect.objectContaining(mockProperties));
  });

  it('rejects late results after withdrawal and old-account document completions', async () => {
    await analytics.grantConsent();
    analytics.identify('u1');
    const resolved = mockResolve.mock.calls[0][1];
    await analytics.withdrawConsent();
    mockCapture.mockClear(); mockIdentify.mockClear();
    resolved({ acquisition_status: 'attributed' });
    expect(mockIdentify).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();
    expect(mockWithdraw).toHaveBeenCalledTimes(1);
    await analytics.grantConsent();
    analytics.identify('u2');
    analytics.captureForUser('u1', 'document_created', { document_ref: 'old-doc' });
    expect(mockCapture).not.toHaveBeenCalledWith('document_created', expect.anything());
  });
});
