import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventQueue, QUEUE_KEY, eventId } from './queue';

const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const event = () => ({ uuid: eventId(), timestamp: new Date().toISOString(), event: 'job_created', properties: { distinct_id: 'a', placeholder: false } });

describe('durable consented queue', () => {
  beforeEach(async () => { jest.useFakeTimers(); await AsyncStorage.clear(); });
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks(); });

  it('replays persisted events with the same UUID, timestamp and identity after offline relaunch', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    const first = new EventQueue('https://invalid/capture/', 'test');
    const original = event();
    first.activate('a'); first.enqueue(original); await settle(); await first.flush();
    expect(JSON.parse((await AsyncStorage.getItem(QUEUE_KEY))!).items).toEqual([original]);
    const second = new EventQueue('https://invalid/capture/', 'test');
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    second.activate('a'); await settle(); await second.flush();
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)).toMatchObject(original);
    expect(JSON.parse((await AsyncStorage.getItem(QUEUE_KEY))!).items).toEqual([]);
    await first.clear(); await second.clear();
  });

  it('never restores another account and purges queued writes on withdrawal', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    const queue = new EventQueue('https://invalid/capture/', 'test');
    queue.activate('a'); queue.enqueue(event());
    await queue.clear(); await settle(); await queue.flush();
    expect(await AsyncStorage.getItem(QUEUE_KEY)).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify({ owner: 'a', items: [event()] }));
    queue.activate('b'); await settle(); await queue.flush();
    expect(global.fetch).not.toHaveBeenCalled(); await queue.clear();
  });

  it('aborts an in-flight request and never requeues it after clearing', async () => {
    let finish!: (value: unknown) => void;
    global.fetch = jest.fn().mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const queue = new EventQueue('https://invalid/capture/', 'test');
    queue.activate('a'); queue.enqueue(event()); await settle();
    const pending = queue.flush(); await settle();
    const signal = (global.fetch as jest.Mock).mock.calls[0][1].signal;
    await queue.clear(); expect(signal.aborted).toBe(true);
    finish({ ok: true }); await pending;
    expect(await AsyncStorage.getItem(QUEUE_KEY)).toBeNull();
  });

  it('retries transient HTTP failures without changing event identity', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: false, status: 429 }).mockResolvedValue({ ok: true });
    const queue = new EventQueue('https://invalid/capture/', 'test');
    queue.activate('a'); queue.enqueue(event()); await settle();
    await queue.flush(); await queue.flush();
    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(calls[0][1].body).toBe(calls[1][1].body);
    expect(queue.diagnostics.pending).toBe(0); await queue.clear();
  });

  it('limits an offline burst to 1000 durable events and reports overflow', async () => {
    const queue = new EventQueue('https://invalid/capture/', 'test');
    queue.activate('a');
    for (let i = 0; i < 1002; i++) queue.enqueue(event());
    // flush waits for serialized persistence; force an offline response.
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    await queue.flush();
    const saved = JSON.parse((await AsyncStorage.getItem(QUEUE_KEY))!);
    expect(saved.items).toHaveLength(1000);
    expect(queue.diagnostics.dropped).toBe(2); await queue.clear();
  });

  it('does not transmit an event whose disk write failed and recovers when storage returns', async () => {
    const queue = new EventQueue('https://invalid/capture/', 'test');
    queue.activate('a'); await settle();
    const write = jest.spyOn(AsyncStorage, 'setItem').mockRejectedValue(new Error('disk unavailable'));
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    queue.enqueue(event()); await settle(); await queue.flush();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(queue.diagnostics.storageFailures).toBeGreaterThan(0);
    write.mockRestore(); await queue.flush();
    expect(global.fetch).toHaveBeenCalledTimes(1); await queue.clear();
  });

  it('reports a failed purge rather than silently allowing a fresh grant', async () => {
    const queue = new EventQueue('https://invalid/capture/', 'test');
    const remove = jest.spyOn(AsyncStorage, 'removeItem').mockRejectedValueOnce(new Error('disk'));
    await expect(queue.clear()).rejects.toThrow('analytics_queue_clear_failed');
    expect(queue.diagnostics.storageFailures).toBe(1);
    remove.mockRestore(); await queue.clear();
  });

  it('bounds retention and drops expired data without sending it', async () => {
    const old = event(); old.timestamp = '2020-01-01T00:00:00.000Z';
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify({ owner: 'a', items: [old] }));
    global.fetch = jest.fn();
    const queue = new EventQueue('https://invalid/capture/', 'test');
    queue.activate('a'); await settle(); await queue.flush();
    expect(global.fetch).not.toHaveBeenCalled(); await queue.clear();
  });
});
