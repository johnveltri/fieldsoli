import type { DocumentPayload, PaymentProjection } from '@fieldsolo/document-renderer';

import type { FieldSoloSupabaseClient } from './client';
import type { Json } from './database.types';

export const SHARE_DOCUMENT_ORIGIN = 'https://fieldsoli.com';

export type FinancialDocumentRecord = {
  id: string;
  jobId: string;
  documentType: 'estimate' | 'invoice';
  documentNumber: number;
  createdAt: string;
  issueDate: string;
  rendererVersion: number;
  payload: DocumentPayload;
  archived: boolean;
  linkEnabled: boolean;
  controlRevision: number;
  token: string;
  paymentProjection: PaymentProjection;
};

export type DocumentPreview = {
  gaps: string[];
  fingerprint: string;
  paymentProjection: PaymentProjection;
  payload: DocumentPayload;
  rendererVersion: number;
};

export class FinancialDocumentError extends Error {
  readonly code: 'unauthorized' | 'not_found' | 'invalid' | 'conflict' | 'stale' | 'incomplete';

  constructor(code: FinancialDocumentError['code']) {
    super(`financial_document:${code}`);
    this.name = 'FinancialDocumentError';
    this.code = code;
  }
}

const ERROR_RE = /financial_document:(unauthorized|not_found|invalid|conflict|stale)/;

function parseError(error: unknown): FinancialDocumentError | null {
  if (!error || typeof error !== 'object' || !('message' in error)) return null;
  const message = String((error as { message?: unknown }).message ?? '');
  const match = message.match(ERROR_RE);
  if (!match) return null;
  return new FinancialDocumentError(match[1] as FinancialDocumentError['code']);
}

function asRecord(value: Json): FinancialDocumentRecord {
  const row = value as unknown as FinancialDocumentRecord;
  return row;
}

export function shareDocumentUrl(token: string): string {
  return `${SHARE_DOCUMENT_ORIGIN}/share/${token}`;
}

export async function previewFinancialDocument(
  client: FieldSoloSupabaseClient,
  input: { jobId: string; type: 'estimate' | 'invoice'; timezone: string },
): Promise<DocumentPreview> {
  const { data, error } = await client.rpc('preview_financial_document', {
    p_job_id: input.jobId,
    p_type: input.type,
    p_timezone: input.timezone,
  });
  if (error) throw parseError(error) ?? error;
  const body = data as unknown as DocumentPreview & { gaps?: string[] };
  return {
    gaps: body.gaps ?? [],
    fingerprint: body.fingerprint,
    paymentProjection: body.paymentProjection,
    payload: body.payload,
    rendererVersion: body.rendererVersion,
  };
}

export async function createFinancialDocument(
  client: FieldSoloSupabaseClient,
  input: {
    jobId: string;
    type: 'estimate' | 'invoice';
    fingerprint: string;
    timezone: string;
    requestKey: string;
  },
): Promise<FinancialDocumentRecord> {
  const { data, error } = await client.rpc('create_financial_document', {
    p_job_id: input.jobId,
    p_type: input.type,
    p_fingerprint: input.fingerprint,
    p_timezone: input.timezone,
    p_request_key: input.requestKey,
  });
  if (error) throw parseError(error) ?? error;
  const body = data as unknown as { status?: string; gaps?: string[] } & FinancialDocumentRecord;
  if (body.status === 'incomplete') {
    throw new FinancialDocumentError('incomplete');
  }
  return asRecord(data as Json);
}

export async function listFinancialDocuments(
  client: FieldSoloSupabaseClient,
  jobId: string,
): Promise<FinancialDocumentRecord[]> {
  const { data, error } = await client.rpc('list_financial_documents', { p_job_id: jobId });
  if (error) throw parseError(error) ?? error;
  const body = data as unknown as { documents?: FinancialDocumentRecord[] };
  return body.documents ?? [];
}

export async function setFinancialDocumentControls(
  client: FieldSoloSupabaseClient,
  input: {
    documentId: string;
    archived: boolean;
    linkEnabled: boolean;
    expectedRevision: number;
  },
): Promise<FinancialDocumentRecord> {
  const { data, error } = await client.rpc('set_financial_document_controls', {
    p_document_id: input.documentId,
    p_archived: input.archived,
    p_link_enabled: input.linkEnabled,
    p_expected_revision: input.expectedRevision,
  });
  if (error) throw parseError(error) ?? error;
  return asRecord(data as Json);
}
