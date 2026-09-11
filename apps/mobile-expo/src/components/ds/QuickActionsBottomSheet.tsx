import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { color, radius, space } from '@fieldsolo/design-system/lib/tokens';

import { SessionChooserRowPlayIcon } from '../figma-icons/JobDetailScreenIcons';
import { bg, border, fg } from '../../theme/nativeTokens';
import type { TextStyles } from '../../theme/nativeTokens';
import { screenHeaderA11y } from '../../lib/accessibility';
import { BottomSheetShell } from './BottomSheetShell';

export type QuickActionsRecentJob = {
  id: string;
  shortDescription: string;
  customerName: string | null;
};

export type QuickActionsStep = 'chooseJob';

type QuickActionsBottomSheetProps = {
  typography: TextStyles;
  visible: boolean;
  step: QuickActionsStep;
  recentJobs: QuickActionsRecentJob[];
  recentJobsLoading: boolean;
  recentJobsError: string | null;
  actionError: string | null;
  starting: boolean;
  onClose: () => void;
  onClosed?: () => void;
  onSelectExistingJob: (job: QuickActionsRecentJob) => void;
  onStartNewSession: () => void;
};

/** Legacy FAB session chooser, retained while the Phase 3 flag is disabled. */
export function QuickActionsBottomSheet({
  typography,
  visible,
  step,
  recentJobs,
  recentJobsLoading,
  recentJobsError,
  actionError,
  starting,
  onClose,
  onClosed,
  onSelectExistingJob,
  onStartNewSession,
}: QuickActionsBottomSheetProps) {
  const busy = starting;
  return (
    <BottomSheetShell
      visible={visible}
      onClose={onClose}
      onClosed={onClosed}
      accessibilityTitle="Start session"
    >
      <View style={styles.stack}>
        <Text {...screenHeaderA11y()} style={[typography.titleH3, styles.title, { color: fg.primary }]}>
          {step === 'chooseJob' ? 'Start Session' : ''}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start New Session"
          disabled={busy}
          onPress={onStartNewSession}
          style={({ pressed }) => [
            styles.primaryRow,
            { backgroundColor: color('Brand/Primary'), borderColor: border.subtle },
            pressed && !busy ? styles.pressed : null,
            busy ? styles.busy : null,
          ]}
        >
          <View style={styles.primaryIcon}>
            <SessionChooserRowPlayIcon color={fg.muted} />
          </View>
          <View style={styles.textStack}>
            <Text style={[typography.bodyBold, { color: fg.muted }]}>Start New Session</Text>
            <Text style={[typography.bodySmall, { color: fg.muted }]} numberOfLines={2}>
              Begin tracking now — add job details later
            </Text>
          </View>
        </Pressable>
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={[typography.statusPillLabel, styles.dividerLabel, { color: fg.secondary }]}>
            OR ATTACH TO EXISTING JOB
          </Text>
          <View style={styles.dividerLine} />
        </View>
        {recentJobsError ? (
          <Text style={[typography.bodySmall, styles.inlineError, { color: color('Semantic/Status/Error/Text') }]}>
            {recentJobsError}
          </Text>
        ) : null}
        {actionError ? (
          <Text style={[typography.bodySmall, styles.inlineError, { color: color('Semantic/Status/Error/Text') }]}>
            {actionError}
          </Text>
        ) : null}
        {recentJobsLoading ? (
          <View style={styles.placeholderList}>
            {[0, 1, 2].map((index) => (
              <View key={index} style={styles.placeholderRow}>
                {index === 0 ? <ActivityIndicator color={fg.secondary} /> : null}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.jobList}>
            {recentJobs.map((job) => (
              <Pressable
                key={job.id}
                accessibilityRole="button"
                accessibilityLabel={`Attach to job ${job.shortDescription}`}
                disabled={busy}
                onPress={() => onSelectExistingJob(job)}
                style={({ pressed }) => [
                  styles.jobRow,
                  { borderColor: border.subtle, backgroundColor: bg.surfaceWhite },
                  pressed && !busy ? styles.pressed : null,
                ]}
              >
                <View style={styles.textStack}>
                  <Text style={[typography.bodyBold, { color: fg.primary }]}>{job.shortDescription}</Text>
                  <Text style={[typography.bodySmall, { color: fg.secondary }]}>
                    {(job.customerName ?? '').trim() || 'No customer'}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </BottomSheetShell>
  );
}

const styles = StyleSheet.create({
  stack: { width: '100%', gap: space('Spacing/12'), paddingTop: 0 },
  title: { textAlign: 'center' },
  primaryRow: {
    flexDirection: 'row', alignItems: 'center', gap: space('Spacing/12'),
    minHeight: space('Spacing/80') + space('Spacing/4'), paddingHorizontal: space('Spacing/20'),
    paddingVertical: space('Spacing/16'), borderRadius: radius('Radius/16'), borderWidth: 1,
  },
  primaryIcon: {
    width: space('Spacing/40'), height: space('Spacing/40'), borderRadius: radius('Radius/Full'),
    backgroundColor: 'rgba(250,246,240,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  textStack: { flex: 1, minWidth: 0, gap: space('Spacing/4') },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: space('Spacing/12'), paddingVertical: space('Spacing/8') },
  dividerLine: { flex: 1, height: 1, backgroundColor: border.subtle },
  dividerLabel: { flexShrink: 1, textAlign: 'center' },
  inlineError: { textAlign: 'center' },
  placeholderList: { gap: space('Spacing/12') },
  placeholderRow: { minHeight: 74, borderRadius: radius('Radius/16'), backgroundColor: bg.subtle, alignItems: 'center', justifyContent: 'center' },
  jobList: { gap: space('Spacing/12'), width: '100%' },
  jobRow: { minHeight: 74, borderRadius: radius('Radius/16'), borderWidth: 1, paddingHorizontal: space('Spacing/20'), paddingVertical: space('Spacing/16') },
  pressed: { opacity: 0.8 },
  busy: { opacity: 0.85 },
});
