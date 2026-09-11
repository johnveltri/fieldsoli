import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

export type OverlaySlideAxis = 'horizontal' | 'vertical';

type OverlaySlideHostProps = {
  children: ReactNode;
  visible: boolean;
  axis: OverlaySlideAxis;
  onRequestClose: () => void;
  /** Called after the exit animation finishes (safe to unmount). */
  onExited?: () => void;
  /** Enable swipe-to-dismiss (edge swipe for horizontal, swipe down for vertical). */
  enableSwipeDismiss?: boolean;
  /**
   * When false, hide without the exit slide (child already animated off-screen).
   * @default true
   */
  exitAnimated?: boolean;
};

type OverlaySwipeLockContextValue = {
  /** Lock parent swipe-dismiss while a nested overlay is visible. Returns unlock. */
  lock: () => () => void;
};

const OverlaySwipeLockContext = createContext<OverlaySwipeLockContextValue | null>(null);

/**
 * Full-screen overlay with slide enter/exit and optional swipe dismiss.
 *
 * Nested hosts (e.g. Profile → Help) lock the parent swipe so an edge-swipe
 * only pops one level instead of closing the whole stack.
 */
export function OverlaySlideHost({
  children,
  visible,
  axis,
  onRequestClose,
  onExited,
  enableSwipeDismiss = true,
  exitAnimated = true,
}: OverlaySlideHostProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const hiddenOffset = axis === 'horizontal' ? windowWidth : windowHeight;
  const translate = useRef(new Animated.Value(hiddenOffset)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  const parentSwipeLock = useContext(OverlaySwipeLockContext);
  const [nestedLockCount, setNestedLockCount] = useState(0);
  const nestedOverlayOpen = nestedLockCount > 0;
  const nestedOverlayOpenRef = useRef(nestedOverlayOpen);
  nestedOverlayOpenRef.current = nestedOverlayOpen;

  useLayoutEffect(() => {
    // Lock for the full mount lifetime (including exit animation) so a swipe
    // that closes this overlay cannot continue into the parent overlay.
    if (!mounted || !parentSwipeLock) return;
    return parentSwipeLock.lock();
  }, [mounted, parentSwipeLock]);

  const swipeLockApi = useMemo<OverlaySwipeLockContextValue>(
    () => ({
      lock: () => {
        setNestedLockCount((count) => count + 1);
        return () => {
          setNestedLockCount((count) => Math.max(0, count - 1));
        };
      },
    }),
    [],
  );

  useLayoutEffect(() => {
    if (!visible) return;
    setMounted(true);
    drag.setValue(0);
    translate.setValue(hiddenOffset);
  }, [drag, hiddenOffset, translate, visible]);

  const onRequestCloseRef = useRef(onRequestClose);
  onRequestCloseRef.current = onRequestClose;
  /** When true, exit is already finished by the swipe animation — skip the snap+slide. */
  const closingFromSwipeRef = useRef(false);
  const exitAnimatedRef = useRef(exitAnimated);
  exitAnimatedRef.current = exitAnimated;

  useEffect(() => {
    if (visible) {
      closingFromSwipeRef.current = false;
      Animated.timing(translate, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }
    if (!mounted) return;

    if (closingFromSwipeRef.current || !exitAnimatedRef.current) {
      closingFromSwipeRef.current = false;
      // Swipe (or caller) already carried the sheet off-screen; settle and unmount.
      drag.setValue(0);
      translate.setValue(hiddenOffset);
      setMounted(false);
      onExited?.();
      return;
    }

    drag.setValue(0);
    Animated.timing(translate, {
      toValue: hiddenOffset,
      duration: 240,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setMounted(false);
        onExited?.();
      }
    });
  }, [drag, hiddenOffset, mounted, onExited, translate, visible]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_evt, gesture) => {
          if (!enableSwipeDismiss || !visibleRef.current || nestedOverlayOpenRef.current) {
            return false;
          }
          if (axis === 'horizontal') {
            return (
              gesture.x0 <= 28 &&
              gesture.dx > 6 &&
              Math.abs(gesture.dy) < Math.abs(gesture.dx) * 1.2
            );
          }
          return (
            gesture.dy > 6 &&
            Math.abs(gesture.dx) < Math.abs(gesture.dy) * 1.2 &&
            gesture.y0 <= 80
          );
        },
        onPanResponderMove: (_evt, gesture) => {
          const delta =
            axis === 'horizontal' ? Math.max(0, gesture.dx) : Math.max(0, gesture.dy);
          drag.setValue(delta);
        },
        onPanResponderRelease: (_evt, gesture) => {
          const delta = axis === 'horizontal' ? gesture.dx : gesture.dy;
          const velocity = axis === 'horizontal' ? gesture.vx : gesture.vy;
          const shouldClose = delta > hiddenOffset * 0.22 || velocity > 0.65;
          if (shouldClose) {
            const start = Math.max(0, delta);
            drag.setValue(start);
            const remaining = Math.max(1, hiddenOffset - start);
            const duration = Math.max(140, Math.min(280, remaining * 0.32));
            closingFromSwipeRef.current = true;
            Animated.timing(drag, {
              toValue: hiddenOffset,
              duration,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }).start(({ finished }) => {
              if (!finished) {
                closingFromSwipeRef.current = false;
                return;
              }
              onRequestCloseRef.current();
            });
            return;
          }
          Animated.spring(drag, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        },
        onPanResponderTerminate: () => {
          if (closingFromSwipeRef.current) return;
          Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
        },
      }),
    [axis, drag, enableSwipeDismiss, hiddenOffset],
  );

  if (!mounted) {
    return null;
  }

  const motion =
    axis === 'horizontal'
      ? { transform: [{ translateX: Animated.add(translate, drag) }] }
      : { transform: [{ translateY: Animated.add(translate, drag) }] };

  return (
    <OverlaySwipeLockContext.Provider value={swipeLockApi}>
      <View
        style={[styles.host, parentSwipeLock ? styles.hostNested : null]}
        {...panResponder.panHandlers}
      >
        <Animated.View style={[styles.fill, motion]}>{children}</Animated.View>
      </View>
    </OverlaySwipeLockContext.Provider>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFill,
    zIndex: 500,
    elevation: 500,
  },
  /** Nested overlays (Help/Privacy on Profile) stack above their parent host. */
  hostNested: {
    zIndex: 600,
    elevation: 600,
  },
  fill: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
