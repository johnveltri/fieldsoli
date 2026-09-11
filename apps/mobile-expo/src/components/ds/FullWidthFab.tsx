import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space } from '@fieldsolo/design-system/lib/tokens';

import { cardShadowRn } from '../../theme/nativeTokens';
import type { TextStyles } from '../../theme/nativeTokens';

export type FullWidthFabProps = {
  typography: TextStyles;
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  disabled?: boolean;
  /**
   * When true, adds bottom safe-area inset under the control so it clears
   * the home indicator when pinned to the screen bottom.
   */
  includeSafeArea?: boolean;
  /** Horizontal inset from the sheet/screen edges. */
  horizontalInset?: number;
  backgroundColor?: string;
  labelColor?: string;
};

/**
 * Full-width floating primary action — sticky-friendly FAB bar (not circular).
 * Used for high-commitment actions like End Session on the live overlay.
 * Footer chrome is fully transparent so content shows through behind the button.
 */
export function FullWidthFab({
  typography,
  label,
  accessibilityLabel,
  onPress,
  disabled = false,
  includeSafeArea = false,
  horizontalInset = space('Spacing/20'),
  backgroundColor = color('Brand/Primary'),
  labelColor = color('Foundation/Surface/White'),
}: FullWidthFabProps) {
  const insets = useSafeAreaInsets();
  const bottomPad = includeSafeArea
    ? Math.max(insets.bottom, space('Spacing/12'))
    : space('Spacing/12');

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          paddingHorizontal: horizontalInset,
          paddingTop: space('Spacing/20'),
          paddingBottom: bottomPad,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor, shadowColor: backgroundColor },
          disabled && styles.disabled,
          pressed && !disabled && styles.pressed,
        ]}
      >
        <Text style={[typography.ctaPrimaryLabel, styles.label, { color: labelColor }]}>
          {label}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  fab: {
    width: '100%',
    minHeight: space('Spacing/50'),
    borderRadius: radius('Radius/16'),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space('Spacing/24'),
    paddingVertical: space('Spacing/16'),
    ...cardShadowRn,
  },
  label: {
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.88,
  },
});
