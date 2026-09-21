import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatCustomerPhoneDisplay } from '@fieldsolo/api-client';
import { radius, space } from '@fieldsolo/design-system/lib/tokens';
import type { JobDetailWorkStatus } from '@fieldsolo/shared-types';

import type { TextStyles } from '../../theme/nativeTokens';
import { screenHeaderA11y } from '../../lib/accessibility';
import { JobDetailStatusPill } from './JobDetailStatusPill';

type CustomerHeaderInput = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  serviceAddress: string;
  lastWorkedLabel: string;
};

export type CustomerSubtitleSegment = {
  text: string;
  /** When true, keep the segment on one line (move to next line rather than wrap mid-value). */
  keepWhole: boolean;
};

const BULLET = ' · ';

/** Prevent mid-phone / mid-email wraps; RN breaks between sibling `Text` nodes instead. */
export function toNonBreakingSegmentText(text: string): string {
  return text.replace(/ /g, '\u00A0').replace(/-/g, '\u2011');
}

export function buildCustomerSubtitleSegments(
  input: CustomerHeaderInput,
): CustomerSubtitleSegment[] {
  const segments: CustomerSubtitleSegment[] = [];
  const name = input.customerName.trim();
  segments.push({ text: name.length > 0 ? name : 'No Customer', keepWhole: false });

  const phone =
    formatCustomerPhoneDisplay(input.customerPhone) ?? input.customerPhone.trim();
  if (phone.length > 0) {
    segments.push({ text: phone, keepWhole: true });
  }

  const email = input.customerEmail.trim();
  if (email.length > 0) {
    segments.push({ text: email, keepWhole: true });
  }

  const address = input.serviceAddress.trim().replace(/\s*\n\s*/g, ', ');
  if (address.length > 0) {
    segments.push({ text: address, keepWhole: false });
  }

  const lastWorked = input.lastWorkedLabel.trim();
  if (lastWorked.length > 0) {
    segments.push({ text: lastWorked, keepWhole: false });
  }

  return segments;
}

export function buildCustomerSubtitleLabel(input: CustomerHeaderInput): string {
  return buildCustomerSubtitleSegments(input)
    .map((segment) => segment.text)
    .join(BULLET);
}

function buildCustomerSubtitleContent(segments: CustomerSubtitleSegment[]): ReactNode[] {
  const nodes: ReactNode[] = [];
  segments.forEach((segment, index) => {
    if (index > 0) nodes.push(BULLET);
    if (segment.keepWhole) {
      nodes.push(
        <Text key={index}>{toNonBreakingSegmentText(segment.text)}</Text>,
      );
    } else {
      nodes.push(segment.text);
    }
  });
  return nodes;
}

export function JobDetailJobHeader({
  title,
  longDescription,
  customerName,
  customerPhone,
  customerEmail,
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
  customerPhone: string;
  customerEmail: string;
  serviceAddress: string;
  lastWorkedLabel: string;
  workStatus: JobDetailWorkStatus;
  typography: TextStyles;
  onTitlePress?: () => void;
  onCustomerPress?: () => void;
}) {
  const customerInput = {
    customerName,
    customerPhone,
    customerEmail,
    serviceAddress,
    lastWorkedLabel,
  };
  const subtitleSegments = buildCustomerSubtitleSegments(customerInput);
  const subtitleLabel = buildCustomerSubtitleLabel(customerInput);
  const description = longDescription?.trim() ?? '';
  const subtitleContent = (
    <Text style={typography.jobDetailSubtitle}>
      {buildCustomerSubtitleContent(subtitleSegments)}
    </Text>
  );

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
            accessibilityLabel={description ? `${title}. ${description}` : title}
            accessibilityHint="Opens job title and description editing"
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
            accessibilityLabel={subtitleLabel}
            accessibilityHint="Opens customer and address editing"
            onPress={onCustomerPress}
            style={({ pressed }) => [styles.subtitlePressable, pressed && styles.pressed]}
          >
            {subtitleContent}
          </Pressable>
        ) : (
          <View style={styles.subtitlePressable}>{subtitleContent}</View>
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
