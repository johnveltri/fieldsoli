import type { JobDetailViewModel } from '@fieldsolo/shared-types';

import {
  isMaterialUsableForCompleteness,
  isOtherCostUsableForCompleteness,
  isSessionUsableForCompleteness,
} from './jobDetailRowHealth';

export type JobFinancialCompletenessContext = {
  job: JobDetailViewModel;
};

export type FinancialCompletenessGap = 'revenue' | 'session' | 'materials' | 'otherCosts';

function hasUsableSession(job: JobDetailViewModel): boolean {
  return job.inProgressSession != null || job.displaySessions.some(isSessionUsableForCompleteness);
}

function hasUsableMaterial(job: JobDetailViewModel): boolean {
  return job.materialBuckets.some((bucket) =>
    bucket.items.some(isMaterialUsableForCompleteness),
  );
}

function hasUsableOtherCost(job: JobDetailViewModel): boolean {
  return job.otherCostBuckets.some((bucket) =>
    bucket.items.some(isOtherCostUsableForCompleteness),
  );
}

function hasMaterialsComplete(job: JobDetailViewModel): boolean {
  return hasUsableMaterial(job) || job.noMaterialsConfirmed;
}

function hasOtherCostsComplete(job: JobDetailViewModel): boolean {
  return hasUsableOtherCost(job) || job.noOtherCostsConfirmed;
}

function hasRevenueComplete(job: {
  revenueCents?: number | null;
  noRevenueConfirmed: boolean;
}): boolean {
  return (job.revenueCents ?? 0) > 0 || job.noRevenueConfirmed;
}

export function isJobFinanciallyComplete(ctx: JobFinancialCompletenessContext): boolean {
  const { job } = ctx;
  return (
    hasRevenueComplete({
      revenueCents: job.earnings.revenueCents,
      noRevenueConfirmed: job.noRevenueConfirmed,
    }) &&
    hasUsableSession(job) &&
    hasMaterialsComplete(job) &&
    hasOtherCostsComplete(job)
  );
}

/** Fixed order for the mark-complete wizard. */
export function financialCompletenessGaps(
  ctx: JobFinancialCompletenessContext,
): FinancialCompletenessGap[] {
  const { job } = ctx;
  const gaps: FinancialCompletenessGap[] = [];
  if (
    !hasRevenueComplete({
      revenueCents: job.earnings.revenueCents,
      noRevenueConfirmed: job.noRevenueConfirmed,
    })
  ) {
    gaps.push('revenue');
  }
  if (!hasUsableSession(job)) {
    gaps.push('session');
  }
  if (!hasMaterialsComplete(job)) {
    gaps.push('materials');
  }
  if (!hasOtherCostsComplete(job)) {
    gaps.push('otherCosts');
  }
  return gaps;
}

export function incompletePillsForJobDetail(job: JobDetailViewModel): string[] {
  const pills: string[] = [];
  if (
    !hasRevenueComplete({
      revenueCents: job.earnings.revenueCents,
      noRevenueConfirmed: job.noRevenueConfirmed,
    })
  ) {
    pills.push('revenue');
  }
  if (!hasUsableSession(job)) pills.push('sessions');
  if (!hasMaterialsComplete(job)) pills.push('materials');
  if (!hasOtherCostsComplete(job)) pills.push('costs');
  return pills;
}

/** List-row adapter for `incompletePillsForJobDetail`. */
export function incompletePillsForListJob(job: {
  revenueCents: number | null;
  noRevenueConfirmed: boolean;
  hasMaterials: boolean;
  noMaterialsConfirmed: boolean;
  hasOtherCosts: boolean;
  noOtherCostsConfirmed: boolean;
  hasSessions: boolean;
}): string[] {
  const pills: string[] = [];
  if (!hasRevenueComplete(job)) pills.push('revenue');
  if (!job.hasSessions) pills.push('sessions');
  if (!job.hasMaterials && !job.noMaterialsConfirmed) pills.push('materials');
  if (!job.hasOtherCosts && !job.noOtherCostsConfirmed) pills.push('costs');
  return pills;
}

export function isCompletedOrPaidWorkStatus(
  status: JobDetailViewModel['workStatus'],
): boolean {
  return status === 'completed' || status === 'paid';
}

/**
 * When a job was financially complete and loses required info while still
 * marked completed/paid, revert work status to in progress.
 *
 * `previousFinanciallyComplete === null` skips the first observation (e.g. job
 * load) so stale state does not demote on open.
 */
export function shouldDemoteCompletedOrPaidForIncompleteFinancials(input: {
  previousFinanciallyComplete: boolean | null;
  nowFinanciallyComplete: boolean;
  workStatus: JobDetailViewModel['workStatus'];
}): boolean {
  const { previousFinanciallyComplete, nowFinanciallyComplete, workStatus } = input;
  if (previousFinanciallyComplete !== true || nowFinanciallyComplete) return false;
  return isCompletedOrPaidWorkStatus(workStatus);
}
