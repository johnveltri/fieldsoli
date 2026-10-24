import React from 'react';
import { render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import { JobDetailJobHeader } from './JobDetailJobHeader';
import {
  ViewMaterialsBuckets,
  ViewNotesBuckets,
  ViewOtherCostsBuckets,
  ViewSessionsBuckets,
} from './ViewActivityBuckets';

const typography = {} as never;

describe('Job Detail readable row accessibility', () => {
  it('keeps header content in the labels when the blocks become edit buttons', () => {
    const screen = render(
      <JobDetailJobHeader
        title="Paint fence"
        longDescription="Two coats on the west side"
        customerName="Ada Lovelace"
        customerPhone=""
        customerEmail=""
        serviceAddress="1 Main St"
        lastWorkedLabel="Worked today"
        workStatus="notStarted"
        typography={typography}
        onTitlePress={jest.fn()}
        onCustomerPress={jest.fn()}
      />,
    );

    expect(screen.getByLabelText('Paint fence. Two coats on the west side')).toHaveProp(
      'accessibilityHint',
      'Opens job title and description editing',
    );
    expect(
      screen.getByLabelText('Ada Lovelace · 1 Main St · Worked today'),
    ).toHaveProp('accessibilityHint', 'Opens customer and address editing');
  });

  it('announces the visible visit, material, cost, and note content', () => {
    const screen = render(
      <>
        <ViewSessionsBuckets
          typography={typography}
          onCardPress={jest.fn()}
          sessions={[
            {
              id: 'session-1',
              startedAt: '2026-09-09T14:00:00.000Z',
              endedAt: '2026-09-09T15:30:00.000Z',
              clockTimesExplicit: true,
              clockStartExplicit: true,
              clockEndExplicit: true,
              calendarDateExplicit: true,
              dateLabel: 'Sep 9, 2026',
              timeRangeLabel: '9:00 AM – 10:30 AM',
              durationLabel: '1.5h',
              attachments: [],
            },
          ]}
        />
        <ViewMaterialsBuckets
          typography={typography}
          onCardPress={jest.fn()}
          buckets={[
            {
              id: 'materials-job',
              kind: 'unassigned',
              items: [
                {
                  id: 'material-1',
                  sessionId: null,
                  name: 'Copper pipe',
                  quantity: 2,
                  quantityExplicit: true,
                  unit: 'ft',
                  unitCostCents: 500,
                  unitCostExplicit: true,
                  totalCostCents: 1000,
                  quantityLabel: '2 ft @ $5.00',
                  priceLabel: '$10.00',
                },
              ],
            },
          ]}
        />
        <ViewOtherCostsBuckets
          typography={typography}
          onCardPress={jest.fn()}
          buckets={[
            {
              id: 'costs-job',
              kind: 'unassigned',
              items: [
                {
                  id: 'cost-1',
                  sessionId: null,
                  costType: 'permit',
                  costTypeExplicit: true,
                  typeLabel: 'Permit',
                  description: 'City permit',
                  costCents: 2500,
                  priceLabel: '$25.00',
                },
              ],
            },
          ]}
        />
        <ViewNotesBuckets
          typography={typography}
          onCardPress={jest.fn()}
          buckets={[
            {
              id: 'notes-job',
              kind: 'unassigned',
              notes: [
                {
                  id: 'note-1',
                  sessionId: null,
                  body: 'Customer requested matte finish',
                  excerpt: 'Customer requested matte finish',
                  dateLabel: 'Sep 9',
                },
              ],
            },
          ]}
        />
      </>,
    );

    expect(
      screen.getByLabelText('Visit. Sep 9, 2026. 9:00 AM – 10:30 AM. 1.5h'),
    ).toBeTruthy();
    expect(
      screen.getByLabelText('Material. Copper pipe. 2 ft @ $5.00. $10.00'),
    ).toBeTruthy();
    expect(
      screen.getByLabelText('Other cost. Permit. City permit. $25.00'),
    ).toBeTruthy();
    expect(
      screen.getByLabelText('Note. Customer requested matte finish. Sep 9'),
    ).toBeTruthy();
  });
});


describe('Job View material customer price', () => {
  const material = {
    id: 'material-1', sessionId: null, name: 'Copper pipe', quantity: 2,
    quantityExplicit: true, unit: 'ft', unitCostCents: 500, unitCostExplicit: true,
    totalCostCents: 1000, quantityLabel: '2 ft @ $5.00', priceLabel: '$10.00',
    capturedMarkupBps: 5000,
  };

  function renderMaterial(overrides = {}, defaultBps: number | undefined = 2000) {
    return render(<ViewMaterialsBuckets
      typography={typography}
      materialMarkupBps={defaultBps}
      onCardPress={jest.fn()}
      emphasizeCriticalEmpty
      buckets={[{ id: 'materials-job', kind: 'unassigned', items: [{ ...material, ...overrides }] }]}
    />);
  }

  it('shows current default charge below cost and announces both distinctly', () => {
    const screen = renderMaterial();
    expect(screen.getByText('$10.00')).toBeTruthy();
    expect(screen.getByText('$12.00 with markup')).toBeTruthy();
    expect(screen.getByLabelText('Material. Copper pipe. 2 ft @ $5.00. Cost $10.00. Price $12.00 with markup')).toBeTruthy();
  });

  it.each([
    [0, '$10.00 with markup'],
    [3000, '$13.00 with markup'],
  ])('respects explicit %i bps override', (markupOverrideBps, label) => {
    expect(renderMaterial({ markupOverrideBps }).getByText(label)).toBeTruthy();
  });

  it('rounds half cents up through canonical pricing', () => {
    expect(renderMaterial({ totalCostCents: 5 }, 1000).getByText('$0.06 with markup')).toBeTruthy();
  });

  it('shows an explicitly captured zero cost and zero markup', () => {
    const screen = renderMaterial({ totalCostCents: 0, unitCostCents: 0, priceLabel: '$0.00' }, 0);
    expect(screen.getByText('$0.00 with markup')).toBeTruthy();
    expect(screen.queryByText('No total')).toBeNull();
  });

  it('omits the charge when cost was not captured', () => {
    const screen = renderMaterial({ totalCostCents: 0, unitCostExplicit: false, unitCostCents: null });
    expect(screen.queryByText(/with markup/)).toBeNull();
    expect(screen.getByText('No total')).toBeTruthy();
  });

  it('omits the charge when the current business rate is unavailable', () => {
    const screen = render(<ViewMaterialsBuckets typography={typography}
      buckets={[{ id: 'materials-job', kind: 'unassigned', items: [material] }]} />);
    expect(screen.queryByText(/with markup/)).toBeNull();
  });
});
