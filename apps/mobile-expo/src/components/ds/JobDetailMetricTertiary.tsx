import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, space } from '@fieldsolo/design-system/lib/tokens';
import type { JobDetailViewModel } from '@fieldsolo/shared-types';

import { financialPositiveNegativeColor } from '../../lib/financialColors';
import {
  bg,
  border,
  fg,
} from '../../theme/nativeTokens';
import type { TextStyles } from '../../theme/nativeTokens';

export function JobDetailMetricTertiary({
  metrics,
  netEarningsCents,
  typography,
  onPress,
}: {
  metrics: JobDetailViewModel['metrics'];
  netEarningsCents: number;
  typography: TextStyles;
  onPress?: () => void;
}) {
  const netHrColor =
    metrics.netPerHrDisplay === '—'
      ? fg.primary
      : financialPositiveNegativeColor(netEarningsCents);

  const card = (
    <View style={styles.metricCard}>
      <View style={styles.metricTertiaryRow}>
        <View style={styles.metricColEqual}>
          <Text style={typography.jobDetailMetricColumnLabel}>TIME</Text>
          <Text style={[typography.metric, styles.metricValueCentered, { textTransform: 'none' }]}>
            {metrics.timeLabel}
          </Text>
        </View>
        <View style={styles.metricColEqual}>
          <Text style={typography.jobDetailMetricColumnLabel}>NET/HR</Text>
          <View style={styles.netHrValue}>
            <Text
              style={[typography.metric, { color: netHrColor, textAlign: 'center', textTransform: 'none' }]}
            >
              {`$ ${metrics.netPerHrDisplay}`}
            </Text>
          </View>
        </View>
        <View style={styles.metricColEqual}>
          <Text style={typography.jobDetailMetricColumnLabel}>SESSIONS</Text>
          <Text style={[typography.metric, styles.metricValueCentered, { textTransform: 'none' }]}>
            {String(metrics.sessionCount)}
          </Text>
        </View>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Edit metrics"
        onPress={onPress}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        {card}
      </Pressable>
    );
  }

  return card;
}

const styles = StyleSheet.create({
  metricCard: {
    width: '100%',
    backgroundColor: bg.surface,
    borderRadius: radius('Radius/16'),
    borderWidth: 1,
    borderColor: border.subtle,
    paddingHorizontal: space('Spacing/8'),
    paddingVertical: space('Spacing/16'),
  },
  metricTertiaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    width: '100%',
  },
  metricColEqual: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: space('Spacing/4'),
  },
  metricValueCentered: {
    textAlign: 'center',
  },
  netHrValue: {
    width: '100%',
    alignItems: 'center',
  },
  pressed: { opacity: 0.75 },
});
