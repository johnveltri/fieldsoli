import { useFonts } from 'expo-font';
import {
  fieldsoloExpoFontAssets,
  fieldsoloLoadedFonts,
} from '@fieldsolo/design-system/expo/loadFieldSoloFonts';
import { useCallback, useMemo, useState } from 'react';
import { Animated, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color } from '@fieldsolo/design-system/lib/tokens';

import { CanvasTiledBackground } from '../components/CanvasTiledBackground';
import { shellBottomNavOuterHeight } from '../components/shell/ShellBottomNav';
import { PlatformHeaderAction } from '../components/platform/PlatformHeaderAction';
import { TopHeaderBackIcon } from '../components/figma-icons/TopHeaderIcons';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '../lib/legal-versions';
import {
  bg,
  createTextStyles,
  fg,
  space,
} from '../theme/nativeTokens';
import { useContentColumn } from '../theme/useContentColumn';
import { screenHeaderA11y } from '../lib/accessibility';

const BACK_ICON_SIZE = 28;

export type HelpScreenProps = {
  onBack: () => void;
};

export function HelpScreen({ onBack }: HelpScreenProps) {
  const insets = useSafeAreaInsets();
  const { columnStyle } = useContentColumn();
  const scrollY = useMemo(() => new Animated.Value(0), []);
  const [scrollContentHeight, setScrollContentHeight] = useState(0);

  const [fontsLoaded] = useFonts(fieldsoloExpoFontAssets);

  const typography = useMemo(
    () =>
      createTextStyles(fieldsoloLoadedFonts),
    [],
  );

  const headerTopPad = Math.max(insets.top - space('Spacing/12'), 0);
  const bottomNavReservedHeight = shellBottomNavOuterHeight(insets.bottom);

  const openHelpEmail = useCallback(() => {
    void Linking.openURL(SUPPORT_MAILTO);
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={styles.root}>
        <CanvasTiledBackground scrollY={scrollY} contentHeight={scrollContentHeight} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CanvasTiledBackground scrollY={scrollY} contentHeight={scrollContentHeight} />
      <Animated.ScrollView
        style={[styles.scroll, { paddingTop: headerTopPad }]}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: bottomNavReservedHeight + space('Spacing/20'),
            flexGrow: 1,
          },
        ]}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
        onContentSizeChange={(_w, h) => setScrollContentHeight(h)}
      >
        <View style={columnStyle}>
          <View style={styles.topHeaderRow}>
            <PlatformHeaderAction accessibilityLabel="Back" onPress={onBack}>
              <TopHeaderBackIcon size={BACK_ICON_SIZE} color={fg.primary} />
            </PlatformHeaderAction>
            <Text {...screenHeaderA11y()} style={[typography.headingH2, styles.title]}>
              Help & Support
            </Text>
          </View>

          <View style={styles.bodyWrap}>
            <Text style={[typography.body, styles.bodyText, { color: fg.primary }]}>
              For account-related help or to request a copy of your data, email us at{' '}
              <Text
                accessibilityRole="link"
                style={styles.emailLink}
                onPress={openHelpEmail}
              >
                {SUPPORT_EMAIL}
              </Text>
              .
            </Text>
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', backgroundColor: bg.canvasWarm },
  scroll: { flex: 1, width: '100%', backgroundColor: 'transparent', zIndex: 1 },
  scrollContent: { alignItems: 'stretch' },
  topHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingTop: space('Spacing/32'),
    paddingBottom: space('Spacing/16'),
    gap: space('Spacing/8'),
  },
  backHit: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  title: {
    flex: 1,
    color: fg.primary,
  },
  bodyWrap: {
    width: '100%',
    paddingHorizontal: 0,
    paddingTop: space('Spacing/8'),
  },
  bodyText: {
    lineHeight: 24,
  },
  emailLink: {
    color: color('Brand/Accent'),
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  pressed: { opacity: 0.75 },
});
