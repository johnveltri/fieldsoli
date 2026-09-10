import { Pressable, StyleSheet, Text, View } from 'react-native';
import { color, radius, space } from '@fieldsolo/design-system/lib/tokens';
import type { JobDetailViewModel } from '@fieldsolo/shared-types';

import { formatUsdCombined } from '../../lib/formatUsd';
import {
  bg,
  border,
  fg,
} from '../../theme/nativeTokens';
import type { TextStyles } from '../../theme/nativeTokens';

export function JobDetailSummaryCard({
  earnings,
  typography,
  onPress,
  noRevenueConfirmed,
}: {
  earnings: JobDetailViewModel['earnings'];
  typography: TextStyles;
  onPress?: () => void;
  noRevenueConfirmed?: boolean;
}) {
  const netTone =
    earnings.netEarningsCents >= 0
    ? color('Semantic/Financial/Positive')
    : color('Semantic/Financial/Negative');
  const matTone = color('Semantic/Financial/Negative');
  const otherTone = color('Semantic/Financial/Negative');
  const feesTone =
    earnings.feesCents < 0 ? color('Semantic/Financial/Negative') : fg.primary;
  const showFees = earnings.feesCents !== 0;
  const materialsDisplay = `-${formatUsdCombined(Math.abs(earnings.materialsCents))}`;
  const otherCostsDisplay = `-${formatUsdCombined(Math.abs(earnings.otherCostsCents))}`;

  const content = (
    <View style={styles.summaryStack}>
      <View style={styles.summaryRow}>
        <Text style={[typography.body, { color: fg.secondary, flex: 1 }]}>Revenue</Text>
        <Text style={[typography.bodyBold, styles.summaryMoney]}>
          {noRevenueConfirmed
            ? formatUsdCombined(0)
            : earnings.revenueCents != null && earnings.revenueCents > 0
              ? formatUsdCombined(earnings.revenueCents)
              : '—'}
        </Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={[typography.body, { color: fg.secondary, flex: 1 }]}>Materials</Text>
        <Text style={[typography.bodyBold, styles.summaryMoney, { color: matTone }]}>
          {materialsDisplay}
        </Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={[typography.body, { color: fg.secondary, flex: 1 }]}>Other Costs</Text>
        <Text style={[typography.bodyBold, styles.summaryMoney, { color: otherTone }]}>
          {otherCostsDisplay}
        </Text>
      </View>
      {showFees ? (
        <View style={styles.summaryRow}>
          <Text style={[typography.body, { color: fg.secondary, flex: 1 }]}>Fees</Text>
          <Text style={[typography.bodyBold, styles.summaryMoney, { color: feesTone }]}>
            {formatUsdCombined(earnings.feesCents)}
          </Text>
        </View>
      ) : null}
      <View style={styles.summaryTotal}>
        <Text style={[typography.bodyBold, { color: fg.primary, flex: 1 }]}>Net Earnings</Text>
        <Text style={[typography.jobDetailNetAmount, { color: netTone, textAlign: 'right' }]}>
          {formatUsdCombined(earnings.netEarningsCents)}
        </Text>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Edit earnings"
        onPress={onPress}
        style={({ pressed }) => [styles.cardOuter, pressed && styles.pressed]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.cardOuter}>{content}</View>;
}

const styles = StyleSheet.create({
  cardOuter: {
    width: '100%',
    backgroundColor: bg.surface,
    borderRadius: radius('Radius/16'),
    borderWidth: 1,
    borderColor: border.subtle,
    paddingHorizontal: space('Spacing/16'),
    paddingVertical: space('Spacing/12'),
  },
  summaryStack: {
    gap: space('Spacing/8'),
    width: '100%',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 24,
  },
  summaryMoney: {
    color: fg.primary,
    textAlign: 'right',
    flexShrink: 0,
  },
  summaryTotal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: space('Spacing/12'),
    marginTop: space('Spacing/4'),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: border.subtle,
  },
  pressed: { opacity: 0.75 },
});
