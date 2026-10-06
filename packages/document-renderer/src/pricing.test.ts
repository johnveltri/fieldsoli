import { describe, expect, it } from 'vitest';

import { computeJobPricing, solveLaborForRevenue } from './pricing';
import { roundHalfUpBps } from './money';

describe('roundHalfUpBps', () => {
  it('rounds half cents up and truncates below half', () => {
    expect(roundHalfUpBps(1, 5000)).toBe(1);
    expect(roundHalfUpBps(1, 4999)).toBe(0);
  });
});

describe('computeJobPricing', () => {
  const costs = [
    {
      costType: 'material' as const,
      totalCostCents: 10000,
      capturedMarkupBps: 2000,
    },
    {
      costType: 'disposal' as const,
      totalCostCents: 5000,
      invoiceCustomer: true,
      costTypeExplicit: true,
    },
    {
      costType: 'travel_parking' as const,
      totalCostCents: 2000,
      invoiceCustomer: false,
      costTypeExplicit: true,
    },
  ];

  it('matches the approved $400 labor example and keeps tax out of revenue', () => {
    const priced = computeJobPricing({
      laborServicesCents: 40000,
      costs,
      taxRateBps: 1000,
      taxableCategories: ['labor', 'materials', 'billable_other_costs'],
    });
    expect(priced.revenueCents).toBe(57000);
    expect(priced.directCostCents).toBe(17000);
    expect(priced.netEarningsCents).toBe(40000);
    expect(priced.taxCents).toBe(5700);
    expect(priced.documentTotalCents).toBe(62700);
  });

  it('taxes only the selected categories', () => {
    const priced = computeJobPricing({
      laborServicesCents: 40000,
      costs,
      taxRateBps: 1000,
      taxableCategories: ['labor'],
    });
    expect(priced.taxCents).toBe(4000);
    expect(priced.revenueCents).toBe(57000);
  });

  it('treats null labor as unknown revenue', () => {
    const priced = computeJobPricing({
      laborServicesCents: null,
      costs: [],
      taxRateBps: 0,
      taxableCategories: [],
    });
    expect(priced.revenueCents).toBeNull();
    expect(priced.netEarningsCents).toBeNull();
  });

  it('rejects a negative residual when solving labor', () => {
    expect(() => solveLaborForRevenue(1000, 2000, 0)).toThrow('negative_residual');
    expect(solveLaborForRevenue(null, 0, 0)).toBeNull();
  });
});
