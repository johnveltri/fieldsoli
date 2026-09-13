import { act, render, screen, waitFor } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import {
  Animated,
  Dimensions,
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
import { bg } from '../../theme/nativeTokens';

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

  it('does not use height avoidance on Android (it loops with the IME)', () => {
    const originalPlatformOS = Platform.OS;

    try {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
      const androidView = render(
        <BottomSheetShell visible onClose={jest.fn()}>
          <Text>Android sheet content</Text>
        </BottomSheetShell>,
      );
      expect(androidView.UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBeUndefined();
      androidView.unmount();

      Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
      const iosView = render(
        <BottomSheetShell visible onClose={jest.fn()}>
          <Text>iOS sheet content</Text>
        </BottomSheetShell>,
      );
      expect(iosView.UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBe('padding');
      iosView.unmount();

      const iosFullbleed = render(
        <BottomSheetShell visible variant="fullbleedDark" stickyFooter={<Text>END SESSION</Text>}>
          <Text>Live session</Text>
        </BottomSheetShell>,
      );
      expect(iosFullbleed.UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBeUndefined();
      iosFullbleed.unmount();
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
      expect(StyleSheet.flatten(screen.getByTestId('bottom-sheet-surface').props.style).paddingBottom).toBe(
        320,
      );
      expect(StyleSheet.flatten(screen.getByTestId('bottom-sheet-bottom-fill').props.style).height).toBe(0);
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
      expect(addListenerSpy).toHaveBeenCalledTimes(4);
    } finally {
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        value: originalPlatformOS,
      });
      addListenerSpy.mockRestore();
    }
  });

  it('uses Android keyboard height and raw screenY overlap without status-bar boost', () => {
    const originalPlatformOS = Platform.OS;
    let onKeyboardDidShow: ((event: {
      endCoordinates: { height: number; screenY?: number };
    }) => void) | undefined;
    const addListenerSpy = jest
      .spyOn(Keyboard, 'addListener')
      .mockImplementation((eventName, listener) => {
        if (eventName === 'keyboardDidShow') {
          onKeyboardDidShow = listener as typeof onKeyboardDidShow;
        }
        return { remove: jest.fn() } as never;
      });
    const screenHeightSpy = jest.spyOn(Dimensions, 'get').mockImplementation((dim) => {
      if (dim === 'screen') return { width: 400, height: 900, scale: 1, fontScale: 1 };
      return { width: 400, height: 800, scale: 1, fontScale: 1 };
    });
    mockSheetInsets.top = 50;

    try {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
      render(
        <BottomSheetShell visible bottomPaddingExtra={0} onClose={jest.fn()}>
          <Text>Profile sheet</Text>
        </BottomSheetShell>,
      );

      act(() => {
        // Prefer max(height, screenHeight - screenY) — no insets.top boost.
        onKeyboardDidShow?.({ endCoordinates: { height: 280, screenY: 600 } });
      });
      // max(280, 900 - 600) = 300
      expect(
        StyleSheet.flatten(screen.getByTestId('bottom-sheet-surface').props.style).paddingBottom,
      ).toBe(300);
    } finally {
      mockSheetInsets.top = 0;
      screenHeightSpy.mockRestore();
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

  it('lifts a fullbleed sticky footer above the Android IME', () => {
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
        <BottomSheetShell
          visible
          variant="fullbleedDark"
          stickyFooter={<Text>END SESSION</Text>}
          onClose={jest.fn()}
        >
          <Text>Live session</Text>
        </BottomSheetShell>,
      );

      const footer = screen.getByTestId('bottom-sheet-sticky-footer');
      expect(StyleSheet.flatten(footer.props.style).bottom).toBe(0);
      expect(
        StyleSheet.flatten(screen.getByTestId('bottom-sheet-surface').props.style).paddingBottom,
      ).toBe(0);

      act(() => {
        onKeyboardDidShow?.({ endCoordinates: { height: 320 } });
      });
      expect(StyleSheet.flatten(screen.getByTestId('bottom-sheet-sticky-footer').props.style).bottom).toBe(
        320,
      );
      expect(
        StyleSheet.flatten(screen.getByTestId('bottom-sheet-surface').props.style).paddingBottom,
      ).toBe(0);

      act(() => {
        onKeyboardDidHide?.();
      });
      expect(StyleSheet.flatten(screen.getByTestId('bottom-sheet-sticky-footer').props.style).bottom).toBe(
        0,
      );
    } finally {
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        value: originalPlatformOS,
      });
      addListenerSpy.mockRestore();
    }
  });

  it('lifts a fullbleed sticky footer above the iOS keyboard including QuickType', () => {
    const originalPlatformOS = Platform.OS;
    let onKeyboardWillShow: ((event: { endCoordinates: { height: number } }) => void) | undefined;
    let onKeyboardWillChangeFrame:
      | ((event: { endCoordinates: { height: number } }) => void)
      | undefined;
    const addListenerSpy = jest
      .spyOn(Keyboard, 'addListener')
      .mockImplementation((eventName, listener) => {
        if (eventName === 'keyboardWillShow') {
          onKeyboardWillShow = listener as typeof onKeyboardWillShow;
        }
        if (eventName === 'keyboardWillChangeFrame') {
          onKeyboardWillChangeFrame = listener as typeof onKeyboardWillChangeFrame;
        }
        return { remove: jest.fn() } as never;
      });

    try {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
      render(
        <BottomSheetShell
          visible
          variant="fullbleedDark"
          stickyFooter={<Text>END SESSION</Text>}
          onClose={jest.fn()}
        >
          <Text>Live session</Text>
        </BottomSheetShell>,
      );

      expect(StyleSheet.flatten(screen.getByTestId('bottom-sheet-sticky-footer').props.style).bottom).toBe(
        0,
      );

      act(() => {
        onKeyboardWillShow?.({ endCoordinates: { height: 291 } });
      });
      expect(StyleSheet.flatten(screen.getByTestId('bottom-sheet-sticky-footer').props.style).bottom).toBe(
        291,
      );

      act(() => {
        onKeyboardWillChangeFrame?.({ endCoordinates: { height: 336 } });
      });
      expect(StyleSheet.flatten(screen.getByTestId('bottom-sheet-sticky-footer').props.style).bottom).toBe(
        336,
      );
    } finally {
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        value: originalPlatformOS,
      });
      addListenerSpy.mockRestore();
    }
  });

  it('presents a fullbleed live session as a full-page overlay', () => {
    render(
      <BottomSheetShell visible variant="fullbleedDark">
        <Text>Live session</Text>
      </BottomSheetShell>,
    );

    const overlayStyle = StyleSheet.flatten(screen.getByTestId('bottom-sheet-overlay').props.style);
    expect(overlayStyle.top).toBe(0);
    const surfaceStyle = StyleSheet.flatten(screen.getByTestId('bottom-sheet-surface').props.style);
    expect(surfaceStyle.borderTopLeftRadius).toBeUndefined();
    expect(surfaceStyle.flexGrow).toBe(1);
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

  it('collapses a hidden overlay so it cannot intercept taps', () => {
    render(
      <BottomSheetShell visible={false} onClose={jest.fn()}>
        <Text>Hidden sheet content</Text>
      </BottomSheetShell>,
    );

    const overlay = screen.getByTestId('bottom-sheet-overlay', {
      includeHiddenElements: true,
    });
    const overlayStyle = StyleSheet.flatten(overlay.props.style);
    expect(overlay.props.pointerEvents).toBe('none');
    expect(overlayStyle).toEqual(expect.objectContaining({ width: 0, height: 0 }));
    expect(overlayStyle.right).toBeUndefined();
    expect(overlayStyle.bottom).toBeUndefined();
  });

  it('fills the live-session bottom inset with the sheet surface', () => {
    render(
      <BottomSheetShell visible variant="fullbleedDark" onClose={jest.fn()}>
        <Text>Live session sheet</Text>
      </BottomSheetShell>,
    );

    expect(
      StyleSheet.flatten(screen.getByTestId('bottom-sheet-bottom-fill').props.style)
        .backgroundColor,
    ).toBe(bg.canvasWarm);
  });
});
