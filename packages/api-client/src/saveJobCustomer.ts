import type { JobId } from '@fieldsolo/shared-types';

import type { FieldSoloSupabaseClient } from './client';

export type JobCustomerSnapshot = {
  jobId: string;
  updatedAt: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  serviceAddress: string;
};

export type SaveJobCustomerInput = {
  customerId?: string | null;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  serviceAddress?: string | null;
  expectedJobUpdatedAt?: string;
};

export type SaveJobCustomerResult =
  | { status: 'ok'; snapshot: JobCustomerSnapshot }
  | { status: 'conflict'; snapshot: JobCustomerSnapshot };

export type SaveJobCustomerErrorCode = 'unauthorized' | 'not_found' | 'invalid';

export class SaveJobCustomerError extends Error {
  readonly code: SaveJobCustomerErrorCode;

  constructor(code: SaveJobCustomerErrorCode) {
    super(`save_job_customer failed: ${code}`);
    this.name = 'SaveJobCustomerError';
    this.code = code;
  }
}

const SAVE_RPC_ERROR_RE = /save_job_customer:(unauthorized|not_found|invalid)/;

export function parseSaveJobCustomerError(error: unknown): SaveJobCustomerError | null {
  if (!error || typeof error !== 'object') return null;
  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';
  const match = message.match(SAVE_RPC_ERROR_RE);
  if (!match) return null;
  return new SaveJobCustomerError(match[1] as SaveJobCustomerErrorCode);
}

function mapSnapshot(raw: Record<string, unknown>): JobCustomerSnapshot {
  return {
    jobId: String(raw.jobId ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
    customerId: raw.customerId == null ? null : String(raw.customerId),
    customerName: String(raw.customerName ?? ''),
    customerPhone: raw.customerPhone == null ? null : String(raw.customerPhone),
    customerEmail: raw.customerEmail == null ? null : String(raw.customerEmail),
    serviceAddress: String(raw.serviceAddress ?? ''),
  };
}

function toRpcPayload(input: SaveJobCustomerInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    customerName: input.customerName,
    customerPhone: input.customerPhone ?? null,
    customerEmail: input.customerEmail ?? null,
    serviceAddress: input.serviceAddress ?? null,
  };
  if (input.customerId !== undefined) {
    payload.customerId = input.customerId;
  }
  if (input.expectedJobUpdatedAt) {
    payload.expectedJobUpdatedAt = input.expectedJobUpdatedAt;
  }
  return payload;
}

export async function saveJobCustomer(
  client: FieldSoloSupabaseClient,
  jobId: JobId,
  input: SaveJobCustomerInput,
): Promise<SaveJobCustomerResult> {
  const { data, error } = await client.rpc('save_job_customer', {
    p_job_id: jobId,
    p_payload: toRpcPayload(input) as import('./database.types').Json,
  });

  if (error) {
    const parsed = parseSaveJobCustomerError(error);
    if (parsed) throw parsed;
    throw error;
  }

  const result = data as { status?: string; snapshot?: Record<string, unknown> } | null;
  if (!result?.snapshot) {
    throw new SaveJobCustomerError('invalid');
  }
  const snapshot = mapSnapshot(result.snapshot);
  if (result.status === 'conflict') {
    return { status: 'conflict', snapshot };
  }
  return { status: 'ok', snapshot };
}
