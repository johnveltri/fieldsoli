import type {
  Job,
  JobDetailWorkStatus,
  JobId,
  JobPaymentState,
} from '@fieldsolo/shared-types';
import { JOB_SHORT_DESCRIPTION_MAX_LENGTH } from '@fieldsolo/shared-types';

import type { FieldSoloSupabaseClient } from './client';
import { formatSessionDurationLabel } from './sessionDurationDraft';

type JobsRow = {
  id: string;
  short_description: string;
  customer_name: string | null;
  updated_at: string;
  revenue_cents: number | null;
  job_payment_state: JobPaymentState | null;
  collected_cents: number | null;
};

type JobWorkStatusDb =
  | 'not_started'
  | 'in_progress'
  | 'on_hold'
  | 'completed'
  | 'canceled';

function rowToJob(row: JobsRow): Job {
  return {
    id: row.id,
    shortDescription: row.short_description,
    customerName: row.customer_name,
    updatedAt: row.updated_at,
    revenueCents: row.revenue_cents,
    jobPaymentState: row.job_payment_state,
    collectedCents: row.collected_cents,
  };
}

/**
 * Returns the most recently updated job id visible to the current session (RLS).
 * Use with an authenticated Supabase client so only that user's rows are returned.
 */
export async function fetchFirstJobIdForCurrentUser(
  client: FieldSoloSupabaseClient,
): Promise<string | null> {
  const { data, error } = await client
    .from('jobs')
    .select('id')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as { id: string } | null)?.id ?? null;
}

/** Loads a single row from `public.jobs` (see `backend/supabase/migrations`). */
export async function fetchJobById(
  client: FieldSoloSupabaseClient,
  id: JobId,
): Promise<Job | null> {
  const { data, error } = await client
    .from('jobs')
    .select(
      'id, short_description, customer_name, updated_at, revenue_cents, job_payment_state, collected_cents',
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return rowToJob(data as JobsRow);
}

export type UpdateJobInput = {
  shortDescription: string;
  longDescription: string;
  customerName: string;
  serviceAddress: string;
  revenueCents: number | null;
};

export type ListJobsForCurrentUserItem = {
  id: JobId;
  shortDescription: string;
  customerName: string | null;
  updatedAt: string;
  /** ISO 8601 from `jobs.last_worked_at`; null when the job has no qualifying sessions. */
  lastWorkedAt: string | null;
  /** ISO 8601 from `jobs.created_at`; used with `lastWorkedAt` for list section bucketing (sort aligns with `list_recency_at` in DB). */
  createdAt: string;
  lastWorkedLabel: string;
  timeLabel: string;
  jobType: string | null;
  workStatus: JobDetailWorkStatus;
  jobPaymentState: JobPaymentState | null;
  revenueCents: number | null;
  /** Optional: may be unavailable on older local schemas. */
  materialsCents: number | null;
  /** Optional: may be unavailable on older local schemas. */
  netEarningsCents: number | null;
  collectedCents: number | null;
  isFinanciallyComplete: boolean;
  /** True when the job has at least one usable (description + total) material line. */
  hasMaterials: boolean;
  /** True when the user confirmed “no materials used” on the job (no material rows). */
  noMaterialsConfirmed: boolean;
  /** True when the job has at least one usable (type + amount) non-material cost line. */
  hasOtherCosts: boolean;
  /** True when the user confirmed “no other costs” on the job. */
  noOtherCostsConfirmed: boolean;
  /** True when the user confirmed “no revenue” on the job. */
  noRevenueConfirmed: boolean;
  /** True when the job has a live in-progress session or a usable ended session. */
  hasSessions: boolean;
};

type ListJobsRow = {
  id: string;
  short_description: string;
  customer_name: string | null;
  updated_at: string;
  created_at: string;
  last_worked_at: string | null;
  job_type: string | null;
  job_work_status: JobWorkStatusDb;
  job_payment_state: JobPaymentState | null;
  revenue_cents: number | null;
  collected_cents: number | null;
  is_job_record_complete: boolean;
  materials_reviewed_at: string | null;
  other_costs_reviewed_at: string | null;
  no_revenue_confirmed_at: string | null;
};

type ListJobSessionRow = {
  id: string;
  job_id: string;
  session_status: 'in_progress' | 'ended' | 'deleted';
  started_at: string;
  ended_at: string | null;
  calendar_date_explicit?: boolean | null;
};

type ListJobMaterialRow = {
  id: string;
  job_id: string | null;
  session_id: string | null;
  total_cost_cents: number;
  cost_type: string | null;
  description: string | null;
  cost_type_explicit: boolean | null;
};

const JOB_COST_LIST_SELECT =
  'id, job_id, session_id, total_cost_cents, cost_type, description, cost_type_explicit';

function isListMaterialCost(costType: string | null): boolean {
  return costType == null || costType === 'material';
}

/** Matches mobile `isMaterialUsableForCompleteness` (description + total). */
function isListMaterialUsableForCompleteness(row: ListJobMaterialRow): boolean {
  if (!isListMaterialCost(row.cost_type)) return false;
  return (row.description?.trim() ?? '') !== '' && row.total_cost_cents > 0;
}

/** Matches mobile `isOtherCostUsableForCompleteness` (explicit type + amount). */
function isListOtherCostUsableForCompleteness(row: ListJobMaterialRow): boolean {
  if (isListMaterialCost(row.cost_type)) return false;
  return row.cost_type_explicit !== false && row.total_cost_cents > 0;
}

/** Matches DB/View session completeness: live in-progress, or dated ended with duration. */
function isListSessionUsableForCompleteness(row: ListJobSessionRow): boolean {
  if (row.session_status === 'in_progress') return true;
  if (row.session_status !== 'ended') return false;
  if (row.calendar_date_explicit === false) return false;
  if (!row.ended_at) return false;
  return new Date(row.ended_at).getTime() > new Date(row.started_at).getTime();
}

function formatDateLabel(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso));
}

/** Batch size for `listJobsForCurrentUser` full fetch (tests / small batches). */
const JOB_LIST_INTERNAL_PAGE_SIZE = 100;

/**
 * Strips ILIKE metacharacters so user input cannot widen a `ilike.%…%` match.
 * Commas are removed so PostgREST `or()` clause parsing stays unambiguous.
 */
export function sanitizeJobListSearchTerm(raw: string): string {
  return raw.replace(/\\/g, '').replace(/%/g, '').replace(/_/g, '').replace(/,/g, ' ').trim();
}

export type ListJobsForCurrentUserPageResult = {
  items: ListJobsForCurrentUserItem[];
  hasMore: boolean;
};

export type ListJobsForCurrentUserTab = 'all' | 'open' | 'paid';

/** Current list contract; migration drift is treated as an error. */
const JOB_LIST_SELECT_FULL =
  'id, short_description, customer_name, updated_at, created_at, last_worked_at, job_type, job_work_status, job_payment_state, revenue_cents, collected_cents, is_job_record_complete, materials_reviewed_at, other_costs_reviewed_at, no_revenue_confirmed_at';

/**
 * One page of jobs ordered by `list_recency_at` desc (`coalesce(last_worked_at, created_at)`), then `id` desc.
 * Rollups (time, materials, net) are computed for rows in this page only.
 */
export async function listJobsForCurrentUserPage(
  client: FieldSoloSupabaseClient,
  options: {
    limit: number;
    offset: number;
    tab?: ListJobsForCurrentUserTab;
    search?: string;
  },
): Promise<ListJobsForCurrentUserPageResult> {
  const { limit, offset, tab = 'all', search } = options;
  const runQuery = async (selectColumns: string) => {
    let listQuery = client.from('jobs').select(selectColumns).is('deleted_at', null);

    if (tab === 'open') {
      listQuery = listQuery
        .neq('job_work_status', 'canceled')
        .or(
          'is_job_record_complete.eq.false,job_work_status.eq.in_progress,and(job_work_status.eq.completed,job_payment_state.neq.paid)',
        );
    } else if (tab === 'paid') {
      listQuery = listQuery
        .eq('job_work_status', 'completed')
        .eq('job_payment_state', 'paid')
        .eq('is_job_record_complete', true);
    }

    const searchTrimmed = search?.trim() ?? '';
    if (searchTrimmed !== '') {
      const core = sanitizeJobListSearchTerm(searchTrimmed);
      if (core.length === 0) {
        listQuery = listQuery.eq('id', '00000000-0000-0000-0000-000000000000');
      } else {
        const p = `%${core}%`;
        listQuery = listQuery.or(`short_description.ilike.${p},customer_name.ilike.${p}`);
      }
    }

    return listQuery
      .order('list_recency_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1);
  };

  const result = await runQuery(JOB_LIST_SELECT_FULL);

  if (result.error) throw result.error;
  const rows = ((result.data ?? []) as unknown) as ListJobsRow[];
  if (rows.length === 0) {
    return { items: [], hasMore: false };
  }
  const items = await enrichJobsRowsWithSessionRollups(client, rows);
  return {
    items,
    hasMore: rows.length === limit,
  };
}

function lastWorkedLabelFromColumn(lastWorkedAt: string | null): string {
  if (lastWorkedAt == null || lastWorkedAt === '') {
    return 'No sessions yet';
  }
  return `Last worked ${formatDateLabel(lastWorkedAt)}`;
}

async function enrichJobsRowsWithSessionRollups(
  client: FieldSoloSupabaseClient,
  rows: ListJobsRow[],
): Promise<ListJobsForCurrentUserItem[]> {
  const jobIds = rows.map((row) => row.id);
  const { data: sessionsData, error: sessionsError } = await client
    .from('sessions')
    .select('id, job_id, session_status, started_at, ended_at, calendar_date_explicit')
    .in('job_id', jobIds);
  if (sessionsError) throw sessionsError;

  const sessions = ((sessionsData ?? []) as ListJobSessionRow[]).filter(
    (s) => s.session_status !== 'deleted',
  );
  const sessionJobIdBySessionId = new Map<string, string>();
  const sessionCountByJobId = new Map<string, number>();
  const totalHoursByJobId = new Map<string, number>();
  for (const s of sessions) {
    sessionJobIdBySessionId.set(s.id, s.job_id);
    if (isListSessionUsableForCompleteness(s)) {
      sessionCountByJobId.set(s.job_id, (sessionCountByJobId.get(s.job_id) ?? 0) + 1);
    }
    if (s.session_status === 'ended' || s.session_status === 'in_progress') {
      const a = new Date(s.started_at).getTime();
      const b = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
      const hours = Math.max(0, (b - a) / 3_600_000);
      totalHoursByJobId.set(s.job_id, (totalHoursByJobId.get(s.job_id) ?? 0) + hours);
    }
  }

  const sessionIds = sessions.map((s) => s.id);
  const [materialsByJobRes, materialsBySessionRes] = await Promise.all([
    client
      .from('job_costs')
      .select(JOB_COST_LIST_SELECT)
      .in('job_id', jobIds)
      .is('deleted_at', null),
    sessionIds.length > 0
      ? client
          .from('job_costs')
          .select(JOB_COST_LIST_SELECT)
          .in('session_id', sessionIds)
          .is('deleted_at', null)
      : Promise.resolve({ data: [] as ListJobMaterialRow[], error: null }),
  ]);
  if (materialsByJobRes.error) throw materialsByJobRes.error;
  if (materialsBySessionRes.error) throw materialsBySessionRes.error;

  const materialById = new Map<string, ListJobMaterialRow>();
  for (const m of (materialsByJobRes.data ?? []) as ListJobMaterialRow[]) {
    materialById.set(m.id, m);
  }
  for (const m of (materialsBySessionRes.data ?? []) as ListJobMaterialRow[]) {
    materialById.set(m.id, m);
  }

  const materialsSpendByJobId = new Map<string, number>();
  const totalCostsSpendByJobId = new Map<string, number>();
  const jobsWithMaterialLines = new Set<string>();
  const jobsWithOtherCostLines = new Set<string>();
  for (const m of materialById.values()) {
    const materialJobId =
      m.job_id ??
      (m.session_id ? sessionJobIdBySessionId.get(m.session_id) ?? null : null);
    if (!materialJobId) continue;
    totalCostsSpendByJobId.set(
      materialJobId,
      (totalCostsSpendByJobId.get(materialJobId) ?? 0) + m.total_cost_cents,
    );
    if (isListMaterialCost(m.cost_type)) {
      if (isListMaterialUsableForCompleteness(m)) {
        jobsWithMaterialLines.add(materialJobId);
      }
      materialsSpendByJobId.set(
        materialJobId,
        (materialsSpendByJobId.get(materialJobId) ?? 0) + m.total_cost_cents,
      );
    } else if (isListOtherCostUsableForCompleteness(m)) {
      jobsWithOtherCostLines.add(materialJobId);
    }
  }

  return rows.map((row) => {
    const lastWorkedAt = row.last_worked_at ?? null;
    const totalHours = totalHoursByJobId.get(row.id) ?? 0;
    const materialsSpendCents = materialsSpendByJobId.get(row.id) ?? 0;
    const materialsCents = -materialsSpendCents;
    const revenueCents = row.revenue_cents ?? 0;
    const netEarningsCents = revenueCents - (totalCostsSpendByJobId.get(row.id) ?? 0);
    const hasMaterials = jobsWithMaterialLines.has(row.id);
    const hasSessions = (sessionCountByJobId.get(row.id) ?? 0) > 0;
    const isFinanciallyComplete = row.is_job_record_complete;

    return {
      id: row.id,
      shortDescription: row.short_description,
      customerName: row.customer_name,
      updatedAt: row.updated_at,
      createdAt: row.created_at,
      lastWorkedAt,
      lastWorkedLabel: lastWorkedLabelFromColumn(lastWorkedAt),
      timeLabel: formatSessionDurationLabel(totalHours),
      jobType: row.job_type,
      workStatus: mapWorkStatus(row),
      jobPaymentState: row.job_payment_state,
      revenueCents: row.revenue_cents,
      materialsCents,
      netEarningsCents,
      collectedCents: row.collected_cents,
      isFinanciallyComplete,
      hasMaterials,
      noMaterialsConfirmed: row.materials_reviewed_at != null,
      hasOtherCosts: jobsWithOtherCostLines.has(row.id),
      noOtherCostsConfirmed: row.other_costs_reviewed_at != null,
      noRevenueConfirmed: row.no_revenue_confirmed_at != null,
      hasSessions,
    };
  });
}

function mapWorkStatus(row: {
  job_work_status: JobWorkStatusDb;
  job_payment_state: JobPaymentState | null;
}): JobDetailWorkStatus {
  if (row.job_work_status === 'completed' && row.job_payment_state === 'paid') return 'paid';
  switch (row.job_work_status) {
    case 'not_started':
      return 'notStarted';
    case 'in_progress':
      return 'inProgress';
    case 'on_hold':
      return 'onHold';
    case 'completed':
      return 'completed';
    case 'canceled':
      return 'cancelled';
    default:
      return 'notStarted';
  }
}

/**
 * Returns all jobs visible to the signed-in user (RLS), ordered by `list_recency_at`
 * desc, then `id` desc. Implemented as repeated page fetches; prefer
 * `listJobsForCurrentUserPage` in UI for large accounts.
 */
export async function listJobsForCurrentUser(
  client: FieldSoloSupabaseClient,
): Promise<ListJobsForCurrentUserItem[]> {
  const acc: ListJobsForCurrentUserItem[] = [];
  let offset = 0;
  for (;;) {
    const { items, hasMore } = await listJobsForCurrentUserPage(client, {
      limit: JOB_LIST_INTERNAL_PAGE_SIZE,
      offset,
    });
    acc.push(...items);
    if (!hasMore) break;
    offset += JOB_LIST_INTERNAL_PAGE_SIZE;
  }
  return acc;
}

export async function createBlankJobForCurrentUser(
  client: FieldSoloSupabaseClient,
): Promise<JobId> {
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  const userId = authData.user?.id;
  if (!userId) {
    throw new Error('No authenticated user available to create a job.');
  }

  const { data, error } = await client
    .from('jobs')
    .insert({
      user_id: userId,
      short_description: 'Untitled Job',
      customer_name: '',
      service_address: '',
      job_type: '',
      created_via: 'add_job',
      job_work_status: 'not_started',
    })
    .select('id')
    .single();

  if (error) throw error;
  return (data as { id: string }).id;
}

/** Minimal job row for quick-pick lists (no rollups). */
export type RecentJobItem = {
  id: JobId;
  shortDescription: string;
  customerName: string | null;
};

/**
 * Returns up to `limit` jobs for the current user ordered by `updated_at` desc
 * (then `id` desc). Use for home quick-session chooser; excludes rollups.
 */
export async function listRecentJobsForCurrentUser(
  client: FieldSoloSupabaseClient,
  options: { limit: number },
): Promise<RecentJobItem[]> {
  const limit = Math.max(1, Math.floor(options.limit));
  const { data, error } = await client
    .from('jobs')
    .select('id, short_description, customer_name')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);

  if (error) throw error;
  const rows = (data ?? []) as {
    id: string;
    short_description: string;
    customer_name: string | null;
  }[];

  return rows.map((r) => ({
    id: r.id,
    shortDescription: r.short_description,
    customerName: r.customer_name,
  }));
}

export type WeeklyNetEarningsForCurrentUserResult = {
  netEarningsCents: number;
  /** Distinct completed jobs whose `last_worked_at` falls in the rolling 7-day window. */
  jobCount: number;
};

/** Count non-deleted jobs whose work status is complete for the signed-in user. */
export async function countCompletedJobsForCurrentUser(
  client: FieldSoloSupabaseClient,
): Promise<number> {
  const { count, error } = await client
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('job_work_status', 'completed')
    .is('deleted_at', null);

  if (error) throw error;
  return count ?? 0;
}

const MS_PER_DAY = 86_400_000;

/**
 * Net earnings (revenue minus materials) for financially complete jobs marked
 * **work complete** in the DB (`job_work_status = completed`, including pending
 * and paid payment states) whose `last_worked_at` is within the last 7 days.
 * Materials include job-attributed and session-attributed lines for those jobs.
 */
export async function getWeeklyNetEarningsCentsForCurrentUser(
  client: FieldSoloSupabaseClient,
): Promise<WeeklyNetEarningsForCurrentUserResult> {
  const windowStartIso = new Date(Date.now() - 7 * MS_PER_DAY).toISOString();

  const { data: jobsRows, error: jobsQueryError } = await client
    .from('jobs')
    .select('id, revenue_cents')
    .eq('job_work_status', 'completed')
    .eq('is_job_record_complete', true)
    .gte('last_worked_at', windowStartIso)
    .is('deleted_at', null);

  if (jobsQueryError) throw jobsQueryError;

  const jobIds = [
    ...new Set(
      ((jobsRows ?? []) as { id: string; revenue_cents: number | null }[])
        .map((r) => r.id)
        .filter(Boolean),
    ),
  ];
  if (jobIds.length === 0) {
    return { netEarningsCents: 0, jobCount: 0 };
  }

  const revenueCents = ((jobsRows ?? []) as { id: string; revenue_cents: number | null }[]).reduce(
    (acc, row) => acc + (row.revenue_cents ?? 0),
    0,
  );

  const { data: allSessionRows, error: allSessionsError } = await client
    .from('sessions')
    .select('id')
    .in('job_id', jobIds)
    .is('deleted_at', null);

  if (allSessionsError) throw allSessionsError;

  const sessionIds = [
    ...new Set(
      ((allSessionRows ?? []) as { id: string }[]).map((r) => r.id).filter(Boolean),
    ),
  ];

  const [materialsByJobRes, materialsBySessionRes] = await Promise.all([
    client
      .from('job_costs')
      .select('id, total_cost_cents')
      .in('job_id', jobIds)
      .is('deleted_at', null),
    sessionIds.length > 0
      ? client
          .from('job_costs')
          .select('id, total_cost_cents')
          .in('session_id', sessionIds)
          .is('deleted_at', null)
      : Promise.resolve({ data: [] as { id: string; total_cost_cents: number }[], error: null }),
  ]);

  if (materialsByJobRes.error) throw materialsByJobRes.error;
  if (materialsBySessionRes.error) throw materialsBySessionRes.error;

  const materialById = new Map<string, { id: string; total_cost_cents: number }>();
  for (const m of (materialsByJobRes.data ?? []) as { id: string; total_cost_cents: number }[]) {
    materialById.set(m.id, m);
  }
  for (const m of (materialsBySessionRes.data ?? []) as { id: string; total_cost_cents: number }[]) {
    materialById.set(m.id, m);
  }

  const materialsSpendCents = [...materialById.values()].reduce(
    (acc, row) => acc + row.total_cost_cents,
    0,
  );

  const netEarningsCents = revenueCents - materialsSpendCents;
  return { netEarningsCents, jobCount: jobIds.length };
}

/** Per-job financial rollup for the Earnings snapshot window. */
export type EarningsSnapshotJob = {
  id: JobId;
  shortDescription: string;
  customerName: string | null;
  revenueCents: number;
  /** Negative spend (revenue minus this yields net). */
  materialsCents: number;
  netEarningsCents: number;
  hours: number;
  /** Net earnings per hour in cents; null when the job has no logged hours. */
  netPerHrCents: number | null;
};

export type EarningsSnapshotAggregate = {
  netEarningsCents: number;
  revenueCents: number;
  /** Negative spend total. */
  materialsCents: number;
  totalHours: number;
  jobCount: number;
  /** Aggregate net per hour in cents (total net / total hours); null when no hours. */
  netPerHrCents: number | null;
};

export type EarningsSnapshotForCurrentUserResult = {
  aggregate: EarningsSnapshotAggregate;
  jobs: EarningsSnapshotJob[];
};

/**
 * Earnings snapshot over a rolling window. Generalizes
 * `getWeeklyNetEarningsCentsForCurrentUser`: financially complete, completed
 * jobs (`job_work_status = completed`, including pending and paid payment
 * states) whose `last_worked_at` falls within the last `windowDays` days.
 * Returns aggregate metrics plus per-job rollups (revenue, materials, hours,
 * net, net/hr) for ranking on the Earnings page.
 */
export async function getEarningsSnapshotForCurrentUser(
  client: FieldSoloSupabaseClient,
  options: { windowDays: number },
): Promise<EarningsSnapshotForCurrentUserResult> {
  const windowDays = Math.max(1, Math.floor(options.windowDays));
  const windowStartIso = new Date(Date.now() - windowDays * MS_PER_DAY).toISOString();

  const emptyAggregate: EarningsSnapshotAggregate = {
    netEarningsCents: 0,
    revenueCents: 0,
    materialsCents: 0,
    totalHours: 0,
    jobCount: 0,
    netPerHrCents: null,
  };

  const { data: jobsData, error: jobsQueryError } = await client
    .from('jobs')
    .select('id, short_description, customer_name, revenue_cents')
    .eq('job_work_status', 'completed')
    .eq('is_job_record_complete', true)
    .gte('last_worked_at', windowStartIso)
    .is('deleted_at', null);

  if (jobsQueryError) throw jobsQueryError;

  type SnapshotJobRow = {
    id: string;
    short_description: string;
    customer_name: string | null;
    revenue_cents: number | null;
  };
  const jobRows = (jobsData ?? []) as SnapshotJobRow[];
  if (jobRows.length === 0) {
    return { aggregate: emptyAggregate, jobs: [] };
  }

  const jobIds = [...new Set(jobRows.map((r) => r.id).filter(Boolean))];

  const { data: sessionsData, error: sessionsError } = await client
    .from('sessions')
    .select('id, job_id, session_status, started_at, ended_at')
    .in('job_id', jobIds)
    .is('deleted_at', null);
  if (sessionsError) throw sessionsError;

  const sessions = ((sessionsData ?? []) as ListJobSessionRow[]).filter(
    (s) => s.session_status !== 'deleted',
  );
  const sessionJobIdBySessionId = new Map<string, string>();
  const totalHoursByJobId = new Map<string, number>();
  for (const s of sessions) {
    sessionJobIdBySessionId.set(s.id, s.job_id);
    if (s.session_status === 'ended' || s.session_status === 'in_progress') {
      const a = new Date(s.started_at).getTime();
      const b = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
      const hours = Math.max(0, (b - a) / 3_600_000);
      totalHoursByJobId.set(s.job_id, (totalHoursByJobId.get(s.job_id) ?? 0) + hours);
    }
  }

  const sessionIds = sessions.map((s) => s.id);
  const [materialsByJobRes, materialsBySessionRes] = await Promise.all([
    client
      .from('job_costs')
      .select('id, job_id, session_id, total_cost_cents, cost_type')
      .in('job_id', jobIds)
      .is('deleted_at', null),
    sessionIds.length > 0
      ? client
          .from('job_costs')
          .select('id, job_id, session_id, total_cost_cents, cost_type')
          .in('session_id', sessionIds)
          .is('deleted_at', null)
      : Promise.resolve({ data: [] as ListJobMaterialRow[], error: null }),
  ]);
  if (materialsByJobRes.error) throw materialsByJobRes.error;
  if (materialsBySessionRes.error) throw materialsBySessionRes.error;

  const materialById = new Map<string, ListJobMaterialRow>();
  for (const m of (materialsByJobRes.data ?? []) as ListJobMaterialRow[]) {
    materialById.set(m.id, m);
  }
  for (const m of (materialsBySessionRes.data ?? []) as ListJobMaterialRow[]) {
    materialById.set(m.id, m);
  }

  const materialsSpendByJobId = new Map<string, number>();
  const allCostsSpendByJobId = new Map<string, number>();
  for (const m of materialById.values()) {
    const materialJobId =
      m.job_id ?? (m.session_id ? sessionJobIdBySessionId.get(m.session_id) ?? null : null);
    if (!materialJobId) continue;
    allCostsSpendByJobId.set(
      materialJobId,
      (allCostsSpendByJobId.get(materialJobId) ?? 0) + m.total_cost_cents,
    );
    if (m.cost_type == null || m.cost_type === 'material') {
      materialsSpendByJobId.set(
        materialJobId,
        (materialsSpendByJobId.get(materialJobId) ?? 0) + m.total_cost_cents,
      );
    }
  }

  const jobs: EarningsSnapshotJob[] = jobRows.map((row) => {
    const revenueCents = row.revenue_cents ?? 0;
    const materialsCents = -(materialsSpendByJobId.get(row.id) ?? 0);
    const netEarningsCents = revenueCents - (allCostsSpendByJobId.get(row.id) ?? 0);
    const hours = totalHoursByJobId.get(row.id) ?? 0;
    const netPerHrCents = hours > 0 ? netEarningsCents / hours : null;
    return {
      id: row.id,
      shortDescription: row.short_description,
      customerName: row.customer_name,
      revenueCents,
      materialsCents,
      netEarningsCents,
      hours,
      netPerHrCents,
    };
  });

  const aggregate = jobs.reduce<EarningsSnapshotAggregate>(
    (acc, job) => {
      acc.netEarningsCents += job.netEarningsCents;
      acc.revenueCents += job.revenueCents;
      acc.materialsCents += job.materialsCents;
      acc.totalHours += job.hours;
      acc.jobCount += 1;
      return acc;
    },
    { ...emptyAggregate },
  );
  aggregate.netPerHrCents =
    aggregate.totalHours > 0 ? aggregate.netEarningsCents / aggregate.totalHours : null;

  return { aggregate, jobs };
}

export type OutstandingPaymentsForCurrentUserResult = {
  /** Number of financially-complete, work-complete, not-yet-paid jobs. */
  count: number;
  /** Sum of `revenue_cents` (gross amount owed) across those jobs. */
  revenueCents: number;
};

/**
 * All-time outstanding payments: jobs whose record is complete, marked
 * work complete, but not yet paid — the same set as the Jobs Open tab "unpaid"
 * section (`job_work_status = completed` and payment state is not paid).
 */
export async function getOutstandingPaymentsForCurrentUser(
  client: FieldSoloSupabaseClient,
): Promise<OutstandingPaymentsForCurrentUserResult> {
  type OutstandingRow = { revenue_cents: number | null; collected_cents: number };
  const result = await client
    .from('jobs')
    .select('revenue_cents, collected_cents')
    .eq('job_work_status', 'completed')
    .or('job_payment_state.is.null,job_payment_state.eq.unpaid,job_payment_state.eq.partially_paid')
    .eq('is_job_record_complete', true)
    .is('deleted_at', null);
  if (result.error) throw result.error;

  const rows = (result.data ?? []) as OutstandingRow[];
  const revenueCents = rows.reduce(
    (acc, row) => acc + Math.max(0, (row.revenue_cents ?? 0) - (row.collected_cents ?? 0)),
    0,
  );
  return { count: rows.length, revenueCents };
}

/**
 * Recent jobs with full list rollups (time, materials, net), ordered by
 * `updated_at` then `id`. Use for Home “Jump back in”.
 */
export async function listRecentDetailedJobsForCurrentUser(
  client: FieldSoloSupabaseClient,
  options: { limit: number },
): Promise<ListJobsForCurrentUserItem[]> {
  const limit = Math.max(1, Math.floor(options.limit));

  const runQuery = async (selectColumns: string) => {
    const listQuery = client.from('jobs').select(selectColumns).is('deleted_at', null);
    return listQuery
      .order('updated_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit);
  };

  const result = await runQuery(JOB_LIST_SELECT_FULL);

  if (result.error) throw result.error;
  const rows = ((result.data ?? []) as unknown) as ListJobsRow[];
  if (rows.length === 0) {
    return [];
  }
  return enrichJobsRowsWithSessionRollups(client, rows);
}

export async function createBlankJobForLiveSessionStart(
  client: FieldSoloSupabaseClient,
  input: { shortDescription: string },
): Promise<JobId> {
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  const userId = authData.user?.id;
  if (!userId) {
    throw new Error('No authenticated user available to create a job.');
  }

  const shortDescription = input.shortDescription
    .trim()
    .slice(0, JOB_SHORT_DESCRIPTION_MAX_LENGTH);
  if (!shortDescription) {
    throw new Error('Short description is required.');
  }

  const { data, error } = await client
    .from('jobs')
    .insert({
      user_id: userId,
      short_description: shortDescription,
      customer_name: '',
      service_address: '',
      job_type: '',
      created_via: 'session_start',
      job_work_status: 'not_started',
    })
    .select('id')
    .single();

  if (error) throw error;
  return (data as { id: string }).id;
}

export async function deleteJobById(
  client: FieldSoloSupabaseClient,
  id: JobId,
): Promise<void> {
  const { data, error } = await client
    .from('jobs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error('Delete affected no rows (check RLS: job must be owned by you).');
  }
}

function normalizeEditableJobInput(input: UpdateJobInput): UpdateJobInput {
  const shortDescription = input.shortDescription
    .trim()
    .slice(0, JOB_SHORT_DESCRIPTION_MAX_LENGTH);
  if (!shortDescription) {
    throw new Error('Short description is required.');
  }

  if (
    input.revenueCents != null &&
    (!Number.isInteger(input.revenueCents) || input.revenueCents < 0)
  ) {
    throw new Error('Revenue must be a non-negative dollar amount.');
  }

  return {
    shortDescription,
    longDescription: input.longDescription.trim(),
    customerName: input.customerName.trim(),
    serviceAddress: input.serviceAddress.trim(),
    revenueCents: input.revenueCents,
  };
}

/**
 * Records or clears the user's review of the job's costs.
 */
export async function updateJobCostsReviewed(
  client: FieldSoloSupabaseClient,
  id: JobId,
  reviewed: boolean,
): Promise<void> {
  await updateJobMaterialsReviewed(client, id, reviewed);
}

export async function updateJobMaterialsReviewed(
  client: FieldSoloSupabaseClient,
  id: JobId,
  reviewed: boolean,
): Promise<void> {
  const { data, error } = await client
    .from('jobs')
    .update({ materials_reviewed_at: reviewed ? new Date().toISOString() : null })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error('Update affected no rows (check RLS: job must be owned by you).');
  }
}

export async function updateJobOtherCostsReviewed(
  client: FieldSoloSupabaseClient,
  id: JobId,
  reviewed: boolean,
): Promise<void> {
  const { data, error } = await client
    .from('jobs')
    .update({ other_costs_reviewed_at: reviewed ? new Date().toISOString() : null })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error('Update affected no rows (check RLS: job must be owned by you).');
  }
}

export async function updateJobNoRevenueConfirmed(
  client: FieldSoloSupabaseClient,
  id: JobId,
  confirmed: boolean,
): Promise<void> {
  const patch = confirmed
    ? { no_revenue_confirmed_at: new Date().toISOString(), revenue_cents: 0 }
    : { no_revenue_confirmed_at: null };
  const { data, error } = await client
    .from('jobs')
    .update(patch)
    .eq('id', id)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error('Update affected no rows (check RLS: job must be owned by you).');
  }
}

/**
 * If the job is still `not_started`, set it to `in_progress` (e.g. after the first session is created).
 * No-op when no row matches (already in progress, completed, etc.).
 */
export async function bumpJobToInProgressIfNotStarted(
  client: FieldSoloSupabaseClient,
  jobId: JobId,
): Promise<void> {
  const { error } = await client
    .from('jobs')
    .update({ job_work_status: 'in_progress' })
    .eq('id', jobId)
    .eq('job_work_status', 'not_started')
    .is('deleted_at', null);
  if (error) throw error;
}

/**
 * Best-effort variant for call sites where the primary write has already
 * succeeded. A status-bump failure must not make the caller retry and create
 * duplicate/conflicting session state.
 */
export async function tryBumpJobToInProgressIfNotStarted(
  client: FieldSoloSupabaseClient,
  jobId: JobId,
): Promise<void> {
  try {
    await bumpJobToInProgressIfNotStarted(client, jobId);
  } catch {
    // Session creation is the source of truth; callers refresh after creation.
  }
}

export async function updateJobById(
  client: FieldSoloSupabaseClient,
  id: JobId,
  input: UpdateJobInput,
): Promise<void> {
  const normalized = normalizeEditableJobInput(input);
  const patch = {
    short_description: normalized.shortDescription,
    long_description: normalized.longDescription.length > 0 ? normalized.longDescription : null,
    customer_name: normalized.customerName,
    service_address: normalized.serviceAddress,
    revenue_cents: normalized.revenueCents,
  };

  const { data, error } = await client
    .from('jobs')
    .update(patch)
    .eq('id', id)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error('Update affected no rows (check RLS: job must be owned by you).');
  }
}

/**
 * Maps UI job status to `jobs` row columns. `paid` in the view model is
 * `completed` + `job_payment_state: paid` in the database.
 */
export function jobDetailWorkStatusToDbColumns(
  status: JobDetailWorkStatus,
  revenueCents = 0,
): {
  job_work_status: JobWorkStatusDb;
  collected_cents: number;
} {
  switch (status) {
    case 'notStarted':
      return { job_work_status: 'not_started', collected_cents: 0 };
    case 'inProgress':
      return { job_work_status: 'in_progress', collected_cents: 0 };
    case 'onHold':
      return { job_work_status: 'on_hold', collected_cents: 0 };
    case 'completed':
      return { job_work_status: 'completed', collected_cents: 0 };
    case 'paid':
      return { job_work_status: 'completed', collected_cents: Math.max(0, revenueCents) };
    case 'cancelled':
      return { job_work_status: 'canceled', collected_cents: 0 };
  }
}

export async function updateJobStatusById(
  client: FieldSoloSupabaseClient,
  id: JobId,
  status: JobDetailWorkStatus,
): Promise<void> {
  let revenueCents = 0;
  if (status === 'paid') {
    const { data: job, error: readError } = await client
      .from('jobs')
      .select('revenue_cents')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (readError) throw readError;
    if (!job) throw new Error('Job not found (check RLS: job must be owned by you).');
    revenueCents = (job as { revenue_cents: number | null }).revenue_cents ?? 0;
  }
  const patch = jobDetailWorkStatusToDbColumns(status, revenueCents);
  const { data, error } = await client
    .from('jobs')
    .update(patch)
    .eq('id', id)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error('Update affected no rows (check RLS: job must be owned by you).');
  }
}
