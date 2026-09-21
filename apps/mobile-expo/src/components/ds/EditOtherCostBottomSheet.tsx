import { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { color, radius, space } from '@fieldsolo/design-system/lib/tokens';

import { DsTextInput } from './DsTextInput';
import { bg, border, cardShadowRn, fg } from '../../theme/nativeTokens';
import type { TextStyles } from '../../theme/nativeTokens';
import {
  JobDetailIconSectionAdd,
  JobDetailIconSectionOtherCosts,
  SessionCardEditPencilIcon,
  SessionSheetBackIcon,
} from '../figma-icons/JobDetailScreenIcons';
import type { JobOtherCostType } from '../../lib/otherCostTypes';
import { otherCostTypeLabel } from '../../lib/otherCostTypes';
import { BottomSheetShell } from './BottomSheetShell';
import { screenHeaderA11y } from '../../lib/accessibility';
import { SheetPrimaryDeleteActions } from './SheetPrimaryDeleteActions';

export type EditOtherCostBottomSheetValues = {
  costType: JobOtherCostType;
  costCents: number;
  description: string;
};

export type EditOtherCostBottomSheetAssignedSession = {
  id: string;
  dateLabel: string;
  timeRangeLabel: string;
};

type EditOtherCostBottomSheetProps = {
  typography: TextStyles;
  visible: boolean;
  title: string;
  primaryLabel: string;
  values?: EditOtherCostBottomSheetValues;
  assignedSession: EditOtherCostBottomSheetAssignedSession | null;
  canAttachSession: boolean;
  /** Shown under the sheet title (e.g. mark-complete wizard). */
  otherCostError?: string;
  noneConfirmLabel?: string;
  onNoneConfirmPress?: () => void;
  onClose?: () => void;
  onClosed?: () => void;
  onBack?: () => void;
  onSavePress?: (values: EditOtherCostBottomSheetValues) => void;
  onDeletePress?: () => void;
  onSessionPillPress?: (currentValues: EditOtherCostBottomSheetValues) => void;
  onCostTypePress?: (currentValues: EditOtherCostBottomSheetValues) => void;
  registerInGlobalStack?: boolean;
};

function toCurrencyString(cents: number): string {
  if (!Number.isFinite(cents) || cents <= 0) return '';
  return (cents / 100).toFixed(2);
}

function parseCentsFromText(text: string): number {
  const cleaned = text.replace(/[^0-9.]/g, '');
  if (cleaned === '' || cleaned === '.') return 0;
  const dollars = Number(cleaned);
  if (!Number.isFinite(dollars)) return NaN;
  return Math.round(dollars * 100);
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

export function EditOtherCostBottomSheet({
  typography,
  visible,
  title,
  primaryLabel,
  values,
  assignedSession,
  canAttachSession,
  otherCostError,
  noneConfirmLabel,
  onNoneConfirmPress,
  onClose,
  onClosed,
  onBack,
  onSavePress,
  onDeletePress,
  onSessionPillPress,
  onCostTypePress,
  registerInGlobalStack = true,
}: EditOtherCostBottomSheetProps) {
  const [costType, setCostType] = useState<JobOtherCostType>(values?.costType ?? 'helper_labor');
  const [priceText, setPriceText] = useState(toCurrencyString(values?.costCents ?? 0));
  const [description, setDescription] = useState(values?.description ?? '');

  useEffect(() => {
    if (!visible) return;
    setCostType(values?.costType ?? 'helper_labor');
    setPriceText(toCurrencyString(values?.costCents ?? 0));
    setDescription(values?.description ?? '');
  }, [values?.costType, values?.costCents, values?.description, visible]);

  const accent = color('Brand/Accent');
  const onDark = bg.canvasWarm;
  const cents = parseCentsFromText(priceText);
  const hasValidCost = Number.isFinite(cents) && cents > 0;
  const canSave = hasValidCost;

  const currentDraft = (): EditOtherCostBottomSheetValues => ({
    costType,
    costCents: Number.isFinite(cents) && cents > 0 ? cents : 0,
    description: description.trim(),
  });

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
            <JobDetailIconSectionOtherCosts color={accent} />
          </View>
          <Text {...screenHeaderA11y()}
            style={[typography.titleH3, styles.headerTitle, { color: fg.primary }]}
          >
            {title}
          </Text>
          {showSessionPill ? (
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

        {otherCostError ? (
          <Text style={[typography.bodySmall, { color: color('Semantic/Status/Error/Text') }]}>
            {otherCostError}
          </Text>
        ) : null}

        <Text style={[typography.bodySmall, styles.subtitle]}>
          {assignedSession
            ? `Session: ${assignedSession.dateLabel} ${assignedSession.timeRangeLabel}`
            : 'Unassigned job cost'}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose cost type"
          onPress={() => onCostTypePress?.(currentDraft())}
          disabled={!onCostTypePress}
          style={({ pressed }) => [styles.inputShell, styles.typeShell, pressed && styles.pressed]}
        >
          <Text style={[typography.body, { color: fg.primary, flex: 1 }]}>
            {otherCostTypeLabel(costType)}
          </Text>
          <DropdownCaret />
        </Pressable>

        <View style={styles.inputShell}>
          <DsTextInput
            value={priceText}
            onChangeText={setPriceText}
            placeholder="Cost"
            placeholderTextColor={fg.secondary}
            keyboardType="decimal-pad"
            style={[typography.body, styles.inputText]}
          />
        </View>

        <View style={styles.inputShell}>
          <DsTextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Description (optional)"
            placeholderTextColor={fg.secondary}
            style={[typography.body, styles.inputText]}
          />
        </View>

        <SheetPrimaryDeleteActions
          typography={typography}
          primaryLabel={primaryLabel}
          primaryDisabled={!canSave}
          primaryColor={color('Semantic/Status/Success/Text')}
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
  typeShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space('Spacing/8'),
  },
  inputText: {
    color: fg.primary,
    padding: 0,
    width: '100%',
  },
  noneConfirm: {
    alignItems: 'center',
    paddingVertical: space('Spacing/8'),
  },
  pressed: {
    opacity: 0.75,
  },
});
