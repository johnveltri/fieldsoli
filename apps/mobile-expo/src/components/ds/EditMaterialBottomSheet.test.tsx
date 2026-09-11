import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import { EditMaterialBottomSheet } from './EditMaterialBottomSheet';
import { createTextStyles } from '../../theme/nativeTokens';

const typography = createTextStyles({
  serifBold: 'System',
  sans: 'System',
  sansSemi: 'System',
  sansBold: 'System',
});

describe('EditMaterialBottomSheet', () => {
  const baseProps = {
    typography,
    visible: true,
    title: 'Add Material',
    primaryLabel: 'SAVE NEW MATERIAL',
    canAttachSession: true,
    assignedSession: null,
  } as const;

  it('calls onSavePress with parsed cents, quantity, and unit when the primary button is tapped', () => {
    const onSavePress = jest.fn();
    const screen = render(
      <EditMaterialBottomSheet
        {...baseProps}
        values={{
          description: 'Copper Pipe',
          unitCostCents: 250,
          quantity: 3,
          unit: 'ft',
        }}
        onSavePress={onSavePress}
      />,
    );

    fireEvent.press(screen.getByLabelText('SAVE NEW MATERIAL'));

    expect(onSavePress).toHaveBeenCalledWith({
      description: 'Copper Pipe',
      unitCostCents: 250,
      quantity: 3,
      unit: 'ft',
    });
  });

  it('disables the primary button when description is blank', () => {
    const onSavePress = jest.fn();
    const screen = render(
      <EditMaterialBottomSheet
        {...baseProps}
        values={{
          description: '',
          unitCostCents: 100,
          quantity: 1,
          unit: 'ea',
        }}
        onSavePress={onSavePress}
      />,
    );

    fireEvent.press(screen.getByLabelText('SAVE NEW MATERIAL'));
    expect(onSavePress).not.toHaveBeenCalled();
  });

  it('disables the primary button when quantity is zero', () => {
    const onSavePress = jest.fn();
    const screen = render(
      <EditMaterialBottomSheet
        {...baseProps}
        values={{
          description: 'Wire',
          unitCostCents: 100,
          quantity: 0,
          unit: 'ea',
        }}
        onSavePress={onSavePress}
      />,
    );

    fireEvent.press(screen.getByLabelText('SAVE NEW MATERIAL'));
    expect(onSavePress).not.toHaveBeenCalled();
  });

  it('edits description + price + qty from user input and sends them on save', () => {
    const onSavePress = jest.fn();
    const screen = render(
      <EditMaterialBottomSheet
        {...baseProps}
        values={{
          description: '',
          unitCostCents: 0,
          quantity: 0,
          unit: 'ea',
        }}
        onSavePress={onSavePress}
      />,
    );

    const description = screen.getByPlaceholderText('e.g. Copper Pipe 1/2"');
    fireEvent.changeText(description, '  Shutoff valve  ');
    fireEvent.changeText(screen.getByPlaceholderText('Unit Price'), '12.34');
    fireEvent.changeText(screen.getByPlaceholderText('1'), '2');

    fireEvent.press(screen.getByLabelText('SAVE NEW MATERIAL'));

    expect(onSavePress).toHaveBeenCalledWith({
      description: 'Shutoff valve',
      unitCostCents: 1234,
      quantity: 2,
      unit: 'ea',
    });
  });

  it('shows the +SESSION pill when the job has sessions and fires onSessionPillPress', () => {
    const onSessionPillPress = jest.fn();
    const screen = render(
      <EditMaterialBottomSheet
        {...baseProps}
        values={{ description: 'X', unitCostCents: 0, quantity: 1, unit: 'ea' }}
        onSessionPillPress={onSessionPillPress}
      />,
    );

    fireEvent.press(screen.getByLabelText('Attach to session'));
    expect(onSessionPillPress).toHaveBeenCalled();
  });

  it('hides the session pill entirely when no sessions exist and none is assigned', () => {
    const screen = render(
      <EditMaterialBottomSheet
        {...baseProps}
        canAttachSession={false}
        assignedSession={null}
        values={{ description: 'X', unitCostCents: 0, quantity: 1, unit: 'ea' }}
      />,
    );

    expect(screen.queryByLabelText('Attach to session')).toBeNull();
    expect(screen.queryByLabelText('Edit session')).toBeNull();
  });

  it('renders the pencil pill when a session is already assigned and shows the session subtitle', () => {
    const screen = render(
      <EditMaterialBottomSheet
        {...baseProps}
        canAttachSession={false}
        assignedSession={{
          id: 'sess-1',
          dateLabel: 'Mar 25, 2026',
          timeRangeLabel: '9:00 AM – 10:00 AM',
        }}
        values={{ description: 'X', unitCostCents: 0, quantity: 1, unit: 'ea' }}
      />,
    );

    expect(screen.getByLabelText('Edit session')).toBeTruthy();
    expect(
      screen.getByText('Session: Mar 25, 2026 9:00 AM – 10:00 AM'),
    ).toBeTruthy();
  });

  it('delegates the unit input to onUnitPress (not a TextInput)', () => {
    const onUnitPress = jest.fn();
    const screen = render(
      <EditMaterialBottomSheet
        {...baseProps}
        values={{ description: 'X', unitCostCents: 0, quantity: 1, unit: 'kit' }}
        onUnitPress={onUnitPress}
      />,
    );

    fireEvent.press(screen.getByLabelText('Choose unit'));
    expect(onUnitPress).toHaveBeenCalled();
    // Also shows the current unit label on the pressable.
    expect(screen.getByText('kit')).toBeTruthy();
  });

  it('fires onDeletePress when the trash icon is tapped', () => {
    const onDeletePress = jest.fn();
    const screen = render(
      <EditMaterialBottomSheet
        {...baseProps}
        values={{ description: 'X', unitCostCents: 0, quantity: 1, unit: 'ea' }}
        onDeletePress={onDeletePress}
      />,
    );

    fireEvent.press(screen.getByLabelText('Delete'));
    expect(onDeletePress).toHaveBeenCalled();
  });

  it('TEST-Q02 total-first mode saves with description and total only', () => {
    const onSavePress = jest.fn();
    const screen = render(
      <EditMaterialBottomSheet
        {...baseProps}
        totalFirstMode
        values={{
          description: 'Copper pipe',
          unitCostCents: 0,
          quantity: 0,
          unit: 'ea',
          totalCostCents: 2500,
        }}
        onSavePress={onSavePress}
      />,
    );

    expect(screen.getByPlaceholderText('Total')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Unit Price')).toBeNull();
    fireEvent.press(screen.getByLabelText('SAVE NEW MATERIAL'));
    expect(onSavePress).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Copper pipe',
        quantity: 1,
        totalCostCents: 2500,
        quantityExplicit: false,
        unitCostExplicit: false,
      }),
    );
  });

  it('TEST-Q02 total-first mode disables save without total', () => {
    const onSavePress = jest.fn();
    const screen = render(
      <EditMaterialBottomSheet
        {...baseProps}
        totalFirstMode
        values={{
          description: 'Copper pipe',
          unitCostCents: 0,
          quantity: 0,
          unit: 'ea',
        }}
        onSavePress={onSavePress}
      />,
    );

    fireEvent.changeText(screen.getByPlaceholderText('Total'), '');
    fireEvent.press(screen.getByLabelText('SAVE NEW MATERIAL'));
    expect(onSavePress).not.toHaveBeenCalled();
  });
});
