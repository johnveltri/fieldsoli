import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { color, radius, space } from '@fieldsolo/design-system/lib/tokens';

import { bg, border, fg } from '../../theme/nativeTokens';
import type { TextStyles } from '../../theme/nativeTokens';
import {
  SessionEditClockIcon,
  SessionSheetBackIcon,
} from '../figma-icons/JobDetailScreenIcons';
import { BottomSheetShell } from './BottomSheetShell';
import { InlineMonthCalendar } from './InlineMonthCalendar';
import { screenHeaderA11y } from '../../lib/accessibility';
import { SheetPrimaryDeleteActions } from './SheetPrimaryDeleteActions';

export type EditLiveSessionSavePayload =
  | {
      kind: 'updateStart';
      /** ISO 8601 — new started_at; live counter resets from here. */
      startedAt: string;
    }
  | {
      kind: 'endSession';
      /** ISO 8601 — new started_at (may be unchanged). */
      startedAt: string;
      /** ISO 8601 — user-provided end time; ends the session immediately. */
      endedAt: string;
    };

type EditLiveSessionBottomSheetProps = {
  typography: TextStyles;
  visible: boolean;
  /** Current started_at (ISO 8601). Sheet seeds its date+time fields from this. */
  startedAt: string;
  onClose?: () => void;
  onClosed?: () => void;
  /** Back arrow — returns to LiveSessionBottomSheet without saving. */
  onBack?: () => void;
  /** Save button — branches on whether the user supplied an end time. */
  onSavePress?: (payload: EditLiveSessionSavePayload) => void;
  /** Trash icon — deletes the live session and returns to job detail. */
  onDeletePress?: () => void;
};

type PickerKind = 'date' | 'startTime' | 'endTime';

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function combineDateAndTime(dateSource: Date, timeSource: Date): Date {
  const out = new Date(dateSource);
  out.setHours(timeSource.getHours(), timeSource.getMinutes(), 0, 0);
  return out;
}

const dateFmt = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Matches Figma label `02 : 00 PM` (spaces around the colon). */
function formatTimeLabel(d: Date): string {
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  const mm = minutes.toString().padStart(2, '0');
  const hh = h12.toString().padStart(2, '0');
  return `${hh} : ${mm} ${period}`;
}

/**
 * Edit Live Session sheet (Figma `1897:3757` — "Edit Live Session").
 *
 * Differs from `EditSessionBottomSheet` in two important ways:
 *   1. `End Time` is OPTIONAL and starts EMPTY, with placeholder
 *      "Editing will End Live Session". If the user picks an end time and
 *      saves, the session ends immediately (`onSavePress` returns
 *      `{ kind: 'endSession' }`).
 *   2. Otherwise saving is a partial update — only date + start time —
 *      and the parent should reset the live counter from the new start
 *      (`onSavePress` returns `{ kind: 'updateStart' }`).
 *
 * The trash icon hard-deletes the live session row (parent navigates back
 * to the job detail page). Tapping the scrim or swiping down minimizes the
 * live session WITHOUT saving the edit fields — that wiring lives in the
 * parent `onClose` handler.
 */
export function EditLiveSessionBottomSheet({
  typography,
  visible,
  startedAt,
  onClose,
  onClosed,
  onBack,
  onSavePress,
  onDeletePress,
}: EditLiveSessionBottomSheetProps) {
  const initialDate = useMemo(
    () => startOfDay(new Date(startedAt)),
    [startedAt],
  );
  const initialStart = useMemo(() => new Date(startedAt), [startedAt]);

  const [date, setDate] = useState<Date>(initialDate);
  const [startTime, setStartTime] = useState<Date>(initialStart);
  /** Null until the user explicitly picks an end time. */
  const [endTime, setEndTime] = useState<Date | null>(null);
  /** Spinner seed for optional end time; opening the picker alone is not a selection. */
  const [draftEndTime, setDraftEndTime] = useState<Date | null>(null);
  const [timeError, setTimeError] = useState<string | null>(null);
  const [activePicker, setActivePicker] = useState<PickerKind | null>(null);

  // Re-seed every time the sheet opens so reopening after a minimize→edit
  // cycle reflects any start-time change made elsewhere.
  useEffect(() => {
    if (!visible) return;
    setDate(initialDate);
    setStartTime(initialStart);
    setEndTime(null);
    setDraftEndTime(null);
    setTimeError(null);
    setActivePicker(null);
  }, [initialDate, initialStart, visible]);

  const applyPick = useCallback((kind: PickerKind, picked: Date) => {
    if (kind === 'date') {
      setDate(startOfDay(picked));
    } else if (kind === 'startTime') {
      setStartTime(picked);
    } else {
      setEndTime(picked);
    }
  }, []);

  const openPicker = useCallback(
    (kind: PickerKind) => {
      const fallback = kind === 'endTime' ? new Date() : startTime;
      const current =
        kind === 'date'
          ? date
          : kind === 'startTime'
            ? startTime
            : (endTime ?? draftEndTime ?? fallback);

      // Android DateTimePicker is dialog-only; date uses our month grid.
      if (Platform.OS === 'android' && kind !== 'date') {
        DateTimePickerAndroid.open({
          value: current,
          mode: 'time',
          is24Hour: false,
          onChange: (event: DateTimePickerEvent, selectedDate?: Date) => {
            if (event.type === 'dismissed' || !selectedDate) return;
            applyPick(kind, selectedDate);
          },
        });
        return;
      }

      // Opening end-time without a value seeds the spinner with `now`, kept
      // separate from `endTime` so merely opening does not end the session.
      if (kind === 'endTime') setDraftEndTime(current);
      setActivePicker((prev) => (prev === kind ? null : kind));
    },
    [applyPick, date, draftEndTime, endTime, startTime],
  );

  const handleTimeChange = useCallback(
    (_event: DateTimePickerEvent, selectedDate?: Date) => {
      if (!activePicker || activePicker === 'date' || !selectedDate) return;
      if (activePicker === 'endTime') {
        setDraftEndTime(selectedDate);
        setEndTime(selectedDate);
        return;
      }
      applyPick(activePicker, selectedDate);
    },
    [activePicker, applyPick],
  );

  const handleSave = useCallback(() => {
    setTimeError(null);
    const startedAtDate = combineDateAndTime(date, startTime);
    if (startedAtDate.getTime() > Date.now()) {
      setTimeError("Start time can't be in the future.");
      return;
    }
    const startedAtIso = startedAtDate.toISOString();
    if (endTime) {
      const endedAtDate = combineDateAndTime(date, endTime);
      if (endedAtDate.getTime() < startedAtDate.getTime()) {
        setTimeError('End time must be after the start time.');
        return;
      }
      const endedAtIso = endedAtDate.toISOString();
      onSavePress?.({ kind: 'endSession', startedAt: startedAtIso, endedAt: endedAtIso });
      return;
    }
    onSavePress?.({ kind: 'updateStart', startedAt: startedAtIso });
  }, [date, endTime, onSavePress, startTime]);

  const timePickerValue =
    activePicker === 'startTime'
      ? startTime
      : activePicker === 'endTime'
        ? (draftEndTime ?? endTime ?? new Date())
        : null;

  return (
    <BottomSheetShell
      visible={visible}
      onClose={onClose}
      onClosed={onClosed}
      // See LiveSessionBottomSheet — Live Session sheets opt out of the
      // global stack registry so the floating bar isn't lifted above its
      // own parent sheet.
      registerInGlobalStack={false}
    >
      <View style={styles.body}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack ?? onClose}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <SessionSheetBackIcon color={fg.secondary} />
          <Text style={[typography.bodyBold, { color: fg.secondary }]}>Back</Text>
        </Pressable>

        <View style={styles.header}>
          <SessionEditClockIcon color={color('Semantic/Status/Error/Text')} />
          <Text {...screenHeaderA11y()} style={[typography.titleH3, { color: fg.primary }]}>
            Edit Live Visit
          </Text>
        </View>

        <View style={styles.fields}>
          <FieldShell
            typography={typography}
            value={dateFmt.format(date)}
            active={activePicker === 'date'}
            onPress={() => openPicker('date')}
            accessibilityLabel="Visit date"
          />
          <Text style={[typography.bodySmall, styles.fieldLabel]}>Start Time</Text>
          <FieldShell
            typography={typography}
            value={formatTimeLabel(startTime)}
            active={activePicker === 'startTime'}
            onPress={() => openPicker('startTime')}
            accessibilityLabel="Start time"
          />
          <Text style={[typography.bodySmall, styles.fieldLabel]}>End Time</Text>
          <FieldShell
            typography={typography}
            // Per spec: end time is optional, placeholder reads
            // "Editing will End Live Session" until the user picks one.
            value={endTime ? formatTimeLabel(endTime) : 'Editing will End Live Visit'}
            placeholder={!endTime}
            active={activePicker === 'endTime'}
            onPress={() => openPicker('endTime')}
            accessibilityLabel="End time (optional — saving with a value ends the visit)"
          />
        </View>

        {activePicker === 'date' ? (
          <View style={styles.pickerWrap}>
            <View style={styles.pickerActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Done"
                onPress={() => setActivePicker(null)}
                style={({ pressed }) => [styles.pickerDone, pressed && styles.pressed]}
              >
                <Text style={[typography.bodyBold, { color: color('Brand/Primary') }]}>
                  Done
                </Text>
              </Pressable>
            </View>
            <InlineMonthCalendar
              typography={typography}
              value={date}
              onChange={(next) => applyPick('date', next)}
            />
          </View>
        ) : null}

        {Platform.OS === 'ios' && timePickerValue && activePicker && activePicker !== 'date' ? (
          <View style={styles.pickerWrap}>
            <View style={styles.pickerActions}>
              {activePicker === 'endTime' && endTime ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear end time"
                  onPress={() => {
                    setEndTime(null);
                    setActivePicker(null);
                  }}
                  style={({ pressed }) => [styles.pickerClear, pressed && styles.pressed]}
                >
                  <Text
                    style={[typography.bodyBold, { color: color('Semantic/Status/Error/Text') }]}
                  >
                    Clear
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Done"
                onPress={() => setActivePicker(null)}
                style={({ pressed }) => [styles.pickerDone, pressed && styles.pressed]}
              >
                <Text style={[typography.bodyBold, { color: color('Brand/Primary') }]}>
                  Done
                </Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={timePickerValue}
              mode="time"
              display="spinner"
              is24Hour={false}
              onChange={handleTimeChange}
              textColor={fg.primary}
            />
          </View>
        ) : null}

        {timeError ? (
          <Text style={[typography.bodySmall, { color: '#b00020', marginTop: space('Spacing/12') }]}>
            {timeError}
          </Text>
        ) : null}

        <SheetPrimaryDeleteActions
          typography={typography}
          primaryLabel="SAVE CHANGES"
          onPrimaryPress={handleSave}
          onDeletePress={onDeletePress}
        />
      </View>
    </BottomSheetShell>
  );
}

type FieldShellProps = {
  typography: TextStyles;
  value: string;
  /** When true, the value renders in muted secondary text (placeholder state). */
  placeholder?: boolean;
  active: boolean;
  onPress: () => void;
  accessibilityLabel: string;
};

function FieldShell({
  typography,
  value,
  placeholder,
  active,
  onPress,
  accessibilityLabel,
}: FieldShellProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.fieldShell,
        active && styles.fieldShellActive,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[typography.body, { color: placeholder ? fg.secondary : fg.primary }]}
      >
        {value}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: space('Spacing/12'),
    width: '100%',
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space('Spacing/4'),
    alignSelf: 'flex-start',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space('Spacing/12'),
  },
  fields: {
    gap: space('Spacing/8'),
    marginTop: space('Spacing/4'),
  },
  fieldLabel: {
    color: fg.secondary,
  },
  fieldShell: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: border.subtle,
    borderRadius: 8,
    backgroundColor: bg.surfaceWhite,
    paddingHorizontal: 13,
    paddingVertical: 9,
    justifyContent: 'center',
  },
  fieldShellActive: {
    borderColor: color('Brand/Primary'),
  },
  pickerWrap: {
    marginTop: space('Spacing/8'),
    borderTopWidth: 1,
    borderTopColor: border.subtle,
  },
  pickerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: space('Spacing/8'),
  },
  pickerClear: {
    paddingHorizontal: space('Spacing/12'),
    paddingVertical: space('Spacing/8'),
    borderRadius: radius('Radius/Full'),
  },
  pickerDone: {
    paddingHorizontal: space('Spacing/12'),
    paddingVertical: space('Spacing/8'),
    borderRadius: radius('Radius/Full'),
  },
  pressed: {
    opacity: 0.75,
  },
});
