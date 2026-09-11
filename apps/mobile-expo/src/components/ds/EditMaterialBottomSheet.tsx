import { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { color, radius, space } from '@fieldsolo/design-system/lib/tokens';
// radius() still used for pill (Radius/Full).

import { bg, border, cardShadowRn, fg } from '../../theme/nativeTokens';
import type { TextStyles } from '../../theme/nativeTokens';
import {
  JobDetailIconSectionAdd,
  JobDetailIconSectionMaterials,
  SessionCardEditPencilIcon,
  SessionSheetBackIcon,
} from '../figma-icons/JobDetailScreenIcons';
import { BottomSheetShell } from './BottomSheetShell';
import { screenHeaderA11y } from '../../lib/accessibility';
import { SheetPrimaryDeleteActions } from './SheetPrimaryDeleteActions';

export type EditMaterialBottomSheetValues = {
  description: string;
  /** Per-unit cost in cents. Zero is allowed (e.g. unknown). */
  unitCostCents: number;
  /** Raw numeric quantity. Must be > 0 for the primary action to enable (legacy). */
  quantity: number;
  unit: string;
  /** Phase 3 total-first: authoritative total when breakdown is incomplete. */
  totalCostCents?: number;
  quantityExplicit?: boolean;
  unitCostExplicit?: boolean;
};

export type EditMaterialBottomSheetAssignedSession = {
  id: string;
  dateLabel: string;
  timeRangeLabel: string;
};

type EditMaterialBottomSheetProps = {
  typography: TextStyles;
  visible: boolean;
  /** "Add Material" | "Edit Material" */
  title: string;
  /** "SAVE NEW MATERIAL" | "SAVE CHANGES" */
  primaryLabel: string;
  /** Prefill values; undefined defaults to blank add-form state. */
  values?: EditMaterialBottomSheetValues;
  /** When non-null, header renders the pencil SESSION pill + session subtitle. */
  assignedSession: EditMaterialBottomSheetAssignedSession | null;
  /** Hides the `+SESSION` pill entirely when the job has no completed sessions. */
  canAttachSession: boolean;
  /**
   * Overrides the subtitle line. Defaults to "Unassigned job material" (or the
   * session label when `assignedSession` is set). Inbox quick capture passes
   * "Unassigned quick capture material".
   */
  subtitle?: string;
  /**
   * When provided, the header renders a `+JOB` pill (instead of `+SESSION`)
   * used by the Inbox quick-capture flow to attach this material to a job.
   * Lifts the current field values so the parent can cache them.
   */
  onJobPillPress?: (currentValues: EditMaterialBottomSheetValues) => void;
  onClose?: () => void;
  onClosed?: () => void;
  onBack?: () => void;
  onSavePress?: (values: EditMaterialBottomSheetValues) => void;
  /** Trash icon — for Add this discards the draft; for Edit this soft-deletes. */
  onDeletePress?: () => void;
  /**
   * Opens the `ChooseSessionBottomSheet` in either `attach` or `edit` mode.
   * Receives the current in-sheet field values so the parent can cache them
   * before switching flows — the sheet unmounts its keyboard and is hidden
   * on return, so without this lift the local state would be lost.
   */
  onSessionPillPress?: (currentValues: EditMaterialBottomSheetValues) => void;
  /**
   * Opens the `DropdownBottomSheet` prefilled with the current unit. Receives
   * the current in-sheet field values so the parent can cache them (see the
   * note on `onSessionPillPress`).
   */
  onUnitPress?: (currentValues: EditMaterialBottomSheetValues) => void;
  /** Shown under the sheet title (e.g. mark-complete wizard). */
  materialError?: string;
  noneConfirmLabel?: string;
  onNoneConfirmPress?: () => void;
  /** @default true — set false when this sheet replaces another (e.g. live session) without stacking. */
  registerInGlobalStack?: boolean;
  /**
   * Phase 3: description + total are enough to save; qty/unit price optional.
   * When true, primary field is Total; breakdown fields remain available.
   */
  totalFirstMode?: boolean;
};

function toCurrencyString(cents: number): string {
  if (!Number.isFinite(cents) || cents <= 0) return '';
  return (cents / 100).toFixed(2);
}

/**
 * Parses a currency text field into a `cents` integer. Accepts digits and a
 * single decimal point; returns NaN for unparseable input so callers can
 * disable the save button.
 */
function parseCentsFromText(text: string): number {
  const cleaned = text.replace(/[^0-9.]/g, '');
  if (cleaned === '' || cleaned === '.') return 0;
  const dollars = Number(cleaned);
  if (!Number.isFinite(dollars)) return NaN;
  return Math.round(dollars * 100);
}

function toQuantityString(qty: number): string {
  if (!Number.isFinite(qty) || qty <= 0) return '';
  // Trim trailing ".000" so 1.000 → "1" but 1.5 is preserved.
  return String(qty);
}

function parseQuantityFromText(text: string): number {
  const cleaned = text.replace(/[^0-9.]/g, '');
  if (cleaned === '' || cleaned === '.') return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function DropdownCaret() {
  return (
    <Svg width={10} height={10} viewBox="0 0 10 10" fill="none">
      <Path
        d="M2 3.5L5 6.5L8 3.5"
        stroke={fg.secondary}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Add / Edit Material sheet (Figma `1283:426` Add Material / `1882:1709`
 * Edit Material).
 *
 * Mirrors the contract of `EditNoteBottomSheet`: parent-supplied `title` and
 * `primaryLabel` stay stable during the slide-down close animation. Local
 * field state resets on the `visible` edge.
 *
 * Layout (top → bottom):
 *   Back
 *   [wrench]  Title                         [+ SESSION] pill
 *   "Unassigned job material" | "Session: …"
 *   Description (full width)
 *   [ Unit Price ]  [ Qty ]  [ Unit ▾ ]
 *   [ SAVE …                 ]  [ 🗑 ]
 *
 * Keyboard handling is inherited from `BottomSheetShell` (sheet slides up
 * when the keyboard opens). The price + quantity inputs use a numeric
 * soft keyboard. The unit input is a Pressable that delegates to
 * `onUnitPress` — typing is not allowed here; custom units are entered
 * via the generic `DropdownBottomSheet`.
 */
export function EditMaterialBottomSheet({
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
  onUnitPress,
  materialError,
  noneConfirmLabel,
  onNoneConfirmPress,
  registerInGlobalStack = true,
  totalFirstMode = false,
}: EditMaterialBottomSheetProps) {
  const [description, setDescription] = useState<string>(
    values?.description ?? '',
  );
  const [priceText, setPriceText] = useState<string>(
    toCurrencyString(values?.unitCostCents ?? 0),
  );
  const [qtyText, setQtyText] = useState<string>(
    toQuantityString(values?.quantity ?? 0),
  );
  const [totalText, setTotalText] = useState<string>(
    toCurrencyString(values?.totalCostCents ?? values?.unitCostCents ?? 0),
  );
  const [showBreakdown, setShowBreakdown] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setDescription(values?.description ?? '');
    setPriceText(toCurrencyString(values?.unitCostCents ?? 0));
    setQtyText(toQuantityString(values?.quantity ?? 0));
    setTotalText(
      toCurrencyString(values?.totalCostCents ?? values?.unitCostCents ?? 0),
    );
    setShowBreakdown(false);
  }, [
    values?.description,
    values?.unitCostCents,
    values?.quantity,
    values?.totalCostCents,
    visible,
  ]);

  const materialGreen = color('Semantic/Activity/Material');
  const onDark = bg.canvasWarm;

  const cents = parseCentsFromText(priceText);
  const qty = parseQuantityFromText(qtyText);
  const totalCents = parseCentsFromText(totalText);
  const hasDescription = description.trim().length > 0;
  const hasQty = Number.isFinite(qty) && qty > 0;
  const hasValidCost = Number.isFinite(cents) && cents >= 0;
  const hasTotalText = totalText.trim().length > 0;
  const hasValidTotal = hasTotalText && Number.isFinite(totalCents) && totalCents >= 0;
  const canSave = totalFirstMode
    ? hasDescription && hasValidTotal
    : hasDescription && hasQty && hasValidCost;

  const showSessionPill = canAttachSession || assignedSession !== null;
  const currentUnit = values?.unit?.trim() ?? '';

  /**
   * Snapshot the current in-sheet state for lift-up to the parent. Used by
   * the session pill and unit pressables so the parent can cache these
   * before swapping to another sub-sheet.
   */
  const currentDraft = (): EditMaterialBottomSheetValues => {
    if (totalFirstMode) {
      const qtyExplicit = showBreakdown && hasQty;
      const unitExplicit = showBreakdown && hasValidCost && priceText.trim() !== '';
      const resolvedTotal =
        qtyExplicit && unitExplicit
          ? Math.round(cents * qty)
          : Number.isFinite(totalCents)
            ? totalCents
            : 0;
      return {
        description: description.trim(),
        unitCostCents: unitExplicit ? cents : resolvedTotal,
        quantity: qtyExplicit ? qty : 1,
        unit: currentUnit || 'ea',
        totalCostCents: resolvedTotal,
        quantityExplicit: qtyExplicit,
        unitCostExplicit: unitExplicit,
      };
    }
    return {
      description: description.trim(),
      unitCostCents: Number.isFinite(cents) ? cents : 0,
      quantity: Number.isFinite(qty) ? qty : 0,
      unit: currentUnit || 'ea',
    };
  };

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
            <JobDetailIconSectionMaterials color={materialGreen} />
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
              onPress={() => onJobPillPress(currentDraft())}
              style={({ pressed }) => [styles.sessionButton, pressed && styles.pressed]}
            >
              <JobDetailIconSectionAdd color={onDark} />
              <Text style={[typography.pillCompact, { color: onDark }]}>JOB</Text>
            </Pressable>
          ) : showSessionPill ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={assignedSession ? 'Edit session' : 'Attach to session'}
              onPress={() => onSessionPillPress?.(currentDraft())}
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

        {materialError ? (
          <Text style={[typography.bodySmall, { color: color('Semantic/Status/Error/Text') }]}>
            {materialError}
          </Text>
        ) : null}

        <Text style={[typography.bodySmall, styles.subtitle]}>
          {subtitle ??
            (assignedSession
              ? `Session: ${assignedSession.dateLabel} ${assignedSession.timeRangeLabel}`
              : 'Unassigned job material')}
        </Text>

        <View style={styles.inputShell}>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={'e.g. Copper Pipe 1/2"'}
            placeholderTextColor={fg.secondary}
            style={[typography.body, styles.inputText]}
          />
        </View>

        {totalFirstMode ? (
          <>
            <View style={styles.inputShell}>
              <TextInput
                value={totalText}
                onChangeText={setTotalText}
                placeholder="Total"
                placeholderTextColor={fg.secondary}
                keyboardType="decimal-pad"
                style={[typography.body, styles.inputText]}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                showBreakdown ? 'Hide quantity and unit price' : 'Add quantity and unit price'
              }
              onPress={() => setShowBreakdown((v) => !v)}
              style={({ pressed }) => [styles.breakdownToggle, pressed && styles.pressed]}
            >
              <Text style={[typography.bodySmall, { color: fg.secondary }]}>
                {showBreakdown ? 'Hide qty & unit price' : 'Add qty & unit price'}
              </Text>
            </Pressable>
          </>
        ) : null}

        {!totalFirstMode || showBreakdown ? (
        <View style={styles.row}>
          <View style={[styles.inputShell, styles.priceShell]}>
            <TextInput
              value={priceText}
              onChangeText={setPriceText}
              placeholder="Unit Price"
              placeholderTextColor={fg.secondary}
              keyboardType="decimal-pad"
              style={[typography.body, styles.inputText]}
            />
          </View>
          <View style={[styles.inputShell, styles.qtyShell]}>
            <TextInput
              value={qtyText}
              onChangeText={setQtyText}
              placeholder="1"
              placeholderTextColor={fg.secondary}
              keyboardType="decimal-pad"
              style={[typography.body, styles.inputText, styles.qtyInput]}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose unit"
            onPress={() => onUnitPress?.(currentDraft())}
            disabled={!onUnitPress}
            style={({ pressed }) => [
              styles.inputShell,
              styles.unitShell,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[typography.body, { color: fg.primary }]}
            >
              {currentUnit || 'ea'}
            </Text>
            <DropdownCaret />
          </Pressable>
        </View>
        ) : null}

        <SheetPrimaryDeleteActions
          typography={typography}
          primaryLabel={primaryLabel}
          primaryDisabled={!canSave}
          primaryColor={materialGreen}
          onPrimaryPress={() => onSavePress?.(currentDraft())}
          onDeletePress={onDeletePress}
        />

        {noneConfirmLabel && onNoneConfirmPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={noneConfirmLabel}
            onPress={onNoneConfirmPress}
            style={({ pressed }) => [styles.noneConfirm, pressed && styles.pressed]}
          >
            <Text style={[typography.metricSLabel, { color: color('Semantic/Status/Success/Text') }]}>
              {noneConfirmLabel}
            </Text>
          </Pressable>
        ) : null}
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
  inputShell: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: border.subtle,
    borderRadius: 8,
    backgroundColor: bg.surfaceWhite,
    paddingHorizontal: 13,
    paddingVertical: 9,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  inputText: {
    color: fg.primary,
    padding: 0,
    width: '100%',
  },
  breakdownToggle: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: space('Spacing/4'),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: space('Spacing/8'),
  },
  priceShell: {
    flex: 1,
  },
  qtyShell: {
    width: space('Spacing/64') + space('Spacing/8'),
  },
  qtyInput: {
    textAlign: 'left',
  },
  unitShell: {
    width: space('Spacing/64') + space('Spacing/8'),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space('Spacing/8'),
  },
  pressed: {
    opacity: 0.75,
  },
  noneConfirm: {
    alignItems: 'center',
    paddingVertical: space('Spacing/8'),
  },
});
