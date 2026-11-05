import AsyncStorage from '@react-native-async-storage/async-storage';

export const QUEUE_KEY = 'fieldsoli.analytics.queue.v2';
const MAX_EVENTS = 1000;
const TTL = 7 * 24 * 60 * 60 * 1000;
export type QueuedEvent = {
  uuid: string; timestamp: string; event: string; properties: Record<string, unknown>;
};
export function eventId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const n = Math.floor(Math.random() * 16);
    return (c === 'x' ? n : (n & 3) | 8).toString(16);
  });
}

/** One queue per account. Disk operations are serialized, including purge. */
export class EventQueue {
  private owner: string | null = null;
  private generation = 0;
  private items: QueuedEvent[] = [];
  private serial: Promise<unknown> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private controller: AbortController | null = null;
  private retryMs = 1000;
  private sending = false;
  readonly diagnostics = { dropped: 0, storageFailures: 0, lastResult: 'idle', pending: 0 };

  constructor(private readonly endpoint: string, private readonly apiKey: string) {}

  private run(work: () => Promise<void>): Promise<boolean> {
    const result = this.serial.then(work);
    this.serial = result.catch(() => { this.diagnostics.storageFailures += 1; });
    return result.then(() => true, () => false);
  }

  activate(owner: string): void {
    if (this.owner === owner) return;
    const generation = ++this.generation;
    this.cancel();
    this.owner = owner;
    this.items = [];
    void this.run(async () => {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      if (generation !== this.generation) return;
      try {
        const saved = raw ? JSON.parse(raw) : null;
        if (saved?.owner === owner && Array.isArray(saved.items)) {
          this.items = saved.items.filter((item: QueuedEvent) =>
            typeof item.uuid === 'string' && typeof item.event === 'string'
            && item.properties?.distinct_id === owner
            && Number.isFinite(Date.parse(item.timestamp))
            && Date.now() - Date.parse(item.timestamp) < TTL,
          ).slice(-MAX_EVENTS);
        }
      } catch { this.diagnostics.dropped += 1; }
      await this.persist();
      this.schedule(0);
    });
  }

  enqueue(event: QueuedEvent): void {
    if (!this.owner) return;
    const generation = this.generation;
    void this.run(async () => {
      if (generation !== this.generation) return;
      this.items.push(event);
      if (this.items.length > MAX_EVENTS) {
        this.diagnostics.dropped += this.items.length - MAX_EVENTS;
        this.items = this.items.slice(-MAX_EVENTS);
      }
      await this.persist(); // Do not send before the event is durable.
      this.schedule(0);
    }).then((ok) => { if (!ok && generation === this.generation) this.schedule(2000); });
  }

  async clear(): Promise<void> {
    ++this.generation;
    this.owner = null;
    this.items = [];
    this.diagnostics.pending = 0;
    this.cancel();
    const cleared = await this.run(() => AsyncStorage.removeItem(QUEUE_KEY));
    if (!cleared) throw new Error('analytics_queue_clear_failed');
  }

  private cancel(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.controller?.abort();
    this.controller = null;
  }

  private async persist(): Promise<void> {
    this.diagnostics.pending = this.items.length;
    if (this.owner) await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify({ owner: this.owner, items: this.items }));
  }

  private schedule(delay: number): void {
    if (!this.owner || !this.items.length || this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; void this.flush(); }, delay);
  }

  async flush(): Promise<void> {
    await this.serial;
    if (!this.owner || this.sending || !this.items.length) return;
    const generation = this.generation;
    this.sending = true;
    const controller = new AbortController();
    this.controller = controller;
    const timeout = setTimeout(() => controller.abort(), 10000);
    const event = this.items[0];
    try {
      const durable = await this.run(async () => {
        if (generation === this.generation) await this.persist();
      });
      if (!durable) throw new Error('storage');
      if (generation !== this.generation) return;
      if (Date.now() - Date.parse(event.timestamp) >= TTL) {
        this.diagnostics.dropped += 1;
      } else {
        const response = await fetch(this.endpoint, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({ api_key: this.apiKey, ...event }),
        });
        if (!response.ok) {
          this.diagnostics.lastResult = `http_${response.status}`;
          if (![400, 413, 422].includes(response.status)) throw new Error('retry');
          this.diagnostics.dropped += 1;
        } else this.diagnostics.lastResult = 'accepted';
      }
      if (generation !== this.generation) return;
      await this.run(async () => {
        if (generation !== this.generation) return;
        this.items = this.items.filter((item) => item.uuid !== event.uuid);
        await this.persist();
      });
      this.retryMs = 1000;
    } catch {
      if (generation === this.generation) {
        if (!this.diagnostics.lastResult.startsWith('http_')) this.diagnostics.lastResult = 'network_or_timeout';
        this.retryMs = Math.min(this.retryMs * 2, 60000);
      }
    } finally {
      clearTimeout(timeout);
      this.sending = false;
      if (this.controller === controller) this.controller = null;
      this.schedule(generation === this.generation && this.retryMs > 1000 ? Math.min(60000, this.retryMs + Math.floor(Math.random() * 1000)) : 0);
    }
  }
}
