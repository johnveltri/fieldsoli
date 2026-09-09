import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  colorWithAlpha,
  radius,
  space,
} from '@fieldsolo/design-system/lib/tokens';
import type { JobDetailSession } from '@fieldsolo/shared-types';

import { bg, border, cardShadowRn, fg } from '../../theme/nativeTokens';
import type { TextStyles } from '../../theme/nativeTokens';
import { sessionViewTimeLabel } from '../../lib/jobDetailRowHealth';
import { JobDetailIconViewSessionChevron } from '../figma-icons/JobDetailScreenIcons';
import { SessionAddToSessionTiles } from './SessionAddToSessionTiles';
import { SessionAttachmentList } from './SessionAttachmentList';

type SessionCardProps = {
  session: JobDetailSession;
  typography: TextStyles;
  expanded: boolean;
  /** Secondary line when date/duration are not yet countable. */
  missingLine?: string | null;
  /** Phase 2 View: flat row with start/end times; tap opens edit (no expand). */
  viewMode?: boolean;
  onToggle: () => void;
  onEditPress: () => void;
  onRowBodyPress?: () => void;
  onAddNote?: () => void;
  onAddMaterial?: () => void;
  onPressAttachment?: (item: { kind: 'note' | 'material'; id: string }) => void;
};

/**
 * Session row — collapsible in legacy Job Detail (`1285:465`), flat in Phase 2 View.
 */
export function SessionCard({
  session,
  typography,
  expanded,
  missingLine,
  viewMode = false,
  onToggle,
  onEditPress,
  onRowBodyPress,
  onAddNote,
  onAddMaterial,
  onPressAttachment,
}: SessionCardProps) {
  const viewTimeLabel = sessionViewTimeLabel(session);
  const showLegacyCollapsedTime =
    !viewMode && session.clockTimesExplicit && session.timeRangeLabel;

  if (viewMode) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Session ${session.dateLabel}`}
        onPress={onRowBodyPress}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <View style={styles.viewModeBody}>
          <View style={styles.leading}>
            <Text style={[typography.body, { color: fg.primary }]}>{session.dateLabel}</Text>
            {viewTimeLabel ? (
              <Text
                style={[typography.bodySmall, { color: fg.secondary, marginTop: space('Spacing/4') }]}
              >
                {viewTimeLabel}
              </Text>
            ) : null}
            {missingLine ? (
              <Text style={[typography.bodySmall, { color: fg.secondary, marginTop: space('Spacing/4') }]}>
                {missingLine}
              </Text>
            ) : null}
          </View>
          <Text style={[typography.metric, styles.viewModeDuration, { color: fg.primary }]}>
            {session.durationLabel}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Session ${session.dateLabel}`}
          onPress={onRowBodyPress ?? onToggle}
          style={styles.headerBodyPressable}
        >
          <View style={styles.headerBody}>
            <View style={styles.leading}>
              <View style={styles.datePad}>
                <Text style={[typography.body, { color: fg.primary }]}>{session.dateLabel}</Text>
              </View>
              {showLegacyCollapsedTime ? (
                <Text style={[typography.bodySmall, { color: fg.secondary }]}>
                  {session.timeRangeLabel}
                </Text>
              ) : null}
              {missingLine ? (
                <Text style={[typography.bodySmall, { color: fg.secondary, marginTop: space('Spacing/4') }]}>
                  {missingLine}
                </Text>
              ) : null}
            </View>
            <View style={styles.trailing}>
              <Text style={[typography.metric, { textTransform: 'none', color: fg.primary }]}>
                {session.durationLabel}
              </Text>
            </View>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} session ${session.dateLabel}`}
          accessibilityState={{ expanded }}
          onPress={onToggle}
          style={styles.chevronPressable}
          hitSlop={8}
        >
          <View style={expanded ? styles.chevronExpanded : undefined}>
            <JobDetailIconViewSessionChevron color={fg.secondary} />
          </View>
        </Pressable>
      </View>

      {expanded ? (
        <View style={styles.panel}>
          <View style={styles.editRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit session"
              onPress={onEditPress}
              style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
            >
              <Text style={[typography.pillCompact, styles.editButtonLabel]}>EDIT</Text>
            </Pressable>
          </View>
          <SessionAddToSessionTiles
            typography={typography}
            onAddNote={onAddNote ?? (() => {})}
            onAddMaterial={onAddMaterial ?? (() => {})}
          />
          <SessionAttachmentList
            typography={typography}
            attachments={session.attachments.filter(
              (a) => a.kind === 'note' || a.kind === 'material',
            )}
            readOnly={false}
            onPressAttachment={onPressAttachment}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: bg.surfaceWhite,
    borderRadius: radius('Radius/16'),
    borderWidth: 1,
    borderColor: border.subtle,
    marginBottom: space('Spacing/8'),
    overflow: 'hidden',
  },
  viewModeBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space('Spacing/16'),
    paddingVertical: space('Spacing/16'),
    minHeight: space('Spacing/80'),
    gap: space('Spacing/12'),
  },
  viewModeDuration: {
    textTransform: 'none',
    flexShrink: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: space('Spacing/80'),
  },
  chevronPressable: {
    justifyContent: 'center',
    paddingLeft: space('Spacing/8'),
    paddingRight: space('Spacing/16'),
  },
  headerBodyPressable: {
    flex: 1,
    minWidth: 0,
  },
  headerBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: space('Spacing/16'),
    paddingVertical: space('Spacing/16'),
    flex: 1,
  },
  leading: { flex: 1, minWidth: 0 },
  datePad: { paddingVertical: space('Spacing/4') },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space('Spacing/12'),
  },
  chevronExpanded: {
    transform: [{ rotate: '180deg' }],
  },

  panel: {
    borderTopWidth: 1,
    borderTopColor: colorWithAlpha('Foundation/Border/Default', 0.05),
    backgroundColor: colorWithAlpha('Foundation/Surface/Subtle', 0.3),
    paddingTop: space('Spacing/12'),
  },
  editRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: space('Spacing/16'),
  },
  editButton: {
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
  editButtonLabel: {
    color: bg.canvasWarm,
  },
  pressed: {
    opacity: 0.75,
  },
});
