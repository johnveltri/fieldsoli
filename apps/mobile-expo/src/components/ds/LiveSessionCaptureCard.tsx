import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  color,
  colorWithAlpha,
  radius,
  space,
} from '@fieldsolo/design-system/lib/tokens';
import type { JobDetailSessionAttachment } from '@fieldsolo/shared-types';

import { bg, border, cardShadowRn, fg } from '../../theme/nativeTokens';
import type { TextStyles } from '../../theme/nativeTokens';
import {
  JobDetailIconViewSessionChevron,
  SessionCardEditPencilIcon,
} from '../figma-icons/JobDetailScreenIcons';
import { SessionAddToSessionTiles } from './SessionAddToSessionTiles';
import { SessionAttachmentList } from './SessionAttachmentList';

type LiveSessionCaptureCardProps = {
  typography: TextStyles;
  /** Localized date label, e.g. `"Mar 25, 2026"`. Mirrors `SessionCard`. */
  dateLabel: string;
  /** Localized "Started at: 9:00 AM" sub-label. */
  startedAtLabel: string;
  expanded: boolean;
  onToggle: () => void;
  onEditPress: () => void;
  attachments: JobDetailSessionAttachment[];
  onAddNote: () => void;
  onAddMaterial: () => void;
  onPressAttachment: (item: { kind: 'note' | 'material'; id: string }) => void;
};

/**
 * Live-session variant of `SessionCard` (Figma `1897:3607` / `1285:465`).
 * Differences: no duration in header; "Started at" sub-label; add tiles +
 * attachment list wired for the active session.
 */
export function LiveSessionCaptureCard({
  typography,
  dateLabel,
  startedAtLabel,
  expanded,
  onToggle,
  onEditPress,
  attachments,
  onAddNote,
  onAddMaterial,
  onPressAttachment,
}: LiveSessionCaptureCardProps) {
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} live session ${dateLabel}`}
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={styles.headerPressable}
      >
        <View style={styles.header}>
          <View style={styles.leading}>
            <View style={styles.datePad}>
              <Text style={[typography.body, { color: fg.primary }]}>{dateLabel}</Text>
            </View>
            <Text style={[typography.bodySmall, { color: fg.secondary }]}>{startedAtLabel}</Text>
          </View>
          <View style={styles.trailing}>
            <View style={expanded ? styles.chevronExpanded : undefined}>
              <JobDetailIconViewSessionChevron color={fg.secondary} />
            </View>
          </View>
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.panel}>
          <View style={styles.editRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit live session"
              onPress={onEditPress}
              style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
            >
              <SessionCardEditPencilIcon color={bg.canvasWarm} />
              <Text
                style={[
                  typography.pillCompact,
                  styles.editButtonLabel,
                ]}
              >
                EDIT
              </Text>
            </Pressable>
          </View>

          <SessionAddToSessionTiles
            typography={typography}
            onAddNote={onAddNote}
            onAddMaterial={onAddMaterial}
          />

          <SessionAttachmentList
            typography={typography}
            attachments={attachments.filter(
              (a): a is Extract<(typeof attachments)[number], { kind: 'note' | 'material' }> =>
                a.kind === 'note' || a.kind === 'material',
            )}
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
    overflow: 'hidden',
  },
  headerPressable: { width: '100%' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space('Spacing/16'),
    paddingVertical: space('Spacing/16'),
  },
  leading: { flex: 1, minWidth: 0 },
  datePad: { paddingVertical: space('Spacing/4') },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space('Spacing/12'),
  },
  chevronExpanded: { transform: [{ rotate: '180deg' }] },

  panel: {
    borderTopWidth: 1,
    borderTopColor: colorWithAlpha('Foundation/Border/Default', 0.05),
    backgroundColor: colorWithAlpha('Foundation/Surface/Subtle', 0.3),
    paddingTop: space('Spacing/16'),
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
  pressed: { opacity: 0.75 },
});
