/**
 * View model for Job Detail screen — aligns with DB + derived UI fields.
 * Maps from Supabase via `@fieldsolo/api-client` `fetchJobDetail`.
 */

/** Mirrors design-system `StatusPill` kinds for the job header pill (includes derived `paid`). */
export type JobDetailWorkStatus =
  | 'paid'
  | 'notStarted'
  | 'inProgress'
  | 'completed'
  | 'onHold'
  | 'cancelled';

/**
 * Merged note + material rows for a single session, sorted by `updatedAt` desc
 * in `fetchJobDetail` (used for the expanded session attachment list).
 */
export type JobDetailSessionAttachment =
  | {
      kind: 'note';
      id: string;
      /** ISO 8601 — from `notes.updated_at` (fallback: `created_at`). */
      updatedAt: string;
      /** List title — same excerpt rules as `JobDetailNote.excerpt`. */
      title: string;
    }
  | {
      kind: 'material';
      id: string;
      /** ISO 8601 — from `materials.updated_at` (fallback: `created_at`). */
      updatedAt: string;
      /** Material description only. */
      name: string;
      /** Primary line, e.g. `Copper wire (2 ea @ $2.00)`. */
      title: string;
      /** Right column — `total_cost` as USD. */
      priceLabel: string;
    }
  | {
      kind: 'otherCost';
      id: string;
      /** ISO 8601 — from `materials.updated_at` (fallback: `created_at`). */
      updatedAt: string;
      /** Cost category label, e.g. `Travel / Parking`. */
      typeLabel: string;
      /** Right column — `total_cost` as USD. */
      priceLabel: string;
    };

export type JobDetailSession = {
  id: string;
  /** ISO 8601 timestamp (UTC with offset). Raw session start for prefilling edit UI. */
  startedAt: string;
  /** ISO 8601 timestamp or null while a session is still in progress. */
  endedAt: string | null;
  /**
   * When false, View must not show a clock range — only date + duration.
   * True when either start or end clock was explicitly set on Edit.
   */
  clockTimesExplicit: boolean;
  /** User explicitly set the start clock on Edit. */
  clockStartExplicit: boolean;
  /** User explicitly set the end clock on Edit. */
  clockEndExplicit: boolean;
  /** False when the user left the session date empty on Edit. */
  calendarDateExplicit: boolean;
  dateLabel: string;
  timeRangeLabel: string;
  durationLabel: string;
  /**
   * Notes and materials linked to this session, newest-updated first.
   * UI may show a preview of the first 3 and expand to the full list.
   */
  attachments: JobDetailSessionAttachment[];
};

export type JobDetailMaterialLine = {
  id: string;
  /** Set when the material is attached to a session; null for job-scoped materials. */
  sessionId: string | null;
  /** Description text — used as prefill when opening the Edit Material sheet. */
  name: string;
  /** Raw numeric quantity (matches `materials.quantity numeric(12,3)`). */
  /** Null when no quantity was captured. Zero is retained as an explicit value. */
  quantity: number | null;
  /** Whether the quantity was captured, independently of its numeric value. */
  quantityExplicit: boolean;
  /** Unit of measure (e.g. "ea", "ft"). Stored verbatim, may be custom. */
  unit: string;
  /** Per-unit cost in cents (raw value for the Edit sheet's unit price input). */
  /** Null when no unit cost was captured. Zero is retained as an explicit value. */
  unitCostCents: number | null;
  /** Whether the unit cost was captured, independently of its numeric value. */
  unitCostExplicit: boolean;
  /** Authoritative material total, including total-only partial materials. */
  totalCostCents: number;
  /**
   * Precomputed display label for the view-only material row, combining
   * quantity, unit, and per-unit cost (e.g. `"2 ea @ $37.50"`). When
   * `unitCostCents` is 0 or quantity is missing the `@ $…` suffix is
   * dropped and the label falls back to `"2 ea"` / `"—"`.
   */
  quantityLabel: string;
  /** Precomputed USD display label for `total_cost_cents`. */
  priceLabel: string;
};

export type JobDetailMaterialBucket = {
  id: string;
  kind: 'unassigned' | 'session';
  sessionDateLabel?: string;
  items: JobDetailMaterialLine[];
};

export type JobDetailNote = {
  id: string;
  /** Full body — used as prefill when opening the Edit Note sheet. */
  body: string;
  /** Set when the note is attached to a session; null for job-scoped notes. */
  sessionId: string | null;
  /** Truncated preview for list rendering. */
  excerpt: string;
  dateLabel: string;
};

export type JobDetailNoteBucket = {
  id: string;
  kind: 'unassigned' | 'session';
  sessionDateLabel?: string;
  notes: JobDetailNote[];
};

export type JobDetailOtherCostLine = {
  id: string;
  sessionId: string | null;
  costType: string;
  costTypeExplicit: boolean;
  typeLabel: string;
  description: string;
  costCents: number;
  priceLabel: string;
};

export type JobDetailOtherCostBucket = {
  id: string;
  kind: 'unassigned' | 'session';
  sessionDateLabel?: string;
  items: JobDetailOtherCostLine[];
};

/** Full payload for `JobDetailScreen`. */
export type JobDetailViewModel = {
  id: string;
  shortDescription: string;
  customerName: string;
  serviceAddress: string;
  jobType: string;
  lastWorkedLabel: string;
  workStatus: JobDetailWorkStatus;
  earnings: {
    /** Null means revenue has not been captured; zero is an explicit value. */
    revenueCents: number | null;
    materialsCents: number;
    /** Non-material job costs (Phase 2 API); Phase 1 may supply from local UI state. */
    otherCostsCents: number;
    feesCents: number;
    netEarningsCents: number;
  };
  metrics: {
    timeLabel: string;
    netPerHrDisplay: string;
    sessionCount: number;
  };
  /** Sessions shown in current Job Detail UI (completed only). */
  displaySessions: JobDetailSession[];
  /** All non-deleted sessions (completed + in-progress) for future UI/flows. */
  allSessions: JobDetailSession[];
  /** Current in-progress session when present. */
  inProgressSession: JobDetailSession | null;
  materialBuckets: JobDetailMaterialBucket[];
  otherCostBuckets: JobDetailOtherCostBucket[];
  noteBuckets: JobDetailNoteBucket[];
  /**
   * User confirmed there is no revenue for this job; satisfies the revenue
   * completeness leg until positive revenue is entered.
   */
  noRevenueConfirmed: boolean;
  /**
   * User confirmed there were no materials for this job; satisfies the materials
   * leg of financial completeness until a material row is added.
   */
  noMaterialsConfirmed: boolean;
  /**
   * User confirmed there were no other costs for this job; satisfies the other-costs
   * leg of financial completeness until a non-material cost row is added.
   */
  noOtherCostsConfirmed: boolean;
};

/** @deprecated Use JobDetailViewModel */
export type JobDetailMock = JobDetailViewModel;
