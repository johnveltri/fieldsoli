import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeSyntheticEvent,
  type TextLayoutEventData,
} from 'react-native';
import type {
  JobDetailMaterialBucket,
  JobDetailNote,
  JobDetailNoteBucket,
  JobDetailOtherCostBucket,
  JobDetailSession,
} from '@fieldsolo/shared-types';
import { color, radius, space } from '@fieldsolo/design-system/lib/tokens';

import {
  isMaterialDescriptionEmpty,
  isMaterialTotalEmpty,
  isOtherCostAmountEmpty,
  isOtherCostTypeEmpty,
  isSessionDateEmpty,
  isSessionDurationEmpty,
  shouldShowMaterialQuantity,
  sessionViewTimeLabel,
} from '../../lib/jobDetailRowHealth';
import { bg, border, fg } from '../../theme/nativeTokens';
import type { TextStyles } from '../../theme/nativeTokens';
import { JobDetailIconViewNote, JobDetailIconViewSessionChevron } from '../figma-icons/JobDetailScreenIcons';
import { EditSwipeableRow } from './edit-mode/EditSwipeableRow';

const COLLAPSED_NOTE_LINES = 4;
const criticalEmptyColor = () => color('Semantic/Status/Error/Text');

type NoteFooterOptions = { expanded: boolean; onToggle: () => void };

function ViewRowShell({
  typography,
  accessibilityLabel,
  accessibilityHint,
  onDelete,
  onPress,
  style,
  children,
}: {
  typography: TextStyles;
  accessibilityLabel: string;
  accessibilityHint?: string;
  onDelete?: () => void;
  onPress?: () => void;
  style?: object | (object | false | null | undefined)[];
  children: ReactNode;
}) {
  const body = onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [style, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  ) : (
    <View style={style}>{children}</View>
  );

  if (!onDelete) return body;

  return (
    <EditSwipeableRow
      typography={typography}
      accessibilityLabel={accessibilityLabel}
      onDelete={onDelete}
    >
      {body}
    </EditSwipeableRow>
  );
}

function countWrappedLines(lines: TextLayoutEventData['lines']): number {
  if (lines.length === 0) return 0;
  // Trailing newline yields an empty final line — ignore it for the collapse budget.
  const last = lines[lines.length - 1];
  if (last.text === '') return lines.length - 1;
  return lines.length;
}

function noteExceedsCollapsedLines(note: JobDetailNote, measuredLines: number | null): boolean {
  // Do not use `excerpt` here — that is a 120-char list preview, not a 4-line
  // visual collapse. A long body can still fit in ≤4 wraps and must not show
  // Show More with nothing left to reveal.
  if (note.body.split(/\r?\n/).length > COLLAPSED_NOTE_LINES) return true;
  return measuredLines != null && measuredLines > COLLAPSED_NOTE_LINES;
}

function ReadOnlyExpandNoteRow({
  note,
  expanded,
  typography,
  rowChrome,
  noteIconSlot,
  onToggle,
  renderNoteFooter,
}: {
  note: JobDetailNote;
  expanded: boolean;
  typography: TextStyles;
  rowChrome: object[];
  noteIconSlot: ReactNode;
  onToggle: () => void;
  renderNoteFooter: (n: JobDetailNote, options?: NoteFooterOptions) => ReactNode;
}) {
  const [contentWidth, setContentWidth] = useState(0);
  const [measuredLines, setMeasuredLines] = useState<number | null>(null);

  useEffect(() => {
    setMeasuredLines(null);
  }, [note.body]);

  const onMeasureLayout = useCallback((event: NativeSyntheticEvent<TextLayoutEventData>) => {
    setMeasuredLines(countWrappedLines(event.nativeEvent.lines));
  }, []);

  const needsExpand = noteExceedsCollapsedLines(note, measuredLines);

  return (
    <View style={rowChrome}>
      {noteIconSlot}
      <View
        style={styles.noteContent}
        onLayout={(event) => {
          const next = Math.round(event.nativeEvent.layout.width);
          if (next > 0) setContentWidth((prev) => (prev === next ? prev : next));
        }}
      >
        {contentWidth > 0 ? (
          <Text
            pointerEvents="none"
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            style={[
              typography.body,
              styles.noteMeasureText,
              { color: fg.primary, width: contentWidth },
            ]}
            onTextLayout={onMeasureLayout}
          >
            {note.body}
          </Text>
        ) : null}
        <Text
          style={[typography.body, { color: fg.primary }]}
          numberOfLines={expanded ? undefined : COLLAPSED_NOTE_LINES}
          ellipsizeMode="tail"
        >
          {note.body}
        </Text>
        {renderNoteFooter(note, needsExpand ? { expanded, onToggle } : undefined)}
      </View>
    </View>
  );
}

/**
 * Single bordered card listing sessions as rows (Phase 2 View).
 * Row tap opens scoped Sessions Edit; swipe reveals Delete.
 */
export function ViewSessionsBuckets({
  sessions,
  typography,
  onCardPress,
  onDeleteSession,
  emphasizeCriticalEmpty = false,
}: {
  sessions: JobDetailSession[];
  typography: TextStyles;
  onCardPress?: () => void;
  onDeleteSession?: (sessionId: string) => void;
  /** Color critical empty placeholders (date / duration) as error text. */
  emphasizeCriticalEmpty?: boolean;
}) {
  if (sessions.length === 0) return null;

  return (
    <View style={styles.viewCardOuter}>
      <View style={styles.viewCardBorder}>
        {sessions.map((session, si) => {
          const dateEmpty = emphasizeCriticalEmpty && isSessionDateEmpty(session);
          const durationEmpty = emphasizeCriticalEmpty && isSessionDurationEmpty(session);
          const timeLabel = sessionViewTimeLabel(session);
          return (
            <ViewRowShell
              key={session.id}
              typography={typography}
              accessibilityLabel={[
                'Session',
                session.dateLabel,
                timeLabel,
                session.durationLabel,
              ].filter(Boolean).join('. ')}
              accessibilityHint={onCardPress ? 'Opens session editing' : undefined}
              onPress={onCardPress}
              onDelete={onDeleteSession ? () => onDeleteSession(session.id) : undefined}
              style={[
                styles.materialRow,
                si > 0 && { borderTopWidth: 1, borderTopColor: color('Foundation/Border/Subtle') },
              ]}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={[
                    typography.body,
                    { color: dateEmpty ? criticalEmptyColor() : fg.primary },
                  ]}
                >
                  {session.dateLabel}
                </Text>
                {timeLabel ? (
                  <Text
                    style={[
                      typography.bodySmall,
                      { color: fg.secondary, marginTop: space('Spacing/4') },
                    ]}
                  >
                    {timeLabel}
                  </Text>
                ) : null}
              </View>
              <Text
                style={[
                  typography.metric,
                  {
                    textTransform: 'none',
                    color: durationEmpty ? criticalEmptyColor() : fg.primary,
                  },
                ]}
              >
                {session.durationLabel}
              </Text>
            </ViewRowShell>
          );
        })}
      </View>
    </View>
  );
}

/** Session bucket header — e.g. "MAR 25, 2026 SESSION"; job-scoped buckets use "JOB". */
export function bucketSessionHeaderTitle(sessionDateLabel: string | undefined): string {
  const d = sessionDateLabel?.trim() ?? '';
  return `${d} SESSION`.replace(/\s+/g, ' ').trim().toUpperCase();
}

const JOB_BUCKET_HEADER = 'JOB';

function BucketHeader({
  bucket,
  typography,
  isFirst,
}: {
  bucket: { kind: 'unassigned' | 'session'; sessionDateLabel?: string };
  typography: TextStyles;
  isFirst: boolean;
}) {
  return (
    <View style={[styles.bucketHeader, isFirst && styles.bucketHeaderFirst]}>
      {bucket.kind === 'unassigned' ? (
        <Text style={[typography.labelHeadingSecondary, styles.bucketHeaderText]}>
          {JOB_BUCKET_HEADER}
        </Text>
      ) : (
        <Text style={[typography.labelHeadingSecondary, styles.bucketHeaderText]}>
          {bucketSessionHeaderTitle(bucket.sessionDateLabel)}
        </Text>
      )}
    </View>
  );
}

/**
 * Single bordered card listing material buckets (job-scoped vs per-session).
 * Shared by Job Detail and the Inbox.
 */
export function ViewMaterialsBuckets({
  buckets,
  typography,
  onMaterialPress,
  onCardPress,
  onDeleteMaterial,
  hideBucketHeaders = false,
  emphasizeCriticalEmpty = false,
}: {
  buckets: JobDetailMaterialBucket[];
  typography: TextStyles;
  /** Tap a row → open the Edit Material sheet / Add to Job sheet for this material. */
  onMaterialPress?: (materialId: string) => void;
  /** Phase 2 View: row tap → scoped Materials Edit (overrides row presses). */
  onCardPress?: () => void;
  onDeleteMaterial?: (materialId: string) => void;
  /**
   * Hide the per-bucket Job / session headers. The Inbox uses this so
   * its own recency section headers (TODAY / PAST WEEK …) are the grouping.
   */
  hideBucketHeaders?: boolean;
  /** Color critical empty placeholders (description / total) as error text. */
  emphasizeCriticalEmpty?: boolean;
}) {
  if (buckets.length === 0) {
    return null;
  }

  return (
    <View style={styles.viewCardOuter}>
      <View style={styles.viewCardBorder}>
        {buckets.map((bucket, bi) => (
          <View
            key={bucket.id}
            style={bi > 0 ? { borderTopWidth: 1, borderTopColor: color('Foundation/Border/Subtle') } : undefined}
          >
            {hideBucketHeaders ? null : (
              <BucketHeader bucket={bucket} typography={typography} isFirst={bi === 0} />
            )}
            {bucket.items.map((item, ii) => {
              const rowStyle = [
                styles.materialRow,
                ii > 0 && { borderTopWidth: 1, borderTopColor: color('Foundation/Border/Subtle') },
              ];
              const rowPress = onCardPress
                ? onCardPress
                : onMaterialPress
                  ? () => onMaterialPress(item.id)
                  : undefined;
              const descriptionEmpty =
                emphasizeCriticalEmpty && isMaterialDescriptionEmpty(item);
              const totalEmpty = emphasizeCriticalEmpty && isMaterialTotalEmpty(item);
              const showQuantity = shouldShowMaterialQuantity(item);
              return (
                <ViewRowShell
                  key={`${bucket.id}-${item.id}`}
                  typography={typography}
                  accessibilityLabel={[
                    'Material',
                    item.name,
                    showQuantity ? item.quantityLabel : '',
                    totalEmpty ? 'No total' : item.priceLabel,
                  ].filter(Boolean).join('. ')}
                  accessibilityHint={rowPress ? 'Opens material editing' : undefined}
                  onPress={rowPress}
                  onDelete={onDeleteMaterial ? () => onDeleteMaterial(item.id) : undefined}
                  style={rowStyle}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={[
                        typography.body,
                        { color: descriptionEmpty ? criticalEmptyColor() : fg.primary },
                      ]}
                    >
                      {item.name}
                    </Text>
                    {showQuantity ? (
                      <Text
                        style={[
                          typography.bodySmall,
                          { color: fg.secondary, marginTop: space('Spacing/4') },
                        ]}
                      >
                        {item.quantityLabel}
                      </Text>
                    ) : null}
                  </View>
                  <Text
                    style={[
                      typography.metric,
                      {
                        textTransform: 'none',
                        color: totalEmpty ? criticalEmptyColor() : fg.primary,
                      },
                    ]}
                  >
                    {totalEmpty ? 'No total' : item.priceLabel}
                  </Text>
                </ViewRowShell>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

/** Session-bucketed other cost rows (Phase 1 local state). */
export function ViewOtherCostsBuckets({
  buckets,
  typography,
  onOtherCostPress,
  onCardPress,
  onDeleteOtherCost,
  hideBucketHeaders = false,
  emphasizeCriticalEmpty = false,
}: {
  buckets: JobDetailOtherCostBucket[];
  typography: TextStyles;
  onOtherCostPress?: (otherCostId: string) => void;
  /** Phase 2 View: row tap → scoped Other Costs Edit (overrides row presses). */
  onCardPress?: () => void;
  onDeleteOtherCost?: (otherCostId: string) => void;
  hideBucketHeaders?: boolean;
  /** Color critical empty placeholders (type / amount) as error text. */
  emphasizeCriticalEmpty?: boolean;
}) {
  if (buckets.length === 0) {
    return null;
  }

  return (
    <View style={styles.viewCardOuter}>
      <View style={styles.viewCardBorder}>
        {buckets.map((bucket, bi) => (
          <View
            key={bucket.id}
            style={bi > 0 ? { borderTopWidth: 1, borderTopColor: color('Foundation/Border/Subtle') } : undefined}
          >
            {hideBucketHeaders ? null : (
              <BucketHeader bucket={bucket} typography={typography} isFirst={bi === 0} />
            )}
            {bucket.items.map((item, ii) => {
              const rowStyle = [
                styles.materialRow,
                ii > 0 && { borderTopWidth: 1, borderTopColor: color('Foundation/Border/Subtle') },
              ];
              const rowPress = onCardPress
                ? onCardPress
                : onOtherCostPress
                  ? () => onOtherCostPress(item.id)
                  : undefined;
              const typeEmpty = emphasizeCriticalEmpty && isOtherCostTypeEmpty(item);
              const amountEmpty = emphasizeCriticalEmpty && isOtherCostAmountEmpty(item);
              return (
                <ViewRowShell
                  key={`${bucket.id}-${item.id}`}
                  typography={typography}
                  accessibilityLabel={[
                    'Other cost',
                    item.typeLabel,
                    item.description,
                    amountEmpty ? 'No amount' : item.priceLabel,
                  ].filter(Boolean).join('. ')}
                  accessibilityHint={rowPress ? 'Opens other cost editing' : undefined}
                  onPress={rowPress}
                  onDelete={onDeleteOtherCost ? () => onDeleteOtherCost(item.id) : undefined}
                  style={rowStyle}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={[
                        typography.body,
                        { color: typeEmpty ? criticalEmptyColor() : fg.primary },
                      ]}
                    >
                      {item.typeLabel}
                    </Text>
                    {item.description ? (
                      <Text
                        style={[
                          typography.bodySmall,
                          { color: fg.secondary, marginTop: space('Spacing/4') },
                        ]}
                      >
                        {item.description}
                      </Text>
                    ) : null}
                  </View>
                  <Text
                    style={[
                      typography.metric,
                      {
                        textTransform: 'none',
                        color: amountEmpty ? criticalEmptyColor() : fg.primary,
                      },
                    ]}
                  >
                    {amountEmpty ? 'No amount' : item.priceLabel}
                  </Text>
                </ViewRowShell>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Single bordered card listing note buckets (job-scoped vs per-session).
 * Shared by Job Detail and the Inbox.
 */
export function ViewNotesBuckets({
  buckets,
  typography,
  onNotePress,
  onNoteEditPress,
  onCardPress,
  onDeleteNote,
  hideBucketHeaders = false,
  showNoteIcon = true,
  readOnlyExpand = false,
}: {
  buckets: JobDetailNoteBucket[];
  typography: TextStyles;
  /** Tap a row → open the Edit Note sheet / Add to Job sheet for this note. */
  onNotePress?: (noteId: string) => void;
  /** Phase 2 View: expanded truncated note Edit control (legacy per-row). */
  onNoteEditPress?: (noteId: string) => void;
  /** Phase 2 View: row tap → scoped Notes Edit (Show More still expands in place). */
  onCardPress?: () => void;
  onDeleteNote?: (noteId: string) => void;
  hideBucketHeaders?: boolean;
  showNoteIcon?: boolean;
  /** When true, truncated notes expand in place on View. */
  readOnlyExpand?: boolean;
}) {
  const [expandedNoteIds, setExpandedNoteIds] = useState<Set<string>>(() => new Set());

  if (buckets.length === 0) {
    return null;
  }

  const noteIcon = color('Semantic/Activity/Note');

  const toggleNoteExpanded = (noteId: string) => {
    setExpandedNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(noteId)) next.delete(noteId);
      else next.add(noteId);
      return next;
    });
  };

  const renderNoteFooter = (
    n: JobDetailNote,
    options?: { expanded: boolean; onToggle: () => void },
  ) => (
    <View style={styles.noteFooterRow}>
      <Text style={[typography.bodySmall, styles.noteFooterDate, { color: fg.secondary }]}>
        {n.dateLabel}
      </Text>
      {options ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={options.expanded ? 'Show less' : 'Show more'}
          accessibilityState={{ expanded: options.expanded }}
          onPress={options.onToggle}
          hitSlop={8}
          style={({ pressed }) => [styles.showMoreControl, pressed && styles.pressed]}
        >
          <View
            style={[
              styles.showMoreIconWrap,
              options.expanded ? styles.chevronExpanded : undefined,
            ]}
          >
            <JobDetailIconViewSessionChevron color={fg.secondary} />
          </View>
          <Text style={[typography.bodySmall, { color: fg.secondary }]}>
            {options.expanded ? 'Show Less' : 'Show More'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );

  const renderNoteRow = (n: JobDetailNote, ni: number, bucketId: string) => {
    const expanded = expandedNoteIds.has(n.id);
    const rowChrome: object[] = [
      showNoteIcon ? styles.noteRow : styles.noteRowPlain,
      ...(ni > 0
        ? [{ borderTopWidth: 1, borderTopColor: color('Foundation/Border/Subtle') }]
        : []),
    ];
    const noteIconSlot = showNoteIcon ? (
      <View style={{ marginTop: space('Spacing/2') }}>
        <JobDetailIconViewNote color={noteIcon} />
      </View>
    ) : null;

    const rowPress = onCardPress
      ? onCardPress
      : onNotePress
        ? () => onNotePress(n.id)
        : onNoteEditPress
          ? () => onNoteEditPress(n.id)
          : undefined;

    const inner = readOnlyExpand ? (
      <ReadOnlyExpandNoteRow
        note={n}
        expanded={expanded}
        typography={typography}
        rowChrome={rowChrome}
        noteIconSlot={noteIconSlot}
        onToggle={() => toggleNoteExpanded(n.id)}
        renderNoteFooter={renderNoteFooter}
      />
    ) : (
      <View style={rowChrome}>
        {noteIconSlot}
        <View style={styles.noteContent}>
          <Text style={[typography.body, { color: fg.primary }]}>{n.excerpt}</Text>
          {renderNoteFooter(n)}
        </View>
      </View>
    );

    return (
      <ViewRowShell
        key={`${bucketId}-n-${n.id}`}
        typography={typography}
        accessibilityLabel={['Note', n.body, n.dateLabel].filter(Boolean).join('. ')}
        accessibilityHint={rowPress ? 'Opens note editing' : undefined}
        onPress={rowPress}
        onDelete={onDeleteNote ? () => onDeleteNote(n.id) : undefined}
      >
        {inner}
      </ViewRowShell>
    );
  };

  return (
    <View style={styles.viewCardOuter}>
      <View style={styles.viewCardBorder}>
        {buckets.map((bucket, bi) => (
          <View
            key={bucket.id}
            style={bi > 0 ? { borderTopWidth: 1, borderTopColor: color('Foundation/Border/Subtle') } : undefined}
          >
            {hideBucketHeaders ? null : (
              <BucketHeader bucket={bucket} typography={typography} isFirst={bi === 0} />
            )}
            {bucket.notes.map((n, ni) => renderNoteRow(n, ni, bucket.id))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewCardOuter: {
    width: '100%',
    paddingBottom: space('Spacing/8'),
  },
  viewCardBorder: {
    borderRadius: radius('Radius/16'),
    borderWidth: 1,
    borderColor: border.subtle,
    backgroundColor: bg.surfaceWhite,
    overflow: 'hidden',
  },
  bucketHeader: {
    minHeight: space('Spacing/32'),
    justifyContent: 'center',
    backgroundColor: bg.surface,
    borderBottomWidth: 1,
    borderBottomColor: border.subtle,
    paddingHorizontal: space('Spacing/16'),
    paddingVertical: space('Spacing/8'),
  },
  bucketHeaderText: {
    color: fg.secondary,
  },
  bucketHeaderFirst: {
    borderTopLeftRadius: radius('Radius/16'),
    borderTopRightRadius: radius('Radius/16'),
  },
  materialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space('Spacing/16'),
    gap: space('Spacing/16'),
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space('Spacing/8'),
    paddingHorizontal: space('Spacing/16'),
    paddingVertical: space('Spacing/16'),
  },
  noteRowPlain: {
    paddingHorizontal: space('Spacing/16'),
    paddingVertical: space('Spacing/16'),
  },
  noteContent: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  noteMeasureText: {
    position: 'absolute',
    opacity: 0,
    left: 0,
    top: 0,
  },
  noteFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space('Spacing/8'),
    gap: space('Spacing/8'),
  },
  noteFooterDate: {
    flex: 1,
    minWidth: 0,
  },
  showMoreControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space('Spacing/2'),
    flexShrink: 0,
  },
  showMoreIconWrap: {
    width: 12,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ scale: 0.65 }],
  },
  chevronExpanded: {
    transform: [{ scale: 0.65 }, { rotate: '180deg' }],
  },
  pressed: { opacity: 0.75 },
});
