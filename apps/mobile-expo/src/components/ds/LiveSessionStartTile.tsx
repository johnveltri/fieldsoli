import { Pressable, StyleSheet, Text } from 'react-native';
import { color, radius, space } from '@fieldsolo/design-system/lib/tokens';

import { bg, cardShadowRn, fg } from '../../theme/nativeTokens';
import type { TextStyles } from '../../theme/nativeTokens';
import { LiveSessionActiveDotIcon } from '../figma-icons/JobDetailScreenIcons';

type LiveSessionStartTileProps = {
  typography: TextStyles;
  onPress: () => void;
  disabled?: boolean;
};

/**
 * Phase 3 Job View: compact "LIVE" control in the Sessions header row
 * (same chrome as the dark EDIT / ADD pills; red live dot instead of +).
 */
export function LiveSessionStartTile({
  typography,
  onPress,
  disabled,
}: LiveSessionStartTileProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Start live session"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <LiveSessionActiveDotIcon color={color('Brand/Primary')} size={11.5} />
      <Text style={[typography.pillCompact, styles.label]}>LIVE</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
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
  label: {
    color: bg.canvasWarm,
  },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },
});
