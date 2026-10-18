import { useFonts } from 'expo-font';
import {
  fieldsoloExpoFontAssets,
  fieldsoloLoadedFonts,
} from '@fieldsolo/design-system/expo/loadFieldSoloFonts';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color } from '@fieldsolo/design-system/lib/tokens';

import { CanvasTiledBackground } from '../components/CanvasTiledBackground';
import { shellBottomNavOuterHeight } from '../components/shell/ShellBottomNav';
import { ProfileRowsCard, type ProfileRowsCardRow } from '../components/ds';
import { PlatformHeaderAction } from '../components/platform/PlatformHeaderAction';
import { TopHeaderBackIcon } from '../components/figma-icons/TopHeaderIcons';
import {
  grantAnalyticsConsent,
  resolveAnalyticsConsentForUser,
  withdrawAnalyticsConsent,
} from '../lib/analytics/consentSync';
import { LEGAL_URLS } from '../lib/legal-versions';
import {
  bg,
  createTextStyles,
  fg,
  space,
} from '../theme/nativeTokens';
import { useContentColumn } from '../theme/useContentColumn';
import { screenHeaderA11y } from '../lib/accessibility';

const BACK_ICON_SIZE = 28;

export type PrivacyChoicesScreenProps = {
  userId: string;
  onBack: () => void;
};

function extractErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string' && e.length > 0) return e;
  if (e && typeof e === 'object' && 'message' in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === 'string' && m.length > 0) return m;
  }
  return fallback;
}

export function PrivacyChoicesScreen({ userId, onBack }: PrivacyChoicesScreenProps) {
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

  const [loading, setLoading] = useState(true);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const result = await resolveAnalyticsConsentForUser(userId);
        if (cancelled) return;
        setAnalyticsEnabled(result === 'granted');
      } catch {
        if (!cancelled) setAnalyticsEnabled(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const onAnalyticsToggle = useCallback(
    async (next: boolean) => {
      if (saving) return;
      const previous = analyticsEnabled;
      setAnalyticsEnabled(next);
      setSaving(true);
      try {
        if (next) {
          await grantAnalyticsConsent(userId);
        } else {
          await withdrawAnalyticsConsent(userId);
        }
      } catch (e) {
        setAnalyticsEnabled(previous);
        Alert.alert(
          'Could not update preference',
          extractErrorMessage(e, 'Please try again.'),
        );
      } finally {
        setSaving(false);
      }
    },
    [analyticsEnabled, saving, userId],
  );

  const openUrl = useCallback((url: string) => {
    void Linking.openURL(url);
  }, []);

  const analyticsRows: ProfileRowsCardRow[] = useMemo(
    () => [
      {
        kind: 'toggle',
        label: 'Help improve FieldSoli',
        value: analyticsEnabled,
        onValueChange: (next) => void onAnalyticsToggle(next),
        disabled: loading || saving,
      },
    ],
    [analyticsEnabled, loading, onAnalyticsToggle, saving],
  );

  const legalRows: ProfileRowsCardRow[] = useMemo(
    () => [
      {
        kind: 'link',
        label: 'Privacy Policy',
        onPress: () => openUrl(LEGAL_URLS.privacyPolicy),
      },
      {
        kind: 'link',
        label: 'Terms',
        onPress: () => openUrl(LEGAL_URLS.terms),
      },
    ],
    [openUrl],
  );

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
              Privacy Choices
            </Text>
          </View>

          <View style={styles.bodyWrap}>
            <Text style={[typography.metricS, styles.sectionLabel]}>ANALYTICS</Text>
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator />
              </View>
            ) : (
              <ProfileRowsCard typography={typography} rows={analyticsRows} />
            )}

            <Text style={[typography.metricS, styles.sectionLabel]}>LEGAL</Text>
            <ProfileRowsCard typography={typography} rows={legalRows} />
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
    alignItems: 'flex-start',
    paddingHorizontal: 0,
    paddingTop: space('Spacing/32'),
    paddingBottom: space('Spacing/16'),
    gap: space('Spacing/16'),
  },
  backHit: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  title: {
    alignSelf: 'stretch',
    color: fg.primary,
  },
  bodyWrap: {
    width: '100%',
    paddingHorizontal: 0,
    paddingTop: space('Spacing/8'),
    gap: space('Spacing/12'),
  },
  sectionLabel: {
    color: color('Brand/Accent'),
    paddingTop: space('Spacing/16'),
    paddingBottom: space('Spacing/4'),
  },
  loadingRow: {
    minHeight: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.75 },
});
