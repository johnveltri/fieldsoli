import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import { LiveSessionBottomSheet } from './LiveSessionBottomSheet';
import { createTextStyles } from '../../theme/nativeTokens';

jest.mock('@react-native-community/datetimepicker', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: () => <View testID="datetime-picker" />,
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

  it('flag off keeps EDIT job affordance', () => {
    const screen = render(
      <LiveSessionBottomSheet
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
  });
});
