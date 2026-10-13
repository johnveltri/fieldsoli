import { vi } from 'vitest';

type QueryResult<T = unknown> = {
  data: T;
  error: unknown;
  count?: number | null;
};

type BuilderOptions = {
  awaitResult?: QueryResult;
  singleResult?: QueryResult;
  maybeSingleResult?: QueryResult;
  onInsert?: (payload: unknown) => void;
  onUpsert?: (payload: unknown) => void;
  onUpdate?: (patch: unknown) => void;
};

export function makeBuilder(options: BuilderOptions = {}) {
  const awaitResult: QueryResult = options.awaitResult ?? { data: null, error: null };
  const singleResult: QueryResult = options.singleResult ?? awaitResult;
  const maybeSingleResult: QueryResult = options.maybeSingleResult ?? awaitResult;

  const builder: Record<string, unknown> = {};
  const chainMethods = ['select', 'eq', 'neq', 'gte', 'is', 'order', 'limit', 'range', 'in', 'or'];

  for (const m of chainMethods) {
    (builder as Record<string, unknown>)[m] = vi.fn(() => builder);
  }

  builder.insert = vi.fn((payload: unknown) => {
    options.onInsert?.(payload);
    return builder;
  });

  builder.upsert = vi.fn((payload: unknown) => {
    options.onUpsert?.(payload);
    options.onInsert?.(payload);
    return builder;
  });

  builder.update = vi.fn((patch: unknown) => {
    options.onUpdate?.(patch);
    return builder;
  });

  builder.delete = vi.fn(() => builder);
  builder.single = vi.fn(async () => singleResult);
  builder.maybeSingle = vi.fn(async () => maybeSingleResult);
  builder.then = (resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(awaitResult).then(resolve, reject);

  return builder;
}

type ClientOptions = {
  authUserId?: string | null;
  buildersByTable: Record<string, ReturnType<typeof makeBuilder>[]>;
  rpcResult?: QueryResult;
};

export function makeClient(options: ClientOptions) {
  const queues = new Map(
    Object.entries(options.buildersByTable).map(([table, builders]) => [table, [...builders]]),
  );

  const from = vi.fn((table: string) => {
    const queue = queues.get(table);
    if (!queue || queue.length === 0) {
      throw new Error(`No mocked query builder queued for table: ${table}`);
    }
    const next = queue.shift();
    if (!next) {
      throw new Error(`Failed to read queued builder for table: ${table}`);
    }
    return next;
  });
  const rpc = vi.fn(async () => options.rpcResult ?? { data: null, error: null });

  return {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: options.authUserId ? { user: { id: options.authUserId } } : null,
        },
        error: null,
      })),
      getUser: vi.fn(async () => ({
        data: { user: options.authUserId ? { id: options.authUserId } : null },
        error: null,
      })),
    },
    from,
    rpc,
  } as const;
}
