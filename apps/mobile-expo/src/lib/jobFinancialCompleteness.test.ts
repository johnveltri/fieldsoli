import { JOB_DETAIL_EMPTY_LABELS } from '@fieldsolo/api-client';
import type { JobDetailViewModel } from '@fieldsolo/shared-types';

import {
  financialCompletenessGaps,
  incompletePillsForJobDetail,
  isJobFinanciallyComplete,
  shouldDemoteCompletedOrPaidForIncompleteFinancials,
} from './jobFinancialCompleteness';

function baseJob(overrides: Partial<JobDetailViewModel> = {}): JobDetailViewModel {
  return {
    id: 'job-1',
    shortDescription: 'Install panel',
    customerName: 'Alice',
    serviceAddress: '1 Main St',
    jobType: 'electrical',
    lastWorkedLabel: 'Last worked Apr 18, 2026',
    workStatus: 'inProgress',
    earnings: {
      revenueCents: 10000,
      materialsCents: -1000,
      otherCostsCents: -500,
      feesCents: 0,
      netEarningsCents: 8500,
    },
    metrics: {
      timeLabel: '1.0h',
      netPerHrDisplay: '$85/hr',
      sessionCount: 1,
    },
    displaySessions: [
      {
        id: 'sess-1',
        startedAt: '2026-04-17T14:00:00.000Z',
        endedAt: '2026-04-17T15:00:00.000Z',
        dateLabel: 'Apr 17, 2026',
        timeRangeLabel: '9:00 AM – 10:00 AM',
        durationLabel: '1.0h',
        clockTimesExplicit: true,
        clockStartExplicit: true,
        clockEndExplicit: true,
        calendarDateExplicit: true,
        attachments: [],
      },
    ],
    allSessions: [],
    inProgressSession: null,
    materialBuckets: [
      {
        id: 'mat-unassigned',
        kind: 'unassigned',
        items: [
          {
            id: 'mat-1',
            sessionId: null,
            name: 'Wire',
            quantity: 1,
            quantityExplicit: true,
            unit: 'ea',
            unitCostCents: 1000,
            unitCostExplicit: true,
            totalCostCents: 1000,
            quantityLabel: '1 ea',
            priceLabel: '$10.00',
          },
        ],
      },
    ],
    otherCostBuckets: [
      {
        id: 'oc-unassigned',
        kind: 'unassigned',
        items: [
          {
            id: 'oc-1',
            sessionId: null,
            costType: 'permit',
            costTypeExplicit: true,
            typeLabel: 'Permit',
            description: '',
            costCents: 500,
            priceLabel: '$5.00',
          },
        ],
      },
    ],
    noteBuckets: [],
    noRevenueConfirmed: false,
    noMaterialsConfirmed: false,
    noOtherCostsConfirmed: false,
    ...overrides,
  };
}

describe('shouldDemoteCompletedOrPaidForIncompleteFinancials', () => {
  it('does not demote on first observation', () => {
    expect(
      shouldDemoteCompletedOrPaidForIncompleteFinancials({
        previousFinanciallyComplete: null,
        nowFinanciallyComplete: false,
        workStatus: 'completed',
      }),
    ).toBe(false);
  });

  it('demotes when completeness drops on completed or paid jobs', () => {
    expect(
      shouldDemoteCompletedOrPaidForIncompleteFinancials({
        previousFinanciallyComplete: true,
        nowFinanciallyComplete: false,
        workStatus: 'completed',
      }),
    ).toBe(true);
    expect(
      shouldDemoteCompletedOrPaidForIncompleteFinancials({
        previousFinanciallyComplete: true,
        nowFinanciallyComplete: false,
        workStatus: 'paid',
      }),
    ).toBe(true);
  });

  it('does not demote when still complete or work is in progress', () => {
    expect(
      shouldDemoteCompletedOrPaidForIncompleteFinancials({
        previousFinanciallyComplete: true,
        nowFinanciallyComplete: true,
        workStatus: 'completed',
      }),
    ).toBe(false);
    expect(
      shouldDemoteCompletedOrPaidForIncompleteFinancials({
        previousFinanciallyComplete: true,
        nowFinanciallyComplete: false,
        workStatus: 'inProgress',
      }),
    ).toBe(false);
  });
});

describe('usable rows for financial completeness', () => {
  it('treats a fully populated job as complete', () => {
    const job = baseJob();
    expect(isJobFinanciallyComplete({ job })).toBe(true);
    expect(financialCompletenessGaps({ job })).toEqual([]);
    expect(incompletePillsForJobDetail(job)).toEqual([]);
  });

  it('ignores sessions missing date or duration', () => {
    const job = baseJob({
      displaySessions: [
        {
          id: 'sess-partial',
          startedAt: '2026-04-17T14:00:00.000Z',
          endedAt: '2026-04-17T15:00:00.000Z',
          dateLabel: JOB_DETAIL_EMPTY_LABELS.sessionDate,
          timeRangeLabel: '',
          durationLabel: JOB_DETAIL_EMPTY_LABELS.sessionDuration,
          clockTimesExplicit: false,
          clockStartExplicit: false,
          clockEndExplicit: false,
          calendarDateExplicit: false,
          attachments: [],
        },
      ],
      metrics: { timeLabel: '0.0h', netPerHrDisplay: '—', sessionCount: 1 },
    });
    expect(isJobFinanciallyComplete({ job })).toBe(false);
    expect(financialCompletenessGaps({ job })).toContain('session');
    expect(incompletePillsForJobDetail(job)).toContain('sessions');
  });

  it('ignores materials missing description or total', () => {
    const job = baseJob({
      materialBuckets: [
        {
          id: 'mat-unassigned',
          kind: 'unassigned',
          items: [
            {
              id: 'mat-partial',
              sessionId: null,
              name: JOB_DETAIL_EMPTY_LABELS.materialDescription,
              quantity: null,
              quantityExplicit: false,
              unit: '',
              unitCostCents: null,
              unitCostExplicit: false,
              totalCostCents: 0,
              quantityLabel: '—',
              priceLabel: '$0.00',
            },
          ],
        },
      ],
    });
    expect(isJobFinanciallyComplete({ job })).toBe(false);
    expect(financialCompletenessGaps({ job })).toContain('materials');
    expect(incompletePillsForJobDetail(job)).toContain('materials');
    expect(incompletePillsForJobDetail(job)).not.toContain('costs');
  });

  it('ignores other costs missing type or amount', () => {
    const job = baseJob({
      otherCostBuckets: [
        {
          id: 'oc-unassigned',
          kind: 'unassigned',
          items: [
            {
              id: 'oc-partial',
              sessionId: null,
              costType: 'other',
              costTypeExplicit: false,
              typeLabel: JOB_DETAIL_EMPTY_LABELS.otherCostType,
              description: '',
              costCents: 0,
              priceLabel: '$0.00',
            },
          ],
        },
      ],
    });
    expect(isJobFinanciallyComplete({ job })).toBe(false);
    expect(financialCompletenessGaps({ job })).toContain('otherCosts');
    expect(incompletePillsForJobDetail(job)).toContain('costs');
    expect(incompletePillsForJobDetail(job)).not.toContain('materials');
  });

  it('still accepts none-confirmed costs without usable rows', () => {
    const job = baseJob({
      materialBuckets: [],
      otherCostBuckets: [],
      noMaterialsConfirmed: true,
      noOtherCostsConfirmed: true,
    });
    expect(isJobFinanciallyComplete({ job })).toBe(true);
    expect(incompletePillsForJobDetail(job)).toEqual([]);
  });

  it('treats Untitled Job as a valid title with no description pill', () => {
    const job = baseJob({ shortDescription: 'Untitled Job' });
    expect(isJobFinanciallyComplete({ job })).toBe(true);
    expect(financialCompletenessGaps({ job })).toEqual([]);
    expect(incompletePillsForJobDetail(job)).toEqual([]);
    expect(incompletePillsForJobDetail(job)).not.toContain('description');
  });

  it('treats unconfirmed $0 or null revenue as incomplete', () => {
    const zero = baseJob({
      earnings: { ...baseJob().earnings, revenueCents: 0 },
      noRevenueConfirmed: false,
    });
    expect(isJobFinanciallyComplete({ job: zero })).toBe(false);
    expect(financialCompletenessGaps({ job: zero })).toEqual(['revenue']);
    expect(incompletePillsForJobDetail(zero)).toEqual(['revenue']);

    const unset = baseJob({
      earnings: { ...baseJob().earnings, revenueCents: null },
      noRevenueConfirmed: false,
    });
    expect(isJobFinanciallyComplete({ job: unset })).toBe(false);
    expect(financialCompletenessGaps({ job: unset })).toEqual(['revenue']);
    expect(incompletePillsForJobDetail(unset)).toEqual(['revenue']);
  });

  it('treats confirmed $0 revenue as complete with no revenue pill', () => {
    const job = baseJob({
      earnings: { ...baseJob().earnings, revenueCents: 0 },
      noRevenueConfirmed: true,
    });
    expect(isJobFinanciallyComplete({ job })).toBe(true);
    expect(financialCompletenessGaps({ job })).toEqual([]);
    expect(incompletePillsForJobDetail(job)).toEqual([]);
  });

  it('counts a live in-progress session when displaySessions are empty or unusable', () => {
    const liveSession = {
      id: 'sess-live',
      startedAt: '2026-04-17T14:00:00.000Z',
      endedAt: null,
      dateLabel: 'Apr 17, 2026',
      timeRangeLabel: '',
      durationLabel: JOB_DETAIL_EMPTY_LABELS.sessionDuration,
      clockTimesExplicit: false,
      clockStartExplicit: false,
      clockEndExplicit: false,
      calendarDateExplicit: true,
      attachments: [],
    };
    const job = baseJob({
      displaySessions: [],
      inProgressSession: liveSession,
    });
    expect(isJobFinanciallyComplete({ job })).toBe(true);
    expect(financialCompletenessGaps({ job })).not.toContain('session');
    expect(incompletePillsForJobDetail(job)).not.toContain('sessions');

    const unusableEnded = baseJob({
      displaySessions: [
        {
          ...liveSession,
          id: 'sess-partial',
          endedAt: '2026-04-17T15:00:00.000Z',
          dateLabel: JOB_DETAIL_EMPTY_LABELS.sessionDate,
          durationLabel: JOB_DETAIL_EMPTY_LABELS.sessionDuration,
          calendarDateExplicit: false,
        },
      ],
      inProgressSession: liveSession,
    });
    expect(isJobFinanciallyComplete({ job: unusableEnded })).toBe(true);
    expect(financialCompletenessGaps({ job: unusableEnded })).not.toContain('session');
  });

  it('fails session completeness for unusable ended-only sessions', () => {
    const job = baseJob({
      displaySessions: [
        {
          id: 'sess-partial',
          startedAt: '2026-04-17T14:00:00.000Z',
          endedAt: '2026-04-17T15:00:00.000Z',
          dateLabel: JOB_DETAIL_EMPTY_LABELS.sessionDate,
          timeRangeLabel: '',
          durationLabel: JOB_DETAIL_EMPTY_LABELS.sessionDuration,
          clockTimesExplicit: false,
          clockStartExplicit: false,
          clockEndExplicit: false,
          calendarDateExplicit: false,
          attachments: [],
        },
      ],
      inProgressSession: null,
      metrics: { timeLabel: '0.0h', netPerHrDisplay: '—', sessionCount: 1 },
    });
    expect(isJobFinanciallyComplete({ job })).toBe(false);
    expect(financialCompletenessGaps({ job })).toContain('session');
    expect(incompletePillsForJobDetail(job)).toContain('sessions');
  });
});
