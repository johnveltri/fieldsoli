import { describe, expect, it, vi } from 'vitest';

import {
  createAndSelectFinancialDocument,
  finalizeJobWithInvoice,
} from './financialDocuments';

describe('financial document revenue controls', () => {
  it('maps an incomplete invoice response to the typed document error', async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { message: 'financial_document:incomplete' },
    }));

    await expect(createAndSelectFinancialDocument({ rpc } as never, {
      jobId: 'job-1',
      fingerprint: 'preview-1',
      timezone: 'America/Chicago',
      requestKey: 'request-1',
    })).rejects.toMatchObject({ name: 'FinancialDocumentError', code: 'incomplete' });

    expect(rpc).toHaveBeenCalledWith('create_and_select_financial_document', {
      p_job_id: 'job-1',
      p_type: 'invoice',
      p_fingerprint: 'preview-1',
      p_timezone: 'America/Chicago',
      p_request_key: 'request-1',
      p_confirmed_paid_total: null,
    });
  });

  it('sends the reviewed invoice total and idempotency key to finalization', async () => {
    const document = { id: 'invoice-1', jobId: 'job-1' };
    const rpc = vi.fn(async () => ({ data: document, error: null }));

    await expect(finalizeJobWithInvoice({ rpc } as never, {
      jobId: 'job-1',
      status: 'paid',
      documentId: 'invoice-1',
      timezone: 'America/Chicago',
      requestKey: 'request-2',
      confirmedPaidTotalCents: 56500,
    })).resolves.toEqual(document);

    expect(rpc).toHaveBeenCalledWith('finalize_job_with_invoice', {
      p_job_id: 'job-1',
      p_status: 'paid',
      p_document_id: 'invoice-1',
      p_fingerprint: null,
      p_timezone: 'America/Chicago',
      p_request_key: 'request-2',
      p_confirmed_paid_total: 56500,
    });
  });
});
