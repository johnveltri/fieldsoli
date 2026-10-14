import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { color, radius, space } from '@fieldsolo/design-system/lib/tokens';
import { createJobForCurrentUser } from '@fieldsolo/api-client';
import { JOB_SHORT_DESCRIPTION_MAX_LENGTH } from '@fieldsolo/shared-types';

import { formatUsdCombined } from '../../lib/formatUsd';
import { sanitizeDecimalInput } from '../../lib/moneyInput';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { bg, cardShadowRn, fg } from '../../theme/nativeTokens';
import type { TextStyles } from '../../theme/nativeTokens';
import { screenHeaderA11y } from '../../lib/accessibility';
import {
  JobDetailIconSectionAdd,
  JobDetailIconSectionMaterials,
  JobDetailIconSectionNotes,
} from '../figma-icons/JobDetailScreenIcons';
import { CAPTURE_UNIT_OPTIONS } from '../../shell/quickActionsFlowHelpers';
import { BottomSheetShell } from './BottomSheetShell';
import { DropdownBottomSheet } from './DropdownBottomSheet';
import {
  EditFieldInput,
  EditIconGroup,
  EditMaterialBreakdownRow,
  EditSheet,
  EditTappableValue,
  EditTitleField,
} from './edit-mode/EditFormRows';

export type CaptureComposerKind =
  | 'job'
  | 'note'
  | 'material'
  | 'note-edit'
  | 'material-edit';

export type CaptureComposerJobCreatedOptions = {
  /** Open Job Detail in fullscreen Edit instead of View. */
  initialEditOpen?: boolean;
};

export type CaptureComposerNoteValues = {
  body: string;
};

export type CaptureComposerMaterialValues = {
  description: string;
  totalCostCents: number;
  quantity: number;
  unit: string;
  unitCostCents: number;
  quantityExplicit: boolean;
  unitCostExplicit: boolean;
};

export type CaptureComposerSheetProps = {
  typography: TextStyles;
  visible: boolean;
  kind: CaptureComposerKind;
  onClose: () => void;
  /** Job only — create runs inside the sheet. */
  onJobCreated?: (
    jobId: string,
    options?: CaptureComposerJobCreatedOptions,
  ) => void;
  /** Note / material — parent persists to Inbox. */
  saving?: boolean;
  onSaveNote?: (values: CaptureComposerNoteValues) => void;
  onSaveMaterial?: (values: CaptureComposerMaterialValues) => void;
  /** Prefill when editing an existing Inbox item (seeded on open). */
  initialNote?: CaptureComposerNoteValues | null;
  initialMaterial?: CaptureComposerMaterialValues | null;
  /** Edit kinds only — open job picker; receives current draft values. */
  onAddToJobNote?: (values: CaptureComposerNoteValues) => void;
  onAddToJobMaterial?: (values: CaptureComposerMaterialValues) => void;
  /**
   * Hosts already inside a Modal should pass false so NativeTabs stay mounted.
   * @default true
   */
  registerInGlobalStack?: boolean;
};

/** Empty note field is one line by default; 6 lines so the sheet isn’t stubby. */
const NOTE_COMPOSER_FIELD_MIN_HEIGHT = 22 * 6;

function isNoteKind(kind: CaptureComposerKind): boolean {
  return kind === 'note' || kind === 'note-edit';
}

function isMaterialKind(kind: CaptureComposerKind): boolean {
  return kind === 'material' || kind === 'material-edit';
}

function parseMoneyToCents(text: string): number | null {
  const cleaned = text.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function parseQuantity(text: string): number | null {
  const cleaned = text.trim().replace(/[^0-9.]/g, '');
  if (!cleaned || cleaned === '.') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function centsToEditText(cents: number): string {
  if (cents <= 0) return '';
  return (cents / 100).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function sheetTitleForKind(kind: CaptureComposerKind): string {
  switch (kind) {
    case 'job':
      return 'New Job';
    case 'note':
      return 'Quick Note';
    case 'material':
      return 'Quick Material';
    case 'note-edit':
      return 'Edit Note';
    case 'material-edit':
      return 'Edit Material';
  }
}

function accessibilityTitleForKind(kind: CaptureComposerKind): string {
  return sheetTitleForKind(kind);
}

function primaryLabelForKind(kind: CaptureComposerKind): string {
  switch (kind) {
    case 'job':
      return 'ADD JOB';
    case 'note':
      return 'SAVE NOTE TO INBOX';
    case 'material':
      return 'SAVE MATERIAL TO INBOX';
    case 'note-edit':
      return 'SAVE NOTE';
    case 'material-edit':
      return 'SAVE MATERIAL';
  }
}

/**
 * Shared primary-capture bottom sheet for New Job, Quick Note/Material, and
 * Inbox edit. Same chrome; `kind` swaps fields, titles, and primary action.
 */
export function CaptureComposerSheet({
  typography,
  visible,
  kind,
  onClose,
  onJobCreated,
  saving = false,
  onSaveNote,
  onSaveMaterial,
  initialNote = null,
  initialMaterial = null,
  onAddToJobNote,
  onAddToJobMaterial,
  registerInGlobalStack = true,
}: CaptureComposerSheetProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [description, setDescription] = useState('');
  const [totalText, setTotalText] = useState('');
  const [totalCents, setTotalCents] = useState(0);
  const [quantityText, setQuantityText] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [quantityExplicit, setQuantityExplicit] = useState(false);
  const [unitPriceText, setUnitPriceText] = useState('');
  const [unitCostCents, setUnitCostCents] = useState(0);
  const [unitCostExplicit, setUnitCostExplicit] = useState(false);
  const [unit, setUnit] = useState('');
  const [unitPickerVisible, setUnitPickerVisible] = useState(false);
  const [totalFocused, setTotalFocused] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const jobTitleRef = useRef<TextInput>(null);
  const jobTitleFocusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jobTitleFocusFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!visible || kind !== 'job') return;

    jobTitleFocusFrameRef.current = requestAnimationFrame(() => {
      jobTitleFocusTimeoutRef.current = setTimeout(() => {
        jobTitleRef.current?.focus();
      }, 80);
    });

    return () => {
      if (jobTitleFocusFrameRef.current != null) {
        cancelAnimationFrame(jobTitleFocusFrameRef.current);
        jobTitleFocusFrameRef.current = null;
      }
      if (jobTitleFocusTimeoutRef.current) {
        clearTimeout(jobTitleFocusTimeoutRef.current);
        jobTitleFocusTimeoutRef.current = null;
      }
    };
  }, [kind, visible]);

  useEffect(() => {
    if (!visible) return;
    setTitle('');
    setBody(initialNote?.body ?? '');
    const mat = initialMaterial;
    const qtyExplicit = mat?.quantityExplicit === true;
    const priceExplicit = mat?.unitCostExplicit === true;
    const total = mat?.totalCostCents ?? 0;
    const qty = mat?.quantity ?? 0;
    const price = mat?.unitCostCents ?? 0;
    setDescription(mat?.description ?? '');
    setTotalCents(total);
    setTotalText(total > 0 ? formatUsdCombined(total) : '');
    setQuantity(qtyExplicit ? qty : 0);
    setQuantityExplicit(qtyExplicit);
    setQuantityText(qtyExplicit && qty > 0 ? String(qty) : '');
    setUnitCostCents(priceExplicit ? price : 0);
    setUnitCostExplicit(priceExplicit);
    setUnitPriceText(
      priceExplicit ? `@ ${formatUsdCombined(price)}` : '',
    );
    setUnit(mat?.unit?.trim() ?? '');
    setUnitPickerVisible(false);
    setTotalFocused(false);
    setCommitting(false);
    setError(null);
    // Seed once per open; parent drafts stay stable while the sheet is visible.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [visible, kind]);

  const hasCompleteBreakdown = quantityExplicit && unitCostExplicit;
  const breakdownTotalCents =
    hasCompleteBreakdown && quantity > 0
      ? Math.round(quantity * unitCostCents)
      : 0;
  const resolvedTotalCents = hasCompleteBreakdown
    ? breakdownTotalCents
    : totalCents;
  const totalCostDisplay =
    resolvedTotalCents > 0 || hasCompleteBreakdown
      ? `${formatUsdCombined(resolvedTotalCents)} total`
      : '';

  const materialValues = useCallback((): CaptureComposerMaterialValues => {
    return {
      description: description.trim(),
      totalCostCents: resolvedTotalCents,
      quantity: hasCompleteBreakdown ? quantity : 1,
      unit: unit.trim() || 'ea',
      unitCostCents: hasCompleteBreakdown ? unitCostCents : resolvedTotalCents,
      quantityExplicit: hasCompleteBreakdown,
      unitCostExplicit: hasCompleteBreakdown,
    };
  }, [
    description,
    hasCompleteBreakdown,
    quantity,
    resolvedTotalCents,
    unit,
    unitCostCents,
  ]);

  const busy = committing || saving;
  const canCommitJob = title.trim().length > 0 && !busy;
  const canSaveNote = body.trim().length > 0 && !busy;
  const canSaveMaterial =
    description.trim().length > 0 && resolvedTotalCents > 0 && !busy;
  const canPrimary =
    kind === 'job'
      ? canCommitJob
      : isNoteKind(kind)
        ? canSaveNote
        : canSaveMaterial;
  const showAddToJob =
    (kind === 'note-edit' && onAddToJobNote != null) ||
    (kind === 'material-edit' && onAddToJobMaterial != null);

  const createJob = useCallback(
    async (options?: CaptureComposerJobCreatedOptions) => {
      if (!canCommitJob || !onJobCreated) return;
      if (!isSupabaseConfigured()) {
        setError('Supabase is not configured.');
        return;
      }
      setCommitting(true);
      setError(null);
      try {
        const shortDescription = title.trim();
        const jobId = await createJobForCurrentUser(supabase, { shortDescription });
        onJobCreated(jobId, options);
      } catch {
        setError("Couldn't add this job. Try again.");
        setCommitting(false);
        return;
      }
      setCommitting(false);
    },
    [canCommitJob, onJobCreated, title],
  );

  const onPrimary = useCallback(() => {
    if (!canPrimary) return;
    if (kind === 'job') {
      void createJob({ initialEditOpen: false });
      return;
    }
    if (isNoteKind(kind)) {
      onSaveNote?.({ body: body.trim() });
      return;
    }
    onSaveMaterial?.(materialValues());
  }, [
    body,
    canPrimary,
    createJob,
    kind,
    materialValues,
    onSaveMaterial,
    onSaveNote,
  ]);

  const onAddToJob = useCallback(() => {
    if (kind === 'note-edit') {
      onAddToJobNote?.({ body: body.trim() });
      return;
    }
    if (kind === 'material-edit') {
      onAddToJobMaterial?.(materialValues());
    }
  }, [body, kind, materialValues, onAddToJobMaterial, onAddToJobNote]);

  const iconColor = fg.secondary;
  const primaryLabel = primaryLabelForKind(kind);
  const sheetTitle = sheetTitleForKind(kind);
  const onDark = bg.canvasWarm;

  return (
    <>
      <BottomSheetShell
        visible={visible}
        onClose={onClose}
        autoSizeUpToFraction={0.92}
        registerInGlobalStack={registerInGlobalStack}
        accessibilityTitle={accessibilityTitleForKind(kind)}
      >
        <View style={styles.body}>
          {visible ? (
          <>
          {kind === 'note-edit' || kind === 'material-edit' ? (
            <View style={styles.header}>
              <Text
                {...screenHeaderA11y()}
                style={[typography.titleH3, styles.headerTitle, { color: fg.primary }]}
              >
                {sheetTitle}
              </Text>
              {showAddToJob ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add to job"
                  onPress={onAddToJob}
                  style={({ pressed }) => [
                    styles.jobPill,
                    pressed && styles.pressed,
                  ]}
                >
                  <JobDetailIconSectionAdd color={onDark} />
                  <Text style={[typography.pillCompact, { color: onDark }]}>JOB</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {kind === 'job' ? (
            <EditSheet>
              <EditTitleField
                ref={jobTitleRef}
                typography={typography}
                accessibilityLabel="Job title"
                placeholder="Job title"
                value={title}
                onChangeText={(t) =>
                  setTitle(t.slice(0, JOB_SHORT_DESCRIPTION_MAX_LENGTH))
                }
                autoFocus
              />
            </EditSheet>
          ) : null}

          {isNoteKind(kind) ? (
            <EditSheet>
              <EditIconGroup
                icon={<JobDetailIconSectionNotes color={iconColor} />}
                iconAlign="top"
              >
                <EditFieldInput
                  typography={typography}
                  accessibilityLabel="Note"
                  placeholder="Note"
                  value={body}
                  onChangeText={setBody}
                  multiline
                  autoFocus
                  style={{ minHeight: NOTE_COMPOSER_FIELD_MIN_HEIGHT }}
                />
              </EditIconGroup>
            </EditSheet>
          ) : null}

          {isMaterialKind(kind) ? (
            <EditSheet>
              <EditIconGroup
                icon={<JobDetailIconSectionMaterials color={iconColor} />}
              >
                <EditFieldInput
                  typography={typography}
                  accessibilityLabel="Material"
                  placeholder="Material"
                  value={description}
                  onChangeText={setDescription}
                  autoFocus
                />
                <EditFieldInput
                  typography={typography}
                  accessibilityLabel="Total cost"
                  placeholder="Total cost"
                  value={
                    totalFocused && !hasCompleteBreakdown
                      ? totalText
                      : totalCostDisplay
                  }
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  editable={!hasCompleteBreakdown}
                  style={hasCompleteBreakdown ? { color: fg.secondary } : undefined}
                  onFocus={() => {
                    if (totalCents > 0) {
                      setTotalText(centsToEditText(totalCents));
                    }
                    setTotalFocused(true);
                  }}
                  onChangeText={(text) => {
                    if (hasCompleteBreakdown) return;
                    const sanitized = sanitizeDecimalInput(text);
                    setTotalText(sanitized);
                    const cents = parseMoneyToCents(sanitized);
                    setTotalCents(cents != null && cents > 0 ? cents : 0);
                  }}
                  onBlur={() => {
                    if (!hasCompleteBreakdown && totalCents > 0) {
                      setTotalText(formatUsdCombined(totalCents));
                    }
                    setTotalFocused(false);
                  }}
                />
                <EditMaterialBreakdownRow
                  quantity={
                    <EditFieldInput
                      typography={typography}
                      placeholder="Qty"
                      accessibilityLabel="Quantity"
                      value={quantityText}
                      keyboardType="decimal-pad"
                      inputMode="decimal"
                      onChangeText={(text) => {
                        setQuantityText(text);
                        const qty = parseQuantity(text);
                        const explicit = text.trim().length > 0;
                        setQuantity(qty ?? 0);
                        setQuantityExplicit(explicit);
                      }}
                      onBlur={() => {
                        const qty = parseQuantity(quantityText);
                        setQuantityText(qty != null ? String(qty) : '');
                      }}
                    />
                  }
                  unit={
                    <EditTappableValue
                      typography={typography}
                      value={unit}
                      placeholder="UOM"
                      accessibilityLabel="Unit of measure"
                      onPress={() => setUnitPickerVisible(true)}
                    />
                  }
                  unitPrice={
                    <EditFieldInput
                      typography={typography}
                      placeholder="@ unit price"
                      accessibilityLabel="Unit price"
                      value={unitPriceText}
                      keyboardType="decimal-pad"
                      inputMode="decimal"
                      onFocus={() => {
                        if (unitCostExplicit) {
                          setUnitPriceText(centsToEditText(unitCostCents));
                        }
                      }}
                      onChangeText={(text) => {
                        const sanitized = sanitizeDecimalInput(text);
                        setUnitPriceText(sanitized);
                        const cents = parseMoneyToCents(sanitized);
                        const explicit = sanitized.trim().length > 0;
                        setUnitCostCents(cents ?? 0);
                        setUnitCostExplicit(explicit);
                      }}
                      onBlur={() => {
                        const cents = parseMoneyToCents(unitPriceText);
                        setUnitPriceText(
                          cents != null ? `@ ${formatUsdCombined(cents)}` : '',
                        );
                      }}
                    />
                  }
                />
              </EditIconGroup>
            </EditSheet>
          ) : null}

          {kind === 'job' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add job details"
              accessibilityState={{ disabled: !canCommitJob }}
              disabled={!canCommitJob}
              onPress={() => void createJob({ initialEditOpen: true })}
              style={({ pressed }) => [
                styles.detailsToggle,
                !canCommitJob && styles.disabled,
                pressed && canCommitJob && styles.pressed,
              ]}
            >
              <Text style={[typography.bodyBold, { color: fg.secondary }]}>
                Add details
              </Text>
            </Pressable>
          ) : null}

          {error ? (
            <Text
              style={[
                typography.bodySmall,
                { color: color('Semantic/Status/Error/Text') },
              ]}
            >
              {error}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              primaryLabel === 'ADD JOB'
                ? 'Add job'
                : isNoteKind(kind)
                  ? kind === 'note-edit'
                    ? 'Save note'
                    : 'Save note to inbox'
                  : kind === 'material-edit'
                    ? 'Save material'
                    : 'Save material to inbox'
            }
            accessibilityState={{ disabled: !canPrimary }}
            disabled={!canPrimary}
            onPress={onPrimary}
            style={({ pressed }) => [
              styles.primary,
              !canPrimary && styles.disabled,
              pressed && canPrimary && styles.pressed,
            ]}
          >
            {busy ? (
              <ActivityIndicator color={color('Foundation/Surface/White')} />
            ) : (
              <Text style={[typography.ctaPrimaryLabel, styles.primaryLabel]}>
                {primaryLabel}
              </Text>
            )}
          </Pressable>
          </>
          ) : null}
        </View>
      </BottomSheetShell>

      <DropdownBottomSheet
        typography={typography}
        visible={unitPickerVisible}
        options={CAPTURE_UNIT_OPTIONS}
        currentValue={unit || null}
        allowCustom
        customPlaceholder="Custom unit"
        customMaxLength={8}
        onBack={() => setUnitPickerVisible(false)}
        onClose={() => setUnitPickerVisible(false)}
        onClear={() => {
          setUnit('');
          setUnitPickerVisible(false);
        }}
        onSelect={(value) => {
          setUnit(value);
          setUnitPickerVisible(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  body: {
    width: '100%',
    gap: space('Spacing/12'),
    paddingBottom: space('Spacing/8'),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space('Spacing/12'),
    minHeight: 44,
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
    textAlign: 'left',
  },
  jobPill: {
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
  detailsToggle: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: space('Spacing/4'),
  },
  primary: {
    width: '100%',
    minHeight: space('Spacing/50'),
    borderRadius: radius('Radius/12'),
    backgroundColor: color('Brand/Primary'),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space('Spacing/16'),
    paddingVertical: space('Spacing/12'),
    ...cardShadowRn,
  },
  primaryLabel: {
    color: color('Foundation/Surface/White'),
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: { opacity: 0.8 },
});
