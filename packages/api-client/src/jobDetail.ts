import type {
  JobDetailMaterialBucket,
  JobDetailMaterialLine,
  JobDetailNote,
  JobDetailNoteBucket,
  JobDetailOtherCostBucket,
  JobDetailOtherCostLine,
  JobDetailSession,
  JobDetailSessionAttachment,
  JobDetailViewModel,
  JobDetailWorkStatus,
  JobId,
  JobPaymentState,
} from '@fieldsolo/shared-types';

import type { FieldSoloSupabaseClient } from './client';
import { JOB_DETAIL_EMPTY_LABELS } from './jobDetailLabels';
import { formatSessionDurationLabel } from './sessionDurationDraft';

type JobWorkStatusDb =
  | 'not_started'
  | 'in_progress'
  | 'on_hold'
  | 'completed'
  | 'canceled';

type JobRow = {
  id: string;
  short_description: string;
  long_description: string | null;
  customer_name: string | null;
  service_address: string | null;
  job_type: string | null;
  job_work_status: JobWorkStatusDb;
  job_payment_state: JobPaymentState | null;
  revenue_cents: number | null;
  collected_cents: number | null;
  updated_at: string;
  last_worked_at: string | null;
  materials_reviewed_at: string | null;
  other_costs_reviewed_at: string | null;
  no_revenue_confirmed_at: string | null;
};

type SessionRow = {
  id: string;
  job_id: string;
  session_status: 'in_progress' | 'ended' | 'deleted';
  started_at: string;
  ended_at: string | null;
  clock_times_explicit?: boolean | null;
  clock_start_explicit?: boolean | null;
  clock_end_explicit?: boolean | null;
  calendar_date_explicit?: boolean | null;
};

type NoteRow = {
  id: string;
  job_id: string | null;
  session_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
};

type MaterialRow = {
  id: string;
  job_id: string | null;
  session_id: string | null;
  description: string | null;
  /** Postgres `numeric` may deserialize as string. */
  quantity: string | number | null;
  unit: string | null;
  unit_cost_cents: number | null;
  total_cost_cents: number;
  cost_type: string;
  cost_type_explicit?: boolean | null;
  quantity_explicit?: boolean | null;
  unit_cost_explicit?: boolean | null;
  created_at: string;
  updated_at: string;
};

const JOB_DETAIL_JOB_SELECT_BASE =
  'id, short_description, long_description, customer_name, service_address, job_type, job_work_status, job_payment_state, revenue_cents, collected_cents, updated_at, last_worked_at, materials_reviewed_at, other_costs_reviewed_at, no_revenue_confirmed_at';

const OTHER_COST_TYPE_LABELS: Record<string, string> = {
  helper_labor: 'Helper Labor',
  equipment_rental: 'Equipment Rental',
  permit: 'Permit',
  disposal: 'Disposal',
  travel_parking: 'Travel / Parking',
  other: 'Other',
};

function isMaterialCostRow(costType: string | null | undefined): boolean {
  return costType == null || costType === 'material';
}

function otherCostTypeLabel(costType: string): string {
  return OTHER_COST_TYPE_LABELS[costType] ?? costType;
}

const moneyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

function formatUsd(cents: number): string {
  return moneyFmt.format(cents / 100);
}

function formatDateLabel(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso));
}

function sessionDurationHours(startedAt: string, endedAt: string | null): number {
  const a = new Date(startedAt).getTime();
  const b = endedAt ? new Date(endedAt).getTime() : Date.now();
  return Math.max(0, (b - a) / 3_600_000);
}

function mapWorkStatus(row: JobRow): JobDetailWorkStatus {
  // Keep "paid" as a derived UI status only when work is complete and payment is paid.
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

function mapSession(row: SessionRow, attachments: JobDetailSessionAttachment[] = []): JobDetailSession {
  const start = new Date(row.started_at);
  const end = row.ended_at ? new Date(row.ended_at) : null;
  const clockStartExplicit = row.clock_start_explicit === true;
  const clockEndExplicit = row.clock_end_explicit === true;
  const clockTimesExplicit = clockStartExplicit || clockEndExplicit;
  const calendarDateExplicit = row.calendar_date_explicit !== false;
  const timeFmt = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  const startStr = timeFmt.format(start);
  const endStr = end ? timeFmt.format(end) : '';
  const hours = sessionDurationHours(row.started_at, row.ended_at);
  const durationLabel =
    hours > 0 ? formatSessionDurationLabel(hours) : JOB_DETAIL_EMPTY_LABELS.sessionDuration;

  let timeRangeLabel = '';
  if (clockStartExplicit && clockEndExplicit && endStr) {
    // Full range only when there is a real duration; otherwise drop the dangling end.
    timeRangeLabel = hours > 0 ? `${startStr} – ${endStr}` : startStr;
  } else if (clockStartExplicit) {
    // Start only (no explicit end) — omit "– end" / "– …".
    timeRangeLabel = startStr;
  } else if (clockEndExplicit && endStr) {
    timeRangeLabel = endStr;
  }

  return {
    id: row.id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    clockTimesExplicit,
    clockStartExplicit,
    clockEndExplicit,
    calendarDateExplicit,
    dateLabel: calendarDateExplicit
      ? formatDateLabel(row.started_at)
      : JOB_DETAIL_EMPTY_LABELS.sessionDate,
    timeRangeLabel,
    durationLabel,
    attachments,
  };
}

function excerptNote(body: string, max = 120): string {
  const t = body.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function materialAttachmentTitle(line: JobDetailMaterialLine): string {
  if (line.quantityLabel && line.quantityLabel !== '—') {
    return `${line.name} (${line.quantityLabel})`;
  }
  return line.name;
}

/**
 * Merges a session’s notes and materials, sorted by `updated_at` descending
 * (falls back to `created_at` when `updated_at` is missing in tests).
 */
function mergeSessionAttachments(
  sessionNotes: NoteRow[],
  sessionMats: MaterialRow[],
  sessionOtherCosts: MaterialRow[] = [],
): JobDetailSessionAttachment[] {
  const noteItems: JobDetailSessionAttachment[] = sessionNotes.map((n) => ({
    kind: 'note' as const,
    id: n.id,
    updatedAt: n.updated_at || n.created_at,
    title: excerptNote(n.body),
  }));
  const matItems: JobDetailSessionAttachment[] = sessionMats.map((m) => {
    const line = materialLine(m);
    return {
      kind: 'material' as const,
      id: m.id,
      updatedAt: m.updated_at || m.created_at,
      name: line.name,
      title: materialAttachmentTitle(line),
      priceLabel: line.priceLabel,
    };
  });
  const otherCostItems: JobDetailSessionAttachment[] = sessionOtherCosts.map((c) => {
    const line = otherCostLine(c);
    return {
      kind: 'otherCost' as const,
      id: c.id,
      updatedAt: c.updated_at || c.created_at,
      typeLabel: line.typeLabel,
      priceLabel: line.priceLabel,
    };
  });
  const merged = [...noteItems, ...matItems, ...otherCostItems];
  merged.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  return merged;
}

function sessionDateLabelFromRow(row: SessionRow): string {
  return row.calendar_date_explicit === false
    ? JOB_DETAIL_EMPTY_LABELS.sessionDate
    : formatDateLabel(row.started_at);
}

function materialLine(row: MaterialRow): JobDetailMaterialLine {
  // Normalize `numeric` (which may come back as string) to a JS number so
  // downstream UI forms don't need to re-parse it.
  const quantityNum =
    typeof row.quantity === 'string'
      ? Number(row.quantity)
      : row.quantity;
  const unit = row.unit?.trim() ?? '';
  const quantityExplicit = row.quantity_explicit !== false;
  const unitCostExplicit = row.unit_cost_explicit !== false;
  const unitCostCents = row.unit_cost_cents;
  const baseQtyLabel =
    quantityExplicit && row.quantity != null && row.quantity !== ''
      ? `${row.quantity}${unit ? ` ${unit}` : ''}`
      : '—';
  // Append the per-unit cost to the display label (e.g. "2 ea @ $37.50") so
  // the view-only material row shows both the quantity and the unit cost;
  // the total cost stays on the right-hand column via `priceLabel`. Suppress
  // the suffix when we have no quantity (`—`) or a zero unit cost (nothing
  // meaningful to show).
  const qtyLabel =
    baseQtyLabel !== '—' && unitCostExplicit && (unitCostCents ?? 0) > 0
      ? `${baseQtyLabel} @ ${formatUsd(unitCostCents ?? 0)}`
      : baseQtyLabel;
  return {
    id: row.id,
    sessionId: row.session_id,
    name: row.description?.trim() || JOB_DETAIL_EMPTY_LABELS.materialDescription,
    quantity: quantityExplicit && Number.isFinite(quantityNum) ? quantityNum : null,
    quantityExplicit,
    unit,
    unitCostCents,
    unitCostExplicit,
    totalCostCents: row.total_cost_cents,
    quantityLabel: qtyLabel,
    priceLabel: formatUsd(row.total_cost_cents),
  };
}

function otherCostLine(row: MaterialRow): JobDetailOtherCostLine {
  const costType = row.cost_type;
  const description = row.description?.trim() ?? '';
  const typeLabel =
    row.cost_type_explicit === false
      ? JOB_DETAIL_EMPTY_LABELS.otherCostType
      : otherCostTypeLabel(costType);
  return {
    id: row.id,
    sessionId: row.session_id,
    costType,
    costTypeExplicit: row.cost_type_explicit !== false,
    typeLabel,
    description,
    costCents: row.total_cost_cents,
    priceLabel: formatUsd(row.total_cost_cents),
  };
}

/** Loads job graph and maps to `JobDetailViewModel`. */
export async function fetchJobDetail(
  client: FieldSoloSupabaseClient,
  jobId: JobId,
): Promise<JobDetailViewModel | null> {
  const { data: job, error: jobErr } = await client
    .from('jobs')
    .select(JOB_DETAIL_JOB_SELECT_BASE)
    .eq('id', jobId)
    .is('deleted_at', null)
    .maybeSingle();
  if (jobErr) throw jobErr;
  if (!job) return null;

  const j = job as unknown as JobRow;

  const { data: sessionsRaw, error: sErr } = await client
    .from('sessions')
    .select(
      'id, job_id, session_status, started_at, ended_at, clock_times_explicit, clock_start_explicit, clock_end_explicit, calendar_date_explicit',
    )
    .eq('job_id', jobId)
    .order('started_at', { ascending: true });

  if (sErr) throw sErr;
  const sessions = (sessionsRaw ?? []) as SessionRow[];
  const activeSessions = sessions.filter((s) => s.session_status !== 'deleted');
  const endedSessions = activeSessions.filter((s) => s.session_status === 'ended');
  const inProgressSession =
    activeSessions.find((s) => s.session_status === 'in_progress') ?? null;
  const sessionIds = activeSessions.map((s) => s.id);

  const notesBase = client
    .from('notes')
    .select('id, job_id, session_id, body, created_at, updated_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  const notesQ =
    sessionIds.length > 0
      ? notesBase.or(`job_id.eq.${jobId},session_id.in.(${sessionIds.join(',')})`)
      : notesBase.eq('job_id', jobId);

  const [notesRes, matsJobRes, matsSessRes] = await Promise.all([
    notesQ,
    client
      .from('job_costs')
      .select('*')
      .eq('job_id', jobId)
      .is('deleted_at', null),
    sessionIds.length
      ? client
          .from('job_costs')
          .select('*')
          .in('session_id', sessionIds)
          .is('deleted_at', null)
      : Promise.resolve({ data: [] as MaterialRow[], error: null }),
  ]);

  if (notesRes.error) throw notesRes.error;
  if (matsJobRes.error) throw matsJobRes.error;
  if (matsSessRes.error) throw matsSessRes.error;

  const notesRaw = notesRes.data;
  const matsJob = matsJobRes.data;
  const matsSess = matsSessRes.data;

  const matById = new Map<string, MaterialRow>();
  for (const m of (matsJob ?? []) as MaterialRow[]) matById.set(m.id, m);
  for (const m of (matsSess ?? []) as MaterialRow[]) matById.set(m.id, m);
  const allCosts = [...matById.values()];
  const materials = allCosts.filter((cost) => isMaterialCostRow(cost.cost_type));
  const otherCosts = allCosts.filter((cost) => !isMaterialCostRow(cost.cost_type));

  const notes = (notesRaw ?? []) as NoteRow[];

  const revenueCents = j.revenue_cents;
  const materialsSpend = materials.reduce((s, m) => s + m.total_cost_cents, 0);
  const otherCostsSpend = otherCosts.reduce((s, cost) => s + cost.total_cost_cents, 0);
  const allCostsSpend = allCosts.reduce((s, cost) => s + cost.total_cost_cents, 0);
  const materialsCents = -materialsSpend;
  const otherCostsCents = -otherCostsSpend;
  const feesCents = 0;
  const netEarningsCents = (revenueCents ?? 0) - allCostsSpend + feesCents;

  let totalHours = 0;
  for (const s of activeSessions) {
    if (s.session_status === 'ended' || s.session_status === 'in_progress') {
      totalHours += sessionDurationHours(s.started_at, s.ended_at);
    }
  }

  const sessionCount = activeSessions.filter(
    (s) => s.session_status === 'ended' || s.session_status === 'in_progress',
  ).length;

  const netPerHrDisplay =
    totalHours > 0.01
      ? `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
          netEarningsCents / 100 / totalHours,
        )}/hr`
      : '—';

  const lastWorkedAt = j.last_worked_at ?? null;
  const lastWorkedLabel =
    lastWorkedAt != null && lastWorkedAt !== ''
      ? `Last worked ${formatDateLabel(lastWorkedAt)}`
      : 'No sessions yet';

  const matsUnassigned = materials.filter((m) => m.session_id == null);
  const matsBySession = new Map<string, MaterialRow[]>();
  for (const m of materials) {
    if (m.session_id) {
      const list = matsBySession.get(m.session_id) ?? [];
      list.push(m);
      matsBySession.set(m.session_id, list);
    }
  }

  const materialBuckets: JobDetailMaterialBucket[] = [];
  if (matsUnassigned.length) {
    materialBuckets.push({
      id: 'mat-unassigned',
      kind: 'unassigned',
      items: matsUnassigned.sort((a, b) => a.created_at.localeCompare(b.created_at)).map(materialLine),
    });
  }
  for (const s of activeSessions) {
    const ms = matsBySession.get(s.id);
    if (ms?.length) {
      materialBuckets.push({
        id: `mat-${s.id}`,
        kind: 'session',
        sessionDateLabel: sessionDateLabelFromRow(s),
        items: ms.sort((a, b) => a.created_at.localeCompare(b.created_at)).map(materialLine),
      });
    }
  }

  const ocUnassigned = otherCosts.filter((c) => c.session_id == null);
  const ocBySession = new Map<string, MaterialRow[]>();
  for (const c of otherCosts) {
    if (c.session_id) {
      const list = ocBySession.get(c.session_id) ?? [];
      list.push(c);
      ocBySession.set(c.session_id, list);
    }
  }

  const otherCostBuckets: JobDetailOtherCostBucket[] = [];
  if (ocUnassigned.length) {
    otherCostBuckets.push({
      id: 'oc-unassigned',
      kind: 'unassigned',
      items: ocUnassigned.sort((a, b) => a.created_at.localeCompare(b.created_at)).map(otherCostLine),
    });
  }
  for (const s of activeSessions) {
    const lines = ocBySession.get(s.id);
    if (lines?.length) {
      otherCostBuckets.push({
        id: `oc-${s.id}`,
        kind: 'session',
        sessionDateLabel: sessionDateLabelFromRow(s),
        items: lines.sort((a, b) => a.created_at.localeCompare(b.created_at)).map(otherCostLine),
      });
    }
  }

  const notesUnassigned = notes.filter(
    (n) => n.job_id === jobId && n.session_id == null,
  );
  const notesBySession = new Map<string, NoteRow[]>();
  for (const n of notes) {
    if (n.session_id) {
      const list = notesBySession.get(n.session_id) ?? [];
      list.push(n);
      notesBySession.set(n.session_id, list);
    }
  }

  const attachmentBySessionId = new Map<string, JobDetailSessionAttachment[]>();
  for (const s of activeSessions) {
    const sessionNotes = notesBySession.get(s.id) ?? [];
    const sessionMats = matsBySession.get(s.id) ?? [];
    const sessionOtherCosts = ocBySession.get(s.id) ?? [];
    attachmentBySessionId.set(
      s.id,
      mergeSessionAttachments(sessionNotes, sessionMats, sessionOtherCosts),
    );
  }

  const mapNote = (n: NoteRow) => ({
    id: n.id,
    body: n.body,
    sessionId: n.session_id,
    excerpt: excerptNote(n.body),
    dateLabel: formatDateLabel(n.created_at),
  });

  const noteBuckets: JobDetailNoteBucket[] = [];
  if (notesUnassigned.length) {
    noteBuckets.push({
      id: 'note-unassigned',
      kind: 'unassigned',
      notes: notesUnassigned.map(mapNote),
    });
  }
  for (const s of activeSessions) {
    const ns = notesBySession.get(s.id);
    if (ns?.length) {
      noteBuckets.push({
        id: `note-${s.id}`,
        kind: 'session',
        sessionDateLabel: sessionDateLabelFromRow(s),
        notes: ns.map(mapNote),
      });
    }
  }

  return {
    id: j.id,
    shortDescription: j.short_description,
    longDescription: j.long_description ?? '',
    customerName: j.customer_name ?? '',
    serviceAddress: j.service_address ?? '',
    jobType: j.job_type ?? '',
    lastWorkedLabel,
    workStatus: mapWorkStatus(j),
    earnings: {
      revenueCents,
      materialsCents,
      otherCostsCents,
      feesCents,
      netEarningsCents,
    },
    metrics: {
      timeLabel: formatSessionDurationLabel(totalHours),
      netPerHrDisplay,
      sessionCount,
    },
    // Current UI shows completed sessions only.
    displaySessions: endedSessions.map((s) =>
      mapSession(s, attachmentBySessionId.get(s.id) ?? []),
    ),
    // Keep full non-deleted set for future dedicated in-progress UI.
    allSessions: activeSessions.map((s) =>
      mapSession(s, attachmentBySessionId.get(s.id) ?? []),
    ),
    inProgressSession: inProgressSession
      ? mapSession(inProgressSession, attachmentBySessionId.get(inProgressSession.id) ?? [])
      : null,
    materialBuckets,
    otherCostBuckets,
    noteBuckets,
    noMaterialsConfirmed: j.materials_reviewed_at != null,
    noOtherCostsConfirmed: j.other_costs_reviewed_at != null,
    noRevenueConfirmed: j.no_revenue_confirmed_at != null,
  };
}
