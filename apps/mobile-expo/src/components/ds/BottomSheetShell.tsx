import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  type ScrollView,
  StyleSheet,
  useWindowDimensions,
  type KeyboardEvent,
  type LayoutChangeEvent,
  View,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CONTENT_COLUMN_MAX_WIDTH, contentGutter } from '@fieldsolo/design-system/lib/responsiveLayout';
import { color, radius, space } from '@fieldsolo/design-system/lib/tokens';

/**
 * Extra lift above the measured IME on Android so SAVE / END SESSION clear
 * Gboard’s candidate strip on physical devices (Galaxy S23). A prior downward
 * “nudge” after status-bar compensation clipped those CTAs under the keyboard.
 */
const ANDROID_IME_CTA_CLEARANCE = space('Spacing/12');

import { useBottomSheetStackWriters } from '../../context/BottomSheetStackContext';
import { announceAccessibilityMessage } from '../../lib/accessibility';
import { bg, border } from '../../theme/nativeTokens';
import { SheetChromeContext } from './sheetChromeContext';
import {
  PanGestureHandler,
  State,
  type PanGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler';
import {
  BottomSheetScrollProvider,
  BottomSheetScrollView,
} from './bottomSheetScrollContext';

const absoluteFill = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
} as const;

type BottomSheetShellVariant =
  | 'standard'
  | /**
   * Edge-to-edge live-session surface (full-page overlay, no sheet radius).
   * Children own the dark header; sheet fill is canvas-warm for the body + FAB.
     */
    'fullbleedDark';

type BottomSheetShellProps = {
  children: ReactNode;
  visible: boolean;
  extraBottomOffset?: number;
  onClose?: () => void;
  onClosed?: () => void;
  /**
   * Visual variant of the outer shell. Defaults to `'standard'` (cream
   * rounded surface + drag handle).
   */
  variant?: BottomSheetShellVariant;
  /**
   * Cap the sheet height at `fraction * window.height` and make the inner
   * content area vertically scrollable past that. The default is unset
   * (sheet grows with its children — same as before this prop existed).
   *
   * Used by the Live Session sheet which can extend essentially to the top
   * of the screen if its content requires it, and only scrolls once it
   * has reached its max height.
   */
  autoSizeUpToFraction?: number;
  /**
   * Whether this sheet should self-register with the global
   * `BottomSheetStackContext` so the floating live-session bar can hide
   * while this sheet is active. Defaults to `true` for app-level sheets. The Live
   * Session sheets themselves opt out (`false`) — otherwise they would hide
   * their own minimized bar during the sheet-to-bar transition.
   */
  registerInGlobalStack?: boolean;
  /**
   * Extra cream padding below sheet content (above the safe-area inset).
   * @default space('Spacing/4')
   */
  bottomPaddingExtra?: number;
  /**
   * Let child content own the bottom safe-area inset so a scroll viewport can
   * extend all the way to the physical screen edge. The child must include
   * the safe-area inset in its own content padding.
   * @default false
   */
  contentExtendsToBottomEdge?: boolean;
  /**
   * When the sheet opens, announced to VoiceOver / TalkBack (e.g. sheet title).
   */
  accessibilityTitle?: string;
  /**
   * Keeps a visible sheet rendered as a background layer while a nested
   * sheet owns touch and accessibility focus. Defaults to `true`.
   */
  interactionEnabled?: boolean;
  /**
   * Renders below the scroll viewport and stays pinned while content scrolls.
   * Used by Live Session for the End Session full-width FAB.
   */
  stickyFooter?: ReactNode;
  /** Optional owner ref for the internal scroll viewport. */
  scrollViewRef?: React.RefObject<ScrollView | null>;
};

/**
 * Reusable app-level bottom-sheet frame for edit/action flows.
 *
 * Includes scrim, top rounded shell (variant `standard`), drag handle, and
 * safe-area bottom padding. The Live Session sheet uses `variant='fullbleedDark'`
 * to draw its own dark header slab, and `autoSizeUpToFraction` to grow with
 * content while capping at the screen.
 */
export function BottomSheetShell({
  children,
  visible,
  extraBottomOffset = 0,
  onClose,
  onClosed,
  variant = 'standard',
  autoSizeUpToFraction,
  registerInGlobalStack = true,
  bottomPaddingExtra = space('Spacing/4'),
  contentExtendsToBottomEdge = false,
  accessibilityTitle,
  interactionEnabled = true,
  stickyFooter,
  scrollViewRef,
}: BottomSheetShellProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  /**
   * Android `adjustResize` shrinks `window` height when the IME is up. Sheets
   * in a Modal do not shrink with it, so using window height made maxHeight
   * and the open animation fight the keyboard. Screen height stays stable.
   */
  const layoutHeight =
    Platform.OS === 'android' ? Dimensions.get('screen').height : windowHeight;
  const sheetGutter = contentGutter(windowWidth);
  const sheetStack = useBottomSheetStackWriters();
  const sheetId = useId();
  const [stickyFooterHeight, setStickyFooterHeight] = useState(0);
  // Keep `onClose` in a ref so re-registering the sheet (when the prop
  // identity changes between renders) doesn't churn the global stack.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  // `onClosed` is commonly an inline callback that checks the parent's
  // current flow before unmounting a sheet. Keep the latest callback in a
  // ref so a parent render (for example, setting `saving`) does not restart
  // the native open/close animation just because that callback's identity
  // changed.
  const onClosedRef = useRef(onClosed);
  useEffect(() => {
    onClosedRef.current = onClosed;
  }, [onClosed]);
  // Use the window height as the hidden translate-Y. A hard-coded value
  // (previously 420) is unsafe because some sheets (e.g. DropdownBottomSheet
  // with 7+ preset rows + custom input) are taller than that — the hidden
  // sheet would still poke up above the bottom edge and visually cover the
  // footer / safe-area primary button of any sheet rendered below it in the
  // sibling stack.
  const hiddenOffset = layoutHeight;
  const translateY = useRef(new Animated.Value(hiddenOffset)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const scrimOpacity = useRef(new Animated.Value(0)).current;
  const forcedOffset = useRef(new Animated.Value(0)).current;
  const scrollOffsetY = useRef(0);
  const [scrollAtTop, setScrollAtTop] = useState(true);
  const panRef = useRef<PanGestureHandler>(null);

  /**
   * Tracks whether the sheet's natural content height exceeds the cap, so we
   * can switch the inner content area between "auto-size" and "scrollable
   * fixed-height" without freezing the sheet at full height when content is
   * short.
   */
  const [contentOverflow, setContentOverflow] = useState(false);

  /**
   * Tracks whether a software keyboard actually covers the bottom inset. A
   * hardware keyboard can still emit a focus/show event with a zero-height
   * frame; in that case the sheet must retain its cream safe-area fill.
   */
  const [keyboardCoversSafeArea, setKeyboardCoversSafeArea] = useState(false);
  /**
   * Some Android IMEs reserve a short bottom band for a floating toolbar.
   * Keep that band painted with the sheet surface rather than exposing the
   * dimmed screen below the modal.
   */
  const [keyboardReservedHeight, setKeyboardReservedHeight] = useState(0);
  /**
   * Keep the overlay in the elevated stacking band while a sheet is open or
   * playing its close animation. Drop back to flat once fully hidden so
   * invisible full-screen overlays do not occlude the shell FAB / minimized
   * live-session bar on Android (elevation-based compositing).
   */
  const [stackingElevated, setStackingElevated] = useState(visible);
  /** When true, swipe already carried the sheet off-screen — skip snap+slide on close. */
  const closingFromSwipeRef = useRef(false);

  const hiddenOffsetRef = useRef(hiddenOffset);
  hiddenOffsetRef.current = hiddenOffset;

  useEffect(() => {
    if (visible) {
      closingFromSwipeRef.current = false;
      setStackingElevated(true);
      dragY.setValue(0);
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scrimOpacity, {
          toValue: 0.3,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    const offset = hiddenOffsetRef.current;
    if (closingFromSwipeRef.current) {
      closingFromSwipeRef.current = false;
      dragY.setValue(0);
      translateY.setValue(offset);
      scrimOpacity.setValue(0);
      setStackingElevated(false);
      onClosedRef.current?.();
      return;
    }

    // Drop elevation immediately. Waiting for the close animation left a
    // full-screen Android overlay (elevation 1000) over Inbox when `finished`
    // was false.
    setStackingElevated(false);
    dragY.setValue(0);
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: offset,
        duration: 210,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scrimOpacity, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setStackingElevated(false);
      onClosedRef.current?.();
    });
    // `hiddenOffset` is read from a ref so keyboard / NativeTabs inset changes
    // do not restart the open animation (that loop looked like a spasming sheet).
  }, [dragY, scrimOpacity, translateY, visible]);

  const wasVisibleRef = useRef(visible);
  useEffect(() => {
    const becameHidden = wasVisibleRef.current && !visible;
    wasVisibleRef.current = visible;
    // Any close path (scrim, swipe, child Back) must drop the IME — not only
    // dismissSheet. Otherwise Update Profile Back leaves the keyboard up.
    if (becameHidden) {
      Keyboard.dismiss();
    }
    if (visible || becameHidden) return;
    translateY.setValue(hiddenOffset);
  }, [hiddenOffset, translateY, visible]);

  const prevVisibleRef = useRef(visible);
  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      announceAccessibilityMessage(accessibilityTitle);
    }
    prevVisibleRef.current = visible;
  }, [accessibilityTitle, visible]);

  useEffect(() => {
    Animated.timing(forcedOffset, {
      toValue: Math.max(0, extraBottomOffset),
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [extraBottomOffset, forcedOffset]);

  // ---- Global stack registration -------------------------------------------
  // Sheets register from open through the end of their close animation so
  // the LiveSessionOverlay hides its floating bar for the entire transition.
  // Live-session sheets opt out via `registerInGlobalStack={false}`.
  const sheetActive = visible || stackingElevated;
  useEffect(() => {
    if (!sheetStack || !registerInGlobalStack || !sheetActive) return;
    const unregister = sheetStack.registerSheet(sheetId, {
      onRequestClose: () => onCloseRef.current?.(),
    });
    return unregister;
  }, [registerInGlobalStack, sheetActive, sheetId, sheetStack]);

  // Reports the rendered sheet's top edge (window-relative) every time the
  // inner Animated.View lays out so the registry can identify the topmost
  // sheet. We compute this from the sheet's measured height + the known
  // window height since the sheet is anchored to the bottom of the window.
  const handleSheetLayout = useCallback(
    (e: LayoutChangeEvent) => {
      if (!sheetStack || !registerInGlobalStack || !visible) return;
      const measuredHeight = e.nativeEvent.layout.height;
      const topY = Math.max(0, windowHeight - measuredHeight);
      sheetStack.setSheetTop(sheetId, topY);
    },
    [registerInGlobalStack, sheetId, sheetStack, visible, windowHeight],
  );

  // Keyboard events (including iOS QuickType frame changes) are the single
  // IME height source for overlay sticky footers. Standard iOS sheets still
  // also use KeyboardAvoidingView padding; fullbleed overlays do not — KAV
  // undercounts the suggestion bar and then fights this explicit lift.
  useEffect(() => {
    const onFrame = (event: KeyboardEvent) => {
      // Off-screen keyboard frames still report a non-zero height on iOS.
      // Prefer the overlap with the window so a dismissed IME does not keep
      // the live-session header/footer shifted.
      // Android Modal sheets do not shrink with adjustResize — compare against
      // screen height so suggestion-bar IME is not under-counted.
      const { height, screenY } = event.endCoordinates;
      const frameHeight =
        Platform.OS === 'android' ? Dimensions.get('screen').height : windowHeight;
      // Inside Android Modals, keyboard `screenY` is often shifted down by the
      // status-bar/cutout. Without compensating, pad lands short and CTAs sit
      // under Gboard (measured ~insets.top on Pixel).
      const screenYForOverlap =
        typeof screenY === 'number'
          ? screenY - (Platform.OS === 'android' ? insets.top : 0)
          : null;
      const overlapFromScreenY =
        screenYForOverlap != null ? Math.max(0, frameHeight - screenYForOverlap) : 0;
      // Prefer the larger signal: one of height / screenY often under-counts
      // Gboard's candidate strip inside Android Modals.
      const visibleIme = Math.max(0, height, overlapFromScreenY);
      // Keep CTAs fully above the IME (plus a small clearance). Do not subtract
      // from visibleIme — that clipped Profile SAVE / End Session on S23.
      const reservedHeight =
        Platform.OS === 'android' && visibleIme > 0
          ? visibleIme + ANDROID_IME_CTA_CLEARANCE
          : visibleIme;
      setKeyboardReservedHeight(reservedHeight);
      setKeyboardCoversSafeArea(reservedHeight > insets.bottom);
    };
    const onHide = () => {
      setKeyboardReservedHeight(0);
      setKeyboardCoversSafeArea(false);
    };
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, onFrame);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    const changeSub =
      Platform.OS === 'ios'
        ? Keyboard.addListener('keyboardWillChangeFrame', onFrame)
        : null;
    return () => {
      showSub.remove();
      hideSub.remove();
      changeSub?.remove();
    };
  }, [insets.bottom, insets.top, windowHeight]);

  const isFullbleed = variant === 'fullbleedDark';

  // Cap the OUTER sheet view at this height when the caller opts in. We
  // reserve the keyboard offset / extra offset slots same as the existing
  // translate logic — the sheet's max useful height shrinks when the keyboard
  // is up so primary actions stay reachable. Bottom inset is part of the
  // sheet's internal padding (see `paddingBottom` below) and is included in
  // the cap.
  const maxSheetHeight = isFullbleed
    ? layoutHeight + Math.max(0, insets.top)
    : autoSizeUpToFraction
      ? Math.max(160, layoutHeight * autoSizeUpToFraction)
      : undefined;

  // A real software keyboard covers the home-indicator / safe-area region, so
  // collapse our own padding to keep the primary CTA flush above it. A
  // zero-height hardware-keyboard event retains the cream safe-area fill.
  // Android cannot use KeyboardAvoidingView `height` here: it remounts on
  // IME hide and fights adjustResize, which makes focused sheets spasm.
  const effectiveSafeBottom = keyboardCoversSafeArea ? 0 : insets.bottom;
  const androidKeyboardPad =
    Platform.OS === 'android' && keyboardReservedHeight > 0
      ? keyboardReservedHeight
      : 0;
  // Overlay footers pin to the IME on both platforms (Android cannot use KAV
  // `height`; iOS KAV misses QuickType). Standard sheets keep iOS KAV padding.
  const overlayKeyboardPad =
    stickyFooter && variant === 'fullbleedDark' && keyboardReservedHeight > 0
      ? keyboardReservedHeight
      : 0;

  // The inner scrollview becomes height-locked when content overflows. We
  // approximate the available content height by subtracting the chrome we
  // own (handle area, safe-area bottom). Children own their padding when
  // `fullbleedDark`, so the only overhead there is the safe-area bottom.
  const shellBottomPadding = contentExtendsToBottomEdge
    ? 0
    : androidKeyboardPad + effectiveSafeBottom + bottomPaddingExtra;
  // Fullbleed sticky footers overlay the scroll viewport (gradient FAB) so
  // chrome height stays zero for scroll sizing — content pads itself instead.
  const stickyOverlaysScroll = Boolean(stickyFooter && isFullbleed);
  const sheetChromeHeight = isFullbleed
    ? stickyOverlaysScroll
      ? overlayKeyboardPad
      : (stickyFooter ? stickyFooterHeight : effectiveSafeBottom) + bottomPaddingExtra + androidKeyboardPad
    : space('Spacing/12') /* paddingTop */ +
      space('Spacing/12') /* handleHitArea paddingBottom */ +
      6 /* handle h */ +
      shellBottomPadding +
      stickyFooterHeight;

  const scrollViewMaxHeight =
    maxSheetHeight != null ? Math.max(0, maxSheetHeight - sheetChromeHeight) : undefined;

  const dismissSheet = useCallback(() => {
    Keyboard.dismiss();
    onCloseRef.current?.();
  }, []);

  const onPanGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: dragY } }],
    {
      useNativeDriver: true,
      listener: (event: { nativeEvent: { translationY: number } }) => {
        const ty = event.nativeEvent.translationY;
        if (ty < 0 || scrollOffsetY.current > 4) {
          dragY.setValue(0);
        }
      },
    },
  );

  const onPanHandlerStateChange = useCallback(
    (event: PanGestureHandlerStateChangeEvent) => {
      const { state, oldState, translationY, velocityY } = event.nativeEvent;
      if (oldState === State.ACTIVE) {
        if (scrollOffsetY.current > 4) {
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
          return;
        }
        if (translationY > 72 || velocityY > 800) {
          const start = Math.max(0, translationY);
          dragY.setValue(start);
          const remaining = Math.max(1, hiddenOffset - start);
          const duration = Math.max(140, Math.min(280, remaining * 0.32));
          closingFromSwipeRef.current = true;
          Animated.parallel([
            Animated.timing(dragY, {
              toValue: hiddenOffset,
              duration,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(scrimOpacity, {
              toValue: 0,
              duration: Math.min(180, duration),
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
          ]).start(({ finished }) => {
            if (!finished) {
              closingFromSwipeRef.current = false;
              return;
            }
            dismissSheet();
          });
          return;
        }
        Animated.spring(dragY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 0,
        }).start();
      }
      if (state === State.BEGAN) {
        if (!closingFromSwipeRef.current) {
          dragY.setValue(0);
        }
      }
    },
    [dismissSheet, dragY, hiddenOffset, scrimOpacity],
  );

  const onScrollOffsetChange = useCallback((offsetY: number) => {
    const atTop = offsetY <= 4;
    setScrollAtTop((prev) => (prev === atTop ? prev : atTop));
  }, []);

  // Bleed into the status bar only. Never bleed below the host — sheets that
  // sit in `shellMain` (above the tab bar) would otherwise paint scrim over
  // the nav as a solid grey band under the sheet.
  const overlayBleedStyle = useMemo(
    () => ({
      top: -insets.top,
    }),
    [insets.top],
  );

  // When the sheet is hidden we still keep the view tree mounted so the slide-down
  // animation can play, but taps must pass through to whatever is behind us —
  // otherwise stacking two sheets (e.g. chooser + edit) swallows the active sheet's
  // taps via the inactive sheet's scrim Pressable.
  const sheetChrome = useMemo(
    () => ({
      keyboardCoversSafeArea,
      keyboardReservedHeight,
      stickyFooterHeight,
    }),
    [keyboardCoversSafeArea, keyboardReservedHeight, stickyFooterHeight],
  );

  const interactive = visible && interactionEnabled;
  // `absoluteFill` sets top/right/bottom/left, which ignores width/height on
  // Android — so a "collapsed" overlay still filled the window and ate Inbox taps.
  const overlayCollapsed = !visible;
  return (
    <View
      testID="bottom-sheet-overlay"
      collapsable={false}
      style={[
        overlayCollapsed ? styles.overlayCollapsed : styles.overlay,
        overlayCollapsed
          ? null
          : stackingElevated
            ? styles.overlayElevated
            : styles.overlayFlat,
      ]}
      pointerEvents={interactive ? 'box-none' : 'none'}
      accessibilityViewIsModal={interactive}
      accessibilityElementsHidden={!interactive}
      importantForAccessibility={interactive ? 'yes' : 'no-hide-descendants'}
    >
      {/* Scrim sits in its OWN absolutely-positioned layer so it covers
          the full screen (including the area behind the keyboard) — keeps
          tap-to-dismiss working everywhere outside the sheet.
          Bleed into system bars on Android without expanding the sheet host. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close bottom sheet"
        onPress={dismissSheet}
        style={[absoluteFill, isFullbleed ? null : overlayBleedStyle]}
        pointerEvents={interactive ? 'auto' : 'none'}
      >
        <Animated.View style={[styles.scrim, { opacity: scrimOpacity }]} />
      </Pressable>
      {/* Android lays the flex-end sheet above its system navigation inset,
          and some IMEs reserve a short floating-toolbar band. The overlay
          spans both, so paint the larger exposed bottom area with the sheet
          surface rather than exposing the dimmed screen below the modal. */}
      <View
        testID="bottom-sheet-bottom-fill"
        pointerEvents="none"
        style={[
          styles.bottomFill,
          {
            // Sheet padding owns the Android IME lift; painting the full keyboard
            // height here stacks a cream band above the IME.
            height: visible && !keyboardCoversSafeArea ? insets.bottom : 0,
            backgroundColor: bg.canvasWarm,
          },
        ]}
      />
      {/* Standard iOS sheets: KAV padding. Fullbleed overlay footers lift with
          keyboardReservedHeight instead — KAV misses the QuickType bar.
          Android never uses KAV `height` (remount/autoFocus loop). */}
      <KeyboardAvoidingView
        style={[styles.kav, isFullbleed ? styles.kavFullbleed : null]}
        behavior={Platform.OS === 'ios' && !isFullbleed ? 'padding' : undefined}
        pointerEvents="box-none"
      >
        <SheetChromeContext.Provider value={sheetChrome}>
        <BottomSheetScrollProvider
          onDismiss={dismissSheet}
          scrollOffsetYRef={scrollOffsetY}
          onScrollOffsetChange={onScrollOffsetChange}
        >
          <PanGestureHandler
            ref={panRef}
            enabled={interactive && scrollAtTop}
            activeOffsetY={10}
            failOffsetY={-5}
            failOffsetX={[-24, 24]}
            onGestureEvent={onPanGestureEvent}
            onHandlerStateChange={onPanHandlerStateChange}
          >
            <Animated.View
              testID="bottom-sheet-surface"
              onLayout={handleSheetLayout}
              collapsable={false}
              style={[
                isFullbleed ? styles.fullbleedPan : null,
                isFullbleed ? styles.sheetFullbleed : styles.sheet,
                !isFullbleed ? { paddingHorizontal: sheetGutter } : null,
                {
                  paddingBottom: isFullbleed ? 0 : shellBottomPadding,
                  maxHeight: isFullbleed ? undefined : maxSheetHeight,
                  flexGrow: isFullbleed ? 1 : undefined,
                  alignSelf: 'stretch',
                  transform: [
                    {
                      translateY: Animated.add(
                        Animated.add(translateY, dragY),
                        Animated.multiply(forcedOffset, -1),
                      ),
                    },
                  ],
                },
              ]}
              pointerEvents={interactive ? 'auto' : 'none'}
            >
              {!isFullbleed ? (
                <View style={styles.handleHitArea}>
                  <View style={styles.handle} />
                </View>
              ) : null}
              {scrollViewMaxHeight != null ? (
                <BottomSheetScrollView
                  scrollViewRef={scrollViewRef as React.RefObject<ScrollView>}
                  waitFor={scrollAtTop ? panRef : undefined}
                  style={{ maxHeight: scrollViewMaxHeight }}
                  contentContainerStyle={[
                    isFullbleed ? null : styles.contentContainer,
                    stickyOverlaysScroll && stickyFooterHeight + overlayKeyboardPad > 0
                      ? { paddingBottom: stickyFooterHeight + overlayKeyboardPad }
                      : null,
                  ]}
                  scrollEnabled={
                    contentOverflow ||
                    overlayKeyboardPad > 0 ||
                    Platform.OS === 'android'
                  }
                  showsVerticalScrollIndicator={contentOverflow}
                  scrollEventThrottle={16}
                  nestedScrollEnabled
                  onContentSizeChange={(_w, h) => {
                    setContentOverflow(h > scrollViewMaxHeight);
                  }}
                  keyboardShouldPersistTaps="handled"
                >
                  {isFullbleed ? children : <View style={styles.content}>{children}</View>}
                </BottomSheetScrollView>
              ) : isFullbleed ? (
                children
              ) : (
                <View style={styles.content}>{children}</View>
              )}
              {stickyFooter ? (
                <View
                  testID="bottom-sheet-sticky-footer"
                  pointerEvents="box-none"
                  onLayout={(event) => {
                    const next = Math.ceil(event.nativeEvent.layout.height);
                    setStickyFooterHeight((prev) => (prev === next ? prev : next));
                  }}
                  style={
                    stickyOverlaysScroll
                      ? [
                          styles.stickyFooterOverlay,
                          overlayKeyboardPad > 0 ? { bottom: overlayKeyboardPad } : null,
                        ]
                      : undefined
                  }
                >
                  {stickyFooter}
                </View>
              ) : null}
            </Animated.View>
          </PanGestureHandler>
        </BottomSheetScrollProvider>
        </SheetChromeContext.Provider>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...absoluteFill,
    justifyContent: 'flex-end',
  },
  overlayElevated: {
    zIndex: 1000,
    elevation: 1000,
  },
  overlayFlat: {
    zIndex: 0,
    elevation: 0,
  },
  overlayCollapsed: {
    position: 'absolute',
    width: 0,
    height: 0,
    overflow: 'hidden',
    zIndex: -1,
    elevation: 0,
  },
  /**
   * `KeyboardAvoidingView` host. Fills the overlay (so its `flex-end`
   * justification anchors the sheet to the bottom of whatever space is left
   * after the keyboard takes its share). The KAV adds bottom padding on iOS
   * and reduces this host's height on Android.
   */
  kav: {
    ...absoluteFill,
    justifyContent: 'flex-end',
  },
  kavFullbleed: {
    justifyContent: 'flex-start',
  },
  fullbleedPan: {
    flex: 1,
    alignSelf: 'stretch',
  },
  scrim: {
    ...absoluteFill,
    backgroundColor: color('Foundation/Text/Primary'),
    opacity: 0.3,
  },
  bottomFill: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
  },
  sheet: {
    borderTopLeftRadius: radius('Radius/32'),
    borderTopRightRadius: radius('Radius/32'),
    borderTopWidth: 1,
    borderTopColor: border.subtle,
    backgroundColor: bg.canvasWarm,
    paddingTop: space('Spacing/12'),
    // Horizontal inset comes from the shared responsive gutter at runtime.
  },
  /** Larger touch target for swipe-down dismiss (handle + padding). */
  handleHitArea: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingBottom: space('Spacing/12'),
  },
  /**
   * Full-page live-session surface: edge-to-edge, no sheet radius, so the
   * dark header covers the status bar instead of leaving the tab behind it.
   */
  sheetFullbleed: {
    overflow: 'hidden',
    backgroundColor: bg.canvasWarm,
  },
  stickyFooterOverlay: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 6,
    borderRadius: radius('Radius/Full'),
    backgroundColor: color('Foundation/Text/Primary'),
    opacity: 0.2,
  },
  content: {
    width: '100%',
    alignSelf: 'center',
    maxWidth: CONTENT_COLUMN_MAX_WIDTH,
  },
  contentContainer: {
    alignItems: 'center',
  },
});
