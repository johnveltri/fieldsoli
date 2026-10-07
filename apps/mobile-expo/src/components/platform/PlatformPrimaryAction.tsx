import { useFonts } from 'expo-font';
import {
  fieldsoloExpoFontAssets,
  fieldsoloLoadedFonts,
} from '@fieldsolo/design-system/expo/loadFieldSoloFonts';
import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { color } from '@fieldsolo/design-system/lib/tokens';
import {
  QuickCaptureNewMaterialIcon,
  QuickCaptureNewNoteIcon,
  QuickCaptureStartSessionIcon,
} from '../figma-icons/QuickActionsSheetIcons';
import { JobsFabPlusIcon } from '../figma-icons/JobsScreenIcons';
import { dynamicTypeTextStyle } from '../../theme/dynamicTypeText';
import { createTextStyles, fg, space } from '../../theme/nativeTokens';
import { PlatformFloatingSurface } from './PlatformFloatingSurface';
import { usePlatformGlass } from './usePlatformGlass';

export type PrimaryActionMenuItemId =
  | 'new_job'
  | 'live_session'
  | 'quick_note'
  | 'quick_material';

const fabIconColor = color('Foundation/Surface/White');
const menuInk = color('Foundation/Text/Primary');

function PrimaryActionCloseIcon({ color: stroke, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 6l12 12M18 6L6 18"
        stroke={stroke}
        strokeWidth={2.25}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Bottom → top visual order matches product: New Job closest to +. */
const MENU_ITEMS: {
  id: PrimaryActionMenuItemId;
  label: string;
  icon: (color: string) => React.ReactNode;
}[] = [
  {
    id: 'quick_material',
    label: 'Quick Material',
    icon: (c) => <QuickCaptureNewMaterialIcon color={c} />,
  },
  {
    id: 'quick_note',
    label: 'Quick Note',
    icon: (c) => <QuickCaptureNewNoteIcon color={c} />,
  },
  {
    id: 'live_session',
    label: 'Live Session',
    icon: (c) => <QuickCaptureStartSessionIcon color={c} />,
  },
  {
    id: 'new_job',
    label: 'New Job',
    icon: (c) => <JobsFabPlusIcon color={c} size={20} />,
  },
];

type PlatformPrimaryActionMenuProps = {
  open: boolean;
  onSelect: (id: PrimaryActionMenuItemId) => void;
};

export function PlatformPrimaryActionMenu({
  open,
  onSelect,
}: PlatformPrimaryActionMenuProps) {
  const { reduceMotion } = usePlatformGlass();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: reduceMotion ? 0 : 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [open, progress, reduceMotion]);

  const [fontsLoaded] = useFonts(fieldsoloExpoFontAssets);

  const typography = useMemo(
    () =>
      createTextStyles(fieldsoloLoadedFonts),
    [],
  );

  void fontsLoaded;

  if (!open) {
    return null;
  }

  return (
    <View style={styles.menuStack} pointerEvents="box-none">
      {MENU_ITEMS.map((item, index) => {
        const translateY = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [16 + index * 4, 0],
        });
        const opacity = progress;
        const labelStyle = dynamicTypeTextStyle(typography.body, 1, { padRatio: 0.05 });
        return (
          <Animated.View
            key={item.id}
            style={{
              opacity,
              transform: [{ translateY }],
              marginBottom: space('Spacing/8'),
            }}
          >
            <PlatformFloatingSurface
              shape="rounded"
              tone="menu"
              style={styles.menuItemSurface}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.label}
                android_ripple={{ color: 'rgba(43, 52, 65, 0.10)' }}
                onPress={() => onSelect(item.id)}
                style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
              >
                <View style={styles.menuIcon}>{item.icon(menuInk)}</View>
                <Text style={[labelStyle, styles.menuLabel, { color: menuInk }]}>{item.label}</Text>
              </Pressable>
            </PlatformFloatingSurface>
          </Animated.View>
        );
      })}
    </View>
  );
}

type PlatformPrimaryActionProps = {
  open: boolean;
  disabled?: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSelectMenuItem: (id: PrimaryActionMenuItemId) => void;
  /** Diameter of the circular FAB. */
  size: number;
  accessibilityLabel?: string;
};

export function PlatformPrimaryAction({
  open,
  disabled,
  onOpen,
  onClose,
  onSelectMenuItem,
  size,
  accessibilityLabel = 'Primary action',
}: PlatformPrimaryActionProps) {
  const iconSize = Math.max(22, Math.round(size * 0.4));
  const lastPressAt = useRef(0);

  const controlStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  } as const;

  const handlePress = () => {
    const now = Date.now();
    if (now - lastPressAt.current < 280) return;
    lastPressAt.current = now;
    if (open) onClose();
    else onOpen();
  };

  return (
    // Anchor is NOT size-locked to the FAB — menu must not clip inside a circle-sized box.
    <View style={styles.root} pointerEvents="box-none">
      {open ? (
        <View style={[styles.menuLayer, { marginBottom: space('Spacing/12') }]} pointerEvents="box-none">
          <PlatformPrimaryActionMenu open={open} onSelect={onSelectMenuItem} />
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={open ? 'Close primary actions' : accessibilityLabel}
        accessibilityState={{ expanded: open }}
        android_ripple={{
          color: 'rgba(255, 255, 255, 0.22)',
          borderless: true,
          radius: size / 2,
        }}
        disabled={disabled}
        onPress={handlePress}
        style={({ pressed }) => [
          controlStyle,
          pressed && !disabled && Platform.OS === 'ios' && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        <PlatformFloatingSurface tone="fab" style={controlStyle}>
          <View style={styles.buttonCenter} pointerEvents="none">
            {open ? (
              <PrimaryActionCloseIcon color={fabIconColor} size={iconSize} />
            ) : (
              <JobsFabPlusIcon color={fabIconColor} size={iconSize} />
            )}
          </View>
        </PlatformFloatingSurface>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  menuLayer: {
    alignItems: 'flex-end',
    zIndex: 3,
  },
  menuStack: {
    alignItems: 'stretch',
    minWidth: 196,
  },
  menuItemSurface: {
    borderRadius: 22,
    minWidth: 196,
    // GlassView does not reliably derive an intrinsic frame from children in
    // an iOS transparent Modal. Give the effect a real drawable row height.
    minHeight: 54,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space('Spacing/12'),
    paddingVertical: space('Spacing/12'),
    paddingHorizontal: space('Spacing/16'),
    minHeight: 54,
    width: '100%',
  },
  menuIcon: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    flexShrink: 1,
    color: fg.primary,
  },
  buttonCenter: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.88 },
  disabled: { opacity: 0.4 },
});
