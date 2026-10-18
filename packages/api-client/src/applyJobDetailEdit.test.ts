import { describe, expect, it, vi } from 'vitest';

import { applyJobDetailEdit, ApplyJobDetailEditError } from './applyJobDetailEdit';

function makeClient(rpc: ReturnType<typeof vi.fn>) {
  return { rpc } as never;
}

describe('applyJobDetailEdit', () => {
  it('sends zero-labor confirmation separately from aggregate no-revenue confirmation', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { status: 'ok' }, error: null });
    await applyJobDetailEdit(makeClient(rpc), 'job-1', {
      job: {
        shortDescription: 'Materials only', longDescription: '', customerName: 'Customer',
        customerPhone: null, customerEmail: null, customerId: null, serviceAddress: '',
        revenueCents: 2000, pricingIntent: 'labor', laborServicesCents: 0,
        noLaborServicesConfirmed: true, noRevenueConfirmed: false,
        noMaterialsConfirmed: false, noOtherCostsConfirmed: true,
      },
      sessions: { create: [], update: [], deleteIds: [] },
      notes: { create: [], update: [], deleteIds: [] },
      materials: { create: [], update: [], deleteIds: [] },
      otherCosts: { create: [], update: [], deleteIds: [] },
    });
    expect(rpc).toHaveBeenCalledWith('apply_job_detail_edit_with_invoice_preferences', {
      p_job_id: 'job-1',
      p_payload: expect.objectContaining({ job: expect.objectContaining({
        pricingIntent: 'labor', laborServicesCents: 0,
        noLaborServicesConfirmed: true, noRevenueConfirmed: false,
      }) }),
    });
  });

  it('maps ok response', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { status: 'ok' }, error: null });
    await expect(
      applyJobDetailEdit(makeClient(rpc), 'job-1', {
        job: {
          shortDescription: 'Title',
          longDescription: '',
          customerName: '',
          customerPhone: null,
          customerEmail: null,
          customerId: null,
          serviceAddress: '',
          revenueCents: null,
          noRevenueConfirmed: true,
          noMaterialsConfirmed: true,
          noOtherCostsConfirmed: false,
        },
        sessions: { create: [], update: [], deleteIds: [] },
        notes: { create: [], update: [], deleteIds: [] },
        materials: { create: [], update: [], deleteIds: [] },
        otherCosts: { create: [], update: [], deleteIds: [] },
        invoicePreferences: {
          revenueDocumentId: 'invoice-2',
          expectedRevenueDocumentId: 'invoice-1',
          confirmedPaidTotalCents: 12500,
          controls: [],
        },
      }),
    ).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith('apply_job_detail_edit_with_invoice_preferences', {
      p_job_id: 'job-1',
      p_payload: expect.objectContaining({
        job: expect.objectContaining({
          noRevenueConfirmed: true,
          noMaterialsConfirmed: true,
          noOtherCostsConfirmed: false,
        }),
        invoicePreferences: {
          revenueDocumentId: 'invoice-2',
          expectedRevenueDocumentId: 'invoice-1',
          confirmedPaidTotalCents: 12500,
          controls: [],
        },
      }),
    });
  });

  it('throws ApplyJobDetailEditError on conflict', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'apply_job_detail_edit:conflict' },
    });
    await expect(
      applyJobDetailEdit(makeClient(rpc), 'job-1', {
        job: {
          shortDescription: 'Title',
          longDescription: '',
          customerName: '',
          customerPhone: null,
          customerEmail: null,
          customerId: null,
          serviceAddress: '',
          revenueCents: null,
          noRevenueConfirmed: false,
          noMaterialsConfirmed: false,
          noOtherCostsConfirmed: false,
        },
        sessions: { create: [], update: [], deleteIds: ['sess-live'] },
        notes: { create: [], update: [], deleteIds: [] },
        materials: { create: [], update: [], deleteIds: [] },
        otherCosts: { create: [], update: [], deleteIds: [] },
      }),
    ).rejects.toBeInstanceOf(ApplyJobDetailEditError);
  });
});
