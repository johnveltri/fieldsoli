import { act, render, screen, waitFor } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
} from 'react-native';

const mockSheetInsets = { top: 0, bottom: 34, left: 0, right: 0 };

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockSheetInsets,
}));

import {
  BottomSheetStackProvider,
  useHasRegisteredBottomSheet,
} from '../../context/BottomSheetStackContext';
import { BottomSheetShell } from './BottomSheetShell';

function SheetStackStatus() {
  const hasRegisteredSheet = useHasRegisteredBottomSheet();
  return <Text testID="sheet-stack-status">{hasRegisteredSheet ? 'active' : 'idle'}</Text>;
}

describe('BottomSheetShell accessibility', () => {
  it('removes a mounted hidden sheet and its scrim from the accessibility tree', () => {
    const { rerender } = render(
      <BottomSheetShell visible={false} onClose={jest.fn()}>
        <Text>Hidden sheet content</Text>
      </BottomSheetShell>,
    );

    expect(screen.queryByLabelText('Close bottom sheet')).toBeNull();
    expect(screen.queryByText('Hidden sheet content')).toBeNull();

    rerender(
      <BottomSheetShell visible onClose={jest.fn()}>
        <Text>Visible sheet content</Text>
      </BottomSheetShell>,
    );

    expect(screen.getAllByLabelText('Close bottom sheet')).toHaveLength(1);
    expect(screen.getByText('Visible sheet content')).toBeTruthy();
  });

  it('marks the overlay as a modal while visible', () => {
    render(
      <BottomSheetShell visible accessibilityTitle="Edit Job" onClose={jest.fn()}>
        <Text>Visible sheet content</Text>
      </BottomSheetShell>,
    );

    expect(screen.getByTestId('bottom-sheet-overlay').props.accessibilityViewIsModal).toBe(true);
  });

  it('uses height avoidance on Android while preserving padding avoidance on iOS', () => {
    const originalPlatformOS = Platform.OS;

    try {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
      const androidView = render(
        <BottomSheetShell visible onClose={jest.fn()}>
          <Text>Android sheet content</Text>
        </BottomSheetShell>,
      );
      expect(androidView.UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBe('height');
      androidView.unmount();

      Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
      const iosView = render(
        <BottomSheetShell visible onClose={jest.fn()}>
          <Text>iOS sheet content</Text>
        </BottomSheetShell>,
      );
      expect(iosView.UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBe('padding');
      iosView.unmount();
    } finally {
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        value: originalPlatformOS,
      });
    }
  });

  it('keeps the modal surface continuous across the keyboard-reserved bottom area', () => {
    const originalPlatformOS = Platform.OS;
    let onKeyboardDidShow: ((event: { endCoordinates: { height: number } }) => void) | undefined;
    let onKeyboardDidHide: (() => void) | undefined;
    const addListenerSpy = jest
      .spyOn(Keyboard, 'addListener')
      .mockImplementation((eventName, listener) => {
        if (eventName === 'keyboardDidShow') {
          onKeyboardDidShow = listener as typeof onKeyboardDidShow;
        }
        if (eventName === 'keyboardDidHide') {
          onKeyboardDidHide = listener as typeof onKeyboardDidHide;
        }
        return { remove: jest.fn() } as never;
      });

    try {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
      render(
        <BottomSheetShell visible bottomPaddingExtra={0} onClose={jest.fn()}>
          <Text>Hardware keyboard sheet</Text>
        </BottomSheetShell>,
      );

      const surface = screen.getByTestId('bottom-sheet-surface');
      const bottomFill = screen.getByTestId('bottom-sheet-bottom-fill');
      expect(StyleSheet.flatten(surface.props.style).paddingBottom).toBe(mockSheetInsets.bottom);
      expect(StyleSheet.flatten(bottomFill.props.style).height).toBe(mockSheetInsets.bottom);
      expect(addListenerSpy).toHaveBeenCalledTimes(4);

      act(() => {
        onKeyboardDidShow?.({ endCoordinates: { height: 0 } });
      });
      expect(StyleSheet.flatten(surface.props.style).paddingBottom).toBe(mockSheetInsets.bottom);
      expect(StyleSheet.flatten(bottomFill.props.style).height).toBe(mockSheetInsets.bottom);
      expect(addListenerSpy).toHaveBeenCalledTimes(4);

      act(() => {
        onKeyboardDidShow?.({ endCoordinates: { height: 320 } });
      });
      expect(StyleSheet.flatten(surface.props.style).paddingBottom).toBe(0);
      expect(StyleSheet.flatten(bottomFill.props.style).height).toBe(320);
      expect(addListenerSpy).toHaveBeenCalledTimes(4);

      act(() => {
        onKeyboardDidHide?.();
      });
      expect(
        StyleSheet.flatten(screen.getByTestId('bottom-sheet-surface').props.style).paddingBottom,
      ).toBe(mockSheetInsets.bottom);
      expect(
        StyleSheet.flatten(screen.getByTestId('bottom-sheet-bottom-fill').props.style).height,
      ).toBe(mockSheetInsets.bottom);
      expect(addListenerSpy).toHaveBeenCalledTimes(6);
    } finally {
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        value: originalPlatformOS,
      });
      addListenerSpy.mockRestore();
    }
  });

  it('lets edge-to-edge content own the bottom safe-area padding', () => {
    render(
      <BottomSheetShell visible contentExtendsToBottomEdge>
        <Text>Edge-to-edge content</Text>
      </BottomSheetShell>,
    );

    const surfaceStyle = StyleSheet.flatten(screen.getByTestId('bottom-sheet-surface').props.style);
    expect(surfaceStyle.paddingBottom).toBe(0);
  });

  it('clips a fullbleed live-session header into the standard rounded sheet top', () => {
    render(
      <BottomSheetShell visible variant="fullbleedDark">
        <Text>Live session</Text>
      </BottomSheetShell>,
    );

    const surfaceStyle = StyleSheet.flatten(screen.getByTestId('bottom-sheet-surface').props.style);
    expect(surfaceStyle.borderTopLeftRadius).toBeGreaterThan(0);
    expect(surfaceStyle.borderTopRightRadius).toBeGreaterThan(0);
    expect(surfaceStyle.borderCurve).toBe('continuous');
    expect(surfaceStyle.overflow).toBe('hidden');
  });

  it('registers as active as soon as the sheet opens', async () => {
    render(
      <BottomSheetStackProvider>
        <SheetStackStatus />
        <BottomSheetShell visible onClose={jest.fn()}>
          <Text>Visible sheet content</Text>
        </BottomSheetShell>
      </BottomSheetStackProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('sheet-stack-status').props.children).toBe('active');
    });
  });

  it('does not restart an open animation when an inline onClosed callback changes', () => {
    const timingSpy = jest.spyOn(Animated, 'timing');
    const view = render(
      <BottomSheetShell visible onClosed={() => undefined}>
        <Text>Stable sheet</Text>
      </BottomSheetShell>,
    );
    const animationCountAfterOpen = timingSpy.mock.calls.length;

    view.rerender(
      <BottomSheetShell visible onClosed={() => undefined}>
        <Text>Stable sheet after parent render</Text>
      </BottomSheetShell>,
    );

    expect(timingSpy).toHaveBeenCalledTimes(animationCountAfterOpen);
    timingSpy.mockRestore();
  });
});
