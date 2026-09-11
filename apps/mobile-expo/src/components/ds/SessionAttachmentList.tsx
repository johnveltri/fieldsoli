import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  color,
  colorWithAlpha,
  radius,
  space,
} from '@fieldsolo/design-system/lib/tokens';
import type { JobDetailSessionAttachment } from '@fieldsolo/shared-types';

import { bg, border, fg } from '../../theme/nativeTokens';
import type { TextStyles } from '../../theme/nativeTokens';
import {
  JobDetailIconViewSessionChevron,
  SessionCaptureTileMaterialIcon,
  SessionCaptureTileNoteIcon,
} from '../figma-icons/JobDetailScreenIcons';

const PREVIEW_MAX = 3;

export type SessionAttachmentListProps = {
  typography: TextStyles;
  attachments: Array<Extract<JobDetailSessionAttachment, { kind: 'note' | 'material' }>>;
  emptyMessage?: string;
  /** When true, rows are not tappable (Phase 2 View expand). */
  readOnly?: boolean;
  onPressAttachment?: (item: { kind: 'note' | 'material'; id: string }) => void;
};

/**
 * Merged session notes + materials: up to 3 rows with expand, or full list
 * (Figma `1285:465` — `view-session-attachment-list`).
 */
export function SessionAttachmentList({
  typography,
  attachments,
  emptyMessage = 'No notes, materials or photos yet',
  readOnly = false,
  onPressAttachment,
}: SessionAttachmentListProps) {
  const [expanded, setExpanded] = useState(false);

  if (attachments.length === 0) {
    return (
      <View style={[styles.emptyWrap, styles.emptyWrapBelowTiles]}>
        <Text style={[typography.bodySmall, { color: fg.secondary, textAlign: 'center' }]}>
          {emptyMessage}
        </Text>
      </View>
    );
  }

  const total = attachments.length;
  const needExpand = total > PREVIEW_MAX;
  const shown = !needExpand || expanded ? attachments : attachments.slice(0, PREVIEW_MAX);
  const xShown = shown.length;

  return (
    <View style={styles.listSection}>
      <View style={styles.attachmentList}>
        {shown.map((item) => {
          const isNote = item.kind === 'note';
          const rowContent = (
            <>
              <View style={styles.rowIcon}>
                {isNote ? (
                  <SessionCaptureTileNoteIcon color={color('Semantic/Activity/Note')} />
                ) : (
                  <SessionCaptureTileMaterialIcon color={color('Semantic/Activity/Material')} />
                )}
              </View>
              <Text
                style={[typography.bodySmall, styles.titleCell, { color: fg.primary }]}
                numberOfLines={isNote ? 1 : undefined}
              >
                {item.title}
              </Text>
              {item.kind === 'material' ? (
                <Text
                  style={[typography.bodySmall, styles.priceCell, { color: fg.primary }]}
                >
                  {item.priceLabel}
                </Text>
              ) : (
                <View style={styles.priceSpacer} />
              )}
            </>
          );
          if (readOnly || !onPressAttachment) {
            return (
              <View key={`${item.kind}-${item.id}`} style={styles.attachmentRow}>
                {rowContent}
              </View>
            );
          }
          return (
            <Pressable
              key={`${item.kind}-${item.id}`}
              accessibilityRole="button"
              accessibilityLabel={isNote ? 'Open note' : 'Open material'}
              onPress={() => onPressAttachment({ kind: item.kind, id: item.id })}
              style={({ pressed }) => [styles.attachmentRow, pressed && styles.pressed]}
            >
              {rowContent}
            </Pressable>
          );
        })}

        {needExpand ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Show fewer attachments' : 'Show all attachments'}
            onPress={() => setExpanded((e) => !e)}
            style={({ pressed }) => [styles.footerRow, pressed && styles.pressed]}
          >
            <Text style={[typography.bodySmall, { color: fg.secondary }]}>
              {xShown} of {total} attachments
            </Text>
            <View style={expanded ? styles.chevronUp : undefined}>
              <JobDetailIconViewSessionChevron color={fg.secondary} />
            </View>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  listSection: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: space('Spacing/16'),
    // Breathing room between the Add to Session tile row and the first attachment.
    paddingTop: space('Spacing/12'),
    paddingBottom: space('Spacing/16'),
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: space('Spacing/16'),
  },
  emptyWrapBelowTiles: {
    marginTop: space('Spacing/12'),
  },
  attachmentList: {
    width: '100%',
    maxWidth: 319,
    gap: space('Spacing/8'),
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 45.25,
    backgroundColor: bg.surfaceWhite,
    borderRadius: radius('Radius/8'),
    borderWidth: 1,
    borderColor: colorWithAlpha('Foundation/Border/Default', 0.05),
    paddingHorizontal: space('Spacing/12'),
    paddingVertical: space('Spacing/12'),
    gap: space('Spacing/8'),
  },
  rowIcon: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCell: {
    flex: 1,
    minWidth: 0,
  },
  priceCell: {
    textAlign: 'right',
    flexShrink: 0,
    maxWidth: '40%',
  },
  priceSpacer: {
    width: 0,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: space('Spacing/8'),
  },
  chevronUp: { transform: [{ rotate: '180deg' }] },
  pressed: { opacity: 0.75 },
});
