import { useFonts } from 'expo-font';
import {
  fieldsoloExpoFontAssets,
  fieldsoloLoadedFonts,
} from '@fieldsolo/design-system/expo/loadFieldSoloFonts';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  fetchCurrentUserProfile,
  updateCurrentUserProfile,
  type UserProfile,
} from '@fieldsolo/api-client';
import { color } from '@fieldsolo/design-system/lib/tokens';

import { CanvasTiledBackground } from '../components/CanvasTiledBackground';
import { useInvoicingFlag } from '../lib/featureFlags';
import { BusinessSettingsScreen } from './BusinessSettingsScreen';
import {
  ChangePasswordBottomSheet,
  DeleteAccountBottomSheet,
  ProfileRowsCard,
  type ProfileRowsCardRow,
  type UpdateProfileValues,
} from '../components/ds';
import {
  ProfileTrashIcon,
} from '../components/figma-icons/ProfileScreenIcons';
import { PlatformHeaderAction } from '../components/platform/PlatformHeaderAction';
import {
  PlatformHeaderTitle,
  platformHeaderRowStyle,
} from '../components/platform/platformHeaderMetrics';
import { TopHeaderBackIcon } from '../components/figma-icons/TopHeaderIcons';
import { useAuth } from '../context/AuthContext';
import { analytics, changedFields, emailProperties, errorProperties } from '../lib/analytics';
import { supabase } from '../lib/supabase';
import { PrivacyChoicesScreen } from './PrivacyChoicesScreen';
import { HelpScreen } from './HelpScreen';
import { JobExportScreen } from './JobExportScreen';
import { OverlaySlideHost } from '../navigation/OverlaySlideHost';
import { PersonalDetailsScreen } from './PersonalDetailsScreen';
import {
  bg,
  createTextStyles,
  fg,
  space,
} from '../theme/nativeTokens';
import type { TextStyles } from '../theme/nativeTokens';
import { useContentColumn } from '../theme/useContentColumn';
import { screenHeaderA11y } from '../lib/accessibility';
import { markFeedbackSent, openFeedbackEmail } from '../lib/feedback';
import { useShellChromeOptional } from '../shell/ShellChromeContext';

/** Page back control — scale up Figma `231:837` (24×24 artboard). */
const PROFILE_BACK_ICON_SIZE = 28;

/**
 * Pull a user-readable message off any thrown value. Supabase throws
 * `PostgrestError` objects (`{ message, code, details, hint }`) that are
 * NOT `instanceof Error`, so a naive `e instanceof Error ? e.message : …`
 * check would always fall back to the generic copy and hide the real
 * cause (e.g. RLS violations, network failures, etc).
 */
function extractErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string' && e.length > 0) return e;
  if (e && typeof e === 'object' && 'message' in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === 'string' && m.length > 0) return m;
  }
  return fallback;
}

/** State machine for the stacked bottom sheets — mirrors the JobDetail material flow. */
type ProfileFlow =
  | 'closed'
  | 'editProfile'
  | 'changePassword'
  | 'deleteAccount';

export type ProfileScreenProps = {
  onBack: () => void;
  /** Closes the Profile overlay and returns to the home tab. */
  onBackToHome?: () => void;
};

export function ProfileScreen({ onBack, onBackToHome = onBack }: ProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const { columnStyle } = useContentColumn();
  const scrollY = useMemo(() => new Animated.Value(0), []);
  const [scrollContentHeight, setScrollContentHeight] = useState(0);
  const { signOut, session, updatePassword, deleteAccount } = useAuth();
  const { enabled: invoicingEnabled, ready: invoicingReady } = useInvoicingFlag(session?.user.id);
  const showInvoicing = invoicingReady && invoicingEnabled;
  const [businessScreen, setBusinessScreen] = useState<null | 'business' | 'settings'>(null);

  const [fontsLoaded] = useFonts(fieldsoloExpoFontAssets);

  const typography = useMemo(
    () =>
      createTextStyles(fieldsoloLoadedFonts),
    [],
  );

  const headerTopPad = Math.max(insets.top - space('Spacing/12'), 0);

  // --- Profile data ---

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [privacyChoicesOpen, setPrivacyChoicesOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [jobExportOpen, setJobExportOpen] = useState(false);
  const [jobExportMounted, setJobExportMounted] = useState(false);
  const [helpMounted, setHelpMounted] = useState(false);
  const [privacyMounted, setPrivacyMounted] = useState(false);
  useEffect(() => {
    if (helpOpen) setHelpMounted(true);
  }, [helpOpen]);
  useEffect(() => {
    if (privacyChoicesOpen) setPrivacyMounted(true);
  }, [privacyChoicesOpen]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const p = await fetchCurrentUserProfile(supabase);
        if (cancelled) return;
        setProfile(p);
        analytics.capture('profile_viewed', {
          profile_complete:
            p != null &&
            [p.firstName, p.lastName].every((v) => (v ?? '').trim().length > 0) &&
            (p.trades ?? []).length > 0,
          trade_count: p?.trades.length ?? 0,
          plan: 'free',
          ...emailProperties(session?.user.email),
        });
      } catch (e) {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.warn('[Profile] failed to fetch profile', e);
        setProfile(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user.id]);

  // --- Sheet flow ---

  const [flow, setFlow] = useState<ProfileFlow>('closed');
  /**
   * Mount-gate so the slide-down animation can play while the parent's flow
   * has already returned to `closed`. Mirrors the JobDetail pattern.
   */
  const [changePasswordMounted, setChangePasswordMounted] = useState(false);
  const [deleteAccountMounted, setDeleteAccountMounted] = useState(false);
  const [saving, setSaving] = useState(false);

  const profileSheetsMounted =
    changePasswordMounted || deleteAccountMounted;
  const setProfileSheetsMounted = useShellChromeOptional()?.setProfileSheetsMounted;
  useEffect(() => {
    setProfileSheetsMounted?.(true);
    return () => setProfileSheetsMounted?.(false);
  }, [setProfileSheetsMounted]);

  const [editDraft, setEditDraft] = useState<UpdateProfileValues>({
    firstName: '',
    lastName: '',
    trades: [],
  });

  const openEditProfile = useCallback(() => {
    // We deliberately don't early-return when `profile` is null. Users who
    // signed up before the profiles trigger existed (or when the local
    // Supabase hasn't run the migration) won't have a row yet — opening
    // Personal Details with empty defaults lets them fill it in, and the save
    // path upserts the row.
    setEditDraft({
      firstName: profile?.firstName ?? '',
      lastName: profile?.lastName ?? '',
      trades: profile?.trades ?? [],
    });
    setFlow('editProfile');
    analytics.capture('profile_edit_opened', {
      first_name_present: (profile?.firstName ?? '').trim().length > 0,
      last_name_present: (profile?.lastName ?? '').trim().length > 0,
      trade_count: profile?.trades.length ?? 0,
    });
  }, [profile]);

  const closeEditProfile = useCallback(() => {
    setFlow('closed');
  }, []);

  const onSaveProfile = useCallback(
    async (values: UpdateProfileValues) => {
      if (saving) return;
      setSaving(true);
      try {
        const before = {
          firstName: profile?.firstName ?? '',
          lastName: profile?.lastName ?? '',
          trades: (profile?.trades ?? []).join('|'),
        };
        const updated = await updateCurrentUserProfile(supabase, {
          firstName: values.firstName,
          lastName: values.lastName,
          trades: values.trades,
        });
        setProfile(updated);
        setFlow('closed');
        if (session?.user.id) {
          analytics.identify(session.user.id, {
            ...emailProperties(session.user.email),
            trade_count: updated.trades.length,
            profile_complete:
              [updated.firstName, updated.lastName].every((v) => (v ?? '').trim().length > 0) &&
              updated.trades.length > 0,
          });
        }
        analytics.capture('profile_saved', {
          changed_fields: changedFields(before, {
            firstName: values.firstName,
            lastName: values.lastName,
            trades: values.trades.join('|'),
          }),
          trade_count: updated.trades.length,
        });
      } catch (e) {
        analytics.capture('profile_save_failed', {
          changed_fields: changedFields(
            {
              firstName: profile?.firstName ?? '',
              lastName: profile?.lastName ?? '',
              trades: (profile?.trades ?? []).join('|'),
            },
            {
              firstName: values.firstName,
              lastName: values.lastName,
              trades: values.trades.join('|'),
            },
          ),
          trade_count: values.trades.length,
          ...errorProperties(e),
        });
        Alert.alert('Save failed', extractErrorMessage(e, 'Could not save personal details.'));
      } finally {
        setSaving(false);
      }
    },
    [profile, saving, session?.user.email, session?.user.id],
  );

  // Change password
  const openChangePassword = useCallback(() => {
    setChangePasswordMounted(true);
    setFlow('changePassword');
  }, []);
  const closeChangePassword = useCallback(() => {
    setFlow('closed');
  }, []);
  const onSubmitNewPassword = useCallback(
    async (newPassword: string) => {
      if (saving) return;
      setSaving(true);
      try {
        analytics.capture('password_change_submitted', { source: 'profile' });
        const { error } = await updatePassword(newPassword);
        if (error) {
          analytics.capture('password_change_failed', {
            source: 'profile',
            ...errorProperties(error),
          });
          Alert.alert('Could not update password', error.message);
          return;
        }
        setFlow('closed');
        analytics.capture('password_change_succeeded', { source: 'profile' });
        Alert.alert('Password updated');
      } finally {
        setSaving(false);
      }
    },
    [saving, updatePassword],
  );

  const openDeleteAccount = useCallback(() => {
    analytics.capture('account_delete_requested', { source: 'profile' });
    setDeleteAccountMounted(true);
    setFlow('deleteAccount');
  }, []);
  const closeDeleteAccount = useCallback(() => {
    setFlow('closed');
  }, []);
  const onDeleteAccountSheetSubmit = useCallback(() => {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account and all associated data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            analytics.capture('account_delete_confirmed', { source: 'profile' });
            const { error } = await deleteAccount();
            if (error) {
              Alert.alert('Could not delete account', error.message);
              return;
            }
            setFlow('closed');
          },
        },
      ],
    );
  }, [deleteAccount]);

  // --- Row construction ---

  const openPrivacyChoices = useCallback(() => {
    setHelpOpen(false);
    setPrivacyChoicesOpen(true);
  }, []);

  const openHelp = useCallback(() => {
    setPrivacyChoicesOpen(false);
    setHelpOpen(true);
  }, []);

  const openJobExport = useCallback(() => {
    setJobExportMounted(true);
    setJobExportOpen(true);
  }, []);

  const sendFeedback = useCallback(() => {
    analytics.capture('feedback_composer_opened', { source: 'profile' });
    void openFeedbackEmail('profile')
      .then(() => {
        if (session?.user.id) void markFeedbackSent(session.user.id).catch(() => {});
      })
      .catch((error) => {
        analytics.capture('feedback_composer_failed', {
          source: 'profile',
          ...errorProperties(error),
        });
        Alert.alert('Email unavailable', `Email us directly at support@fieldsoli.com.`);
      });
  }, [session?.user.id]);

  const accountRows: ProfileRowsCardRow[] = [
    { kind: 'link', label: 'Personal Details', onPress: openEditProfile },
    { kind: 'link', label: 'Change Password', onPress: openChangePassword },
  ];
  const helpRows: ProfileRowsCardRow[] = [
    { kind: 'link', label: 'Help & Support', onPress: openHelp },
    { kind: 'link', label: 'Privacy Choices', onPress: openPrivacyChoices },
    { kind: 'link', label: 'Send Feedback', onPress: sendFeedback, hideChevron: true },
  ];

  const deleteRows: ProfileRowsCardRow[] = useMemo(
    () => [
      {
        kind: 'linkWithIcon',
        label: 'Delete Account',
        icon: <ProfileTrashIcon color={color('Semantic/Status/Error/Text')} />,
        tone: 'danger',
        onPress: openDeleteAccount,
      },
    ],
    [openDeleteAccount],
  );

  const profileSheetLayer = (
    <>
      {changePasswordMounted ? (
        <ChangePasswordBottomSheet
          typography={typography}
          visible={flow === 'changePassword'}
          saving={saving}
          onClose={closeChangePassword}
          onClosed={() => {
            if (flow === 'closed') setChangePasswordMounted(false);
          }}
          onBack={closeChangePassword}
          onSubmit={onSubmitNewPassword}
        />
      ) : null}

      {deleteAccountMounted ? (
        <DeleteAccountBottomSheet
          typography={typography}
          visible={flow === 'deleteAccount'}
          onClose={closeDeleteAccount}
          onClosed={() => {
            if (flow === 'closed') setDeleteAccountMounted(false);
          }}
          onBack={closeDeleteAccount}
          onSubmit={onDeleteAccountSheetSubmit}
        />
      ) : null}
    </>
  );

  if (fontsLoaded && flow === 'editProfile') {
    return (
      <PersonalDetailsScreen
        typography={typography}
        values={editDraft}
        email={session?.user.email ?? null}
        saving={saving}
        onBack={closeEditProfile}
        onSave={onSaveProfile}
      />
    );
  }

  if (fontsLoaded && businessScreen) {
    return (
      <BusinessSettingsScreen
        typography={typography}
        mode={businessScreen}
        onBack={() => setBusinessScreen(null)}
      />
    );
  }

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
            paddingBottom: insets.bottom + space('Spacing/32'),
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
            <View style={platformHeaderRowStyle(styles.topHeaderChromeRow)}>
              <PlatformHeaderAction accessibilityLabel="Back" onPress={onBack}>
                <TopHeaderBackIcon size={PROFILE_BACK_ICON_SIZE} color={fg.primary} />
              </PlatformHeaderAction>
              <PlatformHeaderTitle
                {...screenHeaderA11y()}
                typography={typography.displayH1}
                style={styles.profileTitle}
              >
                ACCOUNT
              </PlatformHeaderTitle>
            </View>
          </View>

          <View style={styles.bodyWrap}>
            <ProfileSectionHeader typography={typography} title="Business" />
            <ProfileRowsCard
              typography={typography}
              rows={[
                ...(showInvoicing ? [
                  { kind: 'link' as const, label: 'Business Details', onPress: () => setBusinessScreen('business') },
                  { kind: 'link' as const, label: 'Estimates & Invoices', onPress: () => setBusinessScreen('settings') },
                ] : []),
                { kind: 'link', label: 'Export Job Summary', onPress: openJobExport },
              ]}
            />
            <ProfileSectionHeader typography={typography} title="Account" />
            <ProfileRowsCard typography={typography} rows={accountRows} />
            <ProfileSectionHeader typography={typography} title="Help & Privacy" />
            <ProfileRowsCard typography={typography} rows={helpRows} />
            <View style={styles.deleteSpacer} />
            <ProfileRowsCard
              typography={typography}
              rows={[{ kind: 'link', label: 'Log Out', hideChevron: true, onPress: () => void signOut() }]}
            />

            <View style={styles.deleteSpacer} />
            <ProfileRowsCard typography={typography} rows={deleteRows} plain framed={false} />
          </View>
        </View>
      </Animated.ScrollView>

      {Platform.OS === 'android' ? (
        profileSheetsMounted ? (
          <Modal
            visible
            transparent
            animationType="none"
            statusBarTranslucent
            navigationBarTranslucent
            onRequestClose={() => {
              if (flow === 'changePassword') closeChangePassword();
              else if (flow === 'deleteAccount') closeDeleteAccount();
              else closeEditProfile();
            }}
          >
            <View style={styles.profileSheetModalHost}>{profileSheetLayer}</View>
          </Modal>
        ) : null
      ) : (
        profileSheetLayer
      )}

      {helpMounted ? (
        <OverlaySlideHost
          visible={helpOpen}
          axis="horizontal"
          onRequestClose={() => setHelpOpen(false)}
          onExited={() => setHelpMounted(false)}
        >
          <HelpScreen onBack={() => setHelpOpen(false)} />
        </OverlaySlideHost>
      ) : null}

      {privacyMounted && session?.user.id ? (
        <OverlaySlideHost
          visible={privacyChoicesOpen}
          axis="horizontal"
          onRequestClose={() => setPrivacyChoicesOpen(false)}
          onExited={() => setPrivacyMounted(false)}
        >
          <PrivacyChoicesScreen
            userId={session.user.id}
            onBack={() => setPrivacyChoicesOpen(false)}
          />
        </OverlaySlideHost>
      ) : null}

      {jobExportMounted && session?.user ? (
        <OverlaySlideHost
          visible={jobExportOpen}
          axis="horizontal"
          onRequestClose={() => setJobExportOpen(false)}
          onExited={() => setJobExportMounted(false)}
        >
          <JobExportScreen onBack={() => setJobExportOpen(false)} onBackToHome={onBackToHome} />
        </OverlaySlideHost>
      ) : null}
    </View>
  );
}

function ProfileSectionHeader({ typography, title }: { typography: TextStyles; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[typography.titleH3, styles.sectionTitle]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', backgroundColor: bg.canvasWarm },
  profileSheetModalHost: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flex: 1, width: '100%', backgroundColor: 'transparent', zIndex: 1 },
  scrollContent: {
    alignItems: 'stretch',
  },
  /** Title + Back — no accent strip (`231:817` variant `Title + Back`). */
  topHeaderRow: {
    width: '100%',
    paddingHorizontal: 0,
    paddingTop: space('Spacing/32'),
    paddingBottom: space('Spacing/16'),
  },
  topHeaderChromeRow: {
    width: '100%',
    gap: space('Spacing/8'),
  },
  profileTitle: {
    color: fg.primary,
  },
  bodyWrap: {
    width: '100%',
    paddingHorizontal: 0,
    paddingTop: space('Spacing/8'),
    gap: space('Spacing/12'),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: space('Spacing/24'),
    paddingBottom: space('Spacing/4'),
    gap: space('Spacing/8'),
  },
  sectionTitle: {
    flex: 1,
    minWidth: 0,
  },
  deleteSpacer: {
    height: space('Spacing/4'),
  },
  pressed: { opacity: 0.75 },
});
