import { roundHalfUpBps } from './money';

export const TAX_CATEGORIES = ['labor', 'materials', 'billable_other_costs'] as const;
export type TaxableCategory = (typeof TAX_CATEGORIES)[number];

export const OTHER_COST_CATEGORIES = [
  'helper_labor',
  'equipment_rental',
  'permit',
  'disposal',
  'travel_parking',
  'other',
] as const;
export type OtherCostCategory = (typeof OTHER_COST_CATEGORIES)[number];

export const OTHER_COST_LABELS: Record<OtherCostCategory, string> = {
  helper_labor: 'Helper labor',
  equipment_rental: 'Equipment rental',
  permit: 'Permit',
  disposal: 'Disposal',
  travel_parking: 'Travel & parking',
  other: 'Other',
};

export type PricingCostInput = {
  costType: 'material' | OtherCostCategory;
  totalCostCents: number;
  capturedMarkupBps?: number | null;
  markupOverrideBps?: number | null;
  invoiceCustomer?: boolean;
  costTypeExplicit?: boolean;
};

export type JobPricingInput = {
  laborServicesCents: number | null;
  costs: PricingCostInput[];
  taxRateBps: number;
  taxableCategories: readonly TaxableCategory[];
};

export type JobPricingResult = {
  materialCostCents: number;
  materialChargeCents: number;
  billableOtherCents: number;
  directCostCents: number;
  revenueCents: number | null;
  netEarningsCents: number | null;
  taxableBaseCents: number;
  taxCents: number;
  documentTotalCents: number | null;
  otherCharges: { category: OtherCostCategory; label: string; amountCents: number }[];
};

function effectiveMarkupBps(cost: PricingCostInput): number {
  if (cost.markupOverrideBps != null) return cost.markupOverrideBps;
  return cost.capturedMarkupBps ?? 0;
}

export function computeJobPricing(input: JobPricingInput): JobPricingResult {
  let materialCostCents = 0;
  let materialChargeCents = 0;
  let billableOtherCents = 0;
  let directCostCents = 0;
  const otherTotals = new Map<OtherCostCategory, number>();

  for (const cost of input.costs) {
    if (!Number.isSafeInteger(cost.totalCostCents) || cost.totalCostCents < 0) {
      throw new Error('invalid_money');
    }
    directCostCents += cost.totalCostCents;
    if (cost.costType === 'material') {
      const markup = roundHalfUpBps(cost.totalCostCents, effectiveMarkupBps(cost));
      materialCostCents += cost.totalCostCents;
      materialChargeCents += cost.totalCostCents + markup;
      continue;
    }
    if (!cost.invoiceCustomer) continue;
    const next = (otherTotals.get(cost.costType) ?? 0) + cost.totalCostCents;
    otherTotals.set(cost.costType, next);
    billableOtherCents += cost.totalCostCents;
  }

  const labor = input.laborServicesCents;
  const revenueCents =
    labor == null ? null : labor + materialChargeCents + billableOtherCents;
  const netEarningsCents = revenueCents == null ? null : revenueCents - directCostCents;

  let taxableBaseCents = 0;
  if (input.taxableCategories.includes('labor') && labor != null) taxableBaseCents += labor;
  if (input.taxableCategories.includes('materials')) taxableBaseCents += materialChargeCents;
  if (input.taxableCategories.includes('billable_other_costs')) {
    taxableBaseCents += billableOtherCents;
  }
  const taxCents = roundHalfUpBps(taxableBaseCents, input.taxRateBps);

  const otherCharges = OTHER_COST_CATEGORIES.flatMap((category) => {
    const amountCents = otherTotals.get(category);
    if (amountCents == null || amountCents === 0) return [];
    return [{ category, label: OTHER_COST_LABELS[category], amountCents }];
  });

  return {
    materialCostCents,
    materialChargeCents,
    billableOtherCents,
    directCostCents,
    revenueCents,
    netEarningsCents,
    taxableBaseCents,
    taxCents,
    documentTotalCents: revenueCents == null ? null : revenueCents + taxCents,
    otherCharges,
  };
}

/** Labor that preserves a requested pretax total after included customer charges. */
export function solveLaborForRevenue(
  requestedRevenueCents: number | null,
  materialChargeCents: number,
  billableOtherCents: number,
): number | null {
  if (requestedRevenueCents == null) return null;
  const labor = requestedRevenueCents - materialChargeCents - billableOtherCents;
  if (labor < 0) throw new Error('negative_residual');
  return labor;
}
