import { describe, expect, it, vi } from 'vitest';

import { saveJobCustomer, SaveJobCustomerError } from './saveJobCustomer';

function makeClient(rpc: ReturnType<typeof vi.fn>) {
  return { rpc } as never;
}

describe('saveJobCustomer', () => {
  it('serializes explicit null clears and maps ok snapshot', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        status: 'ok',
        snapshot: {
          jobId: 'job-1',
          updatedAt: '2026-01-01T00:00:00.000Z',
          customerId: 'cust-1',
          customerName: 'Jordan',
          customerPhone: null,
          customerEmail: 'jordan@example.com',
          serviceAddress: '123 Main',
        },
      },
      error: null,
    });

    const result = await saveJobCustomer(makeClient(rpc), 'job-1', {
      customerId: 'cust-1',
      customerName: 'Jordan',
      customerPhone: null,
      customerEmail: 'jordan@example.com',
      serviceAddress: '123 Main',
    });

    expect(result.status).toBe('ok');
    expect(rpc).toHaveBeenCalledWith('save_job_customer', {
      p_job_id: 'job-1',
      p_payload: {
        customerId: 'cust-1',
        customerName: 'Jordan',
        customerPhone: null,
        customerEmail: 'jordan@example.com',
        serviceAddress: '123 Main',
      },
    });
  });

  it('returns conflict snapshot without throwing', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        status: 'conflict',
        snapshot: {
          jobId: 'job-1',
          updatedAt: '2026-01-02T00:00:00.000Z',
          customerId: null,
          customerName: 'Server',
          customerPhone: null,
          customerEmail: null,
          serviceAddress: '',
        },
      },
      error: null,
    });

    const result = await saveJobCustomer(makeClient(rpc), 'job-1', {
      customerName: 'Stale',
      expectedJobUpdatedAt: '2000-01-01T00:00:00.000Z',
    });
    expect(result.status).toBe('conflict');
    expect(result.snapshot.customerName).toBe('Server');
  });

  it('throws SaveJobCustomerError on rpc failure', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'save_job_customer:invalid' },
    });
    await expect(
      saveJobCustomer(makeClient(rpc), 'job-1', { customerName: 'Pat' }),
    ).rejects.toBeInstanceOf(SaveJobCustomerError);
  });
});
