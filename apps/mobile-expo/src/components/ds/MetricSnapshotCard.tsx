import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { color, colorWithAlpha, radius, space } from '@fieldsolo/design-system/lib/tokens';

import {
  dynamicTypeLineMinHeight,
  dynamicTypeTextStyle,
} from '../../theme/dynamicTypeText';
import { bg, cardShadowRn, type TextStyles } from '../../theme/nativeTokens';

export type MetricSnapshotCardProps = {
  label: string;
  value: string;
  helperText?: string;
  valueTone: 'success' | 'neutral';
  /** When set, overrides `valueTone` for the metric value color. */
  valueColor?: string;
  typography: TextStyles;
  /** When provided, the card becomes a button that navigates on press. */
  onPress?: () => void;
};

/**
 * Home weekly snapshot — large NET EARNINGS card (Figma `1931:2046`).
 */
export function MetricSnapshotCard({
  label,
  value,
  helperText,
  valueTone,
  valueColor: valueColorProp,
  typography,
  onPress,
}: MetricSnapshotCardProps) {
  const { fontScale } = useWindowDimensions();
  const valueColor =
    valueColorProp ??
    (valueTone === 'success'
      ? color('Semantic/Status/Success/Text')
      : color('Foundation/Text/Primary'));

  const labelSize = typography.labelCaps.fontSize ?? 12;
  const labelStyle = dynamicTypeTextStyle(typography.labelCaps, fontScale, {
    padRatio: 0.1,
  });
  const valueSize = typography.metricXL.fontSize ?? 42;
  const valueStyle = dynamicTypeTextStyle(typography.metricXL, fontScale, {
    letterSpacingUntilScale: 99,
    padRatio: 0.06,
  });
  const cardPad = fontScale > 1.6 ? space('Spacing/16') : space('Spacing/32');

  const inner = (
    <View style={styles.primary}>
      <View
        style={{
          minHeight: dynamicTypeLineMinHeight(labelSize, fontScale, 1.7),
          justifyContent: 'center',
          width: '100%',
        }}
      >
        <Text style={[labelStyle, styles.label, { color: color('Foundation/Text/Secondary') }]}>
          {label}
        </Text>
      </View>
      <View
        style={{
          minHeight: dynamicTypeLineMinHeight(valueSize, fontScale, 1.25),
          width: '100%',
        }}
      >
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.55}
          numberOfLines={1}
          style={[valueStyle, styles.value, { color: valueColor }]}
        >
          {value}
        </Text>
      </View>
      {helperText ? (
        <Text style={[typography.bodySmall, styles.helper, { color: color('Foundation/Text/Secondary') }]}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label} ${value}${helperText ? `. ${helperText}` : ''}`}
        style={({ pressed }) => [styles.card, { padding: cardPad }, pressed && styles.pressed]}
      >
        {inner}
      </Pressable>
    );
  }

  return (
    <View
      style={[styles.card, { padding: cardPad }]}
      accessibilityRole="summary"
      accessibilityLabel={`${label} ${value}${helperText ? `. ${helperText}` : ''}`}
    >
      {inner}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: bg.surfaceWhite,
    borderWidth: 1,
    borderColor: colorWithAlpha('Foundation/Border/Default', 0.1),
    borderRadius: radius('Radius/24'),
    // padding applied dynamically for Dynamic Type
    overflow: 'visible',
    ...cardShadowRn,
  },
  primary: {
    alignItems: 'center',
    gap: space('Spacing/8'),
    width: '100%',
    overflow: 'visible',
  },
  label: {
    textAlign: 'center',
  },
  value: {
    textAlign: 'center',
    width: '100%',
  },
  helper: {
    marginTop: space('Spacing/8'),
    textAlign: 'center',
  },
  pressed: { opacity: 0.75 },
});
