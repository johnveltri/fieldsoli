export {
  JOB_SHORT_DESCRIPTION_MAX_LENGTH,
} from './jobDetailView';
export type {
  JobDetailMaterialBucket,
  JobDetailMaterialLine,
  JobDetailMock,
  JobDetailNote,
  JobDetailNoteBucket,
  JobDetailOtherCostBucket,
  JobDetailOtherCostLine,
  JobDetailSession,
  JobDetailSessionAttachment,
  JobDetailViewModel,
  JobDetailWorkStatus,
} from './jobDetailView';

/**
 * Active in-progress (live) session payload — used by the floating live-session
 * bar / open bottom sheet that lives outside the JobDetail screen.
 *
 * Returned by `fetchActiveLiveSessionForCurrentUser` and produced by
 * `createLiveSession` in `@fieldsolo/api-client`.
 */
export type ActiveLiveSession = {
  id: string;
  jobId: string;
  /** ISO 8601 timestamp the session started — drives the live counter. */
  startedAt: string;
  /** IANA timezone of the device at start (used for local-midnight auto-end). */
  startedTz: string;
  /** Job description shown above the timer / on the minimized bar. */
  jobShortDescription: string;
};

/** Stable identifier for a job across DB, API, and clients. */
export type JobId = string;

/** Derived from `jobs.revenue_cents` and `jobs.collected_cents`. */
export type JobPaymentState = 'unpaid' | 'partially_paid' | 'paid';

/**
 * Domain model for a job — extend as the Job Detail vertical slice grows.
 * Align names with `backend/supabase` migrations when they land.
 */
export type Job = {
  id: JobId;
  /** Maps to `jobs.short_description`. */
  shortDescription: string;
  customerName: string | null;
  /** ISO 8601 timestamp */
  updatedAt: string;
  /** Primary economic fields on the job (cents). Omitted when not selected. */
  revenueCents?: number | null;
  jobPaymentState?: JobPaymentState | null;
  collectedCents?: number | null;
};
