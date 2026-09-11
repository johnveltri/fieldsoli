import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import { LiveSessionBottomSheet } from './LiveSessionBottomSheet';
import { LegacyLiveSessionBottomSheet } from './LegacyLiveSessionBottomSheet';
import { createTextStyles } from '../../theme/nativeTokens';

let mockDateTimePickerProps: { onChange?: (_event: unknown, date?: Date) => void } | null = null;

jest.mock('@react-native-community/datetimepicker', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: typeof mockDateTimePickerProps) => {
      mockDateTimePickerProps = props;
      return <View testID="datetime-picker" />;
    },
    DateTimePickerAndroid: { open: jest.fn() },
  };
});

jest.mock('../figma-icons/JobDetailScreenIcons', () => ({
  LiveSessionActiveDotIcon: () => null,
  JobDetailIconSectionMaterials: () => null,
  JobDetailIconSectionNotes: () => null,
  JobDetailIconSectionOtherCosts: () => null,
  JobDetailIconSectionSessions: () => null,
  JobDetailIconTopClose: () => null,
  SessionCardEditPencilIcon: () => null,
  SessionSheetBackIcon: () => null,
  SessionCaptureTileNoteIcon: () => null,
  SessionCaptureTileMaterialIcon: () => null,
}));

jest.mock('../platform/PlatformHeaderAction', () => {
  const { Pressable } = require('react-native');
  return {
    PlatformHeaderAction: ({
      accessibilityLabel,
      onPress,
      children,
    }: {
      accessibilityLabel: string;
      onPress: () => void;
      children: React.ReactNode;
    }) => (
      <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress}>
        {children}
      </Pressable>
    ),
  };
});

jest.mock('./BottomSheetShell', () => {
  const { View } = require('react-native');
  return {
    BottomSheetShell: ({
      visible,
      children,
      stickyFooter,
    }: {
      visible: boolean;
      children: React.ReactNode;
      stickyFooter?: React.ReactNode;
    }) =>
      visible ? (
        <View>
          {children}
          {stickyFooter}
        </View>
      ) : null,
  };
});

jest.mock('./InlineMonthCalendar', () => ({
  InlineMonthCalendar: () => null,
}));

jest.mock('./LiveSessionCaptureCard', () => ({
  LiveSessionCaptureCard: () => null,
}));

jest.mock('./FullWidthFab', () => {
  const { Text } = require('react-native');
  return {
    FullWidthFab: ({
      label,
      accessibilityLabel,
      onPress,
    }: {
      label: string;
      accessibilityLabel?: string;
      onPress: () => void;
    }) => (
      <Text accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} onPress={onPress}>
        {label}
      </Text>
    ),
  };
});

jest.mock('./edit-mode/EditSwipeableRow', () => {
  const { View } = require('react-native');
  return {
    EditSwipeableRow: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
  };
});

const typography = createTextStyles({
  serifBold: 'System',
  sans: 'System',
  sansSemi: 'System',
  sansBold: 'System',
});

const identity = {
  shortDescription: 'Panel upgrade',
  longDescription: '',
  customerName: 'Acme',
  serviceAddress: '1 Main',
  revenueCents: null as number | null,
};

const noop = () => undefined;

describe('LiveSessionBottomSheet phase3Capture', () => {
  it('TEST-L08 hides header EDIT and shows inline identity + add rows', () => {
    const onJobIdentityChange = jest.fn();
    const onAddNote = jest.fn();
    const screen = render(
      <LiveSessionBottomSheet
        typography={typography}
        visible
        jobShortDescription="Panel upgrade"
        startedAt={new Date().toISOString()}
        attachments={[]}
        phase3Capture
        jobIdentity={identity}
        onJobIdentityChange={onJobIdentityChange}
        onAddNote={onAddNote}
        onAddMaterial={noop}
        onPressAttachment={noop}
        onMinimize={noop}
        onEndSessionPress={noop}
      />,
    );

    expect(screen.queryByLabelText('Edit job')).toBeNull();
    expect(screen.queryByText('EDIT')).toBeNull();
    expect(screen.queryByText('Back')).toBeNull();
    expect(screen.getByLabelText('Close')).toBeTruthy();
    expect(screen.getByLabelText('Started time')).toBeTruthy();
    expect(screen.getByLabelText('Job title')).toBeTruthy();
    expect(screen.getByPlaceholderText('Customer')).toBeTruthy();

    fireEvent.press(screen.getByText('Add note'));
    expect(screen.getByPlaceholderText('Note')).toBeTruthy();
    expect(onAddNote).not.toHaveBeenCalled();
    expect(screen.getByLabelText('End session')).toBeTruthy();
  });

  it('TEST-L04 persists customer changes without a Done action', () => {
    jest.useFakeTimers({ advanceTimers: true });
    const onJobIdentityChange = jest.fn();
    const screen = render(
      <LiveSessionBottomSheet
        typography={typography}
        visible
        jobShortDescription="Panel upgrade"
        startedAt={new Date().toISOString()}
        attachments={[]}
        phase3Capture
        jobIdentity={identity}
        onJobIdentityChange={onJobIdentityChange}
        onAddNote={noop}
        onAddMaterial={noop}
        onPressAttachment={noop}
        onMinimize={noop}
        onEndSessionPress={noop}
      />,
    );

    fireEvent.changeText(screen.getByPlaceholderText('Customer'), 'Beta Electric');
    jest.advanceTimersByTime(500);
    expect(onJobIdentityChange).toHaveBeenCalledWith(
      expect.objectContaining({ customerName: 'Beta Electric' }),
    );
    expect(screen.queryByLabelText('Done')).toBeNull();
    screen.unmount();
    jest.useRealTimers();
  });

  it('TEST-L05 keeps a new note visible when its save fails so it can be retried', async () => {
    const onCreateNote = jest.fn<() => Promise<void>>().mockRejectedValue(new Error('Offline'));
    const screen = render(
      <LiveSessionBottomSheet
        typography={typography}
        visible
        jobShortDescription="Panel upgrade"
        startedAt={new Date().toISOString()}
        attachments={[]}
        phase3Capture
        jobIdentity={identity}
        onCreateNote={onCreateNote}
        onAddNote={noop}
        onAddMaterial={noop}
        onPressAttachment={noop}
        onMinimize={noop}
        onEndSessionPress={noop}
      />,
    );

    fireEvent.press(screen.getByText('Add note'));
    const note = screen.getByPlaceholderText('Note');
    fireEvent.changeText(note, 'Keep this draft');
    fireEvent(note, 'blur');

    await waitFor(() => expect(onCreateNote).toHaveBeenCalledWith('Keep this draft'));
    expect(screen.getByDisplayValue('Keep this draft')).toBeTruthy();
  });

  it('TEST-L05 keeps a new material visible when its save fails so it can be retried', async () => {
    const onCreateMaterial = jest.fn<() => Promise<void>>().mockRejectedValue(new Error('Offline'));
    const screen = render(
      <LiveSessionBottomSheet
        typography={typography}
        visible
        jobShortDescription="Panel upgrade"
        startedAt={new Date().toISOString()}
        attachments={[]}
        phase3Capture
        jobIdentity={identity}
        onCreateMaterial={onCreateMaterial}
        onAddNote={noop}
        onAddMaterial={noop}
        onPressAttachment={noop}
        onMinimize={noop}
        onEndSessionPress={noop}
      />,
    );

    fireEvent.press(screen.getByText('Add material'));
    const descriptions = screen.getAllByPlaceholderText('Description');
    const description = descriptions[descriptions.length - 1]!;
    fireEvent.changeText(description, 'Permit');
    const total = screen.getByPlaceholderText('Total');
    fireEvent.changeText(total, '47.50');
    fireEvent(total, 'blur');

    await waitFor(() =>
      expect(onCreateMaterial).toHaveBeenCalledWith({ description: 'Permit', totalCostCents: 4750 }),
    );
    expect(screen.getByDisplayValue('Permit')).toBeTruthy();
  });

  it('TEST-L07 serializes rapid iOS start-time changes and persists the latest value', async () => {
    let resolveFirst: (() => void) | undefined;
    const onChangeStartedAt = jest
      .fn<() => Promise<void>>()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValue(undefined);
    const startedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const screen = render(
      <LiveSessionBottomSheet
        typography={typography}
        visible
        jobShortDescription="Panel upgrade"
        startedAt={startedAt}
        attachments={[]}
        phase3Capture
        jobIdentity={identity}
        onChangeStartedAt={onChangeStartedAt}
        onAddNote={noop}
        onAddMaterial={noop}
        onPressAttachment={noop}
        onMinimize={noop}
        onEndSessionPress={noop}
      />,
    );

    fireEvent.press(screen.getByLabelText('Started time'));
    const first = new Date(Date.now() - 50 * 60 * 1000);
    const latest = new Date(Date.now() - 30 * 60 * 1000);
    await act(async () => {
      mockDateTimePickerProps?.onChange?.({}, first);
      mockDateTimePickerProps?.onChange?.({}, latest);
    });
    expect(onChangeStartedAt).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirst?.();
    });
    await waitFor(() => expect(onChangeStartedAt).toHaveBeenCalledTimes(2));
    const expectedLatest = new Date(latest);
    expectedLatest.setSeconds(0, 0);
    expect(onChangeStartedAt).toHaveBeenLastCalledWith(expectedLatest.toISOString());
  });

  it('TEST-F02 keeps the complete legacy live-session sheet when the flag is off', () => {
    const screen = render(
      <LegacyLiveSessionBottomSheet
        typography={typography}
        visible
        jobShortDescription="Panel upgrade"
        startedAt={new Date().toISOString()}
        attachments={[]}
        onEditJobPress={noop}
        onEditPress={noop}
        onAddNote={noop}
        onAddMaterial={noop}
        onPressAttachment={noop}
        onMinimize={noop}
        onEndSessionPress={noop}
      />,
    );

    expect(screen.getByLabelText('Edit job')).toBeTruthy();
    expect(screen.getByText('EDIT')).toBeTruthy();
    expect(screen.getByText('Back')).toBeTruthy();
    expect(screen.queryByLabelText('Close')).toBeNull();
    expect(screen.queryByLabelText('Started time')).toBeNull();
    expect(screen.queryByPlaceholderText('Customer')).toBeNull();
  });
});
