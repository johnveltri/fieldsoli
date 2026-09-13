import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
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
  const { View, Text } = require('react-native');
  return {
    BottomSheetShell: ({
      visible,
      children,
      stickyFooter,
      registerInGlobalStack,
    }: {
      visible: boolean;
      children: React.ReactNode;
      stickyFooter?: React.ReactNode;
      registerInGlobalStack?: boolean;
    }) =>
      visible ? (
        <View>
          <Text testID="bottom-sheet-register-flag">
            {registerInGlobalStack === false ? 'opt-out' : 'registered'}
          </Text>
          {children}
          {stickyFooter}
        </View>
      ) : null,
  };
});

jest.mock('./InlineMonthCalendar', () => {
  const { View } = require('react-native');
  return {
    InlineMonthCalendar: () => <View testID="inline-month-calendar" />,
  };
});

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
  it('opts out of the global bottom-sheet stack so NativeTabs stay mounted', () => {
    render(
      <LiveSessionBottomSheet
        typography={typography}
        visible
        phase3Capture
        jobShortDescription="Panel upgrade"
        startedAt="2026-01-01T12:00:00.000Z"
        attachments={[]}
        jobIdentity={identity}
        onAddNote={noop}
        onAddMaterial={noop}
        onPressAttachment={noop}
        onMinimize={noop}
        onEndSessionPress={noop}
      />,
    );

    expect(screen.getByTestId('bottom-sheet-register-flag').props.children).toBe('opt-out');
  });

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

  it('keeps End Session visible while an inline field is focused', () => {
    jest.useFakeTimers();
    const screen = render(
      <LiveSessionBottomSheet
        typography={typography}
        visible
        jobShortDescription="Panel upgrade"
        startedAt={new Date().toISOString()}
        attachments={[]}
        phase3Capture
        jobIdentity={identity}
        onAddNote={noop}
        onAddMaterial={noop}
        onPressAttachment={noop}
        onMinimize={noop}
        onEndSessionPress={noop}
      />,
    );

    const title = screen.getByLabelText('Job title');
    expect(screen.getByLabelText('End session')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(320);
    });

    fireEvent(title, 'focus', { nativeEvent: { target: 1 } });
    expect(screen.getByLabelText('End session')).toBeTruthy();

    fireEvent(title, 'blur');
    expect(screen.getByLabelText('End session')).toBeTruthy();
    screen.unmount();
    jest.useRealTimers();
  });

  it('does not restore a cleared title during debounced persist', () => {
    jest.useFakeTimers();
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

    const title = screen.getByLabelText('Job title');
    fireEvent.changeText(title, '');
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(screen.getByLabelText('Job title').props.value).toBe('');
    expect(onJobIdentityChange).not.toHaveBeenCalled();
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

  it('flushes in-progress note drafts when Close minimizes without blur', async () => {
    jest.useFakeTimers();
    const onMinimize = jest.fn();
    const onCreateNote = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const onUpdateNote = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const screen = render(
      <LiveSessionBottomSheet
        typography={typography}
        visible
        jobShortDescription="Panel upgrade"
        startedAt={new Date().toISOString()}
        attachments={[]}
        phase3Capture
        jobIdentity={identity}
        liveNotes={[{ id: 'note-1', body: 'Old note' }]}
        onCreateNote={onCreateNote}
        onUpdateNote={onUpdateNote}
        onAddNote={noop}
        onAddMaterial={noop}
        onPressAttachment={noop}
        onMinimize={onMinimize}
        onEndSessionPress={noop}
      />,
    );

    act(() => {
      jest.advanceTimersByTime(320);
    });

    fireEvent.changeText(screen.getByDisplayValue('Old note'), 'Updated note');
    fireEvent.press(screen.getByText('Add note'));
    const composerNote = screen.getAllByPlaceholderText('Note').find((node) => {
      const value = node.props.value ?? node.props.defaultValue;
      return value == null || value === '';
    });
    expect(composerNote).toBeTruthy();
    fireEvent.changeText(composerNote!, 'Brand new note');
    // No blur — keyboard dismiss can leave focus; Close must still persist.
    fireEvent.press(screen.getByLabelText('Close'));

    expect(onMinimize).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(onUpdateNote).toHaveBeenCalledWith('note-1', 'Updated note');
      expect(onCreateNote).toHaveBeenCalledWith('Brand new note');
    });
    screen.unmount();
    jest.useRealTimers();
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

  it('closes the started date picker when another field is focused', () => {
    const screen = render(
      <LiveSessionBottomSheet
        typography={typography}
        visible
        jobShortDescription="Panel upgrade"
        startedAt={new Date().toISOString()}
        attachments={[]}
        phase3Capture
        jobIdentity={identity}
        onAddNote={noop}
        onAddMaterial={noop}
        onPressAttachment={noop}
        onMinimize={noop}
        onEndSessionPress={noop}
      />,
    );

    fireEvent.press(screen.getByLabelText('Started date'));
    expect(screen.getByTestId('inline-month-calendar')).toBeTruthy();

    fireEvent(screen.getByPlaceholderText('Customer'), 'focus', {
      nativeEvent: { target: 1 },
    });
    expect(screen.queryByTestId('inline-month-calendar')).toBeNull();
  });

  it('closes the started time picker when another field is focused', () => {
    const screen = render(
      <LiveSessionBottomSheet
        typography={typography}
        visible
        jobShortDescription="Panel upgrade"
        startedAt={new Date().toISOString()}
        attachments={[]}
        phase3Capture
        jobIdentity={identity}
        onAddNote={noop}
        onAddMaterial={noop}
        onPressAttachment={noop}
        onMinimize={noop}
        onEndSessionPress={noop}
      />,
    );

    fireEvent.press(screen.getByLabelText('Started time'));
    expect(screen.getByTestId('datetime-picker')).toBeTruthy();

    fireEvent(screen.getByLabelText('Job title'), 'focus', {
      nativeEvent: { target: 1 },
    });
    expect(screen.queryByTestId('datetime-picker')).toBeNull();
  });

  it('closes started pickers when tapping outside the field', () => {
    const screen = render(
      <LiveSessionBottomSheet
        typography={typography}
        visible
        jobShortDescription="Panel upgrade"
        startedAt={new Date().toISOString()}
        attachments={[]}
        phase3Capture
        jobIdentity={identity}
        onAddNote={noop}
        onAddMaterial={noop}
        onPressAttachment={noop}
        onMinimize={noop}
        onEndSessionPress={noop}
      />,
    );

    fireEvent.press(screen.getByLabelText('Started date'));
    expect(screen.getByTestId('inline-month-calendar')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Dismiss started picker'));
    expect(screen.queryByTestId('inline-month-calendar')).toBeNull();

    fireEvent.press(screen.getByLabelText('Started time'));
    expect(screen.getByTestId('datetime-picker')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Dismiss started picker'));
    expect(screen.queryByTestId('datetime-picker')).toBeNull();
  });

  it('closes started pickers when tapping the Started row chrome', () => {
    const screen = render(
      <LiveSessionBottomSheet
        typography={typography}
        visible
        jobShortDescription="Panel upgrade"
        startedAt={new Date().toISOString()}
        attachments={[]}
        phase3Capture
        jobIdentity={identity}
        onAddNote={noop}
        onAddMaterial={noop}
        onPressAttachment={noop}
        onMinimize={noop}
        onEndSessionPress={noop}
      />,
    );

    fireEvent.press(screen.getByLabelText('Started date'));
    expect(screen.getByTestId('inline-month-calendar')).toBeTruthy();

    fireEvent.press(screen.getByText('Started'));
    expect(screen.queryByTestId('inline-month-calendar')).toBeNull();

    fireEvent.press(screen.getByLabelText('Started time'));
    expect(screen.getByTestId('datetime-picker')).toBeTruthy();

    fireEvent.press(screen.getByText('Started'));
    expect(screen.queryByTestId('datetime-picker')).toBeNull();
  });

  it('collapses address newlines and rejects a second decimal in revenue', () => {
    const screen = render(
      <LiveSessionBottomSheet
        typography={typography}
        visible
        jobShortDescription="Panel upgrade"
        startedAt={new Date().toISOString()}
        attachments={[]}
        phase3Capture
        jobIdentity={identity}
        onAddNote={noop}
        onAddMaterial={noop}
        onPressAttachment={noop}
        onMinimize={noop}
        onEndSessionPress={noop}
      />,
    );

    const address = screen.getByPlaceholderText('Address');
    fireEvent.changeText(address, '42 Oak\nStreet');
    expect(address.props.value).toBe('42 Oak Street');
    expect(address.props.multiline).toBe(false);

    const revenue = screen.getByPlaceholderText('Revenue');
    fireEvent.changeText(revenue, '12.3.4');
    expect(revenue.props.value).toBe('12.34');
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
