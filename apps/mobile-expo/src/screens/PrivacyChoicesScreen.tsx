import { useFonts } from 'expo-font';
import {
  fieldsoloExpoFontAssets,
  fieldsoloLoadedFonts,
} from '@fieldsolo/design-system/expo/loadFieldSoloFonts';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
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
import { DeleteAccountBottomSheet, ProfileRowsCard, type ProfileRowsCardRow } from '../components/ds';
import { PlatformHeaderAction } from '../components/platform/PlatformHeaderAction';
import { TopHeaderBackIcon } from '../components/figma-icons/TopHeaderIcons';
import {
  grantAnalyticsConsent,
  resolveAnalyticsConsentForUser,
  withdrawAnalyticsConsent,
} from '../lib/analytics/consentSync';
import { LEGAL_URLS } from '../lib/legal-versions';
import {
  manageDevicePermission,
  readDevicePermissions,
  type DevicePermissions,
} from '../lib/devicePermissions';
import {
  bg,
  createTextStyles,
  fg,
  space,
} from '../theme/nativeTokens';
import { useContentColumn } from '../theme/useContentColumn';
import { OverlaySlideHost } from '../navigation/OverlaySlideHost';
import { ProfileTrashIcon } from '../components/figma-icons/ProfileScreenIcons';
import { analytics } from '../lib/analytics';
import { screenHeaderA11y } from '../lib/accessibility';

const BACK_ICON_SIZE = 28;

export type PrivacyChoicesScreenProps = {
  userId: string;
  onBack: () => void;
  onDeleteAccount: () => void;
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

export function PrivacyChoicesScreen({ userId, onBack, onDeleteAccount }: PrivacyChoicesScreenProps) {
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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteMounted, setDeleteMounted] = useState(false);
  const [permissions, setPermissions] = useState<DevicePermissions | null>(null);
  const [openingSettings, setOpeningSettings] = useState(false);
  const refreshPermissions = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;
    let revision = 0;
    setPermissions(null);
    const refresh = () => {
      const requestRevision = ++revision;
      void readDevicePermissions().then((next) => {
        if (!cancelled && requestRevision === revision) setPermissions(next);
      });
    };
    refreshPermissions.current = refresh;
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => { cancelled = true; refreshPermissions.current = () => {}; subscription.remove(); };
  }, [userId]);

  const manageDevicePermissions = useCallback(async (permission: keyof DevicePermissions) => {
    if (openingSettings) return;
    setOpeningSettings(true);
    try {
      await manageDevicePermission(permission);
    } catch {
      Alert.alert('Could not manage permission', 'Open your device Settings and select FieldSoli to manage access.');
    } finally { refreshPermissions.current(); setOpeningSettings(false); }
  }, [openingSettings]);

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
        accessibilityElementsHidden={deleteMounted}
        importantForAccessibility={deleteMounted ? 'no-hide-descendants' : 'auto'}
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
            <Text accessibilityRole="header" style={[typography.titleH3, styles.sectionLabel]}>Analytics</Text>
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator />
              </View>
            ) : (
              <ProfileRowsCard typography={typography} rows={analyticsRows} />
            )}

            <Text accessibilityRole="header" style={[typography.titleH3, styles.sectionLabel]}>Device permissions</Text>
            <ProfileRowsCard typography={typography} rows={[
              {
                kind: 'toggle',
                label: 'Address suggestions',
                accessibilityHint: 'Requests location access the first time. Later changes open FieldSoli in device Settings.',
                value: permissions?.location === 'allowed',
                disabled: !permissions || permissions.location === 'unavailable' || openingSettings,
                onValueChange: () => { void manageDevicePermissions('location'); },
              },
              {
                kind: 'toggle',
                label: 'Contacts',
                accessibilityHint: `${permissions?.contacts === 'limited' ? 'Limited contacts access. ' : ''}Requests contacts access the first time. Later changes open FieldSoli in device Settings.`,
                value: permissions?.contacts === 'allowed' || permissions?.contacts === 'limited',
                disabled: !permissions || permissions.contacts === 'unavailable' || openingSettings,
                onValueChange: () => { void manageDevicePermissions('contacts'); },
              },
            ]} />

            <Text accessibilityRole="header" style={[typography.titleH3, styles.sectionLabel]}>Legal</Text>
            <ProfileRowsCard typography={typography} rows={legalRows} />
            <View style={styles.deleteAction}>
              <ProfileRowsCard
                typography={typography}
                plain
                framed={false}
                rows={[{
                  kind: 'linkWithIcon',
                  label: 'Delete Account',
                  icon: <ProfileTrashIcon color={color('Semantic/Status/Error/Text')} />,
                  tone: 'danger',
                  onPress: () => {
                    analytics.capture('account_delete_requested', { source: 'profile' });
                    setDeleteMounted(true);
                    setDeleteOpen(true);
                  },
                }]}
              />
            </View>
          </View>
        </View>
      </Animated.ScrollView>
      {deleteMounted ? (
        <OverlaySlideHost
          visible={deleteOpen}
          axis="horizontal"
          onRequestClose={() => setDeleteOpen(false)}
          onExited={() => setDeleteMounted(false)}
        >
          <DeleteAccountBottomSheet
            presentation="page"
            typography={typography}
            visible={deleteOpen}
            onBack={() => setDeleteOpen(false)}
            onSubmit={onDeleteAccount}
          />
        </OverlaySlideHost>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', backgroundColor: bg.canvasWarm },
  scroll: { flex: 1, width: '100%', backgroundColor: 'transparent', zIndex: 1 },
  scrollContent: { alignItems: 'stretch' },
  topHeaderRow: {
    width: '100%',
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 0,
    paddingTop: space('Spacing/32'),
    paddingBottom: space('Spacing/16'),
    gap: space('Spacing/12'),
  },
  backHit: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  title: {
    flex: 1,
    minWidth: 0,
    color: fg.primary,
  },
  bodyWrap: {
    width: '100%',
    paddingHorizontal: 0,
    paddingTop: space('Spacing/8'),
    gap: space('Spacing/12'),
  },
  sectionLabel: {
    color: fg.primary,
    paddingTop: space('Spacing/24'),
    paddingBottom: space('Spacing/4'),
  },
  deleteAction: { paddingTop: space('Spacing/16') },
  loadingRow: {
    minHeight: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.75 },
});
