import { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { color, radius, space } from '@fieldsolo/design-system/lib/tokens';

import { DsTextInput } from './DsTextInput';
import { bg, border, cardShadowRn, fg } from '../../theme/nativeTokens';
import type { TextStyles } from '../../theme/nativeTokens';
import {
  JobDetailIconSectionAdd,
  JobDetailIconViewNote,
  SessionCardEditPencilIcon,
  SessionSheetBackIcon,
} from '../figma-icons/JobDetailScreenIcons';
import { BottomSheetShell } from './BottomSheetShell';
import { screenHeaderA11y } from '../../lib/accessibility';
import { SheetPrimaryDeleteActions } from './SheetPrimaryDeleteActions';

export type EditNoteBottomSheetValues = {
  body: string;
};

export type EditNoteBottomSheetAssignedSession = {
  id: string;
  dateLabel: string;
  timeRangeLabel: string;
};

type EditNoteBottomSheetProps = {
  typography: TextStyles;
  visible: boolean;
  /** "Add Note" | "Edit Note" */
  title: string;
  /** "SAVE NEW NOTE" | "SAVE CHANGES" */
  primaryLabel: string;
  /** Prefill for the textarea; undefined defaults to empty. */
  values?: EditNoteBottomSheetValues;
  /** When non-null, header renders the pencil SESSION pill + session subtitle. */
  assignedSession: EditNoteBottomSheetAssignedSession | null;
  /** Hides the `+SESSION` pill entirely when the job has no completed sessions. */
  canAttachSession: boolean;
  /**
   * Overrides the subtitle line. Defaults to "Unassigned job note" (or the
   * session label when `assignedSession` is set). Inbox quick capture passes
   * "Unassigned quick capture note".
   */
  subtitle?: string;
  /**
   * When provided, the header renders a `+JOB` pill (instead of `+SESSION`)
   * used by the Inbox quick-capture flow to attach this note to a job. Lifts
   * the current body so the parent can cache it before swapping sheets.
   */
  onJobPillPress?: (currentValues: EditNoteBottomSheetValues) => void;
  onClose?: () => void;
  onClosed?: () => void;
  onBack?: () => void;
  onSavePress?: (values: EditNoteBottomSheetValues) => void;
  /** Trash icon — for Add this deletes the draft; for Edit this soft-deletes. */
  onDeletePress?: () => void;
  /**
   * Opens the `ChooseSessionBottomSheet` in either `attach` or `edit` mode.
   * Receives the current in-sheet body so the parent can cache it before
   * switching flows — the sheet is hidden (and its local state reseeded
   * from `values`) on return, so without this lift the typed body would
   * reset.
   */
  onSessionPillPress?: (currentValues: EditNoteBottomSheetValues) => void;
  /** @default true — set false when this sheet replaces another (e.g. live session) without stacking. */
  registerInGlobalStack?: boolean;
};

/**
 * Add / Edit Note sheet (Figma `1874:1677` Add Note / `1279:379` Edit Note).
 *
 * Mirrors the contract of `EditSessionBottomSheet`: parent-supplied `title` and
 * `primaryLabel` so they remain stable during the slide-down close animation
 * (derive from `editingNoteId` on the parent, not from the transient flow
 * state). Local field state is reset on the `visible` edge.
 */
export function EditNoteBottomSheet({
  typography,
  visible,
  title,
  primaryLabel,
  values,
  assignedSession,
  canAttachSession,
  subtitle,
  onJobPillPress,
  onClose,
  onClosed,
  onBack,
  onSavePress,
  onDeletePress,
  onSessionPillPress,
  registerInGlobalStack = true,
}: EditNoteBottomSheetProps) {
  const [body, setBody] = useState<string>(values?.body ?? '');

  useEffect(() => {
    if (!visible) return;
    setBody(values?.body ?? '');
  }, [values?.body, visible]);

  const canSave = body.trim().length > 0;
  const noteOrange = color('Semantic/Activity/Note');
  const onDark = bg.canvasWarm;
  const showSessionPill = canAttachSession || assignedSession !== null;

  return (
    <BottomSheetShell
      visible={visible}
      onClose={onClose}
      onClosed={onClosed}
      registerInGlobalStack={registerInGlobalStack}
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
          <View style={styles.headerIcon}>
            <JobDetailIconViewNote color={noteOrange} />
          </View>
          <Text {...screenHeaderA11y()}
            style={[typography.titleH3, styles.headerTitle, { color: fg.primary }]}
          >
            {title}
          </Text>
          {onJobPillPress ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add to job"
              onPress={() => onJobPillPress({ body })}
              style={({ pressed }) => [styles.sessionButton, pressed && styles.pressed]}
            >
              <JobDetailIconSectionAdd color={onDark} />
              <Text style={[typography.pillCompact, { color: onDark }]}>JOB</Text>
            </Pressable>
          ) : showSessionPill ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={assignedSession ? 'Edit session' : 'Attach to session'}
              onPress={() => onSessionPillPress?.({ body })}
              disabled={!onSessionPillPress}
              style={({ pressed }) => [styles.sessionButton, pressed && styles.pressed]}
            >
              {assignedSession ? (
                <SessionCardEditPencilIcon color={onDark} size={12} />
              ) : (
                <JobDetailIconSectionAdd color={onDark} />
              )}
              <Text style={[typography.pillCompact, { color: onDark }]}>SESSION</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={[typography.bodySmall, styles.subtitle]}>
          {subtitle ??
            (assignedSession
              ? `Session: ${assignedSession.dateLabel} ${assignedSession.timeRangeLabel}`
              : 'Unassigned job note')}
        </Text>

        <View style={styles.textareaShell}>
          <DsTextInput
            value={body}
            onChangeText={setBody}
            placeholder="What happened on site? Measurements, observations, next steps..."
            placeholderTextColor={fg.secondary}
            multiline
            textAlignVertical="top"
            scrollEnabled
            style={[typography.body, styles.textareaInput]}
          />
        </View>

        <SheetPrimaryDeleteActions
          typography={typography}
          primaryLabel={primaryLabel}
          primaryDisabled={!canSave}
          primaryColor={noteOrange}
          onPrimaryPress={() => onSavePress?.({ body: body.trim() })}
          onDeletePress={onDeletePress}
        />
      </View>
    </BottomSheetShell>
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
  headerIcon: {
    width: space('Spacing/16'),
    height: space('Spacing/16'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
  },
  sessionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space('Spacing/8'),
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: space('Spacing/12'),
    paddingVertical: space('Spacing/8'),
    borderRadius: radius('Radius/12'),
    backgroundColor: fg.primary,
    ...cardShadowRn,
  },
  subtitle: {
    color: fg.secondary,
  },
  textareaShell: {
    minHeight: 245,
    borderWidth: 1,
    borderColor: border.subtle,
    borderRadius: radius('Radius/12'),
    backgroundColor: bg.surfaceWhite,
    paddingHorizontal: 17,
    paddingVertical: 13,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  textareaInput: {
    flex: 1,
    color: fg.primary,
    padding: 0,
    minHeight: 219,
  },
  pressed: {
    opacity: 0.75,
  },
});
