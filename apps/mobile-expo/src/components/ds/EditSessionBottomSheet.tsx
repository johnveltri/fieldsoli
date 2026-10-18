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

export type EditSessionBottomSheetValues = {
  /** ISO 8601 timestamp. */
  startedAt: string;
  /** ISO 8601 timestamp. */
  endedAt: string;
};

type EditSessionBottomSheetProps = {
  typography: TextStyles;
  visible: boolean;
  /** "Edit Session" | "Add Session" */
  title: string;
  /** "SAVE CHANGES" | "SAVE NEW SESSION" */
  primaryLabel: string;
  /** Prefill values. When undefined, fields default to today / now. */
  values?: EditSessionBottomSheetValues;
  onClose?: () => void;
  onClosed?: () => void;
  onBack?: () => void;
  onSavePress?: (values: EditSessionBottomSheetValues) => void;
  /** Trash icon — for add flow this deletes unsaved draft; for edit flow this soft-deletes. */
  onDeletePress?: () => void;
  /** Shown under the session date field (e.g. mark-complete wizard). */
  sessionError?: string;
};

type PickerKind = 'date' | 'startTime' | 'endTime';

function now(): Date {
  return new Date();
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function combineDateAndTime(dateSource: Date, timeSource: Date): Date {
  const out = new Date(dateSource);
  out.setHours(
    timeSource.getHours(),
    timeSource.getMinutes(),
    0,
    0,
  );
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
 * Edit/Add Session sheet (Figma `1284:726` — "Edit Session" variant).
 * Tapping the date or time fields opens native date/time pickers; trash icon
 * deletes, primary button saves.
 */
export function EditSessionBottomSheet({
  typography,
  visible,
  title,
  primaryLabel,
  values,
  sessionError,
  onClose,
  onClosed,
  onBack,
  onSavePress,
  onDeletePress,
}: EditSessionBottomSheetProps) {
  const initialDate = useMemo(
    () => (values ? startOfDay(new Date(values.startedAt)) : startOfDay(now())),
    [values],
  );
  const initialStart = useMemo(
    () => (values ? new Date(values.startedAt) : now()),
    [values],
  );
  const initialEnd = useMemo(
    () => (values ? new Date(values.endedAt) : now()),
    [values],
  );

  const [date, setDate] = useState<Date>(initialDate);
  const [startTime, setStartTime] = useState<Date>(initialStart);
  const [endTime, setEndTime] = useState<Date>(initialEnd);
  const [activePicker, setActivePicker] = useState<PickerKind | null>(null);

  useEffect(() => {
    if (!visible) return;
    setDate(initialDate);
    setStartTime(initialStart);
    setEndTime(initialEnd);
    setActivePicker(null);
  }, [initialDate, initialEnd, initialStart, visible]);

  const applyPick = useCallback(
    (kind: PickerKind, picked: Date) => {
      if (kind === 'date') {
        setDate(startOfDay(picked));
      } else if (kind === 'startTime') {
        setStartTime(picked);
      } else {
        setEndTime(picked);
      }
    },
    [],
  );

  const openPicker = useCallback(
    (kind: PickerKind) => {
      // Android DateTimePicker cannot embed inline; date uses our month grid.
      // Time still uses the system dialog on Android.
      if (Platform.OS === 'android' && kind !== 'date') {
        const current = kind === 'startTime' ? startTime : endTime;
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
      setActivePicker((prev) => (prev === kind ? null : kind));
    },
    [applyPick, endTime, startTime],
  );

  const handleTimeChange = useCallback(
    (_event: DateTimePickerEvent, selectedDate?: Date) => {
      if (!activePicker || activePicker === 'date' || !selectedDate) return;
      applyPick(activePicker, selectedDate);
    },
    [activePicker, applyPick],
  );

  const handleSave = useCallback(() => {
    const startedAt = combineDateAndTime(date, startTime);
    const endedAt = combineDateAndTime(date, endTime);
    onSavePress?.({
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
    });
  }, [date, endTime, onSavePress, startTime]);

  const timePickerValue =
    activePicker === 'startTime' ? startTime : activePicker === 'endTime' ? endTime : null;

  return (
    <BottomSheetShell visible={visible} onClose={onClose} onClosed={onClosed}>
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
          <Text {...screenHeaderA11y()}
            style={[typography.titleH3, { color: fg.primary }]}
          >
            {title}
          </Text>
        </View>

        {sessionError ? (
          <Text style={[typography.bodySmall, { color: color('Semantic/Status/Error/Text') }]}>
            {sessionError}
          </Text>
        ) : null}

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
            value={formatTimeLabel(endTime)}
            active={activePicker === 'endTime'}
            onPress={() => openPicker('endTime')}
            accessibilityLabel="End time"
          />
        </View>

        {activePicker === 'date' ? (
          <View style={styles.pickerWrap}>
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
            <InlineMonthCalendar
              typography={typography}
              value={date}
              onChange={(next) => applyPick('date', next)}
            />
          </View>
        ) : null}

        {Platform.OS === 'ios' && timePickerValue && activePicker && activePicker !== 'date' ? (
          <View style={styles.pickerWrap}>
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

        <SheetPrimaryDeleteActions
          typography={typography}
          primaryLabel={primaryLabel}
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
  active: boolean;
  onPress: () => void;
  accessibilityLabel: string;
};

function FieldShell({
  typography,
  value,
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
      <Text style={[typography.body, { color: fg.primary }]}>
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
  pickerDone: {
    alignSelf: 'flex-end',
    paddingHorizontal: space('Spacing/12'),
    paddingVertical: space('Spacing/8'),
    borderRadius: radius('Radius/Full'),
  },
  pressed: {
    opacity: 0.75,
  },
});
