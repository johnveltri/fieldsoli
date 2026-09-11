import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { color, radius, space } from '@fieldsolo/design-system/lib/tokens';

import { cardShadowRn, type TextStyles } from '../../theme/nativeTokens';
import {
  LiveSessionActiveDotIcon,
  LiveSessionMinimizedExpandIcon,
} from '../figma-icons/JobDetailScreenIcons';

type MinimizedLiveSessionBarProps = {
  typography: TextStyles;
  /**
   * Drives the enter / exit animation. When `false`, the bar fades and
   * eases-down to the bottom edge before unmounting visually (the parent
   * keeps it in the tree so the morph feels continuous between the live
   * session sheet and the bar). Defaults to `true` to preserve the
   * pre-animation behavior for any existing callers.
   */
  visible?: boolean;
  /** Job description shown on the bar (per spec). */
  jobShortDescription: string;
  /** ISO 8601 timestamp the live session started at — drives the timer. */
  startedAt: string;
  /** Tap handler — re-opens the full LiveSessionBottomSheet. */
  onPress: () => void;
};

/**
 * Floating "minimized" Live Session dock (Figma `1287:1561` — "Minimized").
 *
 * Replaces the JobsScreen "New Job" FAB while a live session is in progress
 * and floats above all other screens. Tapping it re-opens the full sheet.
 *
 * The bar owns its own enter/exit animation (opacity + small translateY +
 * subtle scale) so that the transition between the full Live Session
 * bottom sheet and the bar — and back — reads as a smooth morph rather
 * than a hard swap. The parent (`LiveSessionOverlay`) keeps the bar
 * mounted whenever a live session exists and just toggles `visible`.
 */
export function MinimizedLiveSessionBar({
  typography,
  visible = true,
  jobShortDescription,
  startedAt,
  onPress,
}: MinimizedLiveSessionBarProps) {
  const elapsed = useElapsedSeconds(startedAt, visible);

  // Single 0..1 progress drives opacity, translateY, and scale together so
  // the morph feels coordinated. Use the native driver — these are pure
  // transform / opacity properties.
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;

  // Track whether we are currently animated to "shown" so we can flip
  // pointerEvents off as soon as we begin hiding (no stale taps).
  const [interactive, setInteractive] = useState<boolean>(visible);

  useEffect(() => {
    if (visible) setInteractive(true);
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? 220 : 180,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setInteractive(false);
    });
  }, [progress, visible]);

  const opacity = progress;
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0],
  });
  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1],
  });

  return (
    <Animated.View
      style={[
        styles.animationWrap,
        { opacity, transform: [{ translateY }, { scale }] },
      ]}
      pointerEvents={interactive ? 'box-none' : 'none'}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open live session"
        onPress={onPress}
        style={({ pressed }) => [styles.bar, pressed && styles.pressed]}
      >
        <View style={styles.main}>
          <View style={styles.copy}>
            <View style={styles.labelRow}>
              <LiveSessionActiveDotIcon color={color('Brand/Accent')} size={13.5} />
              <Text style={[typography.labelCaps, styles.label]}>ACTIVE SESSION</Text>
            </View>
            <Text
              style={[typography.bodyBold, styles.title]}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {jobShortDescription || 'Untitled job'}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Text style={styles.timer}>{formatTimer(elapsed)}</Text>
          <View style={styles.expandIcon}>
            <LiveSessionMinimizedExpandIcon color={color('Foundation/Surface/White')} />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** Same `MM:SS` / `HH:MM:SS` format as the full sheet for visual parity. */
function formatTimer(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hh = Math.floor(safe / 3600);
  const mm = Math.floor((safe % 3600) / 60);
  const ss = safe % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hh === 0) return `${pad(mm)}:${pad(ss)}`;
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

/**
 * Tick once per second while the bar is on-screen. We pause the interval
 * when `active` is false so we don't burn timers for an off-screen bar.
 */
function useElapsedSeconds(startedAt: string, active: boolean): number {
  const startMs = useMemo(() => new Date(startedAt).getTime(), [startedAt]);
  const initial = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
  const [seconds, setSeconds] = useState(initial);

  useEffect(() => {
    setSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    if (!active) return;
    const id = setInterval(() => {
      setSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [active, startMs]);

  return seconds;
}

const styles = StyleSheet.create({
  // Animation wrapper — keeps the bar laid out at full size at all times
  // (so the parent's anchor / center alignment stays stable) and just
  // composites opacity + transform on top.
  animationWrap: {
    width: '100%',
    alignItems: 'center',
  },
  // Fill the shared content column so the minimized session aligns with the
  // job cards behind it. Shadow matches the JobsScreen "+ New Job" FAB.
  bar: {
    width: '100%',
    minHeight: 67.5,
    paddingHorizontal: space('Spacing/16'),
    paddingVertical: space('Spacing/8'),
    backgroundColor: color('Foundation/Border/Default'),
    borderRadius: radius('Radius/16'),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space('Spacing/12'),
    ...cardShadowRn,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  label: {
    color: 'rgba(255,255,255,0.7)',
  },
  title: {
    color: color('Foundation/Text/Muted'),
    marginLeft: 24.5,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space('Spacing/8'),
  },
  timer: {
    fontFamily: 'Ubuntu_700Bold',
    fontSize: 18,
    lineHeight: 22,
    color: color('Foundation/Background/CanvasWarm'),
  },
  expandIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.92 },
});
