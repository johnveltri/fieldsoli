import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import { Alert } from 'react-native';

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

const mockCustomerSuggestionsState = {
  suggestions: [] as Array<{
    customerId: string;
    displayName: string;
    phone: string | null;
    email: string | null;
    serviceAddress: string | null;
  }>,
  suggestionsQuery: '' as string | null,
  loading: false,
  error: false,
  reload: jest.fn(),
};

jest.mock('./customer/useCustomerSuggestions', () => ({
  ...jest.requireActual('./customer/useCustomerSuggestions'),
  useCustomerSuggestions: () => mockCustomerSuggestionsState,
}));

jest.mock('./customer/useAddressAutocomplete', () => ({
  useAddressAutocomplete: () => ({
    suggestions: [],
    loading: false,
    noResults: false,
    showPanel: false,
    meetsThreshold: false,
  }),
}));

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
  customerPhone: '',
  customerEmail: '',
  customerId: null as string | null,
  serviceAddress: '1 Main',
  revenueCents: null as number | null,
};

const supabase = {} as never;
const noop = () => undefined;

describe('LiveSessionBottomSheet phase3Capture', () => {
  it('opts out of the global bottom-sheet stack so NativeTabs stay mounted', () => {
    render(
      <LiveSessionBottomSheet
        typography={typography}
        visible
        phase3Capture
        supabase={supabase}
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
        supabase={supabase}
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

  it('TEST-16 persists customer changes on blur, not per keystroke', () => {
    jest.useFakeTimers({ advanceTimers: true });
    const onJobIdentityChange = jest.fn();
    const onCustomerSnapshotSave = jest.fn();
    const screen = render(
      <LiveSessionBottomSheet
        typography={typography}
        visible
        jobShortDescription="Panel upgrade"
        startedAt={new Date().toISOString()}
        attachments={[]}
        phase3Capture
        supabase={supabase}
        jobIdentity={identity}
        supabase={supabase}
        onJobIdentityChange={onJobIdentityChange}
        onCustomerSnapshotSave={onCustomerSnapshotSave}
        onAddNote={noop}
        onAddMaterial={noop}
        onPressAttachment={noop}
        onMinimize={noop}
        onEndSessionPress={noop}
      />,
    );

    const customer = screen.getByPlaceholderText('Customer');
    fireEvent.changeText(customer, 'Beta Electric');
    jest.advanceTimersByTime(500);
    expect(onJobIdentityChange).not.toHaveBeenCalled();
    expect(onCustomerSnapshotSave).not.toHaveBeenCalled();
    fireEvent(customer, 'blur');
    expect(onCustomerSnapshotSave).toHaveBeenCalledWith(
      expect.objectContaining({ customerName: 'Beta Electric' }),
    );
    expect(screen.queryByLabelText('Done')).toBeNull();
    screen.unmount();
    jest.useRealTimers();
  });

  it('saves the latest customer draft when it changes during an in-flight save', async () => {
    let resolveFirstSave: (() => void) | undefined;
    const onCustomerSnapshotSave = jest
      .fn<() => Promise<void>>()
      .mockImplementationOnce(
        () => new Promise<void>((resolve) => { resolveFirstSave = resolve; }),
      )
      .mockResolvedValue(undefined);
    const screen = render(
      <LiveSessionBottomSheet
        typography={typography}
        visible
        jobShortDescription="Panel upgrade"
        startedAt={new Date().toISOString()}
        attachments={[]}
        phase3Capture
        supabase={supabase}
        jobIdentity={identity}
        onCustomerSnapshotSave={onCustomerSnapshotSave}
        onAddNote={noop}
        onAddMaterial={noop}
        onPressAttachment={noop}
        onMinimize={noop}
        onEndSessionPress={noop}
      />,
    );

    const customer = screen.getByLabelText('Customer');
    fireEvent.changeText(customer, 'Beta Electric');
    fireEvent(customer, 'blur');
    await waitFor(() => expect(onCustomerSnapshotSave).toHaveBeenCalledTimes(1));

    fireEvent.changeText(screen.getByLabelText('Customer'), 'Gamma Electric');
    screen.rerender(
      <LiveSessionBottomSheet
        typography={typography}
        visible
        jobShortDescription="Panel upgrade"
        startedAt={new Date().toISOString()}
        attachments={[]}
        phase3Capture
        supabase={supabase}
        jobIdentity={{ ...identity, customerName: 'Stale refetched name' }}
        onCustomerSnapshotSave={onCustomerSnapshotSave}
        onAddNote={noop}
        onAddMaterial={noop}
        onPressAttachment={noop}
        onMinimize={noop}
        onEndSessionPress={noop}
      />,
    );
    expect(screen.getByDisplayValue('Gamma Electric')).toBeTruthy();

    await act(async () => {
      resolveFirstSave?.();
    });

    await waitFor(() => {
      expect(onCustomerSnapshotSave).toHaveBeenCalledTimes(2);
      expect(onCustomerSnapshotSave).toHaveBeenLastCalledWith(
        expect.objectContaining({ customerName: 'Gamma Electric' }),
      );
    });
    screen.unmount();
  });

  it.each([
    ['minimize', 'Close'] as const,
    ['end', 'End session'] as const,
  ])('%s stays open on Customer-save failure and offers retry', async (transition, label) => {
    let alertButtons: Parameters<typeof Alert.alert>[2] = [];
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      alertButtons = buttons ?? [];
    });
    const onMinimize = jest.fn();
    const onEndSessionPress = jest.fn();
    const onCustomerSnapshotSave = jest
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('Offline'))
      .mockRejectedValueOnce(new Error('Still offline'))
      .mockResolvedValue(undefined);
    const screen = render(
      <LiveSessionBottomSheet
        typography={typography}
        visible
        jobShortDescription="Panel upgrade"
        startedAt={new Date().toISOString()}
        attachments={[]}
        phase3Capture
        supabase={supabase}
        jobIdentity={identity}
        onCustomerSnapshotSave={onCustomerSnapshotSave}
        onAddNote={noop}
        onAddMaterial={noop}
        onPressAttachment={noop}
        onMinimize={onMinimize}
        onEndSessionPress={onEndSessionPress}
      />,
    );

    fireEvent.changeText(screen.getByLabelText('Customer'), 'Beta Electric');
    fireEvent.press(screen.getByLabelText(label));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    expect(onMinimize).not.toHaveBeenCalled();
    expect(onEndSessionPress).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      "Couldn't save customer details. Try again.",
      undefined,
      expect.any(Array),
      expect.any(Object),
    );

    await act(async () => {
      alertButtons[0]?.onPress?.();
    });
    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(2));
    expect(screen.getByDisplayValue('Beta Electric')).toBeTruthy();
    expect(onMinimize).not.toHaveBeenCalled();
    expect(onEndSessionPress).not.toHaveBeenCalled();
    await act(async () => {
      alertButtons[0]?.onPress?.();
    });
    await waitFor(() => expect(onCustomerSnapshotSave).toHaveBeenCalledTimes(3));
    expect(onMinimize).not.toHaveBeenCalled();
    expect(onEndSessionPress).not.toHaveBeenCalled();

    fireEvent.press(screen.getByLabelText(label));
    await waitFor(() => {
      if (transition === 'minimize') expect(onMinimize).toHaveBeenCalledTimes(1);
      else expect(onEndSessionPress).toHaveBeenCalledTimes(1);
    });
    alertSpy.mockRestore();
    screen.unmount();
  });

  it.each([
    ['minimize', 'Close'] as const,
    ['end', 'End session'] as const,
  ])('%s waits for the customer save before closing the Live Session', async (transition, label) => {
    let resolveSave: (() => void) | undefined;
    const onCustomerSnapshotSave = jest.fn(
      () => new Promise<void>((resolve) => { resolveSave = resolve; }),
    );
    const onMinimize = jest.fn();
    const onEndSessionPress = jest.fn();
    const screen = render(
      <LiveSessionBottomSheet
        typography={typography}
        visible
        jobShortDescription="Panel upgrade"
        startedAt={new Date().toISOString()}
        attachments={[]}
        phase3Capture
        supabase={supabase}
        jobIdentity={identity}
        onCustomerSnapshotSave={onCustomerSnapshotSave}
        onAddNote={noop}
        onAddMaterial={noop}
        onPressAttachment={noop}
        onMinimize={onMinimize}
        onEndSessionPress={onEndSessionPress}
      />,
    );

    fireEvent.changeText(screen.getByLabelText('Customer'), 'Beta Electric');
    fireEvent.press(screen.getByLabelText(label));
    await waitFor(() => expect(onCustomerSnapshotSave).toHaveBeenCalledTimes(1));
    expect(onMinimize).not.toHaveBeenCalled();
    expect(onEndSessionPress).not.toHaveBeenCalled();

    await act(async () => {
      resolveSave?.();
    });
    await waitFor(() => {
      if (transition === 'minimize') expect(onMinimize).toHaveBeenCalledTimes(1);
      else expect(onEndSessionPress).toHaveBeenCalledTimes(1);
    });
    screen.unmount();
  });

  it('restores End Session when the address input blurs and keeps the lookup row mounted', () => {
    const screen = render(
      <LiveSessionBottomSheet
        typography={typography}
        visible
        jobShortDescription="Panel upgrade"
        startedAt={new Date().toISOString()}
        attachments={[]}
        phase3Capture
        supabase={supabase}
        jobIdentity={identity}
        onAddNote={noop}
        onAddMaterial={noop}
        onPressAttachment={noop}
        onMinimize={noop}
        onEndSessionPress={noop}
      />,
    );

    const address = screen.getByLabelText('Address');
    fireEvent(address, 'focus', { nativeEvent: { target: 1 } });
    expect(screen.queryByLabelText('End session')).toBeNull();
    fireEvent(address, 'blur');
    expect(screen.getByLabelText('End session')).toBeTruthy();
    expect(screen.getByLabelText('Address')).toBeTruthy();
    screen.unmount();
  });

  it('restores End Session after selecting a customer suggestion', () => {
    jest.useFakeTimers();
    mockCustomerSuggestionsState.suggestions = [
      {
        customerId: 'customer-1',
        displayName: 'Beta Electric',
        phone: null,
        email: null,
        serviceAddress: null,
      },
    ];
    mockCustomerSuggestionsState.suggestionsQuery = '';

    const screen = render(
      <LiveSessionBottomSheet
        typography={typography}
        visible
        jobShortDescription="Panel upgrade"
        startedAt={new Date().toISOString()}
        attachments={[]}
        phase3Capture
        supabase={supabase}
        jobIdentity={{ ...identity, customerName: '' }}
        onAddNote={noop}
        onAddMaterial={noop}
        onPressAttachment={noop}
        onMinimize={noop}
        onEndSessionPress={noop}
      />,
    );

    act(() => {
      jest.advanceTimersByTime(320);
    });

    const customer = screen.getByPlaceholderText('Customer');
    fireEvent(customer, 'focus', { nativeEvent: { target: 1 } });
    expect(screen.queryByLabelText('End session')).toBeNull();

    fireEvent.press(screen.getByLabelText('Beta Electric'));
    expect(screen.getByLabelText('End session')).toBeTruthy();

    mockCustomerSuggestionsState.suggestions = [];
    mockCustomerSuggestionsState.suggestionsQuery = '';
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
        supabase={supabase}
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
        supabase={supabase}
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
        supabase={supabase}
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
        supabase={supabase}
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

    await waitFor(() => expect(onMinimize).toHaveBeenCalledTimes(1));
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
        supabase={supabase}
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
        supabase={supabase}
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
        supabase={supabase}
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
        supabase={supabase}
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
        supabase={supabase}
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
        supabase={supabase}
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
        supabase={supabase}
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
