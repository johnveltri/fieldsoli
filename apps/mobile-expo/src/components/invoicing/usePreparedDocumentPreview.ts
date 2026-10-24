import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  deviceIanaTimeZone,
  previewFinancialDocument,
  type DocumentPreview,
  type FieldSoloSupabaseClient,
} from '@fieldsolo/api-client';

const PREVIEW_TTL_MS = 30_000;
const READ_TIMEOUT_MS = 15_000;

type Options = {
  client: FieldSoloSupabaseClient;
  ownerId: string;
  jobId: string;
  type: 'estimate' | 'invoice';
  /** Stable identity covering every local source change, including document controls. */
  revision: unknown;
  enabled: boolean;
};

type PreparedState = {
  alive: boolean;
  generation: number;
  cached: { preview: DocumentPreview; completedAt: number; timezone: string } | null;
  inFlight: Promise<DocumentPreview> | null;
};

/** Ephemeral, owner-scoped preparation only. Creation still validates its fingerprint on the server. */
export function usePreparedDocumentPreview({ client, ownerId, jobId, type, revision, enabled }: Options) {
  const [warmRevision, setWarmRevision] = useState(0);
  // Each input identity owns an isolated store; late old reads cannot populate a new scope.
  const state = useMemo<PreparedState>(() => ({
    alive: true, generation: 0, cached: null, inFlight: null,
  }), [client, ownerId, jobId, type, revision, enabled]);

  const read = useCallback((): Promise<DocumentPreview> => {
    if (!state.alive) return Promise.reject(new Error('document_preview_superseded'));
    const timezone = deviceIanaTimeZone();
    if (enabled && state.cached && state.cached.timezone === timezone &&
        Date.now() - state.cached.completedAt < PREVIEW_TTL_MS) {
      return Promise.resolve(state.cached.preview);
    }
    if (state.inFlight) return state.inFlight;
    const generation = state.generation;
    const promise = boundedPreviewRead(client, { jobId, type, timezone })
      .then((preview) => {
        if (!state.alive || generation !== state.generation) throw new Error('document_preview_superseded');
        if (enabled) state.cached = { preview, completedAt: Date.now(), timezone };
        return preview;
      })
      .finally(() => {
        if (state.inFlight === promise) state.inFlight = null;
      });
    state.inFlight = promise;
    return promise;
  }, [client, enabled, jobId, state, type]);

  const invalidate = useCallback(() => {
    state.generation += 1;
    state.cached = null;
    state.inFlight = null;
    if (state.alive) setWarmRevision((value) => value + 1);
  }, [state]);

  useEffect(() => {
    state.alive = true;
    return () => {
      state.alive = false;
      state.generation += 1;
      state.cached = null;
      state.inFlight = null;
    };
  }, [state]);

  useEffect(() => {
    if (enabled && ownerId && jobId) void read().catch(() => {
      // Speculative failures are silent and are never cached; explicit reads retry.
    });
  }, [enabled, jobId, ownerId, read, warmRevision]);

  return { read, invalidate };
}

async function boundedPreviewRead(
  client: FieldSoloSupabaseClient,
  input: Parameters<typeof previewFinancialDocument>[1],
): Promise<DocumentPreview> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      previewFinancialDocument(client, input),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('document_read_timeout')), READ_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
