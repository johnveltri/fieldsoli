import { describe, expect, it, vi } from 'vitest';

import { applyJobDetailEdit, ApplyJobDetailEditError } from './applyJobDetailEdit';

function makeClient(rpc: ReturnType<typeof vi.fn>) {
  return { rpc } as never;
}

describe('applyJobDetailEdit', () => {
  it('maps ok response', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { status: 'ok' }, error: null });
    await expect(
      applyJobDetailEdit(makeClient(rpc), 'job-1', {
        job: {
          shortDescription: 'Title',
          longDescription: '',
          customerName: '',
          serviceAddress: '',
          revenueCents: null,
        },
        sessions: { create: [], update: [], deleteIds: [] },
        notes: { create: [], update: [], deleteIds: [] },
        materials: { create: [], update: [], deleteIds: [] },
        otherCosts: { create: [], update: [], deleteIds: [] },
      }),
    ).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith('apply_job_detail_edit', expect.objectContaining({ p_job_id: 'job-1' }));
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
          serviceAddress: '',
          revenueCents: null,
        },
        sessions: { create: [], update: [], deleteIds: ['sess-live'] },
        notes: { create: [], update: [], deleteIds: [] },
        materials: { create: [], update: [], deleteIds: [] },
        otherCosts: { create: [], update: [], deleteIds: [] },
      }),
    ).rejects.toBeInstanceOf(ApplyJobDetailEditError);
  });
});
