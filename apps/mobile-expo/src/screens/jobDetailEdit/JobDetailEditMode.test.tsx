import React, { useEffect } from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { JobDetailViewModel } from '@fieldsolo/shared-types';
import { describe, expect, it, jest } from '@jest/globals';

import { JobDetailEditMode } from './JobDetailEditMode';
import { useJobEditDraft } from './useJobEditDraft';

const job = {
  id: 'job-1',
  shortDescription: 'Paint fence',
  longDescription: '',
  customerName: '',
  serviceAddress: '',
  displaySessions: [],
  noteBuckets: [],
  materialBuckets: [
    {
      id: 'job',
      kind: 'unassigned',
      items: [
        {
          id: 'material-1',
          sessionId: null,
          name: 'Paint',
          quantity: 2,
          quantityExplicit: true,
          unit: 'gal',
          unitCostCents: 200,
          unitCostExplicit: true,
          totalCostCents: 400,
          quantityLabel: '2 gal @ $2.00',
          priceLabel: '$4.00',
        },
      ],
    },
  ],
  otherCostBuckets: [],
  earnings: { revenueCents: null },
  noRevenueConfirmed: false,
  noMaterialsConfirmed: false,
  noOtherCostsConfirmed: false,
} as unknown as JobDetailViewModel;

function Harness({ onDirtyBack }: { onDirtyBack: (dirty: boolean) => void }) {
  const editApi = useJobEditDraft(job);

  useEffect(() => {
    editApi.resetFromJob(job);
  }, [editApi.resetFromJob]);

  return (
    <JobDetailEditMode
      job={job}
      typography={{} as never}
      headerTopPad={0}
      bottomInset={0}
      columnStyle={{}}
      saving={false}
      focusTarget="materials"
      onBack={() => {
        onDirtyBack(editApi.isDirty());
        editApi.discardDraft();
      }}
      onDone={() => {}}
      onDeleteJob={() => {}}
      editApi={editApi}
    />
  );
}

describe('JobDetailEditMode buffered numeric fields', () => {
  it('flushes a focused value before Back checks dirty and restores it after discard', async () => {
    const onDirtyBack = jest.fn();
    const screen = render(<Harness onDirtyBack={onDirtyBack} />);

    const unitPrice = await screen.findByLabelText('Unit price');
    fireEvent(unitPrice, 'focus', { nativeEvent: { target: 1 } });
    fireEvent.changeText(unitPrice, '9.99');
    fireEvent.press(screen.getByLabelText('Close'));

    await waitFor(() => expect(onDirtyBack).toHaveBeenCalledWith(true));
    await waitFor(() =>
      expect(screen.getByLabelText('Unit price').props.value).toBe('@ $2.00'),
    );
  });
});
