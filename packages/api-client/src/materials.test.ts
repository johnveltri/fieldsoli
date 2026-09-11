import { describe, expect, it } from 'vitest';

import { createMaterial, deleteMaterial, updateMaterial } from './materials';
import { makeBuilder, makeClient } from './testUtils';

describe('materials api client', () => {
  // --- createMaterial -------------------------------------------------------

  it('createMaterial inserts an unassigned (job-scoped) row with session_id null', async () => {
    let inserted: unknown;
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        job_costs: [
          makeBuilder({
            onInsert: (payload) => {
              inserted = payload;
            },
            singleResult: { data: { id: 'mat-1' }, error: null },
          }),
        ],
      },
    });

    const id = await createMaterial(client as never, {
      jobId: 'job-9',
      sessionId: null,
      description: '  1/2" PEX coupling  ',
      quantity: 10,
      unit: '  ea  ',
      unitCostCents: 125,
    });

    expect(id).toBe('mat-1');
    expect(inserted).toEqual({
      user_id: 'user-1',
      description: '1/2" PEX coupling',
      quantity: 10,
      unit: 'ea',
      unit_cost_cents: 125,
      total_cost_cents: 1250, // round(125 * 10)
      cost_type: 'material',
      job_id: 'job-9',
      session_id: null,
    });
  });

  it('createMaterial inserts a session-scoped row with job_id null', async () => {
    let inserted: unknown;
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        job_costs: [
          makeBuilder({
            onInsert: (payload) => {
              inserted = payload;
            },
            singleResult: { data: { id: 'mat-2' }, error: null },
          }),
        ],
      },
    });

    const id = await createMaterial(client as never, {
      jobId: 'job-9',
      sessionId: 'sess-1',
      description: 'Shutoff valve',
      quantity: 2,
      unit: 'ea',
      unitCostCents: 999,
    });

    expect(id).toBe('mat-2');
    expect(inserted).toEqual({
      user_id: 'user-1',
      description: 'Shutoff valve',
      quantity: 2,
      unit: 'ea',
      unit_cost_cents: 999,
      total_cost_cents: 1998,
      cost_type: 'material',
      job_id: null,
      session_id: 'sess-1',
    });
  });

  it('createMaterial rounds fractional totals to the nearest cent', async () => {
    let inserted: unknown;
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        job_costs: [
          makeBuilder({
            onInsert: (payload) => {
              inserted = payload;
            },
            singleResult: { data: { id: 'mat-3' }, error: null },
          }),
        ],
      },
    });

    await createMaterial(client as never, {
      jobId: 'job-9',
      sessionId: null,
      description: 'Copper wire',
      quantity: 3.333,
      unit: 'ft',
      unitCostCents: 150,
    });

    // 150 * 3.333 = 499.95 -> round to 500.
    expect((inserted as { total_cost_cents: number }).total_cost_cents).toBe(500);
  });

  it('createMaterial preserves a total-only capture without inventing a breakdown', async () => {
    let inserted: unknown;
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        job_costs: [
          makeBuilder({
            onInsert: (payload) => {
              inserted = payload;
            },
            singleResult: { data: { id: 'mat-total-only' }, error: null },
          }),
        ],
      },
    });

    await createMaterial(client as never, {
      jobId: 'job-9',
      sessionId: null,
      description: 'Permit fee',
      quantity: 1,
      unit: 'ea',
      unitCostCents: 4750,
      quantityExplicit: false,
      unitCostExplicit: false,
      totalCostCents: 4750,
    });

    expect(inserted).toMatchObject({
      quantity: null,
      quantity_explicit: false,
      unit_cost_cents: null,
      unit_cost_explicit: false,
      total_cost_cents: 4750,
    });
  });

  it('createMaterial rejects a blank description', async () => {
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: { job_costs: [] },
    });

    await expect(
      createMaterial(client as never, {
        jobId: 'job-9',
        sessionId: null,
        description: '   ',
        quantity: 1,
        unit: 'ea',
        unitCostCents: 100,
      }),
    ).rejects.toThrow('Material description must not be blank.');
  });

  it('createMaterial rejects non-positive quantity', async () => {
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: { job_costs: [] },
    });

    await expect(
      createMaterial(client as never, {
        jobId: 'job-9',
        sessionId: null,
        description: 'Wire',
        quantity: 0,
        unit: 'ft',
        unitCostCents: 100,
      }),
    ).rejects.toThrow('Material quantity must be a positive number.');
  });

  it('createMaterial rejects negative unit cost', async () => {
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: { job_costs: [] },
    });

    await expect(
      createMaterial(client as never, {
        jobId: 'job-9',
        sessionId: null,
        description: 'Wire',
        quantity: 1,
        unit: 'ft',
        unitCostCents: -1,
      }),
    ).rejects.toThrow('Material unit cost must be a non-negative number of cents.');
  });

  it('createMaterial throws when no authenticated user exists', async () => {
    const client = makeClient({
      authUserId: null,
      buildersByTable: { job_costs: [] },
    });

    await expect(
      createMaterial(client as never, {
        jobId: 'job-9',
        sessionId: null,
        description: 'Wire',
        quantity: 1,
        unit: 'ft',
        unitCostCents: 100,
      }),
    ).rejects.toThrow('No authenticated user available to create a material.');
  });

  // --- updateMaterial -------------------------------------------------------

  it('updateMaterial updates description only when no cost fields or sessionId are set', async () => {
    let patch: unknown;
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        job_costs: [
          makeBuilder({
            onUpdate: (value) => {
              patch = value;
            },
            maybeSingleResult: { data: { id: 'mat-1' }, error: null },
          }),
        ],
      },
    });

    await updateMaterial(client as never, 'mat-1', { description: '  trimmed  ' });

    expect(patch).toEqual({ description: 'trimmed' });
  });

  it('updateMaterial recomputes total_cost_cents when both quantity and unitCostCents are provided', async () => {
    let patch: unknown;
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        job_costs: [
          makeBuilder({
            onUpdate: (value) => {
              patch = value;
            },
            maybeSingleResult: { data: { id: 'mat-1' }, error: null },
          }),
        ],
      },
    });

    await updateMaterial(client as never, 'mat-1', {
      quantity: 4,
      unitCostCents: 250,
    });

    expect(patch).toEqual({
      quantity: 4,
      unit_cost_cents: 250,
      total_cost_cents: 1000,
    });
  });

  it('updateMaterial preserves a total-only capture without a synthetic quantity or unit cost', async () => {
    let patch: unknown;
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        job_costs: [
          makeBuilder({
            onUpdate: (value) => {
              patch = value;
            },
            maybeSingleResult: { data: { id: 'mat-1' }, error: null },
          }),
        ],
      },
    });

    await updateMaterial(client as never, 'mat-1', {
      quantity: 1,
      unitCostCents: 4750,
      quantityExplicit: false,
      unitCostExplicit: false,
      totalCostCents: 4750,
    });

    expect(patch).toEqual({
      quantity: null,
      quantity_explicit: false,
      unit_cost_cents: null,
      unit_cost_explicit: false,
      total_cost_cents: 4750,
    });
  });

  it('updateMaterial reads current row when only quantity changes so total stays accurate', async () => {
    let patch: unknown;
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        job_costs: [
          // 1) SELECT current quantity/unit_cost_cents.
          makeBuilder({
            maybeSingleResult: {
              data: { quantity: '5.000', unit_cost_cents: 100 },
              error: null,
            },
          }),
          // 2) UPDATE.
          makeBuilder({
            onUpdate: (value) => {
              patch = value;
            },
            maybeSingleResult: { data: { id: 'mat-1' }, error: null },
          }),
        ],
      },
    });

    await updateMaterial(client as never, 'mat-1', { quantity: 7 });

    expect(patch).toEqual({ quantity: 7, total_cost_cents: 700 });
  });

  it('updateMaterial reads current row when only unitCostCents changes', async () => {
    let patch: unknown;
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        job_costs: [
          makeBuilder({
            maybeSingleResult: {
              data: { quantity: 3, unit_cost_cents: 200 },
              error: null,
            },
          }),
          makeBuilder({
            onUpdate: (value) => {
              patch = value;
            },
            maybeSingleResult: { data: { id: 'mat-1' }, error: null },
          }),
        ],
      },
    });

    await updateMaterial(client as never, 'mat-1', { unitCostCents: 333 });

    expect(patch).toEqual({ unit_cost_cents: 333, total_cost_cents: 999 });
  });

  it('updateMaterial moves a material to a session by clearing job_id in the same UPDATE', async () => {
    let patch: unknown;
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        job_costs: [
          makeBuilder({
            onUpdate: (value) => {
              patch = value;
            },
            maybeSingleResult: { data: { id: 'mat-1' }, error: null },
          }),
        ],
      },
    });

    await updateMaterial(client as never, 'mat-1', { sessionId: 'sess-42' });

    expect(patch).toEqual({ job_id: null, session_id: 'sess-42' });
  });

  it('updateMaterial moves a session-scoped row back to unassigned by resolving parent job', async () => {
    let patch: unknown;
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        job_costs: [
          // 1) SELECT current job_id/session_id (session-scoped row).
          makeBuilder({
            maybeSingleResult: {
              data: { job_id: null, session_id: 'sess-7' },
              error: null,
            },
          }),
          // 2) UPDATE.
          makeBuilder({
            onUpdate: (value) => {
              patch = value;
            },
            maybeSingleResult: { data: { id: 'mat-1' }, error: null },
          }),
        ],
        sessions: [
          makeBuilder({
            maybeSingleResult: { data: { job_id: 'job-9' }, error: null },
          }),
        ],
      },
    });

    await updateMaterial(client as never, 'mat-1', { sessionId: null });

    expect(patch).toEqual({ job_id: 'job-9', session_id: null });
  });

  it('updateMaterial moves back to unassigned using provided jobId without extra reads', async () => {
    let patch: unknown;
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        job_costs: [
          makeBuilder({
            onUpdate: (value) => {
              patch = value;
            },
            maybeSingleResult: { data: { id: 'mat-1' }, error: null },
          }),
        ],
      },
    });

    await updateMaterial(client as never, 'mat-1', { sessionId: null, jobId: 'job-77' });

    expect(patch).toEqual({ job_id: 'job-77', session_id: null });
    expect((client.from as unknown as { mock: { calls: unknown[][] } }).mock.calls).toEqual([
      ['job_costs'],
    ]);
  });

  it('updateMaterial rejects a blank description', async () => {
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: { job_costs: [] },
    });

    await expect(
      updateMaterial(client as never, 'mat-1', { description: '   ' }),
    ).rejects.toThrow('Material description must not be blank.');
  });

  it('updateMaterial throws when the target row is not affected (e.g. RLS or soft-deleted)', async () => {
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        job_costs: [
          makeBuilder({
            maybeSingleResult: { data: null, error: null },
          }),
        ],
      },
    });

    await expect(
      updateMaterial(client as never, 'mat-1', { description: 'new' }),
    ).rejects.toThrow('Update affected no rows (check RLS: material must be owned by you).');

    const materialsBuilder = (
      client.from as unknown as { mock: { results: Array<{ value: unknown }> } }
    ).mock.results[0]?.value as { is: { mock: { calls: unknown[][] } } };
    expect(materialsBuilder.is.mock.calls).toContainEqual(['deleted_at', null]);
  });

  // --- deleteMaterial -------------------------------------------------------

  it('deleteMaterial stamps deleted_at with an ISO timestamp', async () => {
    let patch: unknown;
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        job_costs: [
          makeBuilder({
            onUpdate: (value) => {
              patch = value;
            },
            maybeSingleResult: { data: { id: 'mat-1' }, error: null },
          }),
        ],
      },
    });

    await deleteMaterial(client as never, 'mat-1');

    const row = patch as { deleted_at: string };
    expect(typeof row.deleted_at).toBe('string');
    expect(Date.parse(row.deleted_at)).not.toBeNaN();

    const materialsBuilder = (
      client.from as unknown as { mock: { results: Array<{ value: unknown }> } }
    ).mock.results[0]?.value as { is: { mock: { calls: unknown[][] } } };
    expect(materialsBuilder.is.mock.calls).toContainEqual(['deleted_at', null]);
  });

  it('deleteMaterial throws when no rows are affected', async () => {
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        job_costs: [
          makeBuilder({
            maybeSingleResult: { data: null, error: null },
          }),
        ],
      },
    });

    await expect(deleteMaterial(client as never, 'mat-1')).rejects.toThrow(
      'Delete affected no rows (check RLS: material must be owned by you).',
    );
  });
});
