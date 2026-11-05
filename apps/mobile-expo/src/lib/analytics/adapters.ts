import { EventQueue, eventId } from './queue';
import type { AnalyticsAdapter, AnalyticsProperties } from './types';

export function createNoopAdapter(name = 'noop'): AnalyticsAdapter {
  return { name, capture: () => {}, identify: () => {}, reset: () => {}, screen: () => {} };
}

export function createPostHogAdapter(input: {
  apiKey: string; host: string;
  onDrop: (event: import('./types').AnalyticsEventName, reason: string) => void;
}): AnalyticsAdapter {
  const queue = new EventQueue(`${input.host.replace(/\/+$/, '')}/capture/`, input.apiKey);
  let userId: string | null = null;
  const post = (event: string, properties: AnalyticsProperties) => {
    if (!userId) return;
    queue.enqueue({
      event,
      uuid: eventId(),
      timestamp: new Date().toISOString(),
      properties: {
        ...properties, distinct_id: userId, $geoip_disable: true,
        ...(typeof properties.app_session_id === 'string' ? { $session_id: properties.app_session_id } : {}),
      },
    });
  };
  return {
    name: 'posthog',
    capture: post,
    identify: (id, traits) => {
      userId = id;
      queue.activate(id);
      post('$identify', { $set: traits });
    },
    reset: () => { userId = null; return queue.clear(); },
    flush: () => queue.flush(),
    diagnostics: () => ({ ...queue.diagnostics }),
    screen: (name, properties) => post('screen_viewed', { ...properties, screen: name }),
  };
}
