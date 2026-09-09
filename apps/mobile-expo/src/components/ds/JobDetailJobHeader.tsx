import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, space } from '@fieldsolo/design-system/lib/tokens';
import type { JobDetailWorkStatus } from '@fieldsolo/shared-types';

import type { TextStyles } from '../../theme/nativeTokens';
import { screenHeaderA11y } from '../../lib/accessibility';
import { JobDetailStatusPill } from './JobDetailStatusPill';

export function JobDetailJobHeader({
  title,
  longDescription,
  customerName,
  serviceAddress,
  lastWorkedLabel,
  workStatus,
  typography,
  onTitlePress,
  onCustomerPress,
}: {
  title: string;
  longDescription?: string;
  customerName: string;
  serviceAddress: string;
  lastWorkedLabel: string;
  workStatus: JobDetailWorkStatus;
  typography: TextStyles;
  onTitlePress?: () => void;
  onCustomerPress?: () => void;
}) {
  const customerLabel = customerName.trim().length > 0 ? customerName.trim() : 'No Customer';
  const addressLabel =
    serviceAddress.trim().length > 0
      ? serviceAddress.trim().replace(/\s*\n\s*/g, ', ')
      : 'No Address';
  const subtitleLabel = `${customerLabel} • ${addressLabel} • ${lastWorkedLabel}`;
  const description = longDescription?.trim() ?? '';

  const titleStyle = [typography.displayH1, styles.jobTitle];
  const descriptionEl =
    description.length > 0 ? (
      <Text style={[typography.body, styles.jobDescription]}>{description}</Text>
    ) : null;

  return (
    <View style={styles.jobCardShell}>
      <View style={styles.jobCardContent}>
        <View style={styles.statusRow}>
          <JobDetailStatusPill kind={workStatus} typography={typography} />
        </View>
        {onTitlePress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit job title"
            onPress={onTitlePress}
            style={({ pressed }) => [styles.titleBlock, pressed && styles.pressed]}
          >
            <Text style={titleStyle}>{title}</Text>
            {descriptionEl}
          </Pressable>
        ) : (
          <View style={styles.titleBlock}>
            <Text {...screenHeaderA11y(title)} style={titleStyle}>
              {title}
            </Text>
            {descriptionEl}
          </View>
        )}
        {onCustomerPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit customer"
            onPress={onCustomerPress}
            style={({ pressed }) => [styles.subtitlePressable, pressed && styles.pressed]}
          >
            <Text style={typography.jobDetailSubtitle}>{subtitleLabel}</Text>
          </Pressable>
        ) : (
          <View style={styles.subtitlePressable}>
            <Text style={typography.jobDetailSubtitle}>{subtitleLabel}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  jobCardShell: {
    width: '100%',
    borderRadius: radius('Radius/16'),
  },
  jobCardContent: {
    paddingTop: space('Spacing/8'),
    paddingBottom: 0,
    gap: space('Spacing/8'),
  },
  statusRow: {
    width: '100%',
    alignItems: 'flex-start',
  },
  titleBlock: {
    width: '100%',
    gap: space('Spacing/8'),
  },
  jobTitle: {
    // Display-H1 is uppercase by default; job titles are sentence case.
    textTransform: 'none',
    width: '100%',
  },
  jobDescription: {
    width: '100%',
  },
  subtitlePressable: {
    // Extra top hit area; keep bottom tight so the summary card sits closer.
    paddingTop: space('Spacing/8'),
    paddingBottom: space('Spacing/4'),
  },
  pressed: { opacity: 0.75 },
});
