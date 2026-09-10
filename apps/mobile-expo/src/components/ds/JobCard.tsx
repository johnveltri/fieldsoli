import type { ListJobsForCurrentUserItem } from '@fieldsolo/api-client';
import { color, colorWithAlpha } from '@fieldsolo/design-system/lib/tokens';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  bg,
  border,
  cardShadowRn,
  fg,
  type TextStyles,
  space,
} from '../../theme/nativeTokens';

import { financialPositiveNegativeColor } from '../../lib/financialColors';

import { JobDetailStatusPill } from './JobDetailStatusPill';

function formatUsd(cents: number | null | undefined): string {
  const value = cents ?? 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function formatRecencyDate(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso));
}

export type JobCardProps = {
  job: ListJobsForCurrentUserItem;
  onPress: () => void;
  typography: TextStyles;
  incompletePills?: string[];
  /** `lastUpdated` uses `job.updatedAt` — use on Home when the list is ordered by `updated_at`. */
  recencyLabelMode?: 'lastWorked' | 'lastUpdated';
};

/**
 * Jobs list / Home — full job card with rail, status pill, metrics row.
 */
export function JobCard({
  job,
  onPress,
  typography,
  incompletePills,
  recencyLabelMode = 'lastWorked',
}: JobCardProps) {
  const timeValue = job.timeLabel || '0.0h';
  const revenue = formatUsd(job.revenueCents);
  const materials = formatUsd(job.materialsCents);
  const net = formatUsd(job.netEarningsCents);

  const recencySuffix =
    recencyLabelMode === 'lastUpdated'
      ? `Last updated ${formatRecencyDate(job.updatedAt)}`
      : job.lastWorkedLabel;

  return (
    // Outer lift keeps Android elevation off the Pressable so opacity/ripple
    // don't draw a square "border" ring around the rounded card.
    <View style={styles.jobCardLift}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        android_ripple={{
          color: colorWithAlpha('Foundation/Text/Primary', 0.08),
          borderless: false,
        }}
        style={({ pressed }) => [
          styles.jobCard,
          Platform.OS === 'ios' && pressed && styles.pressed,
        ]}
      >
        <View style={styles.jobCardRail} />
        <View style={styles.jobCardContent}>
          <View style={styles.jobHeaderBlock}>
            <View style={styles.statusPillWrap}>
              <JobDetailStatusPill kind={job.workStatus} typography={typography} />
            </View>
            <Text style={[typography.titleH3, { color: fg.primary }]}>{job.shortDescription}</Text>
            <Text style={[typography.bodySmall, { color: fg.secondary }]}>
              {(job.customerName || 'No customer').trim()} {'\u2022'} {recencySuffix}
            </Text>
          </View>

          {incompletePills != null && incompletePills.length > 0 ? (
            <Text style={[typography.bodySmall, styles.incompleteReasons]}>
              {`Missing: ${incompletePills.join(', ')}`}
            </Text>
          ) : null}

          <View style={styles.metricsRow}>
            <View style={styles.metricCol}>
              <Text style={typography.jobDetailMetricColumnLabel}>TIME</Text>
              <Text style={[typography.metric, styles.metricValue, { color: fg.primary }]}>
                {timeValue}
              </Text>
            </View>
            <View style={styles.metricCol}>
              <Text style={typography.jobDetailMetricColumnLabel}>REV</Text>
              <Text style={[typography.metric, styles.metricValue, { color: fg.primary }]}>
                {revenue}
              </Text>
            </View>
            <View style={styles.metricCol}>
              <Text style={typography.jobDetailMetricColumnLabel}>COST</Text>
              <Text
                style={[
                  typography.metric,
                  styles.metricValue,
                  { color: color('Semantic/Financial/Negative') },
                ]}
              >
                {materials}
              </Text>
            </View>
            <View style={styles.metricCol}>
              <Text style={typography.jobDetailMetricColumnLabel}>NET</Text>
              <Text
                style={[
                  typography.metric,
                  styles.metricValue,
                  { color: financialPositiveNegativeColor(job.netEarningsCents) },
                ]}
              >
                {net}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  jobCardLift: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: bg.surfaceWhite,
    ...cardShadowRn,
  },
  jobCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: border.subtle,
    borderRadius: 16,
    backgroundColor: bg.surfaceWhite,
    overflow: 'hidden',
    flexDirection: 'row',
    paddingLeft: space('Spacing/24'),
    paddingRight: 0,
  },
  jobCardRail: {
    width: 2,
    backgroundColor: colorWithAlpha('Brand/Primary', 0.15),
  },
  jobCardContent: {
    flex: 1,
    paddingHorizontal: space('Spacing/24'),
    paddingVertical: space('Spacing/24'),
    gap: space('Spacing/16'),
  },
  jobHeaderBlock: {
    width: '100%',
    gap: space('Spacing/4'),
  },
  statusPillWrap: {
    width: '100%',
    alignItems: 'flex-start',
  },
  incompleteReasons: {
    color: color('Semantic/Status/Error/Text'),
  },
  metricsRow: {
    borderTopWidth: 1,
    borderTopColor: border.subtle,
    paddingTop: space('Spacing/16'),
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricCol: {
    flex: 1,
    gap: space('Spacing/4'),
    alignItems: 'center',
  },
  metricValue: {
    textTransform: 'none',
    textAlign: 'center',
  },
  pressed: { opacity: 0.75 },
});
