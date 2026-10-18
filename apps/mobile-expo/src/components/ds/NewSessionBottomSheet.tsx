import { Pressable, StyleSheet, Text, View } from 'react-native';
import { color, radius, space } from '@fieldsolo/design-system/lib/tokens';

import { bg, border, fg } from '../../theme/nativeTokens';
import type { TextStyles } from '../../theme/nativeTokens';
import {
  SessionChooserRowPlayIcon,
  SessionChooserRowPlusIcon,
  SessionSheetBackIcon,
} from '../figma-icons/JobDetailScreenIcons';
import { BottomSheetShell } from './BottomSheetShell';
import { screenHeaderA11y } from '../../lib/accessibility';

type NewSessionBottomSheetProps = {
  typography: TextStyles;
  visible: boolean;
  onClose?: () => void;
  onClosed?: () => void;
  /** Static in v1 — no-op from the parent per spec. */
  onLiveSessionPress?: () => void;
  onLogPastPress?: () => void;
};

/**
 * "New Session" chooser (Figma `1286:602`) — two `RowCard` tiles surfaced after
 * the user taps ADD on the Sessions section.
 */
export function NewSessionBottomSheet({
  typography,
  visible,
  onClose,
  onClosed,
  onLiveSessionPress,
  onLogPastPress,
}: NewSessionBottomSheetProps) {
  return (
    <BottomSheetShell visible={visible} onClose={onClose} onClosed={onClosed}>
      <View style={styles.body}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onClose}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <SessionSheetBackIcon color={fg.secondary} />
          <Text style={[typography.bodyBold, { color: fg.secondary }]}>Back</Text>
        </Pressable>

        <Text {...screenHeaderA11y()} style={[typography.titleH3, styles.title, { color: fg.primary }]}>
          New Visit
        </Text>

        <View style={styles.rows}>
          <RowCardTile
            typography={typography}
            variant="primary"
            title="Live Visit"
            subtitle="Start a timer now"
            onPress={onLiveSessionPress}
          />
          <RowCardTile
            typography={typography}
            variant="neutral"
            title="Log Past Visit"
            subtitle="Log a completed visit manually"
            onPress={onLogPastPress}
          />
        </View>
      </View>
    </BottomSheetShell>
  );
}

type RowCardTileProps = {
  typography: TextStyles;
  variant: 'primary' | 'neutral';
  title: string;
  subtitle: string;
  onPress?: () => void;
};

function RowCardTile({
  typography,
  variant,
  title,
  subtitle,
  onPress,
}: RowCardTileProps) {
  const isPrimary = variant === 'primary';
  const cardBg = isPrimary
    ? color('Brand/Primary')
    : color('Semantic/Status/Neutral/BG');
  const cardBorder = isPrimary ? border.subtle : fg.primary;
  const leadingBg = isPrimary ? 'rgba(250,246,240,0.2)' : fg.secondary;
  const textColor = isPrimary ? fg.muted : fg.primary;
  const subtitleColor = isPrimary ? fg.muted : fg.secondary;
  const iconColor = isPrimary ? fg.muted : bg.surfaceWhite;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: cardBg,
          borderColor: cardBorder,
        },
        pressed && onPress ? styles.pressed : null,
      ]}
    >
      <View style={[styles.rowLeading, { backgroundColor: leadingBg }]}>
        {isPrimary ? (
          <SessionChooserRowPlayIcon color={iconColor} />
        ) : (
          <SessionChooserRowPlusIcon color={iconColor} />
        )}
      </View>
      <View style={styles.rowTextStack}>
        <Text
          style={[typography.bodyBold, { color: textColor }]}
        >
          {title}
        </Text>
        <Text
          style={[typography.bodySmall, { color: subtitleColor }]}
        >
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: {
    width: '100%',
    gap: space('Spacing/16'),
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space('Spacing/4'),
    alignSelf: 'flex-start',
  },
  title: {
    textAlign: 'center',
    marginTop: space('Spacing/16'),
  },
  rows: {
    marginTop: space('Spacing/24'),
    gap: space('Spacing/12'),
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space('Spacing/12'),
    minHeight: space('Spacing/80') + space('Spacing/4'),
    paddingHorizontal: space('Spacing/20'),
    paddingVertical: space('Spacing/16'),
    borderRadius: radius('Radius/16'),
    borderWidth: 1,
    shadowColor: color('Foundation/Text/Primary'),
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  rowLeading: {
    width: space('Spacing/40'),
    height: space('Spacing/40'),
    borderRadius: radius('Radius/Full'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextStack: {
    flex: 1,
    minWidth: 0,
    gap: space('Spacing/4'),
  },
  pressed: {
    opacity: 0.8,
  },
});
