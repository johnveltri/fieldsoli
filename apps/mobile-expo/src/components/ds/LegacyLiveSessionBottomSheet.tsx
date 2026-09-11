import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { color, radius, space } from '@fieldsolo/design-system/lib/tokens';
import type { JobDetailSessionAttachment } from '@fieldsolo/shared-types';

import { bg, cardShadowRn, fg } from '../../theme/nativeTokens';
import type { TextStyles } from '../../theme/nativeTokens';
import {
  LiveSessionActiveDotIcon,
  SessionCardEditPencilIcon,
  SessionSheetBackIcon,
} from '../figma-icons/JobDetailScreenIcons';
import { BottomSheetShell } from './BottomSheetShell';
import { LiveSessionCaptureCard } from './LiveSessionCaptureCard';

type LiveSessionBottomSheetProps = {
  typography: TextStyles;
  visible: boolean;
  /** Job description shown above the live counter (per spec). */
  jobShortDescription: string;
  /** ISO 8601 timestamp the live session started at. Drives the timer. */
  startedAt: string;
  /** Merged note + material rows for this live session (from `fetchJobDetail`). */
  attachments: JobDetailSessionAttachment[];
  onAddNote: () => void;
  onAddMaterial: () => void;
  onPressAttachment: (item: { kind: 'note' | 'material'; id: string }) => void;
  /**
   * Minimize handler — fired by the back button, swipe-down, and scrim tap.
   * Per spec, the sheet does NOT fully close; it dismisses to the floating
   * minimized bar instead. The parent controls `visible` separately.
   */
  onMinimize: () => void;
  /** Animation-completed callback (forwarded to BottomSheetShell.onClosed). */
  onClosed?: () => void;
  /** Opens Edit Live Session (start/end times) from the capture card. */
  onEditPress: () => void;
  /** Opens Edit Job (name/customer/address/revenue) from the header. */
  onEditJobPress: () => void;
  onEndSessionPress: () => void;
};

/**
 * Live Session bottom sheet (Figma `1897:3091` — "Live Session Bottom Sheet").
 *
 * Owns its own dark `live-session-header` slab (back button + ACTIVE SESSION
 * pill + short description + 70px monospace counter) drawn flush to the rounded top
 * corners via `BottomSheetShell variant='fullbleedDark'`.
 *
 * The body holds a single `LiveSessionCaptureCard` (collapsible session info
 * + capture tiles) and a full-width END SESSION button.
 */
export function LegacyLiveSessionBottomSheet({
  typography,
  visible,
  jobShortDescription,
  startedAt,
  attachments,
  onAddNote,
  onAddMaterial,
  onPressAttachment,
  onMinimize,
  onClosed,
  onEditPress,
  onEditJobPress,
  onEndSessionPress,
}: LiveSessionBottomSheetProps) {
  const [expanded, setExpanded] = useState(true);
  const elapsed = useElapsedSeconds(startedAt, visible);

  // Date / "Started at: …" labels mirror the JobDetail SessionCard formatters
  // (see `packages/api-client/src/jobDetail.ts` `formatDateLabel` /
  // `formatTimeLabel`) so the live-session card reads identically to ended
  // session cards once the session ends.
  const startedDate = useMemo(() => new Date(startedAt), [startedAt]);
  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(startedDate),
    [startedDate],
  );
  const startedAtLabel = useMemo(
    () =>
      `Started at: ${new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      }).format(startedDate)}`,
    [startedDate],
  );

  return (
    <BottomSheetShell
      visible={visible}
      onClose={onMinimize}
      onClosed={onClosed}
      variant="fullbleedDark"
      // Cap at ~98% of the window — sheet grows with content up to this
      // height; inner `ScrollView` scrolls if needed. Slightly under 100% so
      // the sheet does not read as a full edge-to-edge cover over the status area.
      autoSizeUpToFraction={0.98}
      // Opt out of the global sheet-stack registry: the floating
      // MinimizedLiveSessionBar is owned by the *same* feature as this
      // sheet, so we don't want it trying to position itself above its
      // own parent sheet.
      registerInGlobalStack={false}
    >
      <View style={styles.dark}>
        <View style={styles.dragHandle} />
        <View style={styles.darkContent}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Minimize live session"
            onPress={onMinimize}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
            hitSlop={12}
          >
            <SessionSheetBackIcon color={color('Foundation/Surface/White')} />
            <Text style={[typography.bodyBold, styles.backLabel]}>Back</Text>
          </Pressable>

          <View style={styles.statusRow}>
            <View style={styles.statusIdentity}>
              <LiveSessionActiveDotIcon color={color('Brand/Accent')} size={11.5} />
              <Text style={[typography.labelCaps, styles.statusLabel]}>
                ACTIVE SESSION
              </Text>
            </View>
            <View style={styles.statusSpacer} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit job"
              onPress={onEditJobPress}
              style={({ pressed }) => [styles.headerEditButton, pressed && styles.pressed]}
            >
              <SessionCardEditPencilIcon color={fg.primary} />
              <Text style={[typography.pillCompact, styles.headerEditLabel]}>EDIT</Text>
            </Pressable>
          </View>

          <View style={styles.titleWrap}>
            <Text style={styles.title}>
              {jobShortDescription || 'Untitled job'}
            </Text>
          </View>

          <View style={styles.timerWrap}>
            <Text style={styles.timer}>{formatTimer(elapsed)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <LiveSessionCaptureCard
          typography={typography}
          dateLabel={dateLabel}
          startedAtLabel={startedAtLabel}
          expanded={expanded}
          onToggle={() => setExpanded((p) => !p)}
          onEditPress={onEditPress}
          attachments={attachments}
          onAddNote={onAddNote}
          onAddMaterial={onAddMaterial}
          onPressAttachment={onPressAttachment}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="End session"
          onPress={onEndSessionPress}
          style={({ pressed }) => [styles.endButton, pressed && styles.pressed]}
        >
          <Text style={styles.endButtonLabel}>END SESSION</Text>
        </Pressable>
      </View>
    </BottomSheetShell>
  );
}

/**
 * Hybrid timer label per spec: `MM:SS` for the first hour (so the live
 * counter ticks visibly during a quick visit), then `HH:MM:SS` once the
 * session crosses an hour. Always elides any fractional minute.
 */
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
 * Tick once per second while visible; pauses + resyncs when hidden so we
 * never burn timers for an off-screen sheet.
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
  // Dark header slab — Figma `1897:3113` "live-session-header"
  // (bg=Foundation/Border/Default, px=20, drag handle at top).
  // Top padding + handle margin match `BottomSheetShell` standard sheets
  // (`sheet.paddingTop` + `handle.marginBottom` = both Spacing/16) so the
  // drag handle sits the same distance from the sheet top as everywhere else.
  dark: {
    width: '100%',
    backgroundColor: color('Foundation/Border/Default'),
    paddingHorizontal: space('Spacing/20'),
    paddingTop: space('Spacing/16'),
    paddingBottom: space('Spacing/8'),
    overflow: 'hidden',
    alignItems: 'center',
  },
  dragHandle: {
    width: 40,
    height: 6,
    borderRadius: radius('Radius/Full'),
    backgroundColor: color('Brand/Accent'),
    marginBottom: space('Spacing/16'),
  },
  // Same vertical rhythm as standard `BottomSheetShell` modals: no extra
  // inset above the first row (Back) after the drag handle — those sheets
  // place Back immediately in `body` with no wrapper paddingTop. Use
  // `gap: Spacing/12` like `EditSessionBottomSheet` / `EditLiveSessionBottomSheet`
  // between Back and the header row below it.
  darkContent: {
    width: '100%',
    paddingHorizontal: space('Spacing/8'),
    paddingTop: 0,
    paddingBottom: space('Spacing/8'),
    gap: space('Spacing/12'),
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space('Spacing/4'),
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingRight: space('Spacing/8'),
  },
  backLabel: {
    color: color('Foundation/Surface/White'),
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 7,
  },
  statusIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  statusSpacer: {
    flex: 1,
    minWidth: 0,
  },
  statusLabel: {
    color: color('Foundation/Text/Muted'),
  },
  headerEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space('Spacing/8'),
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: space('Spacing/12'),
    paddingVertical: space('Spacing/8'),
    borderRadius: radius('Radius/12'),
    backgroundColor: bg.canvasWarm,
    ...cardShadowRn,
  },
  headerEditLabel: {
    color: fg.primary,
  },
  titleWrap: {
    width: '100%',
  },
  title: {
    fontFamily: 'PTSerif_700Bold',
    fontSize: 24,
    lineHeight: 30,
    color: color('Foundation/Surface/White'),
  },
  timerWrap: {
    width: '100%',
    alignItems: 'center',
    paddingTop: space('Spacing/4'),
  },
  timer: {
    fontFamily: 'Ubuntu_700Bold',
    fontSize: 70,
    lineHeight: 86,
    color: color('Foundation/Surface/White'),
    textAlign: 'center',
  },
  // Body — Figma `1897:3115` "live-session-body"; extra bottom inset so the
  // END SESSION button clears the sheet foot comfortable above safe area.
  // Explicit cream fill: fullbleed shell bg is the dark header blue.
  body: {
    width: '100%',
    backgroundColor: bg.canvasWarm,
    paddingHorizontal: space('Spacing/20'),
    paddingTop: space('Spacing/12'),
    paddingBottom: space('Spacing/32'),
    gap: space('Spacing/12'),
  },
  // END SESSION button — Figma `1287:1567` "Button XL" (Brand/Primary,
  // py=24 px=24, radius=12) with soft card lift.
  endButton: {
    ...cardShadowRn,
    width: '100%',
    backgroundColor: color('Brand/Primary'),
    borderRadius: radius('Radius/12'),
    paddingVertical: space('Spacing/24'),
    paddingHorizontal: space('Spacing/24'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  endButtonLabel: {
    fontFamily: 'Ubuntu_700Bold',
    fontSize: 18,
    lineHeight: 22,
    color: color('Foundation/Surface/White'),
    textAlign: 'center',
  },
  pressed: { opacity: 0.85 },
});
