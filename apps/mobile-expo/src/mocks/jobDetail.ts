/**
 * Demo mock for Job Detail — optional fallback; primary path is `fetchJobDetail` + Supabase.
 */

import type { JobDetailViewModel } from '@fieldsolo/shared-types';

export type {
  JobDetailMaterialBucket,
  JobDetailMaterialLine,
  JobDetailMock,
  JobDetailNote,
  JobDetailNoteBucket,
  JobDetailSession,
  JobDetailViewModel,
  JobDetailWorkStatus,
} from '@fieldsolo/shared-types';

export const mockJobDetail: JobDetailViewModel = {
  id: '00000000-0000-0000-0000-000000000001',
  shortDescription: 'Bathroom Remodel Phase 1',
  longDescription: '',
  customerName: 'Andrew G',
  serviceAddress: '123 Main Street\nPerrysburg, OH 43551',
  jobType: 'plumbing',
  lastWorkedLabel: 'Last worked Mar 13',
  workStatus: 'inProgress',
  earnings: {
    revenueCents: 2_220_000,
    materialsCents: -2_220_000,
    otherCostsCents: 0,
    feesCents: -20_000,
    netEarningsCents: 2_220_000,
  },
  metrics: {
    timeLabel: '102.0h',
    netPerHrDisplay: '6,337/hr',
    sessionCount: 239,
  },
  displaySessions: [
    {
      id: 'sess-1',
      startedAt: '2026-03-25T09:00:00.000Z',
      endedAt: '2026-03-25T10:00:00.000Z',
      clockTimesExplicit: true,
      clockStartExplicit: true,
      clockEndExplicit: true,
      calendarDateExplicit: true,
      dateLabel: 'Mar 25, 2026',
      timeRangeLabel: '9:00 AM – 10:00 AM',
      durationLabel: '1.0h',
      attachments: [],
    },
  ],
  allSessions: [
    {
      id: 'sess-1',
      startedAt: '2026-03-25T09:00:00.000Z',
      endedAt: '2026-03-25T10:00:00.000Z',
      clockTimesExplicit: true,
      clockStartExplicit: true,
      clockEndExplicit: true,
      calendarDateExplicit: true,
      dateLabel: 'Mar 25, 2026',
      timeRangeLabel: '9:00 AM – 10:00 AM',
      durationLabel: '1.0h',
      attachments: [],
    },
  ],
  inProgressSession: null,
  materialBuckets: [
    {
      id: 'mat-unassigned',
      kind: 'unassigned',
      items: [
        {
          id: 'mat-mock-u1',
          sessionId: null,
          name: 'Moen Faucet',
          quantity: 1,
          quantityExplicit: true,
          unit: 'ea',
          unitCostCents: 7500,
          unitCostExplicit: true,
          totalCostCents: 7500,
          quantityLabel: '1 ea @ $75.00',
          priceLabel: '$75.00',
        },
      ],
    },
    {
      id: 'mat-s1',
      kind: 'session',
      sessionDateLabel: 'Mar 25, 2026',
      items: [
        {
          id: 'mat-mock-s1',
          sessionId: 'sess-1',
          name: 'Moen Faucet',
          quantity: 1,
          quantityExplicit: true,
          unit: 'ea',
          unitCostCents: 7500,
          unitCostExplicit: true,
          totalCostCents: 7500,
          quantityLabel: '1 ea @ $75.00',
          priceLabel: '$75.00',
        },
      ],
    },
  ],
  noteBuckets: [
    {
      id: 'note-unassigned',
      kind: 'unassigned',
      notes: [
        {
          id: 'note-mock-u1',
          body: 'Client requested brushed nickel finish. Old valve was slightly corroded but salvageable. Will monitor for leaks after install.',
          sessionId: null,
          excerpt:
            'Client requested brushed nickel finish. Old valve was slightly corroded but salvageable. Will... ',
          dateLabel: 'Mar 25, 2026',
        },
      ],
    },
    {
      id: 'note-s1',
      kind: 'session',
      sessionDateLabel: 'Mar 25, 2026',
      notes: [
        {
          id: 'note-mock-s1',
          body: 'dsfsdf',
          sessionId: 's-mock-1',
          excerpt: 'dsfsdf',
          dateLabel: 'Mar 25, 2026',
        },
      ],
    },
  ],
  otherCostBuckets: [],
  noRevenueConfirmed: false,
  noMaterialsConfirmed: false,
  noOtherCostsConfirmed: false,
};
