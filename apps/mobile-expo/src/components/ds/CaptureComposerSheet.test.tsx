import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { CaptureComposerSheet } from './CaptureComposerSheet';
import { createTextStyles } from '../../theme/nativeTokens';

const mockCreateJobForCurrentUser = jest.fn<(...args: unknown[]) => Promise<string>>();
const mockIsSupabaseConfigured = jest.fn<() => boolean>(() => true);

jest.mock('@fieldsolo/api-client', () => ({
  createJobForCurrentUser: (...args: unknown[]) => mockCreateJobForCurrentUser(...args),
}));

jest.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: () => mockIsSupabaseConfigured(),
  supabase: { client: 'supabase' },
}));

jest.mock('../figma-icons/JobDetailScreenIcons', () => ({
  JobDetailIconSectionAdd: () => null,
  JobDetailIconSectionMaterials: () => null,
  JobDetailIconSectionNotes: () => null,
}));

jest.mock('./BottomSheetShell', () => {
  const { View } = require('react-native');
  return {
    BottomSheetShell: ({
      visible,
      children,
    }: {
      visible: boolean;
      children: React.ReactNode;
    }) => (visible ? <View>{children}</View> : null),
  };
});

jest.mock('./DropdownBottomSheet', () => ({
  DropdownBottomSheet: () => null,
}));

const typography = createTextStyles({
  serifBold: 'System',
  sans: 'System',
  sansSemi: 'System',
  sansBold: 'System',
});

describe('CaptureComposerSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsSupabaseConfigured.mockReturnValue(true);
    mockCreateJobForCurrentUser.mockResolvedValue('job-new-1');
  });

  describe('kind=job', () => {
    it('TEST-N01 disables Add Job when title is empty and does not prefill Untitled', () => {
      const screen = render(
        <CaptureComposerSheet
          typography={typography}
          visible
          kind="job"
          onClose={() => undefined}
          onJobCreated={() => undefined}
        />,
      );

      expect(screen.queryByDisplayValue('Untitled Job')).toBeNull();
      fireEvent.press(screen.getByLabelText('Add job'));
      expect(mockCreateJobForCurrentUser).not.toHaveBeenCalled();
    });

    it('TEST-N02 creates a titled job and opens Job View via onJobCreated', async () => {
      const onJobCreated = jest.fn();
      const screen = render(
        <CaptureComposerSheet
          typography={typography}
          visible
          kind="job"
          onClose={() => undefined}
          onJobCreated={onJobCreated}
        />,
      );

      fireEvent.changeText(screen.getByLabelText('Job title'), 'Panel upgrade');
      fireEvent.press(screen.getByLabelText('Add job'));

      await waitFor(() => {
        expect(mockCreateJobForCurrentUser).toHaveBeenCalledWith(
          { client: 'supabase' },
          expect.objectContaining({ shortDescription: 'Panel upgrade' }),
        );
        expect(onJobCreated).toHaveBeenCalledWith('job-new-1', {
          initialEditOpen: false,
        });
      });
    });

    it('TEST-N03 dismiss does not create a job', () => {
      const onClose = jest.fn();
      const screen = render(
        <CaptureComposerSheet
          typography={typography}
          visible
          kind="job"
          onClose={onClose}
          onJobCreated={() => undefined}
        />,
      );

      fireEvent.changeText(screen.getByLabelText('Job title'), 'Abandoned draft');
      onClose();
      expect(mockCreateJobForCurrentUser).not.toHaveBeenCalled();
    });

    it('TEST-N04 Add details creates the job and opens fullscreen Edit', async () => {
      const onJobCreated = jest.fn();
      const screen = render(
        <CaptureComposerSheet
          typography={typography}
          visible
          kind="job"
          onClose={() => undefined}
          onJobCreated={onJobCreated}
        />,
      );

      fireEvent.changeText(screen.getByLabelText('Job title'), 'Service call');
      fireEvent.press(screen.getByLabelText('Add job details'));

      await waitFor(() => {
        expect(mockCreateJobForCurrentUser).toHaveBeenCalledWith(
          { client: 'supabase' },
          expect.objectContaining({ shortDescription: 'Service call' }),
        );
        expect(onJobCreated).toHaveBeenCalledWith('job-new-1', {
          initialEditOpen: true,
        });
      });
      expect(screen.queryByPlaceholderText('Customer')).toBeNull();
      expect(screen.queryByText('Hide details')).toBeNull();
    });
  });

  describe('kind=note', () => {
    it('saves a non-blank note', () => {
      const onSaveNote = jest.fn();
      const screen = render(
        <CaptureComposerSheet
          typography={typography}
          visible
          kind="note"
          onClose={() => undefined}
          onSaveNote={onSaveNote}
          onSaveMaterial={() => undefined}
        />,
      );

      fireEvent.press(screen.getByLabelText('Save note to inbox'));
      expect(onSaveNote).not.toHaveBeenCalled();

      fireEvent.changeText(screen.getByLabelText('Note'), 'On-site measurement');
      fireEvent.press(screen.getByLabelText('Save note to inbox'));
      expect(onSaveNote).toHaveBeenCalledWith({ body: 'On-site measurement' });
    });

    it('seeds when editing an existing note and shows Add to job', () => {
      const onSaveNote = jest.fn();
      const screen = render(
        <CaptureComposerSheet
          typography={typography}
          visible
          kind="note-edit"
          initialNote={{ body: 'Existing note' }}
          onClose={() => undefined}
          onSaveNote={onSaveNote}
          onAddToJobNote={() => undefined}
        />,
      );

      expect(screen.getByDisplayValue('Existing note')).toBeTruthy();
      expect(screen.getByText('Edit Note')).toBeTruthy();
      expect(screen.getByLabelText('Add to job')).toBeTruthy();
      fireEvent.press(screen.getByLabelText('Save note'));
      expect(onSaveNote).toHaveBeenCalledWith({ body: 'Existing note' });
    });

    it('does not show a visible title for quick note create', () => {
      const screen = render(
        <CaptureComposerSheet
          typography={typography}
          visible
          kind="note"
          onClose={() => undefined}
          onSaveNote={() => undefined}
          onAddToJobNote={() => undefined}
        />,
      );
      expect(screen.queryByText('Quick Note')).toBeNull();
      expect(screen.queryByLabelText('Add to job')).toBeNull();
    });
  });

  describe('kind=job', () => {
    it('does not show a visible New Job title', () => {
      const screen = render(
        <CaptureComposerSheet
          typography={typography}
          visible
          kind="job"
          onClose={() => undefined}
          onJobCreated={() => undefined}
        />,
      );
      expect(screen.queryByText('New Job')).toBeNull();
    });
  });

  describe('kind=material-edit', () => {
    it('shows Edit Material title, SAVE MATERIAL, and Add to job', () => {
      const screen = render(
        <CaptureComposerSheet
          typography={typography}
          visible
          kind="material-edit"
          onClose={() => undefined}
          onSaveMaterial={() => undefined}
          onAddToJobMaterial={() => undefined}
        />,
      );
      expect(screen.getByText('Edit Material')).toBeTruthy();
      expect(screen.getByLabelText('Add to job')).toBeTruthy();
      expect(screen.getByLabelText('Save material')).toBeTruthy();
    });
  });

  describe('kind=material', () => {
    it('does not show a visible Quick Material title or Add to job', () => {
      const screen = render(
        <CaptureComposerSheet
          typography={typography}
          visible
          kind="material"
          onClose={() => undefined}
          onSaveMaterial={() => undefined}
          onAddToJobMaterial={() => undefined}
        />,
      );
      expect(screen.queryByText('Quick Material')).toBeNull();
      expect(screen.queryByLabelText('Add to job')).toBeNull();
    });

    it('requires material description and total before save', async () => {
      const onSaveMaterial = jest.fn();
      const screen = render(
        <CaptureComposerSheet
          typography={typography}
          visible
          kind="material"
          onClose={() => undefined}
          onSaveNote={() => undefined}
          onSaveMaterial={onSaveMaterial}
        />,
      );

      expect(screen.getByLabelText('Quantity')).toBeTruthy();
      expect(screen.getByLabelText('Unit of measure')).toBeTruthy();
      expect(screen.getByLabelText('Unit price')).toBeTruthy();

      fireEvent.changeText(screen.getByLabelText('Material'), 'Wire nuts');
      fireEvent.press(screen.getByLabelText('Save material to inbox'));
      expect(onSaveMaterial).not.toHaveBeenCalled();

      fireEvent.changeText(screen.getByLabelText('Total cost'), '12.50');
      fireEvent.press(screen.getByLabelText('Save material to inbox'));
      await waitFor(() => {
        expect(onSaveMaterial).toHaveBeenCalledWith({
          description: 'Wire nuts',
          totalCostCents: 1250,
          quantity: 1,
          unit: 'ea',
          unitCostCents: 1250,
          quantityExplicit: false,
          unitCostExplicit: false,
        });
      });
    });

    it('uses quantity × unit price when both are filled', async () => {
      const onSaveMaterial = jest.fn();
      const screen = render(
        <CaptureComposerSheet
          typography={typography}
          visible
          kind="material"
          onClose={() => undefined}
          onSaveNote={() => undefined}
          onSaveMaterial={onSaveMaterial}
        />,
      );

      fireEvent.changeText(screen.getByLabelText('Material'), 'Copper pipe');
      fireEvent.changeText(screen.getByLabelText('Quantity'), '2');
      fireEvent.changeText(screen.getByLabelText('Unit price'), '5.00');
      fireEvent.press(screen.getByLabelText('Save material to inbox'));

      await waitFor(() => {
        expect(onSaveMaterial).toHaveBeenCalledWith({
          description: 'Copper pipe',
          totalCostCents: 1000,
          quantity: 2,
          unit: 'ea',
          unitCostCents: 500,
          quantityExplicit: true,
          unitCostExplicit: true,
        });
      });
    });
  });
});
