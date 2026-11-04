import { AppleAdsAttribution, parseAppleAdsResponse, type AppleAdsDependencies } from './appleAds';

jest.mock('./appleAdsNative', () => ({ getAppleAdsToken: jest.fn() }));

function setup(eligible = true) {
  const data = new Map<string, string>();
  const storage = {
    getItem: jest.fn(async (key: string) => data.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { data.set(key, value); }),
    removeItem: jest.fn(async (key: string) => { data.delete(key); }),
  };
  const token = jest.fn(async (): Promise<string | null> => 'private-token');
  const request = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ attribution: true, campaignId: 123, keywordId: 456 }) } as Response));
  const wait = jest.fn(async () => {});
  const deps: AppleAdsDependencies = { storage, token, fetch: request, wait };
  return { service: new AppleAdsAttribution(deps, eligible), data, storage, token, request, wait };
}

describe('Apple Ads attribution', () => {
  it('allowlists IDs and enums, excluding tokens, dates, text and arbitrary fields', () => {
    expect(parseAppleAdsResponse({ attribution: true, campaignId: 123, keywordId: -1,
      adGroupId: 'secret', conversionType: 'Download', claimType: 'Click',
      token: 'secret', clickDate: 'private', email: 'private', customer: { name: 'private' },
    })).toEqual({ status: 'attributed', properties: {
      apple_ads_campaign_id: '123', apple_ads_conversion_type: 'Download', apple_ads_claim_type: 'Click',
    } });
    expect(parseAppleAdsResponse({ attribution: false, campaignId: 123 })).toEqual({ status: 'unattributed', properties: {} });
    expect(parseAppleAdsResponse({ attribution: 'false' })).toBeNull();
  });

  it('does nothing until explicitly resolved, and skips ineligible builds', async () => {
    const { service, token, request, storage } = setup(false);
    expect(storage.getItem).not.toHaveBeenCalled();
    await service.resolve('u1', jest.fn());
    expect(token).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
    expect(service.properties()).toEqual({ acquisition_status: 'unsupported' });
  });

  it('exchanges only the transient token with Apple, stores safe data, and restores for the same account', async () => {
    const { service, token, request, storage, data } = setup();
    const result = jest.fn();
    await service.resolve('u1', result);
    expect(request).toHaveBeenCalledWith('https://api-adservices.apple.com/api/v1/', expect.objectContaining({
      method: 'POST', body: 'private-token', headers: { 'Content-Type': 'text/plain' },
    }));
    expect(result).toHaveBeenCalledWith(expect.objectContaining({ acquisition_status: 'attributed', apple_ads_keyword_id: '456' }));
    expect(JSON.stringify([...data.values()])).not.toContain('private-token');
    service.stop();
    await service.resolve('u1', result);
    expect(token).toHaveBeenCalledTimes(1);
    expect(storage.getItem).toHaveBeenCalledTimes(2);
  });

  it('does not reuse the original account acquisition on account switching', async () => {
    const { service, token } = setup();
    await service.resolve('u1', jest.fn());
    await service.resolve('u2', jest.fn());
    expect(service.properties()).toEqual({ acquisition_status: 'unknown', acquisition_reason: 'different_account' });
    expect(token).toHaveBeenCalledTimes(1);
  });

  it('retains resolved acquisition on later foregrounds without resetting the event envelope', async () => {
    const { service, request } = setup();
    await service.resolve('u1', jest.fn());
    const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 120_000);
    try {
      const pending = service.resolve('u1', jest.fn());
      expect(service.properties().apple_ads_campaign_id).toBe('123');
      await pending;
      expect(request).toHaveBeenCalledTimes(1);
    } finally { clock.mockRestore(); }
  });

  it('retries 404 at five second intervals before accepting the result', async () => {
    const { service, request, wait } = setup();
    request.mockResolvedValueOnce({ ok: false, status: 404 } as Response);
    await service.resolve('u1', jest.fn());
    expect(request).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(5000, expect.anything());
    expect(service.properties().acquisition_status).toBe('attributed');
  });

  it('bounds retries and never labels errors or missing payloads organic', async () => {
    const { service, request, wait, storage } = setup();
    request.mockResolvedValue({ ok: false, status: 503 } as Response);
    await service.resolve('u1', jest.fn());
    expect(request).toHaveBeenCalledTimes(4);
    expect(wait).toHaveBeenCalledTimes(3);
    expect(service.properties()).toEqual({ acquisition_status: 'unknown', acquisition_reason: 'lookup_failed' });
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('negative attribution is unattributed, never proof of organic', async () => {
    const { service, request } = setup();
    request.mockResolvedValue({ ok: true, status: 200, json: async () => ({ attribution: false }) } as Response);
    await service.resolve('u1', jest.fn());
    expect(service.properties()).toEqual({ acquisition_status: 'unattributed', acquisition_source: 'unattributed' });
  });

  it('distinguishes unsupported native builds and malformed responses from negative attribution', async () => {
    const unsupported = setup();
    unsupported.token.mockResolvedValue(null);
    await unsupported.service.resolve('u1', jest.fn());
    expect(unsupported.service.properties().acquisition_status).toBe('unsupported');
    expect(unsupported.request).not.toHaveBeenCalled();
    const malformed = setup();
    malformed.request.mockResolvedValue({ ok: true, status: 200, json: async () => ({ unexpected: true }) } as Response);
    await malformed.service.resolve('u1', jest.fn());
    expect(malformed.service.properties()).toEqual({ acquisition_status: 'unknown', acquisition_reason: 'invalid_response' });
    expect(malformed.storage.setItem).not.toHaveBeenCalled();
  });

  it('aborts a stalled network request without persisting a negative result', async () => {
    jest.useFakeTimers();
    try {
      const { service, request, storage } = setup();
      request.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => reject(new Error('secret raw error')));
      }));
      const pending = service.resolve('u1', jest.fn());
      await jest.advanceTimersByTimeAsync(10_000);
      await pending;
      expect(service.properties()).toEqual({ acquisition_status: 'unknown', acquisition_reason: 'lookup_failed' });
      expect(storage.setItem).not.toHaveBeenCalled();
    } finally { jest.useRealTimers(); }
  });

  it('does not persist or emit a result that arrives after logout', async () => {
    const { service, request, storage } = setup();
    let complete!: (value: Response) => void;
    request.mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    const result = jest.fn();
    const pending = service.resolve('u1', result);
    // Advance the storage and token awaits.
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    service.stop();
    complete({ ok: true, status: 200, json: async () => ({ attribution: true, campaignId: 123 }) } as Response);
    await pending;
    expect(result).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('withdrawal removes the payload and prevents resurrection after a new grant', async () => {
    const { service, data, token } = setup();
    await service.resolve('u1', jest.fn());
    await service.withdraw();
    expect([...data.values()]).toEqual(['{"disabled":true}']);
    await service.resolve('u1', jest.fn());
    expect(service.properties()).toEqual({ acquisition_status: 'unknown', acquisition_reason: 'consent_reset' });
    expect(token).toHaveBeenCalledTimes(1);
  });

  it('allows a first lookup after declining before any attribution was collected', async () => {
    const { service, token, storage } = setup();
    await service.withdraw();
    expect(storage.setItem).not.toHaveBeenCalled();
    await service.resolve('u1', jest.fn());
    expect(token).toHaveBeenCalledTimes(1);
  });
});
