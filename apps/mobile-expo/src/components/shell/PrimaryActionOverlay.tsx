import { useCallback, useRef, useState, type RefObject } from 'react';
import {
  Modal,
  PixelRatio,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type View as RNView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHasLiveSession } from '../../context/LiveSessionContext';
import { useShellChromeOptional } from '../../shell/ShellChromeContext';
import { useQuickActionsFlow } from '../../shell/QuickActionsFlowContext';
import { contentColumnMetrics } from '../../theme/nativeTokens';
import {
  DOCK_FLOATING_PAD_H,
  shellDockRowHeight,
  shellPrimaryActionBottomOffset,
} from '../platform/shellDockMetrics';
import {
  PlatformPrimaryAction,
  type PrimaryActionMenuItemId,
} from '../platform/PlatformPrimaryAction';

type PrimaryActionOverlayProps = {
  /**
   * Android: ref to the shell `BlurTargetView` so Modal blur can sample the
   * content behind the overlay (required for dimezis blur methods).
   */
  blurTargetRef?: RefObject<RNView | null>;
};

/**
 * Floating + control above the native tab bar with Calendar-style full-screen blur menu.
 */
export function PrimaryActionOverlay({ blurTargetRef }: PrimaryActionOverlayProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const fontScale = PixelRatio.getFontScale();
  const rowHeight = shellDockRowHeight(fontScale);
  const primarySize = rowHeight;
  const fabBottom = shellPrimaryActionBottomOffset(insets.bottom);
  const { sideInset, gutter } = contentColumnMetrics(windowWidth);
  const horizontalPad = Math.max(sideInset + gutter, DOCK_FLOATING_PAD_H);

  const { creatingJob, handlePrimaryAction } = useQuickActionsFlow();
  const hasLiveSession = useHasLiveSession();
  const hideBottomChrome = useShellChromeOptional()?.hideBottomChrome ?? false;
  const hidePrimaryAction = hasLiveSession || hideBottomChrome;

  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const openMenu = useCallback(() => setMenuOpen(true), []);

  const pendingActionRef = useRef<PrimaryActionMenuItemId | null>(null);
  const onSelectItem = useCallback(
    (id: PrimaryActionMenuItemId) => {
      pendingActionRef.current = id;
      setMenuOpen(false);
      if (Platform.OS !== 'android') {
        pendingActionRef.current = null;
        handlePrimaryAction(id);
        return;
      }
      // The FAB menu is itself a Modal. Opening Quick Note immediately stacks
      // a second Android Dialog and the sheet fights the keyboard (spasm).
      setTimeout(() => {
        const pending = pendingActionRef.current;
        pendingActionRef.current = null;
        if (pending) handlePrimaryAction(pending);
      }, 80);
    },
    [handlePrimaryAction],
  );

  if (hidePrimaryAction) {
    return null;
  }

  const primaryControl = (
    <PlatformPrimaryAction
      open={menuOpen}
      disabled={creatingJob}
      size={primarySize}
      onOpen={openMenu}
      onClose={closeMenu}
      onSelectMenuItem={onSelectItem}
    />
  );

  const stripPosition = {
    bottom: fabBottom,
    paddingRight: horizontalPad,
  } as const;

  const androidBlurReady = Platform.OS === 'android' && blurTargetRef != null;

  return (
    <>
      <View pointerEvents="box-none" style={styles.host} testID="primary-action-overlay">
        <View
          pointerEvents={menuOpen ? 'none' : 'box-none'}
          style={[styles.strip, stripPosition]}
        >
          {/* No fixed height box — menu must not clip when open in-modal. */}
          <View pointerEvents="box-none">{menuOpen ? null : primaryControl}</View>
        </View>
      </View>

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeMenu}
      >
        <View style={styles.modalRoot} testID="platform-primary-menu-modal">
          {/*
            Blur + dim are non-interactive so they never swallow dismiss taps
            (BlurView has been known to eat gestures on New Arch).
          */}
          <BlurView
            intensity={Platform.OS === 'ios' ? 64 : 64}
            tint="dark"
            pointerEvents="none"
            blurMethod={androidBlurReady ? 'dimezisBlurViewSdk31Plus' : undefined}
            blurTarget={androidBlurReady ? blurTargetRef : undefined}
            // Default Android factor is 4; 3 keeps blur visible without milky wash.
            blurReductionFactor={androidBlurReady ? 3 : undefined}
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="none" style={styles.dimOverlay} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss primary action menu"
            style={StyleSheet.absoluteFill}
            onPress={closeMenu}
          />

          <View pointerEvents="box-none" style={[styles.strip, stripPosition, { zIndex: 2 }]}>
            <View pointerEvents="box-none">{primaryControl}</View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    elevation: 100,
    overflow: 'visible',
  },
  strip: {
    position: 'absolute',
    right: 0,
    overflow: 'visible',
    elevation: 12,
  },
  modalRoot: {
    flex: 1,
  },
  dimOverlay: {
    ...StyleSheet.absoluteFill,
    // Same dark wash; Android transparency comes from weaker blur above, not a lighter dim.
    backgroundColor: 'rgba(20, 18, 16, 0.28)',
  },
});
