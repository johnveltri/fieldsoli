import { Pressable, StyleSheet, Text, View } from 'react-native';

import { color, radius, space } from '@fieldsolo/design-system/lib/tokens';

import { cardShadowRn, fg, type TextStyles } from '../../theme/nativeTokens';
import { HomeSummaryCardArrowIcon } from '../figma-icons/HomeSectionIcons';

type ActionSummaryCardProps = {
  title: string;
  subtitle: string;
  accentColor: string;
  subtitleColor?: string;
  trailingValue?: string;
  typography: TextStyles;
  onPress: () => void;
  accessibilityLabel?: string;
};

/** Shared card treatment for a short summary that opens its next step. */
export function ActionSummaryCard({
  title,
  subtitle,
  accentColor,
  subtitleColor = fg.secondary,
  trailingValue,
  typography,
  onPress,
  accessibilityLabel,
}: ActionSummaryCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${title}. ${subtitle}.`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.main}>
        <Text style={[typography.titleH3, styles.title, { color: fg.primary }]}>{title}</Text>
        <Text style={[typography.bodySmall, { color: subtitleColor }]}>{subtitle}</Text>
      </View>
      <View style={styles.trailing}>
        {trailingValue ? (
          <Text style={[typography.metric, styles.trailingValue, { color: accentColor }]}>
            {trailingValue}
          </Text>
        ) : null}
        <HomeSummaryCardArrowIcon backgroundColor={accentColor} arrowColor={fg.muted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space('Spacing/20'),
    paddingVertical: space('Spacing/16'),
    backgroundColor: color('Foundation/Surface/White'),
    borderColor: color('Foundation/Border/Subtle'),
    borderWidth: 1,
    borderRadius: radius('Radius/16'),
    ...cardShadowRn,
  },
  main: {
    flex: 1,
    minWidth: 0,
    gap: space('Spacing/4'),
    marginRight: space('Spacing/12'),
  },
  title: { width: '100%' },
  trailing: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space('Spacing/12'),
  },
  trailingValue: { textTransform: 'none', fontVariant: ['tabular-nums'] },
  pressed: { opacity: 0.75 },
});
