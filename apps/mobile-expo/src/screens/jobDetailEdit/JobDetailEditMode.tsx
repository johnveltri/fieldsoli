import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ScrollView,
} from 'react-native';
import { color, radius, space } from '@fieldsolo/design-system/lib/tokens';
import type { JobDetailViewModel } from '@fieldsolo/shared-types';
import {
  formatLocalDateLabel,
  formatSessionDurationLabel,
  formatSessionTimeLabel,
  JOB_DETAIL_EMPTY_LABELS,
  type FieldSoloSupabaseClient,
} from '@fieldsolo/api-client';

import {
  EditAddRow,
  EditConfirmNoneRow,
  EditEntityBlockScope,
  EditFieldInput,
  EditIconGroup,
  EditIconRow,
  EditKeyboardScrollProvider,
  EditKeyboardScrollContext,
  EditModeScrollView,
  EDIT_KEYBOARD_BOTTOM_CLEARANCE,
  EditMaterialBreakdownRow,
  EditSheet,
  EditSplitFields,
  EditSplitTimeRow,
  EditTappableValue,
  EditTitleField,
  EditDescriptionField,
  editSheetRowSeparator,
} from '../../components/ds/edit-mode/EditFormRows';
import { EditIconLink } from '../../components/ds/edit-mode/EditModeIcons';
import { CustomerFieldsBlock } from '../../components/ds/customer/CustomerFieldsBlock';
import { EditSwipeableRow } from '../../components/ds/edit-mode/EditSwipeableRow';
import { PlatformHeaderAction } from '../../components/platform/PlatformHeaderAction';
import {
  JobDetailIconSectionMaterials,
  JobDetailIconSectionNotes,
  JobDetailIconSectionOtherCosts,
  JobDetailIconSectionSessions,
  JobDetailIconTopClose,
} from '../../components/figma-icons/JobDetailScreenIcons';
import { formatUsdCombined } from '../../lib/formatUsd';
import { otherCostTypeLabel, type JobOtherCostType } from '../../lib/otherCostTypes';
import { bg, cardShadowRn, fg } from '../../theme/nativeTokens';
import type { TextStyles } from '../../theme/nativeTokens';
import {
  JobDetailEditPickers,
  type EditPickerTarget,
} from './JobDetailEditPickers';
import {
  buildMaterialUnitPriceBlurPatch,
  isDraftMaterialUsable,
  isDraftOtherCostUsable,
  JOB_SHORT_DESCRIPTION_MAX_LENGTH,
  materialHasBreakdown,
  useJobEditDraft,
  type DraftMaterialRow,
  type DraftNoteRow,
  type DraftOtherCostRow,
  type DraftSessionRow,
} from './useJobEditDraft';
import {
  editSectionsForFocusTarget,
  editShowsSection,
  type JobDetailEditFocusTarget,
} from './jobDetailFocusTarget';

type JobDetailEditModeProps = {
  job: JobDetailViewModel;
  typography: TextStyles;
  headerTopPad: number;
  bottomInset: number;
  columnStyle: object;
  saving: boolean;
  onBack: () => void;
  onDone: () => void;
  onDeleteJob: () => void;
  editApi: ReturnType<typeof useJobEditDraft>;
  supabase: FieldSoloSupabaseClient;
  focusTarget?: JobDetailEditFocusTarget | null;
  /** When false, keyboard/dock scroll state is cleared (View/Edit crossfade keeps edit mounted). */
  active?: boolean;
  /** When true, header chrome is rendered by JobDetailScreen. */
  hideHeader?: boolean;
};

const iconColor = fg.secondary;

function focusTargetAnchorKey(target: JobDetailEditFocusTarget): string {
  if (typeof target === 'string') return target;
  return `${target.kind}:${target.id}`;
}

function JobDetailEditFocusScroller({
  active,
  focusTarget,
  focusAnchorsRef,
  scrollRef,
  scrollContentRef,
}: {
  active: boolean;
  focusTarget: JobDetailEditFocusTarget | null;
  focusAnchorsRef: React.MutableRefObject<Record<string, View>>;
  scrollRef: React.RefObject<ScrollView | null>;
  scrollContentRef: React.RefObject<View | null>;
}) {
  const keyboardScroll = useContext(EditKeyboardScrollContext);

  useEffect(() => {
    if (!active || !focusTarget) return;
    keyboardScroll?.resetKeyboardScrollState();
    const key = focusTargetAnchorKey(focusTarget);
    const scroll = () => {
      const anchor = focusAnchorsRef.current[key];
      const scrollView = scrollRef.current;
      const content = scrollContentRef.current;
      if (!anchor || !scrollView || !content) return;
      anchor.measureLayout(
        content,
        (_x, y) => {
          scrollView.scrollTo({
            y: Math.max(0, y - space('Spacing/16')),
            animated: true,
          });
        },
        () => {},
      );
    };
    const t = setTimeout(scroll, 0);
    return () => clearTimeout(t);
  }, [active, focusAnchorsRef, focusTarget, keyboardScroll, scrollContentRef, scrollRef]);

  return null;
}

function parseRevenueInput(text: string): number | null {
  const trimmed = text.trim().replace(/[@$,\s]/g, '');
  if (trimmed.length === 0) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function centsToEditText(cents: number): string {
  return (cents / 100).toFixed(2);
}

function revenueCentsToInput(cents: number | null): string {
  if (cents == null || cents <= 0) return '';
  return formatUsdCombined(cents);
}

function formatMoneyFieldOnBlur(text: string, setText: (value: string) => void) {
  const cents = parseRevenueInput(text);
  setText(cents != null && cents > 0 ? formatUsdCombined(cents) : '');
}

function formatUnitPriceFieldOnBlur(text: string, setText: (value: string) => void) {
  const cents = parseRevenueInput(text);
  setText(cents != null ? `@ ${formatUsdCombined(cents)}` : '');
}

function parseQuantityInput(text: string): number | null {
  const cleaned = text.trim().replace(/[^0-9.]/g, '');
  if (cleaned.length === 0 || cleaned === '.') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function quantityToInput(quantity: number, explicit = false): string {
  if (quantity <= 0 && !explicit) return '';
  return String(quantity);
}

function formatQuantityFieldOnBlur(text: string, setText: (value: string) => void) {
  const quantity = parseQuantityInput(text);
  setText(quantity != null ? String(quantity) : '');
}

function SessionAttachRow({
  typography,
  sessions,
  value,
  onPress,
}: {
  typography: TextStyles;
  sessions: { id: string; dateLabel: string }[];
  value: string | null;
  onPress: () => void;
}) {
  const session = value ? sessions.find((s) => s.id === value) : undefined;
  const displayValue = session ? `${session.dateLabel} Session` : '';

  return (
    <EditTappableValue
      typography={typography}
      value={displayValue}
      placeholder="Unassigned"
      accessibilityLabel="Attach to session"
      onPress={onPress}
    />
  );
}

export function JobDetailEditMode({
  typography,
  headerTopPad,
  bottomInset,
  columnStyle,
  saving,
  onBack,
  onDone,
  onDeleteJob,
  editApi,
  supabase,
  focusTarget = null,
  active = true,
  hideHeader = false,
}: JobDetailEditModeProps) {
  const {
    snapshot,
    draft,
    resetVersion,
    validation,
    updateDraft,
    addSession,
    addNote,
    addMaterial,
    addOtherCost,
    removeRow,
    updateSession,
    updateNote,
    updateMaterial,
    updateOtherCost,
    getDraftSnapshot,
    setDoneHandler,
    setBackHandler,
  } = editApi;

  const editSections = useMemo(
    () => editSectionsForFocusTarget(focusTarget),
    [focusTarget],
  );
  const showSection = useCallback(
    (section: Parameters<typeof editShowsSection>[1]) =>
      editShowsSection(editSections, section),
    [editSections],
  );

  const [pickerTarget, setPickerTarget] = useState<EditPickerTarget | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollContentRef = useRef<View>(null);
  const scrollYRef = useRef(0);
  const focusAnchorsRef = useRef<Record<string, View>>({});
  const setFocusAnchor = useCallback(
    (key: string) => (node: View | null) => {
      if (node) focusAnchorsRef.current[key] = node;
      else delete focusAnchorsRef.current[key];
    },
    [],
  );
  const [revenueText, setRevenueText] = useState(() =>
    revenueCentsToInput(draft?.revenueCents ?? null),
  );
  const [isRevenueFocused, setIsRevenueFocused] = useState(false);
  const revenueTextRef = useRef(revenueText);
  revenueTextRef.current = revenueText;
  const fieldFlushersRef = useRef(new Set<() => void>());
  const registerFieldFlusher = useCallback((flush: () => void) => {
    fieldFlushersRef.current.add(flush);
    return () => {
      fieldFlushersRef.current.delete(flush);
    };
  }, []);

  // Edit stays mounted under View; resync display when entering Edit or draft resets.
  useEffect(() => {
    if (!active || isRevenueFocused) return;
    setRevenueText(revenueCentsToInput(draft?.revenueCents ?? null));
  }, [active, draft?.revenueCents, draft?.noRevenueConfirmed, isRevenueFocused]);

  useEffect(() => {
    setRevenueText(revenueCentsToInput(getDraftSnapshot().draft?.revenueCents ?? null));
    setIsRevenueFocused(false);
  }, [getDraftSnapshot, resetVersion]);

  const openPicker = useCallback((target: EditPickerTarget) => {
    Keyboard.dismiss();
    setPickerTarget(target);
  }, []);
  const closePicker = useCallback(() => setPickerTarget(null), []);

  const endedSessionsForPicker = useMemo(
    () =>
      (draft?.sessions ?? [])
        .filter((s) => !s.removed)
        .map((s) => ({
          id: s.id,
          dateLabel: s.date
            ? formatLocalDateLabel(s.date)
            : JOB_DETAIL_EMPTY_LABELS.sessionDate,
        })),
    [draft?.sessions],
  );

  const confirmDeleteJob = useCallback(() => {
    Alert.alert('Delete this job?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete job', style: 'destructive', onPress: onDeleteJob },
    ]);
  }, [onDeleteJob]);

  const commitRevenueFromText = useCallback(
    (text: string) => {
      const parsed = parseRevenueInput(text);
      formatMoneyFieldOnBlur(text, setRevenueText);
      if (parsed != null && parsed > 0) {
        updateDraft({ revenueCents: parsed, noRevenueConfirmed: false });
        return;
      }
      const confirmed = getDraftSnapshot().draft?.noRevenueConfirmed === true;
      updateDraft({
        revenueCents: confirmed ? 0 : null,
        noRevenueConfirmed: confirmed,
      });
    },
    [getDraftSnapshot, updateDraft],
  );

  useEffect(() => {
    return registerFieldFlusher(() => {
      commitRevenueFromText(revenueTextRef.current);
    });
  }, [commitRevenueFromText, registerFieldFlusher]);

  const flushFields = useCallback(() => {
    for (const flush of fieldFlushersRef.current) {
      flush();
    }
  }, []);

  const handleDonePress = useCallback(() => {
    // Commit any in-progress TextInput values before save — Done often fires
    // without a blur (shared header / keyboard still open).
    flushFields();
    Keyboard.dismiss();
    setTimeout(onDone, 0);
  }, [flushFields, onDone]);

  const handleBackPress = useCallback(() => {
    if (saving) return;
    // Numeric fields commit on blur. Flush before the dirty check so Close and
    // hardware Back cannot discard an in-focus value without confirmation.
    flushFields();
    Keyboard.dismiss();
    setTimeout(onBack, 0);
  }, [flushFields, onBack, saving]);

  useEffect(() => {
    setDoneHandler(handleDonePress);
    return () => setDoneHandler(null);
  }, [handleDonePress, setDoneHandler]);

  useEffect(() => {
    setBackHandler(handleBackPress);
    return () => setBackHandler(null);
  }, [handleBackPress, setBackHandler]);

  if (!draft) return null;

  const doneDisabled = !validation.canDone || saving;
  const visibleSessions = draft.sessions.filter((s) => !s.removed);
  const visibleMaterials = draft.materials.filter((m) => !m.removed);
  const visibleOtherCosts = draft.otherCosts.filter((c) => !c.removed);
  const visibleNotes = draft.notes.filter((n) => !n.removed);
  const hasUsableMaterial = visibleMaterials.some(isDraftMaterialUsable);
  const hasUsableOtherCost = visibleOtherCosts.some(isDraftOtherCostUsable);

  return (
    <>
    <View style={styles.flex}>
      <EditKeyboardScrollProvider
        scrollViewRef={scrollRef}
        scrollContentRef={scrollContentRef}
        scrollYRef={scrollYRef}
        active={active}
      >
      <JobDetailEditFocusScroller
        active={active}
        focusTarget={focusTarget}
        focusAnchorsRef={focusAnchorsRef}
        scrollRef={scrollRef}
        scrollContentRef={scrollContentRef}
      />
      <EditModeScrollView
        scrollViewRef={scrollRef as React.RefObject<ScrollView>}
        scrollYRef={scrollYRef}
        style={styles.flex}
        contentContainerStyle={{
          paddingTop: hideHeader ? space('Spacing/8') : headerTopPad + space('Spacing/4'),
          paddingBottom: space('Spacing/32') + bottomInset + EDIT_KEYBOARD_BOTTOM_CLEARANCE,
        }}
      >
        <View ref={scrollContentRef} style={columnStyle} collapsable={false}>
          {hideHeader ? null : (
          <View style={styles.topHeader}>
            <PlatformHeaderAction
              accessibilityLabel="Close"
              onPress={handleBackPress}
              style={saving ? styles.controlDisabled : undefined}
            >
              <JobDetailIconTopClose color={fg.primary} />
            </PlatformHeaderAction>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Done"
              disabled={doneDisabled}
              onPress={handleDonePress}
              style={({ pressed }) => [
                styles.doneButton,
                doneDisabled && styles.doneButtonDisabled,
                pressed && !doneDisabled && styles.pressed,
              ]}
            >
              {saving ? (
                <ActivityIndicator color={bg.canvasWarm} size="small" />
              ) : (
                <Text style={[typography.pillCompact, styles.doneLabel]}>Done</Text>
              )}
            </Pressable>
          </View>
          )}

          {showSection('title') ? (
          <View ref={setFocusAnchor('title')} collapsable={false}>
          <EditSheet>
            <EditTitleField
              typography={typography}
              accessibilityLabel="Job title"
              placeholder="Job title"
              value={draft.shortDescription}
              onChangeText={(t) =>
                updateDraft({
                  shortDescription: t.slice(0, JOB_SHORT_DESCRIPTION_MAX_LENGTH),
                })
              }
              onBlur={() => {
                const current = getDraftSnapshot().draft?.shortDescription ?? '';
                if (current.trim() !== '') return;
                updateDraft({
                  shortDescription:
                    snapshot?.shortDescription.trim() || 'Untitled Job',
                });
              }}
            />
            <EditDescriptionField
              typography={typography}
              accessibilityLabel="Job description"
              placeholder="Description"
              value={draft.longDescription}
              onChangeText={(t) => updateDraft({ longDescription: t })}
            />
          </EditSheet>
          </View>
          ) : null}

          {showSection('customer') ? (
          <View ref={setFocusAnchor('customer')} collapsable={false}>
            <CustomerFieldsBlock
              typography={typography}
              iconColor={iconColor}
              surface="job_edit"
              supabase={supabase}
              draft={{
                customerName: draft.customerName,
                customerPhone: draft.customerPhone,
                customerEmail: draft.customerEmail,
                customerId: draft.customerId,
                serviceAddress: draft.serviceAddress,
              }}
              onChange={(patch) => updateDraft(patch)}
            />
          </View>
          ) : null}

          {showSection('revenue') ? (
          <View ref={setFocusAnchor('revenue')} collapsable={false}>
          <EditSheet>
            <EditIconRow icon={<JobDetailIconSectionOtherCosts color={iconColor} />}>
              <EditFieldInput
                typography={typography}
                placeholder="Revenue"
                value={revenueText}
                opticalNudgeY={-5}
                keyboardType="decimal-pad"
                inputMode="decimal"
                onFocus={() => {
                  setIsRevenueFocused(true);
                  if (draft.revenueCents != null && draft.revenueCents > 0) {
                    setRevenueText(centsToEditText(draft.revenueCents));
                  }
                }}
                onBlur={() => {
                  setIsRevenueFocused(false);
                  commitRevenueFromText(revenueText);
                }}
                onChangeText={(t) => {
                  setRevenueText(t);
                  const parsed = parseRevenueInput(t);
                  if (parsed != null && parsed > 0) {
                    updateDraft({ noRevenueConfirmed: false });
                  }
                }}
              />
            </EditIconRow>
            {(draft.revenueCents ?? 0) <= 0 ? (
              <EditConfirmNoneRow
                typography={typography}
                confirmed={draft.noRevenueConfirmed}
                confirmLabel="Confirm no revenue"
                confirmedLabel="No revenue confirmed"
                disabled={saving}
                onToggle={() => {
                  if (saving) return;
                  if (draft.noRevenueConfirmed) {
                    updateDraft({ noRevenueConfirmed: false, revenueCents: null });
                    setRevenueText('');
                  } else {
                    updateDraft({ noRevenueConfirmed: true, revenueCents: 0 });
                    setRevenueText('');
                  }
                }}
              />
            ) : null}
          </EditSheet>
          </View>
          ) : null}

          {showSection('sessions') ? (
          <View ref={setFocusAnchor('sessions')} collapsable={false}>
          <EditSheet>
            {visibleSessions.map((row, index) => (
                <View key={row.id} ref={setFocusAnchor(`session:${row.id}`)} collapsable={false}>
                <SessionEditBlock
                  row={row}
                  typography={typography}
                  showTopBorder={index > 0}
                  onDelete={() => {
                    if (!saving) removeRow('sessions', row.id);
                  }}
                  onOpenPicker={openPicker}
                />
                </View>
              ))}
            <EditAddRow
              typography={typography}
              icon={<JobDetailIconSectionSessions color={iconColor} />}
              label="Add session"
              onPress={addSession}
              showTopBorder={visibleSessions.length > 0}
            />
          </EditSheet>
          </View>
          ) : null}

          {showSection('materials') ? (
          <View ref={setFocusAnchor('materials')} collapsable={false}>
          <EditSheet>
            {visibleMaterials.map((row, index) => (
                <View key={row.id} ref={setFocusAnchor(`material:${row.id}`)} collapsable={false}>
                <MaterialEditBlock
                  key={`${row.id}:${resetVersion}`}
                  row={row}
                  typography={typography}
                  sessions={endedSessionsForPicker}
                  showTopBorder={index > 0}
                  onDelete={() => {
                    if (!saving) removeRow('materials', row.id);
                  }}
                  onChange={(patch) => updateMaterial(row.id, patch)}
                  onOpenPicker={openPicker}
                  registerFieldFlusher={registerFieldFlusher}
                />
                </View>
              ))}
            <EditAddRow
              typography={typography}
              icon={<JobDetailIconSectionMaterials color={iconColor} />}
              label="Add material"
              onPress={addMaterial}
              showTopBorder={visibleMaterials.length > 0}
            />
            {!hasUsableMaterial ? (
              <EditConfirmNoneRow
                typography={typography}
                confirmed={draft.noMaterialsConfirmed}
                confirmLabel="Confirm no materials"
                confirmedLabel="No materials confirmed"
                disabled={saving}
                onToggle={() => {
                  if (saving) return;
                  updateDraft({ noMaterialsConfirmed: !draft.noMaterialsConfirmed });
                }}
              />
            ) : null}
          </EditSheet>
          </View>
          ) : null}

          {showSection('otherCosts') ? (
          <View ref={setFocusAnchor('otherCosts')} collapsable={false}>
          <EditSheet>
            {visibleOtherCosts.map((row, index) => (
                <View key={row.id} ref={setFocusAnchor(`otherCost:${row.id}`)} collapsable={false}>
                <OtherCostEditBlock
                  key={`${row.id}:${resetVersion}`}
                  row={row}
                  typography={typography}
                  sessions={endedSessionsForPicker}
                  showTopBorder={index > 0}
                  onDelete={() => {
                    if (!saving) removeRow('otherCosts', row.id);
                  }}
                  onChange={(patch) => updateOtherCost(row.id, patch)}
                  onOpenPicker={openPicker}
                  registerFieldFlusher={registerFieldFlusher}
                />
                </View>
              ))}
            <EditAddRow
              typography={typography}
              icon={<JobDetailIconSectionOtherCosts color={iconColor} />}
              label="Add other cost"
              onPress={addOtherCost}
              showTopBorder={visibleOtherCosts.length > 0}
            />
            {!hasUsableOtherCost ? (
              <EditConfirmNoneRow
                typography={typography}
                confirmed={draft.noOtherCostsConfirmed}
                confirmLabel="Confirm no other costs"
                confirmedLabel="No other costs confirmed"
                disabled={saving}
                onToggle={() => {
                  if (saving) return;
                  updateDraft({ noOtherCostsConfirmed: !draft.noOtherCostsConfirmed });
                }}
              />
            ) : null}
          </EditSheet>
          </View>
          ) : null}

          {showSection('notes') ? (
          <View ref={setFocusAnchor('notes')} collapsable={false}>
          <EditSheet>
            {visibleNotes.map((row, index) => (
                <View key={row.id} ref={setFocusAnchor(`note:${row.id}`)} collapsable={false}>
                <NoteEditBlock
                  row={row}
                  typography={typography}
                  sessions={endedSessionsForPicker}
                  showTopBorder={index > 0}
                  onDelete={() => {
                    if (!saving) removeRow('notes', row.id);
                  }}
                  onChange={(patch) => updateNote(row.id, patch)}
                  onOpenPicker={openPicker}
                />
                </View>
              ))}
            <EditAddRow
              typography={typography}
              icon={<JobDetailIconSectionNotes color={iconColor} />}
              label="Add note"
              onPress={addNote}
              showTopBorder={visibleNotes.length > 0}
            />
          </EditSheet>
          </View>
          ) : null}

          {editSections === 'all' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete job"
            disabled={saving}
            onPress={confirmDeleteJob}
            style={({ pressed }) => [
              styles.deleteJob,
              saving && styles.controlDisabled,
              pressed && !saving && styles.pressed,
            ]}
          >
            <Text style={[typography.body, { color: color('Semantic/Status/Error/Text') }]}>
              Delete job
            </Text>
          </Pressable>
          ) : null}
        </View>
      </EditModeScrollView>
      </EditKeyboardScrollProvider>
    </View>

    <JobDetailEditPickers
      typography={typography}
      target={pickerTarget}
      draft={draft}
      onClose={closePicker}
      onUpdateSession={updateSession}
      onUpdateMaterial={updateMaterial}
      onUpdateNote={updateNote}
      onUpdateOtherCost={updateOtherCost}
    />
    </>
  );
}

function EntityBlock({
  typography,
  onDelete,
  accessibilityLabel,
  showTopBorder = false,
  dockRef,
  children,
}: {
  typography: TextStyles;
  onDelete: () => void;
  accessibilityLabel: string;
  showTopBorder?: boolean;
  dockRef?: React.RefObject<View | null>;
  children: React.ReactNode;
}) {
  return (
    <EditSwipeableRow
      typography={typography}
      onDelete={onDelete}
      accessibilityLabel={accessibilityLabel}
    >
      <EditEntityBlockScope dockRef={dockRef}>
        <View style={showTopBorder ? editSheetRowSeparator : undefined}>{children}</View>
      </EditEntityBlockScope>
    </EditSwipeableRow>
  );
}

function SessionEditBlock({
  row,
  typography,
  showTopBorder,
  onDelete,
  onOpenPicker,
}: {
  row: DraftSessionRow;
  typography: TextStyles;
  showTopBorder?: boolean;
  onDelete: () => void;
  onOpenPicker: (target: EditPickerTarget) => void;
}) {
  const openSessionStartTime = () =>
    onOpenPicker({ kind: 'sessionStartTime', sessionId: row.id });
  const openSessionEndTime = () => onOpenPicker({ kind: 'sessionEndTime', sessionId: row.id });

  return (
    <EntityBlock
      typography={typography}
      showTopBorder={showTopBorder}
      onDelete={onDelete}
      accessibilityLabel="Session"
    >
      <EditIconGroup icon={<JobDetailIconSectionSessions color={iconColor} />}>
        <EditTappableValue
          typography={typography}
          value={row.date ? formatLocalDateLabel(row.date) : ''}
          placeholder="Date"
          accessibilityLabel="Session date"
          onPress={() => onOpenPicker({ kind: 'sessionDate', sessionId: row.id })}
        />
        <EditTappableValue
          typography={typography}
          value={row.durationHours > 0 ? formatSessionDurationLabel(row.durationHours) : ''}
          placeholder="Duration"
          accessibilityLabel="Session duration"
          onPress={() => onOpenPicker({ kind: 'sessionDuration', sessionId: row.id })}
        />
        <EditSplitTimeRow
          typography={typography}
          startValue={row.explicitStartClock ? formatSessionTimeLabel(row.startedAt) : ''}
          endValue={row.explicitEndClock ? formatSessionTimeLabel(row.endedAt) : ''}
          onPressStart={openSessionStartTime}
          onPressEnd={openSessionEndTime}
        />
      </EditIconGroup>
    </EntityBlock>
  );
}

function MaterialEditBlock({
  row,
  typography,
  sessions,
  showTopBorder,
  onDelete,
  onChange,
  onOpenPicker,
  registerFieldFlusher,
}: {
  row: DraftMaterialRow;
  typography: TextStyles;
  sessions: { id: string; dateLabel: string }[];
  showTopBorder?: boolean;
  onDelete: () => void;
  onChange: (patch: Partial<DraftMaterialRow>) => void;
  onOpenPicker: (target: EditPickerTarget) => void;
  registerFieldFlusher: (flush: () => void) => () => void;
}) {
  const [totalCostText, setTotalCostText] = useState(() =>
    revenueCentsToInput(row.totalCostCents),
  );
  const [unitPriceText, setUnitPriceText] = useState(() =>
    row.unitCostExplicit ? `@ ${formatUsdCombined(row.unitCostCents)}` : '',
  );
  const [quantityText, setQuantityText] = useState(() =>
    quantityToInput(row.quantity, row.quantityExplicit),
  );
  const [isTotalCostFocused, setIsTotalCostFocused] = useState(false);
  const [isUnitPriceFocused, setIsUnitPriceFocused] = useState(false);
  const [isQuantityFocused, setIsQuantityFocused] = useState(false);
  const totalCostTextRef = useRef(totalCostText);
  const unitPriceTextRef = useRef(unitPriceText);
  const quantityTextRef = useRef(quantityText);
  const rowRef = useRef(row);
  totalCostTextRef.current = totalCostText;
  unitPriceTextRef.current = unitPriceText;
  quantityTextRef.current = quantityText;
  rowRef.current = row;

  const hasCompleteBreakdown = row.quantityExplicit && row.unitCostExplicit;
  const displayedTotalCents = hasCompleteBreakdown
    ? Math.round(row.quantity * row.unitCostCents)
    : row.totalCostCents;
  const totalCostDisplay =
    displayedTotalCents > 0 || hasCompleteBreakdown
      ? `${formatUsdCombined(displayedTotalCents)} total`
      : '';

  useEffect(() => {
    if (!materialHasBreakdown(row)) return;
    setTotalCostText(revenueCentsToInput(row.totalCostCents));
  }, [row.quantity, row.unitCostCents, row.totalCostCents, row.showBreakdown, row.unit]);

  // Keep unfocused display text aligned when draft resets after Done (edit pane stays mounted).
  useEffect(() => {
    if (isTotalCostFocused) return;
    if (materialHasBreakdown(row)) return;
    setTotalCostText(revenueCentsToInput(row.totalCostCents));
  }, [
    isTotalCostFocused,
    row.totalCostCents,
    row.quantityExplicit,
    row.unitCostExplicit,
    row.showBreakdown,
    row.unit,
    row.quantity,
    row.unitCostCents,
  ]);

  useEffect(() => {
    if (isUnitPriceFocused) return;
    setUnitPriceText(
      row.unitCostExplicit ? `@ ${formatUsdCombined(row.unitCostCents)}` : '',
    );
  }, [isUnitPriceFocused, row.unitCostCents, row.unitCostExplicit]);

  useEffect(() => {
    if (isQuantityFocused) return;
    setQuantityText(quantityToInput(row.quantity, row.quantityExplicit));
  }, [isQuantityFocused, row.quantity, row.quantityExplicit]);

  const commitTotalCost = useCallback(() => {
    const current = rowRef.current;
    if (current.quantityExplicit && current.unitCostExplicit) return;
    formatMoneyFieldOnBlur(totalCostTextRef.current, setTotalCostText);
    onChange({ totalCostCents: parseRevenueInput(totalCostTextRef.current) ?? 0 });
  }, [onChange]);

  const commitUnitPrice = useCallback(() => {
    const current = rowRef.current;
    const unitCostCents = parseRevenueInput(unitPriceTextRef.current) ?? 0;
    const unitCostExplicit = unitPriceTextRef.current.trim().length > 0;
    formatUnitPriceFieldOnBlur(unitPriceTextRef.current, setUnitPriceText);
    onChange(buildMaterialUnitPriceBlurPatch(current, unitCostCents, unitCostExplicit));
  }, [onChange]);

  const commitQuantity = useCallback(() => {
    const current = rowRef.current;
    const quantity = parseQuantityInput(quantityTextRef.current) ?? 0;
    const quantityExplicit = quantityTextRef.current.trim().length > 0;
    formatQuantityFieldOnBlur(quantityTextRef.current, setQuantityText);
    onChange({
      quantity,
      quantityExplicit,
      showBreakdown: quantityExplicit || current.unitCostExplicit || !!current.unit.trim(),
    });
  }, [onChange]);

  useEffect(() => {
    const unsubTotal = registerFieldFlusher(commitTotalCost);
    const unsubUnit = registerFieldFlusher(commitUnitPrice);
    const unsubQty = registerFieldFlusher(commitQuantity);
    return () => {
      unsubTotal();
      unsubUnit();
      unsubQty();
    };
  }, [commitQuantity, commitTotalCost, commitUnitPrice, registerFieldFlusher]);

  return (
    <EntityBlock
      typography={typography}
      showTopBorder={showTopBorder}
      onDelete={onDelete}
      accessibilityLabel="Material"
    >
      <EditIconGroup icon={<JobDetailIconSectionMaterials color={iconColor} />}>
        <EditFieldInput
          typography={typography}
          value={row.description}
          opticalNudgeY={-4}
          onChangeText={(description) => onChange({ description })}
          placeholder="Material"
        />
        <EditFieldInput
          typography={typography}
          placeholder="Total cost"
          accessibilityLabel="Total cost"
          value={
            isTotalCostFocused && !hasCompleteBreakdown ? totalCostText : totalCostDisplay
          }
          keyboardType="decimal-pad"
          inputMode="decimal"
          editable={!hasCompleteBreakdown}
          style={hasCompleteBreakdown ? { color: fg.secondary } : undefined}
          onFocus={() => {
            if (row.totalCostCents > 0) {
              setTotalCostText(centsToEditText(row.totalCostCents));
            }
            setIsTotalCostFocused(true);
          }}
          onBlur={() => {
            commitTotalCost();
            setIsTotalCostFocused(false);
          }}
          onChangeText={setTotalCostText}
        />
        <EditMaterialBreakdownRow
          unitPrice={
            <EditFieldInput
              typography={typography}
              placeholder="@ unit price"
              accessibilityLabel="Unit price"
              value={unitPriceText}
              keyboardType="decimal-pad"
              inputMode="decimal"
              onFocus={() => {
                if (row.unitCostExplicit) {
                  setUnitPriceText(centsToEditText(row.unitCostCents));
                }
                setIsUnitPriceFocused(true);
              }}
              onBlur={() => {
                commitUnitPrice();
                setIsUnitPriceFocused(false);
              }}
              onChangeText={setUnitPriceText}
            />
          }
          quantity={
            <EditFieldInput
              typography={typography}
              placeholder="Qty"
              accessibilityLabel="Quantity"
              value={quantityText}
              keyboardType="decimal-pad"
              inputMode="decimal"
              onFocus={() => setIsQuantityFocused(true)}
              onBlur={() => {
                commitQuantity();
                setIsQuantityFocused(false);
              }}
              onChangeText={setQuantityText}
            />
          }
          unit={
            <EditTappableValue
              typography={typography}
              value={row.unit}
              placeholder="UOM"
              accessibilityLabel="Unit of measure"
              onPress={() => onOpenPicker({ kind: 'materialUnit', materialId: row.id })}
            />
          }
        />
      </EditIconGroup>
      <EditIconRow icon={<EditIconLink color={iconColor} />}>
        <SessionAttachRow
          typography={typography}
          sessions={sessions}
          value={row.sessionId}
          onPress={() =>
            onOpenPicker({ kind: 'attachSession', entity: 'material', entityId: row.id })
          }
        />
      </EditIconRow>
    </EntityBlock>
  );
}

function OtherCostEditBlock({
  row,
  typography,
  sessions,
  showTopBorder,
  onDelete,
  onChange,
  onOpenPicker,
  registerFieldFlusher,
}: {
  row: DraftOtherCostRow;
  typography: TextStyles;
  sessions: { id: string; dateLabel: string }[];
  showTopBorder?: boolean;
  onDelete: () => void;
  onChange: (patch: Partial<DraftOtherCostRow>) => void;
  onOpenPicker: (target: EditPickerTarget) => void;
  registerFieldFlusher: (flush: () => void) => () => void;
}) {
  const [amountText, setAmountText] = useState(() => revenueCentsToInput(row.costCents));
  const [isAmountFocused, setIsAmountFocused] = useState(false);
  const amountTextRef = useRef(amountText);
  amountTextRef.current = amountText;

  useEffect(() => {
    if (isAmountFocused) return;
    setAmountText(revenueCentsToInput(row.costCents));
  }, [isAmountFocused, row.costCents]);

  const commitAmount = useCallback(() => {
    formatMoneyFieldOnBlur(amountTextRef.current, setAmountText);
    onChange({ costCents: parseRevenueInput(amountTextRef.current) ?? 0 });
  }, [onChange]);

  useEffect(() => registerFieldFlusher(commitAmount), [commitAmount, registerFieldFlusher]);

  return (
    <EntityBlock
      typography={typography}
      showTopBorder={showTopBorder}
      onDelete={onDelete}
      accessibilityLabel="Other cost"
    >
      <EditIconGroup icon={<JobDetailIconSectionOtherCosts color={iconColor} />}>
        <EditTappableValue
          typography={typography}
          value={
            row.costType ? otherCostTypeLabel(row.costType as JobOtherCostType) : ''
          }
          placeholder="Cost type"
          accessibilityLabel="Cost type"
          onPress={() => onOpenPicker({ kind: 'costType', otherCostId: row.id })}
        />
        <EditFieldInput
          typography={typography}
          placeholder="Amount"
          accessibilityLabel="Amount"
          value={amountText}
          opticalNudgeY={-5}
          keyboardType="decimal-pad"
          inputMode="decimal"
          onFocus={() => {
            if (row.costCents > 0) {
              setAmountText(centsToEditText(row.costCents));
            }
            setIsAmountFocused(true);
          }}
          onBlur={() => {
            commitAmount();
            setIsAmountFocused(false);
          }}
          onChangeText={setAmountText}
        />
        <EditFieldInput
          typography={typography}
          value={row.description}
          onChangeText={(description) => onChange({ description })}
          placeholder="Description"
        />
      </EditIconGroup>
      <EditIconRow icon={<EditIconLink color={iconColor} />}>
        <SessionAttachRow
          typography={typography}
          sessions={sessions}
          value={row.sessionId}
          onPress={() =>
            onOpenPicker({ kind: 'attachSession', entity: 'otherCost', entityId: row.id })
          }
        />
      </EditIconRow>
    </EntityBlock>
  );
}

function NoteEditBlock({
  row,
  typography,
  sessions,
  showTopBorder,
  onDelete,
  onChange,
  onOpenPicker,
}: {
  row: DraftNoteRow;
  typography: TextStyles;
  sessions: { id: string; dateLabel: string }[];
  showTopBorder?: boolean;
  onDelete: () => void;
  onChange: (patch: Partial<DraftNoteRow>) => void;
  onOpenPicker: (target: EditPickerTarget) => void;
}) {
  const dockRef = useRef<View>(null);

  return (
    <EntityBlock
      typography={typography}
      showTopBorder={showTopBorder}
      onDelete={onDelete}
      accessibilityLabel="Note"
      dockRef={dockRef}
    >
      <EditIconGroup icon={<JobDetailIconSectionNotes color={iconColor} />}>
        <EditFieldInput
          typography={typography}
          value={row.body}
          onChangeText={(body) => onChange({ body })}
          placeholder="Note"
          multiline
        />
      </EditIconGroup>
      <EditIconRow icon={<EditIconLink color={iconColor} />}>
        <View ref={dockRef} collapsable={false}>
          <SessionAttachRow
            typography={typography}
            sessions={sessions}
            value={row.sessionId}
            onPress={() => onOpenPicker({ kind: 'attachSession', entity: 'note', entityId: row.id })}
          />
        </View>
      </EditIconRow>
    </EntityBlock>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space('Spacing/4'),
  },
  doneButton: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: space('Spacing/16'),
    paddingVertical: space('Spacing/8'),
    borderRadius: radius('Radius/12'),
    backgroundColor: color('Brand/Primary'),
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadowRn,
  },
  doneButtonDisabled: {
    opacity: 0.45,
  },
  controlDisabled: {
    opacity: 0.45,
  },
  doneLabel: {
    color: bg.canvasWarm,
  },
  pressed: { opacity: 0.75 },
  deleteJob: {
    marginTop: space('Spacing/24'),
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
});
