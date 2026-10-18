import type { JobDetailViewModel } from '@fieldsolo/shared-types';

import {
  isMaterialUsableForCompleteness,
  isOtherCostUsableForCompleteness,
  isSessionUsableForCompleteness,
} from './jobDetailRowHealth';

export type JobFinancialCompletenessContext = {
  job: JobDetailViewModel;
  /** Feature rollout state; false preserves the legacy Revenue gate. */
  invoicingEnabled?: boolean;
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
  laborServicesCents?: number | null;
  pricingMode?: 'legacy' | 'component';
  noLaborServicesConfirmed?: boolean;
  revenueInvoice?: { id: string } | null;
}, invoicingEnabled = true): boolean {
  // A selected immutable invoice is the authoritative Revenue source even if
  // the editable Labor & Services proposal has not been reviewed yet.
  if (job.revenueInvoice?.id) return true;
  if (invoicingEnabled && job.pricingMode === 'component') {
    // Null means Labor is still unknown. Zero requires the distinct
    // no-Labor confirmation; billable charges may still make Revenue positive.
    if (job.laborServicesCents == null) return false;
    if (job.laborServicesCents === 0) {
      return job.noLaborServicesConfirmed === true ||
        ((job.revenueCents ?? 0) === 0 && job.noRevenueConfirmed);
    }
  }
  return (job.revenueCents ?? 0) > 0 || job.noRevenueConfirmed;
}

export function isJobFinanciallyComplete(ctx: JobFinancialCompletenessContext): boolean {
  const { job } = ctx;
  const invoicingEnabled = ctx.invoicingEnabled !== false;
  return (
    hasRevenueComplete({
      revenueCents: job.earnings.revenueCents,
      noRevenueConfirmed: job.noRevenueConfirmed,
      laborServicesCents: job.laborServicesCents,
      pricingMode: job.pricingMode,
      noLaborServicesConfirmed: job.noLaborServicesConfirmed,
      revenueInvoice: job.revenueInvoice,
    }, invoicingEnabled) &&
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
  const invoicingEnabled = ctx.invoicingEnabled !== false;
  const gaps: FinancialCompletenessGap[] = [];
  if (
    !hasRevenueComplete({
      revenueCents: job.earnings.revenueCents,
      noRevenueConfirmed: job.noRevenueConfirmed,
      laborServicesCents: job.laborServicesCents,
      pricingMode: job.pricingMode,
      noLaborServicesConfirmed: job.noLaborServicesConfirmed,
      revenueInvoice: job.revenueInvoice,
    }, invoicingEnabled)
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

export function incompletePillsForJobDetail(
  job: JobDetailViewModel,
  invoicingEnabled = true,
): string[] {
  const pills: string[] = [];
  if (
    !hasRevenueComplete({
      revenueCents: job.earnings.revenueCents,
      noRevenueConfirmed: job.noRevenueConfirmed,
      laborServicesCents: job.laborServicesCents,
      pricingMode: job.pricingMode,
      noLaborServicesConfirmed: job.noLaborServicesConfirmed,
      revenueInvoice: job.revenueInvoice,
    }, invoicingEnabled)
  ) {
    pills.push('revenue');
  }
  if (!hasUsableSession(job)) pills.push('visits');
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
  if (!job.hasSessions) pills.push('visits');
  if (!job.hasMaterials && !job.noMaterialsConfirmed) pills.push('materials');
  if (!job.hasOtherCosts && !job.noOtherCostsConfirmed) pills.push('costs');
  return pills;
}

export function isCompletedOrPaidWorkStatus(
  status: JobDetailViewModel['workStatus'],
): status is 'completed' | 'paid' {
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
