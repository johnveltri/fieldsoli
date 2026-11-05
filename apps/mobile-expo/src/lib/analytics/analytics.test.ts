import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';

import { createNoopAdapter, createPostHogAdapter } from './adapters';
import { sanitizeProperties } from './utils';
import type { AnalyticsEventName } from './types';

const originalFetch = global.fetch;

describe('analytics adapters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
      } as Response),
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('no-op adapter accepts the typed event surface without throwing', () => {
    const adapter = createNoopAdapter();
    const eventName: AnalyticsEventName = 'app_opened';

    expect(() => {
      adapter.capture(eventName, { platform: 'ios' });
      adapter.identify('user-1', { email_domain: 'example.com' });
      adapter.screen('home', { source: 'test' });
      adapter.reset();
    }).not.toThrow();
  });

  it('queues identified events and sends stable UUIDs and original timestamps', async () => {
    const adapter = createPostHogAdapter({ apiKey: 'ph_test', host: 'https://us.i.posthog.com', onDrop: jest.fn() });
    adapter.capture('job_created', { job_id: 'pre-identity' });
    adapter.identify('user-1', {});
    adapter.capture('job_created', { job_id: 'job-1' });
    await adapter.flush?.(); await adapter.flush?.();
    const bodies = (global.fetch as jest.Mock).mock.calls.map((call) => JSON.parse(call[1].body));
    expect(bodies.map(body => body.event)).toEqual(['$identify', 'job_created']);
    expect(bodies[1]).toMatchObject({ uuid: expect.any(String), timestamp: expect.any(String), properties: { distinct_id: 'user-1', job_id: 'job-1' } });
    await adapter.reset();
  });
});

describe('analytics privacy sanitizer', () => {
  it('drops debug-rich fields when debug-rich mode is disabled', () => {
    expect(
      sanitizeProperties(
        {
          job_id: 'job-1',
          email: 'beta@example.com',
          job_short_description: 'Kitchen sink',
          error_message: 'Raw backend message',
        },
        false,
      ),
    ).toEqual({ job_id: 'job-1' });
  });

  it('rejects unknown, nested, raw-error and customer data while preserving attribution references', () => {
    expect(sanitizeProperties({ job_ref: 'j1', mutation_ref: 'm1', apple_ads_campaign_id: '123',
      customer_name: 'Private', email_domain: 'private.example', token: 'secret',
      error_message: 'secret', source: { nested: 'secret' }, extra: { email: 'secret' },
    }, true)).toEqual({ job_ref: 'j1', mutation_ref: 'm1', apple_ads_campaign_id: '123' });
  });

  it('never persists content even when debug-rich mode is enabled', () => {
    expect(
      sanitizeProperties(
        {
          job_id: 'job-1',
          email: 'beta@example.com',
          job_short_description: 'Kitchen sink',
        },
        true,
      ),
    ).toEqual({
      job_id: 'job-1',
    });
  });
});
