import type { JobId } from '@fieldsolo/shared-types';

import type { FieldSoloSupabaseClient } from './client';
import type { OtherCostTypeDb } from './otherCosts';

export type ApplyJobDetailEditJobPatch = {
  shortDescription: string;
  longDescription: string;
  customerName: string;
  serviceAddress: string;
  revenueCents: number | null;
  noRevenueConfirmed: boolean;
  noMaterialsConfirmed: boolean;
  noOtherCostsConfirmed: boolean;
};

export type ApplyJobDetailEditSessionRow = {
  id: string;
  startedAt: string;
  endedAt: string;
  /** True when either clock is explicit; kept for View compatibility. */
  clockTimesExplicit: boolean;
  clockStartExplicit: boolean;
  clockEndExplicit: boolean;
  calendarDateExplicit: boolean;
  startedTz: string | null;
};

export type ApplyJobDetailEditNoteRow = {
  id: string;
  body: string;
  sessionId: string | null;
};

export type ApplyJobDetailEditMaterialRow = {
  id: string;
  description: string;
  quantity: number | null;
  quantityExplicit: boolean;
  unit: string;
  unitCostCents: number | null;
  unitCostExplicit: boolean;
  totalCostCents: number;
  sessionId: string | null;
};

export type ApplyJobDetailEditOtherCostRow = {
  id: string;
  costType: OtherCostTypeDb;
  costTypeExplicit: boolean;
  description: string;
  costCents: number;
  sessionId: string | null;
};

export type ApplyJobDetailEditPayload = {
  job: ApplyJobDetailEditJobPatch;
  sessions: {
    create: ApplyJobDetailEditSessionRow[];
    update: ApplyJobDetailEditSessionRow[];
    deleteIds: string[];
  };
  notes: {
    create: ApplyJobDetailEditNoteRow[];
    update: ApplyJobDetailEditNoteRow[];
    deleteIds: string[];
  };
  materials: {
    create: ApplyJobDetailEditMaterialRow[];
    update: ApplyJobDetailEditMaterialRow[];
    deleteIds: string[];
  };
  otherCosts: {
    create: ApplyJobDetailEditOtherCostRow[];
    update: ApplyJobDetailEditOtherCostRow[];
    deleteIds: string[];
  };
};

export type ApplyJobDetailEditErrorCode =
  | 'unauthorized'
  | 'not_found'
  | 'invalid'
  | 'conflict';

export class ApplyJobDetailEditError extends Error {
  readonly code: ApplyJobDetailEditErrorCode;

  constructor(code: ApplyJobDetailEditErrorCode) {
    super(`apply_job_detail_edit failed: ${code}`);
    this.name = 'ApplyJobDetailEditError';
    this.code = code;
  }
}

const APPLY_RPC_ERROR_RE = /apply_job_detail_edit:(unauthorized|not_found|invalid|conflict)/;

/** Maps PostgREST / Postgres RPC errors raised by apply_job_detail_edit. */
export function parseApplyJobDetailEditError(error: unknown): ApplyJobDetailEditError | null {
  if (!error || typeof error !== 'object') return null;
  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';
  const match = message.match(APPLY_RPC_ERROR_RE);
  if (!match) return null;
  return new ApplyJobDetailEditError(match[1] as ApplyJobDetailEditErrorCode);
}

type RpcResult =
  | { status: 'ok' }
  | { status: 'error'; code: ApplyJobDetailEditErrorCode };

function toRpcPayload(payload: ApplyJobDetailEditPayload): Record<string, unknown> {
  return {
    job: {
      shortDescription: payload.job.shortDescription,
      longDescription: payload.job.longDescription,
      customerName: payload.job.customerName,
      serviceAddress: payload.job.serviceAddress,
      revenueCents: payload.job.revenueCents,
      noRevenueConfirmed: payload.job.noRevenueConfirmed,
      noMaterialsConfirmed: payload.job.noMaterialsConfirmed,
      noOtherCostsConfirmed: payload.job.noOtherCostsConfirmed,
    },
    sessions: payload.sessions,
    notes: payload.notes,
    materials: payload.materials,
    otherCosts: payload.otherCosts,
  };
}

/** Applies a job-detail edit diff in one database transaction. */
export async function applyJobDetailEdit(
  client: FieldSoloSupabaseClient,
  jobId: JobId,
  payload: ApplyJobDetailEditPayload,
): Promise<void> {
  const { data, error } = await client.rpc('apply_job_detail_edit_atomic', {
    p_job_id: jobId,
    p_payload: toRpcPayload(payload) as import('./database.types').Json,
  });

  if (error) {
    const parsed = parseApplyJobDetailEditError(error);
    if (parsed) throw parsed;
    throw error;
  }

  const result = data as RpcResult | null;
  if (!result || result.status === 'ok') return;
  if (result.status === 'error' && result.code) {
    throw new ApplyJobDetailEditError(result.code);
  }
  throw new ApplyJobDetailEditError('invalid');
}
