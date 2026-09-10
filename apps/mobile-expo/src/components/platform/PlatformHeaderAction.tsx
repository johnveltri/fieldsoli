import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { fg } from '../../theme/nativeTokens';
import { PlatformFloatingSurface } from './PlatformFloatingSurface';

/** Icons on orange brand FAB header chrome (profile, jobs inbox). */
export const platformHeaderActionIconColor = '#FFFFFF';

export type PlatformHeaderActionVariant = 'primary' | 'surface';

type PlatformHeaderActionProps = {
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  children: ReactNode;
  /** Applied to the outer 44×44 hit target (e.g. inbox badge positioning). */
  style?: StyleProp<ViewStyle>;
  /** When false, skip the floating chrome wrapper (icon-only hit target). */
  useFloatingChrome?: boolean;
  /**
   * `surface` — clear Liquid Glass on iOS (dock-like), white M3 surface on Android (back, close).
   * `primary` — brand orange FAB chrome (profile, inbox entry).
   * @default 'surface'
   */
  variant?: PlatformHeaderActionVariant;
};

const MIN_TOUCH = 44;
const CHROME_RADIUS = MIN_TOUCH / 2;

const chromeSizeStyle = {
  width: MIN_TOUCH,
  height: MIN_TOUCH,
  borderRadius: CHROME_RADIUS,
} as const;

function iconColorForVariant(variant: PlatformHeaderActionVariant): string {
  return variant === 'primary' ? platformHeaderActionIconColor : fg.primary;
}

function withIconColor(children: ReactNode, color: string): ReactNode {
  return Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    const props = child.props as { color?: string };
    if (!('color' in props)) return child;
    return cloneElement(child as ReactElement<{ color?: string }>, { color });
  });
}

/**
 * Circular header control (back, close, inbox, profile).
 * `surface` back/close: iOS clear Liquid Glass (`dock`), Android white M3 surface (`menu`).
 */
export function PlatformHeaderAction({
  accessibilityLabel,
  onPress,
  disabled = false,
  children,
  style,
  useFloatingChrome = true,
  variant = 'surface',
}: PlatformHeaderActionProps) {
  const surfaceTone =
    variant === 'primary' ? 'fab' : Platform.OS === 'ios' ? 'dock' : 'menu';
  const iconColor = iconColorForVariant(variant);
  const rippleColor =
    variant === 'primary' ? 'rgba(255, 255, 255, 0.22)' : 'rgba(43, 52, 65, 0.10)';

  if (!useFloatingChrome) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        hitSlop={6}
        style={({ pressed }) => [
          styles.bareHit,
          style,
          pressed && !disabled && styles.pressedIos,
          disabled && styles.disabled,
        ]}
      >
        {withIconColor(children, iconColor)}
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      android_ripple={{
        color: rippleColor,
        borderless: true,
        radius: CHROME_RADIUS,
      }}
      style={({ pressed }) => [
        styles.pressableOuter,
        style,
        pressed && !disabled && Platform.OS === 'ios' && styles.pressedIos,
        disabled && styles.disabled,
      ]}
    >
      <PlatformFloatingSurface
        tone={surfaceTone}
        contentLayout="fill"
        style={chromeSizeStyle}
      >
        <View style={styles.iconSlot} pointerEvents="none">
          {withIconColor(children, iconColor)}
        </View>
      </PlatformFloatingSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressableOuter: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    overflow: 'visible',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    ...(Platform.OS === 'android' ? { backgroundColor: 'transparent' } : null),
  },
  /** Match PlatformPrimaryAction — center glyph in the full chrome circle. */
  iconSlot: {
    width: '100%',
    height: '100%',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bareHit: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressedIos: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.5,
  },
});
