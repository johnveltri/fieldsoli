import { StyleSheet, Text, View } from 'react-native';
import { color, radius, space } from '@fieldsolo/design-system/lib/tokens';
import type { JobDetailWorkStatus } from '@fieldsolo/shared-types';

import type { TextStyles } from '../../theme/nativeTokens';

/** User-facing copy for each status (header pill + status picker). Stored all caps to match LABEL typography. */
export const JOB_DETAIL_WORK_STATUS_LABEL: Record<JobDetailWorkStatus, string> = {
  notStarted: 'NOT STARTED',
  inProgress: 'IN PROGRESS',
  completed: 'COMPLETED',
  paid: 'PAID',
  onHold: 'ON HOLD',
  cancelled: 'CANCELLED',
};

function statusPillTextColor(kind: JobDetailWorkStatus): string {
  switch (kind) {
    case 'paid':
      return color('Semantic/Status/Success/Text');
    case 'notStarted':
      return color('Semantic/Status/Neutral/Text');
    case 'inProgress':
      return color('Semantic/Status/Info/Text');
    case 'completed':
      return color('Semantic/Status/Warning/Label');
    case 'onHold':
      return color('Semantic/Status/Paused/Text');
    case 'cancelled':
      return color('Semantic/Status/Error/Text');
  }
}

export function JobDetailStatusPill({
  kind,
  typography,
}: {
  kind: JobDetailWorkStatus;
  typography: TextStyles;
}) {
  const textColor = statusPillTextColor(kind);
  return (
    <View style={styles.pillOuter}>
      <Text style={[typography.statusPillLabel, { color: textColor }]}>
        {JOB_DETAIL_WORK_STATUS_LABEL[kind]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pillOuter: {
    borderRadius: radius('Radius/Full'),
    paddingLeft: 0,
    paddingRight: space('Spacing/8'),
    paddingBottom: space('Spacing/6'),
    alignItems: 'flex-start',
  },
});
