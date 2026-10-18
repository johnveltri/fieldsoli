import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import { Platform } from 'react-native';

import { EditLiveSessionBottomSheet } from './EditLiveSessionBottomSheet';
import { createTextStyles } from '../../theme/nativeTokens';

jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: ({
    onChange,
  }: {
    onChange?: (event: { type: string }, date?: Date) => void;
  }) => {
    const React = require('react');
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable
        testID="date-time-picker"
        onPress={() =>
          onChange?.({ type: 'set' }, new Date('2026-04-25T14:00:00.000Z'))
        }
      >
        <Text>picker</Text>
      </Pressable>
    );
  },
  DateTimePickerAndroid: { open: jest.fn() },
}));

const typography = createTextStyles({
  serifBold: 'System',
  sans: 'System',
  sansSemi: 'System',
  sansBold: 'System',
});

function setPlatformOS(os: 'ios' | 'android') {
  const original = Platform.OS;
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    get: () => os,
  });
  return () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      get: () => original,
    });
  };
}

describe('EditLiveSessionBottomSheet', () => {
  const baseProps = {
    typography,
    visible: true,
    startedAt: '2026-04-25T15:00:00.000Z',
  } as const;

  it('keeps iOS end time optional when the picker is opened but not changed', () => {
    const restorePlatform = setPlatformOS('ios');
    const onSavePress = jest.fn();
    try {
      const screen = render(
        <EditLiveSessionBottomSheet
          {...baseProps}
          onSavePress={onSavePress}
        />,
      );

      fireEvent.press(
        screen.getByLabelText(
          'End time (optional — saving with a value ends the visit)',
        ),
      );
      expect(screen.getByTestId('date-time-picker')).toBeTruthy();

      fireEvent.press(screen.getByLabelText('SAVE CHANGES'));

      expect(onSavePress).toHaveBeenCalledWith({
        kind: 'updateStart',
        startedAt: '2026-04-25T15:00:00.000Z',
      });
    } finally {
      restorePlatform();
    }
  });

  it('rejects an end time before the start time', () => {
    const restorePlatform = setPlatformOS('ios');
    const onSavePress = jest.fn();
    try {
      const screen = render(
        <EditLiveSessionBottomSheet
          {...baseProps}
          onSavePress={onSavePress}
        />,
      );

      fireEvent.press(
        screen.getByLabelText(
          'End time (optional — saving with a value ends the visit)',
        ),
      );
      fireEvent.press(screen.getByTestId('date-time-picker'));
      fireEvent.press(screen.getByLabelText('SAVE CHANGES'));

      expect(screen.getByText('End time must be after the start time.')).toBeTruthy();
      expect(onSavePress).not.toHaveBeenCalled();
    } finally {
      restorePlatform();
    }
  });

  it('rejects a start time in the future', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-25T10:00:00.000Z'));
    const restorePlatform = setPlatformOS('ios');
    const onSavePress = jest.fn();
    try {
      const screen = render(
        <EditLiveSessionBottomSheet
          {...baseProps}
          startedAt="2026-04-25T15:00:00.000Z"
          onSavePress={onSavePress}
        />,
      );

      fireEvent.press(screen.getByLabelText('SAVE CHANGES'));

      expect(screen.getByText("Start time can't be in the future.")).toBeTruthy();
      expect(onSavePress).not.toHaveBeenCalled();
    } finally {
      restorePlatform();
      jest.useRealTimers();
    }
  });
});
