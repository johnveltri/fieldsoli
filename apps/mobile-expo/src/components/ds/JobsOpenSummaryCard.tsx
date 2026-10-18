import { color } from '@fieldsolo/design-system/lib/tokens';

import { type TextStyles } from '../../theme/nativeTokens';
import { ActionSummaryCard } from './ActionSummaryCard';
import {
  JOBS_OPEN_SECTION_COPY,
  type JobsOpenSectionKind,
} from './JobsOpenStackSectionHeader';

export type JobsOpenSummaryCardProps = {
  kind: JobsOpenSectionKind;
  count: number;
  /** Optional pre-formatted metric shown before the navigation affordance. */
  trailingValue?: string;
  typography: TextStyles;
  onPress: () => void;
};

const ACCENT: Record<JobsOpenSectionKind, string> = {
  incomplete: color('Semantic/Status/Warning/Text'),
  inProgress: color('Semantic/Status/Info/Text'),
  unpaid: color('Semantic/Status/Neutral/Text'),
};

/**
 * Collapsed Open-tab section row for Home “Needs attention” and Earnings outstanding.
 */
export function JobsOpenSummaryCard({
  kind,
  count,
  trailingValue,
  typography,
  onPress,
}: JobsOpenSummaryCardProps) {
  const { titlePrefix, subtitle } = JOBS_OPEN_SECTION_COPY[kind];
  const accentColor = ACCENT[kind];
  const titleLine = `${titlePrefix} (${count})`;

  return (
    <ActionSummaryCard
      title={titleLine}
      subtitle={subtitle}
      accentColor={accentColor}
      trailingValue={trailingValue}
      typography={typography}
      onPress={onPress}
      accessibilityLabel={`${titleLine}. ${subtitle}.${trailingValue ? ` ${trailingValue}.` : ''}`}
    />
  );
}
