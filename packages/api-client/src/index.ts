export { createFieldSoloClient, type FieldSoloSupabaseClient } from './client';
export { fetchJobDetail } from './jobDetail';
export { JOB_DETAIL_EMPTY_LABELS } from './jobDetailLabels';
export {
  applyJobDetailEdit,
  ApplyJobDetailEditError,
  type ApplyJobDetailEditPayload,
  type ApplyJobDetailEditErrorCode,
} from './applyJobDetailEdit';
export {
  createDefaultSessionDraft,
  deviceIanaTimeZone,
  durationHoursBetween,
  DURATION_CHIP_HOURS,
  formatDurationChipLabel,
  formatLocalDateLabel,
  formatSessionDurationLabel,
  formatSessionTimeLabel,
  inferSessionClockExplicitFlags,
  normalizeSessionStartedTz,
  resolveSessionDraftTimes,
  synthesizeSessionTimes,
  todayLocalDateString,
  type SessionDurationDraft,
} from './sessionDurationDraft';
export {
  createBlankJobForCurrentUser,
  createBlankJobForLiveSessionStart,
  createJobForCurrentUser,
  type CreateJobForCurrentUserInput,
  deleteJobById,
  fetchFirstJobIdForCurrentUser,
  fetchJobById,
  jobDetailWorkStatusToDbColumns,
  listJobsForCurrentUser,
  listJobsForCurrentUserPage,
  listRecentDetailedJobsForCurrentUser,
  listRecentJobsForCurrentUser,
  getWeeklyNetEarningsCentsForCurrentUser,
  countCompletedJobsForCurrentUser,
  getEarningsSnapshotForCurrentUser,
  getOutstandingPaymentsForCurrentUser,
  updateJobById,
  bumpJobToInProgressIfNotStarted,
  tryBumpJobToInProgressIfNotStarted,
  updateJobCostsReviewed,
  updateJobMaterialsReviewed,
  updateJobNoRevenueConfirmed,
  updateJobOtherCostsReviewed,
  updateJobStatusById,
  type ListJobsForCurrentUserItem,
  type ListJobsForCurrentUserPageResult,
  type ListJobsForCurrentUserTab,
  type RecentJobItem,
  type WeeklyNetEarningsForCurrentUserResult,
  type EarningsSnapshotJob,
  type EarningsSnapshotAggregate,
  type EarningsSnapshotForCurrentUserResult,
  type OutstandingPaymentsForCurrentUserResult,
  type UpdateJobInput,
} from './jobs';
export {
  createManualSession,
  deleteSession,
  updateSessionTimes,
  type CreateManualSessionInput,
  type SessionId,
  type UpdateSessionTimesInput,
} from './sessions';
export {
  createLiveSession,
  endLiveSession,
  fetchActiveLiveSessionForCurrentUser,
  updateLiveSessionStart,
  type CreateLiveSessionInput,
  type EndLiveSessionInput,
  type UpdateLiveSessionStartInput,
} from './liveSessions';
export {
  createNote,
  deleteNote,
  updateNote,
  type CreateNoteInput,
  type NoteId,
  type UpdateNoteInput,
} from './notes';
export {
  createMaterial,
  deleteMaterial,
  updateMaterial,
  type CreateMaterialInput,
  type MaterialId,
  type UpdateMaterialInput,
} from './materials';
export {
  createOtherCost,
  deleteOtherCost,
  updateOtherCost,
  OTHER_COST_TYPE_VALUES,
  type CreateOtherCostInput,
  type OtherCostId,
  type OtherCostTypeDb,
  type UpdateOtherCostInput,
} from './otherCosts';
export {
  countInboxItems,
  listInboxMaterials,
  listInboxNotes,
  type InboxCounts,
  type InboxMaterialItem,
  type InboxNoteItem,
} from './inbox';
export {
  fetchCurrentUserProfile,
  updateCurrentUserProfile,
  type UpdateUserProfileInput,
  type UserProfile,
} from './profiles';
export {
  deleteCurrentAccount,
  updateCurrentUserPassword,
} from './account';
export {
  requestJobExport,
  JobExportRequestError,
  type JobExportRequestInput,
  type JobExportRequestResult,
} from './jobExports';
export {
  recordLegalAcceptance,
  recordReacceptanceLegalAcceptances,
  recordSignupLegalAcceptances,
  fetchLatestLegalAcceptanceVersions,
  needsLegalReacceptance,
  type LegalAcceptanceVersions,
  type LegalDocumentType,
  type RecordLegalAcceptanceInput,
} from './consent';
export {
  fetchAnalyticsConsentStatus,
  upsertAnalyticsConsentStatus,
  type AnalyticsConsentStatus,
} from './analyticsConsent';
