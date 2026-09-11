import { describe, expect, it } from 'vitest';

import { fetchJobDetail } from './jobDetail';
import {
  createBlankJobForCurrentUser,
  createBlankJobForLiveSessionStart,
  createJobForCurrentUser,
  countCompletedJobsForCurrentUser,
  deleteJobById,
  getEarningsSnapshotForCurrentUser,
  getOutstandingPaymentsForCurrentUser,
  getWeeklyNetEarningsCentsForCurrentUser,
  jobDetailWorkStatusToDbColumns,
  listJobsForCurrentUser,
  listJobsForCurrentUserPage,
  listRecentJobsForCurrentUser,
  updateJobById,
  updateJobCostsReviewed,
  updateJobNoRevenueConfirmed,
  bumpJobToInProgressIfNotStarted,
  updateJobStatusById,
} from './jobs';
import { makeBuilder, makeClient } from './testUtils';

describe('jobs api client', () => {
  it('counts completed, non-deleted jobs for the current user', async () => {
    const jobsBuilder = makeBuilder({
      awaitResult: { data: null, error: null, count: 3 },
    });
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: { jobs: [jobsBuilder] },
    });

    await expect(countCompletedJobsForCurrentUser(client as never)).resolves.toBe(3);
    expect(jobsBuilder.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
    expect(jobsBuilder.eq).toHaveBeenCalledWith('job_work_status', 'completed');
    expect(jobsBuilder.is).toHaveBeenCalledWith('deleted_at', null);
  });

  it('createBlankJobForCurrentUser inserts required defaults and returns id', async () => {
    let inserted: unknown;
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        jobs: [
          makeBuilder({
            onInsert: (payload) => {
              inserted = payload;
            },
            singleResult: { data: { id: 'job-123' }, error: null },
          }),
        ],
      },
    });

    const id = await createBlankJobForCurrentUser(client as never);

    expect(id).toBe('job-123');
    expect(inserted).toEqual({
      user_id: 'user-1',
      short_description: 'Untitled Job',
      customer_name: '',
      service_address: '',
      job_type: '',
      created_via: 'add_job',
      job_work_status: 'not_started',
    });
  });

  it('createBlankJobForCurrentUser throws without authenticated user', async () => {
    const client = makeClient({
      authUserId: null,
      buildersByTable: { jobs: [] },
    });

    await expect(createBlankJobForCurrentUser(client as never)).rejects.toThrow(
      'No authenticated user available to create a job.',
    );
  });

  it('createBlankJobForLiveSessionStart inserts a session-start job with the provided title', async () => {
    let inserted: unknown;
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        jobs: [
          makeBuilder({
            onInsert: (payload) => {
              inserted = payload;
            },
            singleResult: { data: { id: 'job-live-1' }, error: null },
          }),
        ],
      },
    });

    const id = await createBlankJobForLiveSessionStart(client as never, {
      shortDescription: '  Live Session May 9 at 12:00 PM  ',
    });

    expect(id).toBe('job-live-1');
    expect(inserted).toEqual({
      user_id: 'user-1',
      short_description: 'Live Session May 9 at 12:00 PM',
      customer_name: '',
      service_address: '',
      job_type: '',
      created_via: 'session_start',
      job_work_status: 'not_started',
    });
  });

  it('createBlankJobForLiveSessionStart rejects blank titles', async () => {
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: { jobs: [] },
    });

    await expect(
      createBlankJobForLiveSessionStart(client as never, { shortDescription: '   ' }),
    ).rejects.toThrow('Short description is required.');
  });

  it('createJobForCurrentUser inserts with typed title and optional identity', async () => {
    let inserted: unknown;
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        jobs: [
          makeBuilder({
            onInsert: (payload) => {
              inserted = payload;
            },
            singleResult: { data: { id: 'job-named-1' }, error: null },
          }),
        ],
      },
    });

    const id = await createJobForCurrentUser(client as never, {
      shortDescription: '  Fence repair  ',
      longDescription: ' Gate latch ',
      customerName: ' Alice ',
      serviceAddress: ' 12 Oak ',
      revenueCents: 15000,
    });

    expect(id).toBe('job-named-1');
    expect(inserted).toEqual({
      user_id: 'user-1',
      short_description: 'Fence repair',
      long_description: 'Gate latch',
      customer_name: 'Alice',
      service_address: '12 Oak',
      revenue_cents: 15000,
      job_type: '',
      created_via: 'add_job',
      job_work_status: 'not_started',
    });
  });

  it('createJobForCurrentUser rejects blank titles', async () => {
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: { jobs: [] },
    });

    await expect(
      createJobForCurrentUser(client as never, { shortDescription: '   ' }),
    ).rejects.toThrow('Short description is required.');
  });

  it('listRecentJobsForCurrentUser returns lightweight recent job rows', async () => {
    const builder = makeBuilder({
      awaitResult: {
        data: [
          {
            id: 'job-2',
            short_description: 'Replace switch',
            customer_name: 'Alice',
          },
          {
            id: 'job-1',
            short_description: 'Install light',
            customer_name: null,
          },
        ],
        error: null,
      },
    });
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: { jobs: [builder] },
    });

    const jobs = await listRecentJobsForCurrentUser(client as never, { limit: 3 });

    expect(jobs).toEqual([
      { id: 'job-2', shortDescription: 'Replace switch', customerName: 'Alice' },
      { id: 'job-1', shortDescription: 'Install light', customerName: null },
    ]);
    expect(builder.select).toHaveBeenCalledWith('id, short_description, customer_name');
    expect(builder.is).toHaveBeenCalledWith('deleted_at', null);
    expect(builder.order).toHaveBeenCalledWith('updated_at', { ascending: false });
    expect(builder.order).toHaveBeenCalledWith('id', { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(3);
  });

  it('getWeeklyNetEarningsCentsForCurrentUser includes session-attached materials', async () => {
    const weeklyJobsBuilder = makeBuilder({
      awaitResult: {
        data: [{ id: 'job-weekly', revenue_cents: 10000 }],
        error: null,
      },
    });
    const allJobSessionsBuilder = makeBuilder({
      awaitResult: {
        data: [{ id: 'sess-weekly' }, { id: 'sess-old' }],
        error: null,
      },
    });
    const materialsByJobBuilder = makeBuilder({
      awaitResult: {
        data: [{ id: 'mat-job', total_cost_cents: 1500 }],
        error: null,
      },
    });
    const materialsBySessionBuilder = makeBuilder({
      awaitResult: {
        data: [{ id: 'mat-session', total_cost_cents: 2000 }],
        error: null,
      },
    });
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        jobs: [weeklyJobsBuilder],
        sessions: [allJobSessionsBuilder],
        job_costs: [materialsByJobBuilder, materialsBySessionBuilder],
      },
    });

    const result = await getWeeklyNetEarningsCentsForCurrentUser(client as never);

    expect(result).toEqual({ netEarningsCents: 6500, jobCount: 1 });
    expect(weeklyJobsBuilder.select).toHaveBeenCalledWith('id, revenue_cents');
    expect(weeklyJobsBuilder.eq).toHaveBeenCalledWith('job_work_status', 'completed');
    expect(weeklyJobsBuilder.eq).toHaveBeenCalledWith('is_job_record_complete', true);
    expect(weeklyJobsBuilder.gte).toHaveBeenCalledWith('last_worked_at', expect.any(String));
    expect(weeklyJobsBuilder.is).toHaveBeenCalledWith('deleted_at', null);
    expect(allJobSessionsBuilder.select).toHaveBeenCalledWith('id');
    expect(allJobSessionsBuilder.in).toHaveBeenCalledWith('job_id', ['job-weekly']);
    expect(materialsByJobBuilder.in).toHaveBeenCalledWith('job_id', ['job-weekly']);
    expect(materialsBySessionBuilder.in).toHaveBeenCalledWith('session_id', [
      'sess-weekly',
      'sess-old',
    ]);
  });

  it('getEarningsSnapshotForCurrentUser rolls up revenue, materials, hours, and net per hour', async () => {
    const snapshotJobsBuilder = makeBuilder({
      awaitResult: {
        data: [
          {
            id: 'job-high',
            short_description: 'Panel upgrade',
            customer_name: 'Ada',
            revenue_cents: 120000,
          },
          {
            id: 'job-low',
            short_description: 'Outlet repair',
            customer_name: null,
            revenue_cents: 20000,
          },
        ],
        error: null,
      },
    });
    const sessionsBuilder = makeBuilder({
      awaitResult: {
        data: [
          {
            id: 'sess-high',
            job_id: 'job-high',
            session_status: 'ended',
            started_at: '2026-05-09T10:00:00.000Z',
            ended_at: '2026-05-09T12:00:00.000Z',
          },
          {
            id: 'sess-low',
            job_id: 'job-low',
            session_status: 'ended',
            started_at: '2026-05-09T09:00:00.000Z',
            ended_at: '2026-05-09T10:00:00.000Z',
          },
          {
            id: 'sess-deleted',
            job_id: 'job-high',
            session_status: 'deleted',
            started_at: '2026-05-09T13:00:00.000Z',
            ended_at: '2026-05-09T14:00:00.000Z',
          },
        ],
        error: null,
      },
    });
    const materialsByJobBuilder = makeBuilder({
      awaitResult: {
        data: [
          {
            id: 'mat-shared',
            job_id: 'job-high',
            session_id: 'sess-high',
            total_cost_cents: 30000,
          },
          {
            id: 'mat-low',
            job_id: 'job-low',
            session_id: null,
            total_cost_cents: 5000,
          },
        ],
        error: null,
      },
    });
    const materialsBySessionBuilder = makeBuilder({
      awaitResult: {
        data: [
          {
            id: 'mat-shared',
            job_id: 'job-high',
            session_id: 'sess-high',
            total_cost_cents: 30000,
          },
          {
            id: 'mat-session-only',
            job_id: null,
            session_id: 'sess-high',
            total_cost_cents: 10000,
          },
        ],
        error: null,
      },
    });
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        jobs: [snapshotJobsBuilder],
        sessions: [sessionsBuilder],
        job_costs: [materialsByJobBuilder, materialsBySessionBuilder],
      },
    });

    const result = await getEarningsSnapshotForCurrentUser(client as never, { windowDays: 30 });

    expect(result.aggregate).toEqual({
      revenueCents: 140000,
      materialsCents: -45000,
      netEarningsCents: 95000,
      totalHours: 3,
      jobCount: 2,
      netPerHrCents: 95000 / 3,
    });
    expect(result.jobs).toEqual([
      {
        id: 'job-high',
        shortDescription: 'Panel upgrade',
        customerName: 'Ada',
        revenueCents: 120000,
        materialsCents: -40000,
        netEarningsCents: 80000,
        hours: 2,
        netPerHrCents: 40000,
      },
      {
        id: 'job-low',
        shortDescription: 'Outlet repair',
        customerName: null,
        revenueCents: 20000,
        materialsCents: -5000,
        netEarningsCents: 15000,
        hours: 1,
        netPerHrCents: 15000,
      },
    ]);
    expect(snapshotJobsBuilder.select).toHaveBeenCalledWith(
      'id, short_description, customer_name, revenue_cents',
    );
    expect(snapshotJobsBuilder.eq).toHaveBeenCalledWith('job_work_status', 'completed');
    expect(snapshotJobsBuilder.eq).toHaveBeenCalledWith('is_job_record_complete', true);
    expect(snapshotJobsBuilder.gte).toHaveBeenCalledWith('last_worked_at', expect.any(String));
    expect(snapshotJobsBuilder.is).toHaveBeenCalledWith('deleted_at', null);
    expect(sessionsBuilder.in).toHaveBeenCalledWith('job_id', ['job-high', 'job-low']);
    expect(materialsByJobBuilder.in).toHaveBeenCalledWith('job_id', ['job-high', 'job-low']);
    expect(materialsBySessionBuilder.in).toHaveBeenCalledWith('session_id', [
      'sess-high',
      'sess-low',
    ]);
  });

  it('getOutstandingPaymentsForCurrentUser counts financially complete unpaid jobs', async () => {
    const outstandingBuilder = makeBuilder({
      awaitResult: {
        data: [
          { revenue_cents: 50000, collected_cents: 0 },
          { revenue_cents: null, collected_cents: 0 },
          { revenue_cents: 12500, collected_cents: 0 },
        ],
        error: null,
      },
    });
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        jobs: [outstandingBuilder],
      },
    });

    const result = await getOutstandingPaymentsForCurrentUser(client as never);

    expect(result).toEqual({ count: 3, revenueCents: 62500 });
    expect(outstandingBuilder.select).toHaveBeenCalledWith('revenue_cents, collected_cents');
    expect(outstandingBuilder.eq).toHaveBeenCalledWith('job_work_status', 'completed');
    expect(outstandingBuilder.eq).toHaveBeenCalledWith('is_job_record_complete', true);
    expect(outstandingBuilder.or).toHaveBeenCalledWith(
      'job_payment_state.is.null,job_payment_state.eq.unpaid,job_payment_state.eq.partially_paid',
    );
    expect(outstandingBuilder.is).toHaveBeenCalledWith('deleted_at', null);
  });

  it('deleteJobById performs soft-delete and validates affected rows', async () => {
    let patch: unknown;
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        jobs: [
          makeBuilder({
            onUpdate: (value) => {
              patch = value;
            },
            maybeSingleResult: { data: { id: 'job-1' }, error: null },
          }),
        ],
      },
    });

    await deleteJobById(client as never, 'job-1');

    expect(typeof (patch as { deleted_at: unknown }).deleted_at).toBe('string');
    expect(Date.parse((patch as { deleted_at: string }).deleted_at)).not.toBeNaN();
  });

  it('deleteJobById throws when no rows are affected', async () => {
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        jobs: [
          makeBuilder({
            maybeSingleResult: { data: null, error: null },
          }),
        ],
      },
    });

    await expect(deleteJobById(client as never, 'job-1')).rejects.toThrow(
      'Delete affected no rows',
    );
  });

  it('updateJobById validates input and normalizes strings', async () => {
    let patch: unknown;
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        jobs: [
          makeBuilder({
            onUpdate: (value) => {
              patch = value;
            },
            maybeSingleResult: { data: { id: 'job-1' }, error: null },
          }),
        ],
      },
    });

    await updateJobById(client as never, 'job-1', {
      shortDescription: '  Replace ceiling fan  ',
      longDescription: '  Recaulk and replace the valve.  ',
      customerName: '  Jane Doe ',
      serviceAddress: '  101 Main St ',
      revenueCents: 125000,
    });

    expect(patch).toEqual({
      short_description: 'Replace ceiling fan',
      long_description: 'Recaulk and replace the valve.',
      customer_name: 'Jane Doe',
      service_address: '101 Main St',
      revenue_cents: 125000,
    });
  });

  it('jobDetailWorkStatusToDbColumns maps UI status to DB columns', () => {
    expect(jobDetailWorkStatusToDbColumns('notStarted')).toEqual({
      job_work_status: 'not_started',
      collected_cents: 0,
    });
    expect(jobDetailWorkStatusToDbColumns('completed')).toEqual({
      job_work_status: 'completed',
      collected_cents: 0,
    });
    expect(jobDetailWorkStatusToDbColumns('paid', 25000)).toEqual({
      job_work_status: 'completed',
      collected_cents: 25000,
    });
    expect(jobDetailWorkStatusToDbColumns('cancelled')).toEqual({
      job_work_status: 'canceled',
      collected_cents: 0,
    });
  });

  it('updateJobStatusById patches work + payment columns', async () => {
    let patch: unknown;
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        jobs: [
          makeBuilder({
            onUpdate: (value) => {
              patch = value;
            },
            maybeSingleResult: { data: { id: 'job-1' }, error: null },
          }),
        ],
      },
    });

    await updateJobStatusById(client as never, 'job-1', 'inProgress');

    expect(patch).toEqual({
      job_work_status: 'in_progress',
      collected_cents: 0,
    });
  });

  it('updateJobStatusById throws when no rows are affected', async () => {
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        jobs: [makeBuilder({ maybeSingleResult: { data: null, error: null } })],
      },
    });

    await expect(updateJobStatusById(client as never, 'job-1', 'completed')).rejects.toThrow(
      'Update affected no rows',
    );
  });

  it('bumpJobToInProgressIfNotStarted patches job to in_progress', async () => {
    let patch: unknown;
    const jobBuilder = makeBuilder({
      onUpdate: (value) => {
        patch = value;
      },
      awaitResult: { data: null, error: null },
    });
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        jobs: [jobBuilder],
      },
    });

    await bumpJobToInProgressIfNotStarted(client as never, 'job-1');

    expect(patch).toEqual({ job_work_status: 'in_progress' });
    expect(jobBuilder.eq).toHaveBeenCalledWith('id', 'job-1');
    expect(jobBuilder.eq).toHaveBeenCalledWith('job_work_status', 'not_started');
  });

  it('updateJobCostsReviewed stamps costs_reviewed_at', async () => {
    let patch: unknown;
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        jobs: [
          makeBuilder({
            onUpdate: (value) => {
              patch = value;
            },
            maybeSingleResult: { data: { id: 'job-1' }, error: null },
          }),
        ],
      },
    });

    await updateJobCostsReviewed(client as never, 'job-1', true);

    expect(patch).toEqual({ materials_reviewed_at: expect.any(String) });
  });

  it('updateJobNoRevenueConfirmed stamps confirmation and zeros revenue', async () => {
    let patch: unknown;
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        jobs: [
          makeBuilder({
            onUpdate: (value) => {
              patch = value;
            },
            maybeSingleResult: { data: { id: 'job-1' }, error: null },
          }),
        ],
      },
    });

    await updateJobNoRevenueConfirmed(client as never, 'job-1', true);

    expect(patch).toEqual({
      no_revenue_confirmed_at: expect.any(String),
      revenue_cents: 0,
    });
  });

  it('updateJobNoRevenueConfirmed clears confirmation without wiping revenue', async () => {
    let patch: unknown;
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        jobs: [
          makeBuilder({
            onUpdate: (value) => {
              patch = value;
            },
            maybeSingleResult: { data: { id: 'job-1' }, error: null },
          }),
        ],
      },
    });

    await updateJobNoRevenueConfirmed(client as never, 'job-1', false);

    expect(patch).toEqual({ no_revenue_confirmed_at: null });
  });

  it('updateJobById rejects blank titles and invalid revenue', async () => {
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        jobs: [makeBuilder({ maybeSingleResult: { data: { id: 'job-1' }, error: null } })],
      },
    });

    await expect(
      updateJobById(client as never, 'job-1', {
        shortDescription: '   ',
        longDescription: '',
        customerName: '',
        serviceAddress: '',
        revenueCents: 0,
      }),
    ).rejects.toThrow('Short description is required.');

    await expect(
      updateJobById(client as never, 'job-1', {
        shortDescription: 'Valid title',
        longDescription: '',
        customerName: '',
        serviceAddress: '',
        revenueCents: -1,
      }),
    ).rejects.toThrow('Revenue must be a non-negative dollar amount.');

    await expect(
      updateJobById(client as never, 'job-1', {
        shortDescription: 'Valid title',
        longDescription: '',
        customerName: '',
        serviceAddress: '',
        revenueCents: 99.5,
      }),
    ).rejects.toThrow('Revenue must be a non-negative dollar amount.');
  });

  it('listJobsForCurrentUser computes metrics from non-deleted sessions and material dedupe', async () => {
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        jobs: [
          makeBuilder({
            awaitResult: {
              data: [
                {
                  id: 'job-1',
                  short_description: 'Install faucet',
                  customer_name: 'Alice',
                  updated_at: '2026-04-17T10:00:00.000Z',
                  created_at: '2026-04-10T08:00:00.000Z',
                  last_worked_at: '2026-04-16T12:00:00.000Z',
                  job_type: 'plumbing',
                  job_work_status: 'completed',
                  job_payment_state: 'paid',
                  revenue_cents: 50000,
                  collected_cents: 50000,
                  is_job_record_complete: true,
                },
              ],
              error: null,
            },
          }),
        ],
        sessions: [
          makeBuilder({
            awaitResult: {
              data: [
                {
                  id: 'sess-ended',
                  job_id: 'job-1',
                  session_status: 'ended',
                  started_at: '2026-04-16T10:00:00.000Z',
                  ended_at: '2026-04-16T12:00:00.000Z',
                },
                {
                  id: 'sess-deleted',
                  job_id: 'job-1',
                  session_status: 'deleted',
                  started_at: '2026-04-17T10:00:00.000Z',
                  ended_at: null,
                },
              ],
              error: null,
            },
          }),
        ],
        job_costs: [
          makeBuilder({
            awaitResult: {
              data: [
                {
                  id: 'mat-shared',
                  job_id: 'job-1',
                  session_id: 'sess-ended',
                  description: 'Shared material',
                  cost_type: 'material',
                  total_cost_cents: 4000,
                },
                {
                  id: 'mat-job-only',
                  job_id: 'job-1',
                  session_id: null,
                  description: 'Job material',
                  cost_type: 'material',
                  total_cost_cents: 1000,
                },
              ],
              error: null,
            },
          }),
          makeBuilder({
            awaitResult: {
              data: [
                {
                  id: 'mat-shared',
                  job_id: 'job-1',
                  session_id: 'sess-ended',
                  description: 'Shared material',
                  cost_type: 'material',
                  total_cost_cents: 4000,
                },
              ],
              error: null,
            },
          }),
        ],
      },
    });

    const rows = await listJobsForCurrentUser(client as never);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'job-1',
      workStatus: 'paid',
      timeLabel: '2.0h',
      revenueCents: 50000,
      materialsCents: -5000,
      netEarningsCents: 45000,
      collectedCents: 50000,
      hasMaterials: true,
      hasSessions: true,
    });
    expect(rows[0].lastWorkedAt).toBe('2026-04-16T12:00:00.000Z');
    expect(rows[0].createdAt).toBe('2026-04-10T08:00:00.000Z');
    expect(rows[0].lastWorkedLabel).toContain('Last worked');
    expect(rows[0].lastWorkedLabel).toContain('Apr 16, 2026');
    expect(rows[0].noRevenueConfirmed).toBe(false);
  });

  it('listJobsForCurrentUserPage sets hasMore when the page is full', async () => {
    const row = (id: string) => ({
      id,
      short_description: 'J',
      customer_name: null,
      updated_at: '2026-04-17T10:00:00.000Z',
      created_at: '2026-04-10T08:00:00.000Z',
      last_worked_at: '2026-04-16T12:00:00.000Z',
      job_type: 'x',
      job_work_status: 'not_started' as const,
      job_payment_state: null,
      revenue_cents: 0,
      collected_cents: 0,
      is_job_record_complete: false,
    });
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        jobs: [
          makeBuilder({
            awaitResult: { data: [row('job-a'), row('job-b')], error: null },
          }),
          makeBuilder({
            awaitResult: { data: [row('job-c')], error: null },
          }),
        ],
        sessions: [
          makeBuilder({ awaitResult: { data: [], error: null } }),
          makeBuilder({ awaitResult: { data: [], error: null } }),
        ],
        job_costs: [
          makeBuilder({ awaitResult: { data: [], error: null } }),
          makeBuilder({ awaitResult: { data: [], error: null } }),
        ],
      },
    });

    const first = await listJobsForCurrentUserPage(client as never, { limit: 2, offset: 0 });
    expect(first.items).toHaveLength(2);
    expect(first.hasMore).toBe(true);
    expect(first.items[0]).toMatchObject({ hasMaterials: false, hasSessions: false });

    const second = await listJobsForCurrentUserPage(client as never, { limit: 2, offset: 2 });
    expect(second.items).toHaveLength(1);
    expect(second.hasMore).toBe(false);
  });

  it('listJobsForCurrentUserPage applies open-tab query filters', async () => {
    const jobsBuilder = makeBuilder({
      awaitResult: { data: [], error: null },
    });
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        jobs: [jobsBuilder],
      },
    });

    await listJobsForCurrentUserPage(client as never, { limit: 10, offset: 0, tab: 'open' });

    const neqSpy = jobsBuilder.neq as unknown as { mock: { calls: unknown[][] } };
    const orSpy = jobsBuilder.or as unknown as { mock: { calls: unknown[][] } };
    expect(neqSpy.mock.calls).toContainEqual(['job_work_status', 'canceled']);
    expect(orSpy.mock.calls.length).toBeGreaterThan(0);
    const clause = String(orSpy.mock.calls[0]?.[0]);
    expect(clause).toContain('is_job_record_complete.eq.false');
    expect(clause).toContain('job_work_status.eq.in_progress');
    expect(clause).toContain('job_payment_state.neq.paid');
  });

  it('listJobsForCurrentUserPage applies search ilike or filter', async () => {
    const jobsBuilder = makeBuilder({ awaitResult: { data: [], error: null } });
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: { jobs: [jobsBuilder] },
    });

    await listJobsForCurrentUserPage(client as never, {
      limit: 10,
      offset: 0,
      search: '  fan  ',
    });

    const orSpy = jobsBuilder.or as unknown as { mock: { calls: unknown[][] } };
    expect(orSpy.mock.calls.length).toBeGreaterThan(0);
    const clause = String(orSpy.mock.calls[0]?.[0]);
    expect(clause).toContain('short_description.ilike.');
    expect(clause).toContain('customer_name.ilike.');
    expect(clause).toContain('%fan%');
  });

  it('listJobsForCurrentUserPage applies paid-tab query filters', async () => {
    const jobsBuilder = makeBuilder({ awaitResult: { data: [], error: null } });
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: { jobs: [jobsBuilder] },
    });

    await listJobsForCurrentUserPage(client as never, { limit: 10, offset: 0, tab: 'paid' });

    const eqSpy = jobsBuilder.eq as unknown as { mock: { calls: unknown[][] } };
    expect(eqSpy.mock.calls).toContainEqual(['job_work_status', 'completed']);
    expect(eqSpy.mock.calls).toContainEqual(['job_payment_state', 'paid']);
    expect(eqSpy.mock.calls).toContainEqual(['is_job_record_complete', true]);
  });

  it('listJobsForCurrentUser filters out soft-deleted materials from per-job rollups', async () => {
    // Regression guard: before the fix, the two materials queries in
    // `listJobsForCurrentUser` did not apply `.is('deleted_at', null)`,
    // so soft-deleted materials kept counting against the MAT / NET
    // metrics on the jobs list even though JobDetailScreen (which uses
    // fetchJobDetail) correctly excluded them. This test asserts the
    // filter is applied to both materials builders so the two screens
    // stay in sync.
    const materialsByJobBuilder = makeBuilder({
      awaitResult: {
        data: [
          {
            id: 'mat-active',
            job_id: 'job-1',
            session_id: null,
            description: 'Active material',
            cost_type: 'material',
            total_cost_cents: 2500,
          },
        ],
        error: null,
      },
    });
    const materialsBySessionBuilder = makeBuilder({
      awaitResult: { data: [], error: null },
    });

    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        jobs: [
          makeBuilder({
            awaitResult: {
              data: [
                {
                  id: 'job-1',
                  short_description: 'Panel install',
                  customer_name: 'Alex',
                  updated_at: '2026-04-17T10:00:00.000Z',
                  created_at: '2026-04-10T08:00:00.000Z',
                  last_worked_at: '2026-04-16T11:00:00.000Z',
                  job_type: 'electrical',
                  job_work_status: 'in_progress',
                  job_payment_state: 'unpaid',
                  revenue_cents: 80000,
                  collected_cents: 0,
                  is_job_record_complete: true,
                },
              ],
              error: null,
            },
          }),
        ],
        sessions: [
          makeBuilder({
            awaitResult: {
              data: [
                {
                  id: 'sess-1',
                  job_id: 'job-1',
                  session_status: 'ended',
                  started_at: '2026-04-16T10:00:00.000Z',
                  ended_at: '2026-04-16T11:00:00.000Z',
                },
              ],
              error: null,
            },
          }),
        ],
        job_costs: [materialsByJobBuilder, materialsBySessionBuilder],
      },
    });

    await listJobsForCurrentUser(client as never);

    const filterCallsForBuilder = (
      builder: ReturnType<typeof makeBuilder>,
    ): unknown[][] => {
      const isSpy = builder.is as unknown as {
        mock: { calls: unknown[][] };
      };
      return isSpy.mock.calls;
    };

    expect(filterCallsForBuilder(materialsByJobBuilder)).toContainEqual([
      'deleted_at',
      null,
    ]);
    expect(filterCallsForBuilder(materialsBySessionBuilder)).toContainEqual([
      'deleted_at',
      null,
    ]);
  });

  it('listJobsForCurrentUser ignores incomplete materials for hasMaterials', async () => {
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        jobs: [
          makeBuilder({
            awaitResult: {
              data: [
                {
                  id: 'job-1',
                  short_description: 'Panel install',
                  customer_name: 'A',
                  updated_at: '2026-04-17T10:00:00.000Z',
                  created_at: '2026-04-10T08:00:00.000Z',
                  last_worked_at: '2026-04-16T12:00:00.000Z',
                  job_type: 'electrical',
                  job_work_status: 'in_progress',
                  job_payment_state: null,
                  revenue_cents: 10000,
                  collected_cents: 0,
                  is_job_record_complete: false,
                  materials_reviewed_at: null,
                  other_costs_reviewed_at: null,
                },
              ],
              error: null,
            },
          }),
        ],
        sessions: [
          makeBuilder({
            awaitResult: {
              data: [
                {
                  id: 'sess-1',
                  job_id: 'job-1',
                  session_status: 'ended',
                  started_at: '2026-04-16T10:00:00.000Z',
                  ended_at: '2026-04-16T11:00:00.000Z',
                },
              ],
              error: null,
            },
          }),
        ],
        job_costs: [
          makeBuilder({
            awaitResult: {
              data: [
                {
                  id: 'mat-incomplete',
                  job_id: 'job-1',
                  session_id: null,
                  description: '',
                  cost_type: 'material',
                  total_cost_cents: 0,
                },
              ],
              error: null,
            },
          }),
          makeBuilder({ awaitResult: { data: [], error: null } }),
        ],
      },
    });

    const rows = await listJobsForCurrentUser(client as never);
    expect(rows[0]?.hasMaterials).toBe(false);
  });

  it('listJobsForCurrentUser maps noRevenueConfirmed and counts in_progress sessions', async () => {
    const jobsBuilder = makeBuilder({
      awaitResult: {
        data: [
          {
            id: 'job-1',
            short_description: 'Untitled Job',
            customer_name: null,
            updated_at: '2026-04-17T10:00:00.000Z',
            created_at: '2026-04-10T08:00:00.000Z',
            last_worked_at: '2026-04-16T12:00:00.000Z',
            job_type: 'electrical',
            job_work_status: 'in_progress',
            job_payment_state: null,
            revenue_cents: 0,
            collected_cents: 0,
            is_job_record_complete: false,
            no_revenue_confirmed_at: '2026-04-17T09:00:00.000Z',
          },
        ],
        error: null,
      },
    });
    const sessionsBuilder = makeBuilder({
      awaitResult: {
        data: [
          {
            id: 'sess-live',
            job_id: 'job-1',
            session_status: 'in_progress',
            started_at: '2026-04-17T09:00:00.000Z',
            ended_at: null,
          },
        ],
        error: null,
      },
    });
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        jobs: [jobsBuilder],
        sessions: [sessionsBuilder],
        job_costs: [
          makeBuilder({ awaitResult: { data: [], error: null } }),
          makeBuilder({ awaitResult: { data: [], error: null } }),
        ],
      },
    });

    const rows = await listJobsForCurrentUser(client as never);
    expect(rows[0]?.noRevenueConfirmed).toBe(true);
    expect(rows[0]?.hasSessions).toBe(true);
    expect(jobsBuilder.select).toHaveBeenCalledWith(
      expect.stringContaining('no_revenue_confirmed_at'),
    );
    expect(sessionsBuilder.select).toHaveBeenCalledWith(
      'id, job_id, session_status, started_at, ended_at, calendar_date_explicit',
    );
  });

  it('listJobsForCurrentUser ignores unusable ended-only sessions for hasSessions', async () => {
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        jobs: [
          makeBuilder({
            awaitResult: {
              data: [
                {
                  id: 'job-1',
                  short_description: 'Panel install',
                  customer_name: 'A',
                  updated_at: '2026-04-17T10:00:00.000Z',
                  created_at: '2026-04-10T08:00:00.000Z',
                  last_worked_at: null,
                  job_type: 'electrical',
                  job_work_status: 'in_progress',
                  job_payment_state: null,
                  revenue_cents: 10000,
                  collected_cents: 0,
                  is_job_record_complete: false,
                },
              ],
              error: null,
            },
          }),
        ],
        sessions: [
          makeBuilder({
            awaitResult: {
              data: [
                {
                  id: 'sess-undated',
                  job_id: 'job-1',
                  session_status: 'ended',
                  started_at: '2026-04-16T10:00:00.000Z',
                  ended_at: '2026-04-16T11:00:00.000Z',
                  calendar_date_explicit: false,
                },
                {
                  id: 'sess-zero',
                  job_id: 'job-1',
                  session_status: 'ended',
                  started_at: '2026-04-16T10:00:00.000Z',
                  ended_at: '2026-04-16T10:00:00.000Z',
                },
              ],
              error: null,
            },
          }),
        ],
        job_costs: [
          makeBuilder({ awaitResult: { data: [], error: null } }),
          makeBuilder({ awaitResult: { data: [], error: null } }),
        ],
      },
    });

    const rows = await listJobsForCurrentUser(client as never);
    expect(rows[0]?.hasSessions).toBe(false);
    expect(rows[0]?.noRevenueConfirmed).toBe(false);
  });

  it('list and detail stay aligned for shared job fields and earnings', async () => {
    const jobsBuilder = makeBuilder({
      awaitResult: {
        data: [
          {
            id: 'job-sync',
            short_description: 'Water heater replacement',
            customer_name: 'Bob',
            updated_at: '2026-04-17T10:00:00.000Z',
            created_at: '2026-04-10T08:00:00.000Z',
            last_worked_at: '2026-04-16T12:00:00.000Z',
            job_type: 'plumbing',
            job_work_status: 'completed',
            job_payment_state: 'unpaid',
            revenue_cents: 120000,
            collected_cents: 0,
            is_job_record_complete: true,
          },
        ],
        error: null,
      },
    });

    const sessionsForListBuilder = makeBuilder({
      awaitResult: {
        data: [
          {
            id: 'sess-sync',
            job_id: 'job-sync',
            session_status: 'ended',
            started_at: '2026-04-16T09:00:00.000Z',
            ended_at: '2026-04-16T12:00:00.000Z',
          },
        ],
        error: null,
      },
    });

    const matsListByJobBuilder = makeBuilder({
      awaitResult: {
        data: [
          {
            id: 'mat-sync',
            job_id: 'job-sync',
            session_id: 'sess-sync',
            description: 'Pipe fittings',
            cost_type: 'material',
            total_cost_cents: 7000,
          },
        ],
        error: null,
      },
    });

    const matsListBySessionBuilder = makeBuilder({
      awaitResult: {
        data: [
          {
            id: 'mat-sync',
            job_id: 'job-sync',
            session_id: 'sess-sync',
            description: 'Pipe fittings',
            cost_type: 'material',
            total_cost_cents: 7000,
          },
        ],
        error: null,
      },
    });

    const jobDetailJobBuilder = makeBuilder({
      maybeSingleResult: {
        data: {
          id: 'job-sync',
          short_description: 'Water heater replacement',
          customer_name: 'Bob',
          service_address: '22 Cedar St',
          job_type: 'plumbing',
          job_work_status: 'completed',
          job_payment_state: 'unpaid',
          revenue_cents: 120000,
          collected_cents: 0,
          updated_at: '2026-04-17T10:00:00.000Z',
          last_worked_at: '2026-04-16T12:00:00.000Z',
        },
        error: null,
      },
    });

    const sessionsForDetailBuilder = makeBuilder({
      awaitResult: {
        data: [
          {
            id: 'sess-sync',
            job_id: 'job-sync',
            session_status: 'ended',
            started_at: '2026-04-16T09:00:00.000Z',
            ended_at: '2026-04-16T12:00:00.000Z',
          },
        ],
        error: null,
      },
    });

    const notesBuilder = makeBuilder({
      awaitResult: { data: [], error: null },
    });
    const matsDetailByJobBuilder = makeBuilder({
      awaitResult: {
        data: [
          {
            id: 'mat-sync',
            job_id: 'job-sync',
            session_id: 'sess-sync',
            description: 'Pipe fittings',
            quantity: 1,
            unit: 'ea',
            total_cost_cents: 7000,
            created_at: '2026-04-16T12:30:00.000Z',
          },
        ],
        error: null,
      },
    });
    const matsDetailBySessionBuilder = makeBuilder({
      awaitResult: {
        data: [
          {
            id: 'mat-sync',
            job_id: 'job-sync',
            session_id: 'sess-sync',
            description: 'Pipe fittings',
            quantity: 1,
            unit: 'ea',
            total_cost_cents: 7000,
            created_at: '2026-04-16T12:30:00.000Z',
          },
        ],
        error: null,
      },
    });
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        jobs: [jobsBuilder, jobDetailJobBuilder],
        sessions: [sessionsForListBuilder, sessionsForDetailBuilder],
        job_costs: [
          matsListByJobBuilder,
          matsListBySessionBuilder,
          matsDetailByJobBuilder,
          matsDetailBySessionBuilder,
        ],
        notes: [notesBuilder],
      },
    });

    const [listRows, detail] = await Promise.all([
      listJobsForCurrentUser(client as never),
      fetchJobDetail(client as never, 'job-sync'),
    ]);

    expect(detail).not.toBeNull();
    expect(listRows).toHaveLength(1);

    const listRow = listRows[0];
    const jobDetail = detail!;

    expect(listRow.id).toBe(jobDetail.id);
    expect(listRow.shortDescription).toBe(jobDetail.shortDescription);
    expect(listRow.customerName).toBe(jobDetail.customerName);
    expect(listRow.revenueCents).toBe(jobDetail.earnings.revenueCents);
    expect(listRow.materialsCents).toBe(jobDetail.earnings.materialsCents);
    expect(listRow.netEarningsCents).toBe(jobDetail.earnings.netEarningsCents);
    expect(listRow.timeLabel).toBe(jobDetail.metrics.timeLabel);
    expect(listRow.lastWorkedLabel).toBe(jobDetail.lastWorkedLabel);
    expect(listRow.lastWorkedAt).toBe('2026-04-16T12:00:00.000Z');
    expect(listRow.createdAt).toBe('2026-04-10T08:00:00.000Z');
    expect(listRow.isFinanciallyComplete).toBe(true);
    expect(listRow.hasMaterials).toBe(true);
    expect(listRow.hasSessions).toBe(true);
  });

  it('fetchJobDetail includes only ended sessions in the sessions list', async () => {
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        jobs: [
          makeBuilder({
            maybeSingleResult: {
              data: {
                id: 'job-2',
                short_description: 'Panel upgrade',
                customer_name: 'Casey',
                service_address: '44 North Ave',
                job_type: 'electrical',
                job_work_status: 'in_progress',
                job_payment_state: 'unpaid',
                revenue_cents: 150000,
                collected_cents: 0,
                updated_at: '2026-04-17T10:00:00.000Z',
                last_worked_at: '2026-04-17T09:00:00.000Z',
              },
              error: null,
            },
          }),
        ],
        sessions: [
          makeBuilder({
            awaitResult: {
              data: [
                {
                  id: 'sess-ended',
                  job_id: 'job-2',
                  session_status: 'ended',
                  started_at: '2026-04-16T09:00:00.000Z',
                  ended_at: '2026-04-16T10:00:00.000Z',
                },
                {
                  id: 'sess-progress',
                  job_id: 'job-2',
                  session_status: 'in_progress',
                  started_at: '2026-04-17T09:00:00.000Z',
                  ended_at: null,
                },
              ],
              error: null,
            },
          }),
        ],
        notes: [makeBuilder({ awaitResult: { data: [], error: null } })],
        job_costs: [
          makeBuilder({ awaitResult: { data: [], error: null } }),
          makeBuilder({ awaitResult: { data: [], error: null } }),
        ],
      },
    });

    const detail = await fetchJobDetail(client as never, 'job-2');

    expect(detail).not.toBeNull();
    expect(detail?.displaySessions.map((s) => s.id)).toEqual(['sess-ended']);
    expect(detail?.noMaterialsConfirmed).toBe(false);
    expect(detail?.noRevenueConfirmed).toBe(false);
  });

  it('fetchJobDetail distinguishes zero duration from short positive sessions', async () => {
    const startedAt = '2026-04-16T09:00:00.000Z';
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        jobs: [
          makeBuilder({
            maybeSingleResult: {
              data: {
                id: 'job-short-sessions',
                short_description: 'Quick check',
                customer_name: 'Casey',
                service_address: '44 North Ave',
                job_type: 'electrical',
                job_work_status: 'in_progress',
                job_payment_state: 'unpaid',
                revenue_cents: 5000,
                collected_cents: 0,
                updated_at: '2026-04-17T10:00:00.000Z',
                last_worked_at: '2026-04-16T09:00:37.000Z',
              },
              error: null,
            },
          }),
        ],
        sessions: [
          makeBuilder({
            awaitResult: {
              data: [
                {
                  id: 'sess-zero',
                  job_id: 'job-short-sessions',
                  session_status: 'ended',
                  started_at: startedAt,
                  ended_at: startedAt,
                  calendar_date_explicit: true,
                  clock_start_explicit: true,
                  clock_end_explicit: true,
                },
                {
                  id: 'sess-one-second',
                  job_id: 'job-short-sessions',
                  session_status: 'ended',
                  started_at: startedAt,
                  ended_at: '2026-04-16T09:00:01.000Z',
                  calendar_date_explicit: true,
                  clock_start_explicit: true,
                  clock_end_explicit: true,
                },
                {
                  id: 'sess-thirty-six-seconds',
                  job_id: 'job-short-sessions',
                  session_status: 'ended',
                  started_at: startedAt,
                  ended_at: '2026-04-16T09:00:36.000Z',
                  calendar_date_explicit: true,
                  clock_start_explicit: true,
                  clock_end_explicit: true,
                },
                {
                  id: 'sess-thirty-seven-seconds',
                  job_id: 'job-short-sessions',
                  session_status: 'ended',
                  started_at: startedAt,
                  ended_at: '2026-04-16T09:00:37.000Z',
                  calendar_date_explicit: true,
                  clock_start_explicit: true,
                  clock_end_explicit: true,
                },
              ],
              error: null,
            },
          }),
        ],
        notes: [makeBuilder({ awaitResult: { data: [], error: null } })],
        job_costs: [
          makeBuilder({ awaitResult: { data: [], error: null } }),
          makeBuilder({ awaitResult: { data: [], error: null } }),
        ],
      },
    });

    const detail = await fetchJobDetail(client as never, 'job-short-sessions');

    expect(detail?.displaySessions.map((session) => session.durationLabel)).toEqual([
      'No duration',
      '<0.1h',
      '<0.1h',
      '<0.1h',
    ]);
    expect(detail?.displaySessions[0]?.timeRangeLabel).not.toContain('–');
    expect(
      detail?.displaySessions
        .slice(1)
        .every((session) => session.timeRangeLabel.includes('–')),
    ).toBe(true);
    expect(detail?.metrics.timeLabel).toBe('<0.1h');
  });

  it('fetchJobDetail maps note id/body/sessionId and filters soft-deleted notes', async () => {
    const notesBuilder = makeBuilder({
      awaitResult: {
        data: [
          {
            id: 'note-unassigned',
            job_id: 'job-3',
            session_id: null,
            body: 'Long enough body that will be truncated for the excerpt preview...',
            created_at: '2026-04-17T11:00:00.000Z',
            updated_at: '2026-04-17T11:00:00.000Z',
          },
          {
            id: 'note-session',
            job_id: null,
            session_id: 'sess-a',
            body: 'Short',
            created_at: '2026-04-17T10:30:00.000Z',
            updated_at: '2026-04-17T10:30:00.000Z',
          },
        ],
        error: null,
      },
    });

    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        jobs: [
          makeBuilder({
            maybeSingleResult: {
              data: {
                id: 'job-3',
                short_description: 'HVAC tune-up',
                customer_name: 'Dana',
                service_address: '12 Oak Dr',
                job_type: 'hvac',
                job_work_status: 'in_progress',
                job_payment_state: 'unpaid',
                revenue_cents: 90000,
                collected_cents: 0,
                updated_at: '2026-04-17T10:00:00.000Z',
                last_worked_at: '2026-04-16T10:00:00.000Z',
              },
              error: null,
            },
          }),
        ],
        sessions: [
          makeBuilder({
            awaitResult: {
              data: [
                {
                  id: 'sess-a',
                  job_id: 'job-3',
                  session_status: 'ended',
                  started_at: '2026-04-16T09:00:00.000Z',
                  ended_at: '2026-04-16T10:00:00.000Z',
                },
              ],
              error: null,
            },
          }),
        ],
        notes: [notesBuilder],
        job_costs: [
          makeBuilder({ awaitResult: { data: [], error: null } }),
          makeBuilder({ awaitResult: { data: [], error: null } }),
        ],
      },
    });

    const detail = await fetchJobDetail(client as never, 'job-3');

    expect(detail).not.toBeNull();
    // Soft-deleted notes are excluded by the api-client query filter.
    const isSpy = notesBuilder.is as unknown as { mock: { calls: unknown[][] } };
    expect(isSpy.mock.calls).toContainEqual(['deleted_at', null]);

    // Unassigned note: id + full body + sessionId=null + truncated excerpt preserved.
    const unassignedBucket = detail!.noteBuckets.find((b) => b.kind === 'unassigned');
    expect(unassignedBucket).toBeDefined();
    expect(unassignedBucket!.notes).toHaveLength(1);
    const unassigned = unassignedBucket!.notes[0];
    expect(unassigned).toMatchObject({
      id: 'note-unassigned',
      sessionId: null,
      body: 'Long enough body that will be truncated for the excerpt preview...',
    });
    // Short bodies are not truncated — excerpt equals the (trimmed) body.
    const sessionBucket = detail!.noteBuckets.find((b) => b.kind === 'session');
    expect(sessionBucket).toBeDefined();
    expect(sessionBucket!.notes).toHaveLength(1);
    expect(sessionBucket!.notes[0]).toMatchObject({
      id: 'note-session',
      sessionId: 'sess-a',
      body: 'Short',
      excerpt: 'Short',
    });
  });

  it('fetchJobDetail merges session notes and materials into attachments sorted by updated_at desc', async () => {
    const notesData = [
      {
        id: 'note-older',
        job_id: null,
        session_id: 'sess-x',
        body: 'Older note',
        created_at: '2026-04-17T08:00:00.000Z',
        updated_at: '2026-04-17T08:00:00.000Z',
      },
      {
        id: 'note-newer',
        job_id: null,
        session_id: 'sess-x',
        body: 'Newer note',
        created_at: '2026-04-17T09:00:00.000Z',
        updated_at: '2026-04-17T12:00:00.000Z',
      },
    ];
    const matData = [
      {
        id: 'mat-mid',
        job_id: null,
        session_id: 'sess-x',
        description: 'Wire spool',
        quantity: 2,
        unit: 'ea',
        unit_cost_cents: 200,
        total_cost_cents: 400,
        created_at: '2026-04-17T10:00:00.000Z',
        updated_at: '2026-04-17T10:00:00.000Z',
      },
    ];
    const notesBuilder = makeBuilder({
      awaitResult: { data: notesData, error: null },
    });
    const matsBuilder = makeBuilder({ awaitResult: { data: matData, error: null } });
    const client = makeClient({
      authUserId: 'user-1',
      buildersByTable: {
        jobs: [
          makeBuilder({
            maybeSingleResult: {
              data: {
                id: 'job-att',
                short_description: 'Job',
                customer_name: 'C',
                service_address: '1 St',
                job_type: 'x',
                job_work_status: 'in_progress',
                job_payment_state: 'unpaid',
                revenue_cents: 0,
                collected_cents: 0,
                updated_at: '2026-04-17T10:00:00.000Z',
                last_worked_at: '2026-04-16T10:00:00.000Z',
              },
              error: null,
            },
          }),
        ],
        sessions: [
          makeBuilder({
            awaitResult: {
              data: [
                {
                  id: 'sess-x',
                  job_id: 'job-att',
                  session_status: 'ended',
                  started_at: '2026-04-16T09:00:00.000Z',
                  ended_at: '2026-04-16T10:00:00.000Z',
                },
              ],
              error: null,
            },
          }),
        ],
        notes: [notesBuilder],
        job_costs: [matsBuilder, makeBuilder({ awaitResult: { data: [], error: null } })],
      },
    });

    const detail = await fetchJobDetail(client as never, 'job-att');
    expect(detail).not.toBeNull();
    const sess = detail!.displaySessions.find((s) => s.id === 'sess-x');
    expect(sess).toBeDefined();
    expect(sess!.attachments.map((a) => a.id)).toEqual(['note-newer', 'mat-mid', 'note-older']);
  });
});
