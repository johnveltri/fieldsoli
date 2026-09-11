import { useFonts } from 'expo-font';
import {
  fieldsoloExpoFontAssets,
  fieldsoloLoadedFonts,
} from '@fieldsolo/design-system/expo/loadFieldSoloFonts';
import { usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AppState,
  ActivityIndicator,
  BackHandler,
  Modal,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import type { JobsOpenSectionKind } from '../components/ds';
import { CaptureComposerSheet } from '../components/ds';
import { BlurTargetView } from 'expo-blur';
import { LiveSessionOverlay } from '../components/LiveSessionOverlay';
import { PrimaryActionOverlay } from '../components/shell/PrimaryActionOverlay';
import { QuickActionsFlowProvider } from './QuickActionsFlowContext';
import { ShellChromeProvider } from './ShellChromeContext';
import { ShellOverlayProvider, type ShellOverlayContextValue } from './ShellOverlayContext';
import { useAuth } from '../context/AuthContext';
import {
  useBottomSheetStackWriters,
  useTopmostBottomSheet,
} from '../context/BottomSheetStackContext';
import { useJobsListInvalidation } from '../context/JobsListInvalidationContext';
import { useLiveSession } from '../context/LiveSessionContext';
import type { ListJobsForCurrentUserTab } from '@fieldsolo/api-client';
import {
  createBlankJobForCurrentUser,
  fetchLatestLegalAcceptanceVersions,
  needsLegalReacceptance,
} from '@fieldsolo/api-client';
import { analytics, emailProperties } from '../lib/analytics';
import { resolveAnalyticsConsentForUser } from '../lib/analytics/consentSync';
import { useJobDetailFullscreenEditFlag } from '../lib/featureFlags/useJobDetailFullscreenEditFlag';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  REQUIRED_PRIVACY_VERSION,
  REQUIRED_TERMS_VERSION,
} from '../lib/legal-versions';
import {
  cacheLegalAcceptance,
  hasCachedLegalAcceptance,
} from '../lib/legalAcceptanceStorage';
import { AnalyticsConsentPromptModal } from '../components/AnalyticsConsentPromptModal';
import { LegalReacceptanceModal } from '../components/LegalReacceptanceModal';
import type { EarningsWindow } from '../screens/EarningsScreen';
import { JobDetailScreen } from '../screens/JobDetailScreen';
import { OverlaySlideHost } from '../navigation/OverlaySlideHost';
import { color } from '@fieldsolo/design-system/lib/tokens';
import { bg, createTextStyles } from '../theme/nativeTokens';
import {
  SHELL_TAB_HREF,
  shellMainTabFromPathname,
  type ShellMainTab,
} from './shellTabRoutes';
import {
  createContext,
  useContext,
} from 'react';

export type ShellAppContextValue = {
  mainTab: ShellMainTab;
  jobsListTab: ListJobsForCurrentUserTab;
  setJobsListTab: (tab: ListJobsForCurrentUserTab) => void;
  jobsOpenScrollTarget: JobsOpenSectionKind | null;
  jobsOpenScrollNonce: number;
  clearJobsOpenScrollTarget: () => void;
  earningsWindow: EarningsWindow;
  setEarningsWindow: (window: EarningsWindow) => void;
  navigateToJobsOpenSection: (section: JobsOpenSectionKind) => void;
  openInbox: () => void;
  openJobDetail: (
    jobId: string | null | undefined,
    options?: { initialEditOpen?: boolean; entrySource?: string },
  ) => void;
  createJobAndOpen: (source: 'jobs_fab' | 'home_empty' | 'primary_action') => Promise<string>;
  onOpenProfile: () => void;
  onOpenEarningsFromHome: () => void;
};

const ShellAppContext = createContext<ShellAppContextValue | null>(null);

export function useShellApp(): ShellAppContextValue {
  const ctx = useContext(ShellAppContext);
  if (!ctx) {
    throw new Error('useShellApp must be used within AuthenticatedAppChrome');
  }
  return ctx;
}

type AuthenticatedAppChromeProps = {
  children: ReactNode;
};

export function AuthenticatedAppChrome({ children }: AuthenticatedAppChromeProps) {
  const { session, signupLegalPending } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  /** Android FAB-menu BlurView samples this tree (expo-blur BlurTargetView). */
  const shellBlurTargetRef = useRef<View>(null);
  const mainTab = shellMainTabFromPathname(pathname);

  const [legalGate, setLegalGate] = useState<'loading' | 'blocked' | 'ready'>('loading');
  const [analyticsConsentGate, setAnalyticsConsentGate] = useState<
    'idle' | 'loading' | 'prompt' | 'ready'
  >('idle');
  const [jobDetailOpen, setJobDetailOpen] = useState(false);
  const [jobDetailMounted, setJobDetailMounted] = useState(false);
  const [jobDetailModalAnimation, setJobDetailModalAnimation] = useState<'slide' | 'none'>('slide');
  const [jobDetailExitAnimated, setJobDetailExitAnimated] = useState(true);
  const jobDetailSwipeClosingRef = useRef(false);
  const jobDetailHardwareBackRef = useRef<(() => boolean) | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobDetailEntrySource, setJobDetailEntrySource] = useState<string>('unknown');
  const [jobDetailInitialEditOpen, setJobDetailInitialEditOpen] = useState(false);
  const [jobDetailLoadKey, setJobDetailLoadKey] = useState(0);
  const [jobsListTab, setJobsListTab] = useState<ListJobsForCurrentUserTab>('all');
  const [jobsOpenScrollTarget, setJobsOpenScrollTarget] = useState<JobsOpenSectionKind | null>(
    null,
  );
  const [jobsOpenScrollNonce, setJobsOpenScrollNonce] = useState(0);
  const [earningsWindow, setEarningsWindow] = useState<EarningsWindow>('week');
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileMounted, setProfileMounted] = useState(false);
  useEffect(() => {
    if (profileOpen) setProfileMounted(true);
  }, [profileOpen]);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxMounted, setInboxMounted] = useState(false);
  useEffect(() => {
    if (inboxOpen) setInboxMounted(true);
  }, [inboxOpen]);
  const [inboxLoadKey, setInboxLoadKey] = useState(0);
  const [newJobComposerOpen, setNewJobComposerOpen] = useState(false);
  const [newJobComposerSource, setNewJobComposerSource] = useState<
    'jobs_fab' | 'home_empty' | 'primary_action'
  >('primary_action');

  const liveSession = useLiveSession();
  const { invalidateJobsList } = useJobsListInvalidation();
  const sheetStackWriters = useBottomSheetStackWriters();
  const topmostSheet = useTopmostBottomSheet();
  const {
    enabled: fullscreenEditEnabled,
    ready: fullscreenEditReady,
  } = useJobDetailFullscreenEditFlag(session?.user.id);
  const phase3Enabled = fullscreenEditReady && fullscreenEditEnabled;

  const [fontsLoaded] = useFonts(fieldsoloExpoFontAssets);
  const typography = useMemo(
    () => createTextStyles(fieldsoloLoadedFonts),
    [],
  );

  useEffect(() => {
    if (!session || signupLegalPending) {
      return;
    }

    let cancelled = false;
    void (async () => {
      setLegalGate('loading');
      try {
        const accepted = await fetchLatestLegalAcceptanceVersions(supabase);
        if (cancelled) return;
        const requiresAcceptance = needsLegalReacceptance(accepted, {
          privacyVersion: REQUIRED_PRIVACY_VERSION,
          termsVersion: REQUIRED_TERMS_VERSION,
        });
        if (!requiresAcceptance) {
          try {
            await cacheLegalAcceptance({
              userId: session.user.id,
              privacyVersion: REQUIRED_PRIVACY_VERSION,
              termsVersion: REQUIRED_TERMS_VERSION,
            });
          } catch {
            // best-effort
          }
        }
        if (!cancelled) setLegalGate(requiresAcceptance ? 'blocked' : 'ready');
      } catch {
        const cached = await hasCachedLegalAcceptance({
          userId: session.user.id,
          privacyVersion: REQUIRED_PRIVACY_VERSION,
          termsVersion: REQUIRED_TERMS_VERSION,
        });
        if (!cancelled) setLegalGate(cached ? 'ready' : 'blocked');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.user.id, signupLegalPending]);

  useEffect(() => {
    if (!session?.user.id || signupLegalPending || legalGate !== 'ready') {
      return;
    }

    let cancelled = false;
    void (async () => {
      setAnalyticsConsentGate('loading');
      const result = await resolveAnalyticsConsentForUser(session.user.id);
      if (cancelled) return;
      setAnalyticsConsentGate(result === 'missing' ? 'prompt' : 'ready');
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.user.id, signupLegalPending, legalGate]);

  const navigateToJobsOpenSection = useCallback(
    (section: JobsOpenSectionKind) => {
      setJobsListTab('open');
      setJobsOpenScrollTarget(section);
      setJobsOpenScrollNonce((n) => n + 1);
      router.navigate(SHELL_TAB_HREF.jobs);
    },
    [router],
  );

  const clearJobsOpenScrollTarget = useCallback(() => {
    setJobsOpenScrollTarget(null);
  }, []);

  const openInbox = useCallback(() => {
    analytics.capture('inbox_opened', { source: 'jobs_header' });
    setInboxLoadKey((k) => k + 1);
    setInboxOpen(true);
  }, []);

  const closeJobDetail = useCallback(
    (options?: { animated?: boolean }) => {
      const animated = options?.animated !== false;
      if (jobDetailSwipeClosingRef.current && animated) {
        return;
      }
      if (!animated) {
        jobDetailSwipeClosingRef.current = true;
      }
      analytics.capture('job_detail_closed', { destination: mainTab });
      setJobDetailInitialEditOpen(false);
      invalidateJobsList();
      if (Platform.OS === 'android') {
        setJobDetailExitAnimated(animated);
        setJobDetailOpen(false);
        return;
      }
      if (!animated) {
        setJobDetailModalAnimation('none');
        requestAnimationFrame(() => {
          setJobDetailOpen(false);
        });
        return;
      }
      setJobDetailModalAnimation('slide');
      setJobDetailOpen(false);
    },
    [invalidateJobsList, mainTab],
  );

  const onJobDetailSwipeDismissStart = useCallback(() => {
    jobDetailSwipeClosingRef.current = true;
    if (Platform.OS === 'android') {
      setJobDetailExitAnimated(false);
    } else {
      setJobDetailModalAnimation('none');
    }
  }, []);

  const onJobDetailSwipeDismissCancel = useCallback(() => {
    jobDetailSwipeClosingRef.current = false;
    setJobDetailExitAnimated(true);
    setJobDetailModalAnimation('slide');
  }, []);

  const onJobDetailHardwareBackHandlerChange = useCallback((handler: (() => boolean) | null) => {
    jobDetailHardwareBackRef.current = handler;
  }, []);

  const openJobDetail = useCallback(
    (
      jobId: string | null | undefined,
      options?: { initialEditOpen?: boolean; entrySource?: string },
    ) => {
      if (options?.entrySource) setJobDetailEntrySource(options.entrySource);
      jobDetailSwipeClosingRef.current = false;
      setSelectedJobId(jobId ?? null);
      setJobDetailInitialEditOpen(options?.initialEditOpen ?? false);
      setJobDetailLoadKey((k) => k + 1);
      setJobDetailExitAnimated(true);
      setJobDetailModalAnimation('slide');
      setJobDetailMounted(true);
      setJobDetailOpen(true);
    },
    [],
  );

  const createJobAndOpen = useCallback(
    async (source: 'jobs_fab' | 'home_empty' | 'primary_action') => {
      if (phase3Enabled) {
        analytics.capture('job_create_started', { source, composer: true });
        setNewJobComposerSource(source);
        setNewJobComposerOpen(true);
        return '';
      }
      if (!isSupabaseConfigured()) throw new Error('Supabase is not configured.');
      analytics.capture('job_create_started', { source });
      try {
        const jobId = await createBlankJobForCurrentUser(supabase);
        analytics.capture('job_created', { source, job_id: jobId, placeholder: true });
        invalidateJobsList();
        openJobDetail(jobId, { initialEditOpen: true, entrySource: source });
        return jobId;
      } catch (error) {
        analytics.capture('job_create_failed', { source });
        throw error;
      }
    },
    [invalidateJobsList, openJobDetail, phase3Enabled],
  );

  const onNewJobCreated = useCallback(
    (jobId: string, options?: { initialEditOpen?: boolean }) => {
      setNewJobComposerOpen(false);
      analytics.capture('job_created', {
        source: newJobComposerSource,
        job_id: jobId,
        placeholder: false,
        opened_in_edit: options?.initialEditOpen === true,
      });
      invalidateJobsList();
      openJobDetail(jobId, {
        initialEditOpen: options?.initialEditOpen === true,
        entrySource: newJobComposerSource,
      });
    },
    [invalidateJobsList, newJobComposerSource, openJobDetail],
  );

  useEffect(() => {
    if (jobDetailOpen) setJobDetailMounted(true);
  }, [jobDetailOpen]);

  useEffect(() => {
    if (Platform.OS !== 'android' || !jobDetailOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (topmostSheet) {
        sheetStackWriters?.requestCloseTopmost();
        return true;
      }
      if (jobDetailSwipeClosingRef.current) return true;
      if (jobDetailHardwareBackRef.current?.()) return true;
      closeJobDetail();
      return true;
    });
    return () => sub.remove();
  }, [closeJobDetail, jobDetailOpen, sheetStackWriters, topmostSheet]);

  useEffect(() => {
    if (mainTab !== 'home') setProfileOpen(false);
  }, [mainTab]);

  const skipNextTabAnalyticsRef = useRef(false);
  const prevMainTabRef = useRef<ShellMainTab | null>(null);

  useEffect(() => {
    if (legalGate !== 'ready' || analyticsConsentGate !== 'ready') return;
    if (skipNextTabAnalyticsRef.current) {
      skipNextTabAnalyticsRef.current = false;
      prevMainTabRef.current = mainTab;
      return;
    }
    const prev = prevMainTabRef.current;
    if (prev !== null && prev !== mainTab) {
      if (inboxOpen) {
        analytics.capture('inbox_closed', { destination: mainTab });
        setInboxOpen(false);
      }
      analytics.capture('shell_tab_selected', {
        from_tab: prev,
        to_tab: mainTab,
        has_live_session: liveSession.hasLiveSession,
      });
    }
    prevMainTabRef.current = mainTab;
  }, [analyticsConsentGate, inboxOpen, legalGate, liveSession.hasLiveSession, mainTab]);

  const onLiveSessionEnded = useCallback(
    (jobId: string) => {
      openJobDetail(jobId, { entrySource: 'live_session_overlay' });
    },
    [openJobDetail],
  );

  const currentScreen = useMemo(() => {
    if (!session) return 'sign_in' as const;
    if (jobDetailOpen) return 'job_detail' as const;
    if (inboxOpen) return 'inbox' as const;
    if (mainTab === 'home' && profileOpen) return 'profile' as const;
    return mainTab;
  }, [inboxOpen, jobDetailOpen, mainTab, profileOpen, session]);

  useEffect(() => {
    if (
      !session
      || analyticsConsentGate !== 'ready'
      || !analytics.isConsentGranted()
    ) {
      return;
    }
    analytics.identify(session.user.id, {
      ...emailProperties(session.user.email),
      auth_provider: 'supabase',
    });
  }, [analyticsConsentGate, session?.user.id, session?.user.email, session]);

  useEffect(() => {
    if (analyticsConsentGate !== 'ready' || !analytics.isConsentGranted()) {
      return;
    }
    analytics.screen(currentScreen, {
      auth_state: session ? 'authenticated' : 'anonymous',
      main_tab: mainTab,
      job_detail_open: jobDetailOpen,
      inbox_open: inboxOpen,
      profile_open: profileOpen,
      has_live_session: liveSession.hasLiveSession,
    });
  }, [
    analyticsConsentGate,
    currentScreen,
    inboxOpen,
    jobDetailOpen,
    liveSession.hasLiveSession,
    mainTab,
    profileOpen,
    session,
  ]);

  const openedTrackedRef = useRef(false);
  useEffect(() => {
    if (
      openedTrackedRef.current
      || analyticsConsentGate !== 'ready'
      || !analytics.isConsentGranted()
    ) {
      return;
    }
    openedTrackedRef.current = true;
    analytics.capture('app_opened', {
      auth_state: session ? 'authenticated' : 'anonymous',
      has_live_session: liveSession.hasLiveSession,
    });
  }, [analyticsConsentGate, liveSession.hasLiveSession, session]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        analytics.capture('app_became_active', {
          auth_state: session ? 'authenticated' : 'anonymous',
          has_live_session: liveSession.hasLiveSession,
        });
      }
    });
    return () => sub.remove();
  }, [liveSession.hasLiveSession, session]);

  const closeInbox = useCallback(() => {
    setInboxOpen(false);
  }, []);

  const closeProfile = useCallback(() => {
    setProfileOpen(false);
  }, []);

  const onQuickCaptureSaved = useCallback(
    ({ mode, jobId }: { mode: 'inbox' | 'job'; jobId: string | null }) => {
      if (mode === 'job' && jobId && jobDetailOpen && selectedJobId === jobId) {
        setJobDetailLoadKey((k) => k + 1);
      }
    },
    [jobDetailOpen, selectedJobId],
  );

  const dismissOverlaysForTabPress = useCallback(
    (destinationTab: ShellMainTab) => {
      if (inboxOpen) {
        analytics.capture('inbox_closed', { destination: destinationTab });
        setInboxOpen(false);
      }
      if (profileOpen) {
        setProfileOpen(false);
      }
    },
    [inboxOpen, profileOpen],
  );

  const shellOverlayValue = useMemo(
    (): ShellOverlayContextValue => ({
      mainTab,
      inboxOpen,
      inboxMounted,
      inboxLoadKey,
      closeInbox,
      onInboxExited: () => setInboxMounted(false),
      profileOpen,
      profileMounted,
      closeProfile,
      onProfileExited: () => setProfileMounted(false),
      dismissOverlaysForTabPress,
    }),
    [
      closeInbox,
      closeProfile,
      dismissOverlaysForTabPress,
      inboxLoadKey,
      inboxMounted,
      inboxOpen,
      mainTab,
      profileMounted,
      profileOpen,
    ],
  );

  const shellContextValue = useMemo(
    (): ShellAppContextValue => ({
      mainTab,
      jobsListTab,
      setJobsListTab,
      jobsOpenScrollTarget,
      jobsOpenScrollNonce,
      clearJobsOpenScrollTarget,
      earningsWindow,
      setEarningsWindow,
      navigateToJobsOpenSection,
      openInbox,
      openJobDetail,
      createJobAndOpen,
      onOpenProfile: () => {
        analytics.capture('profile_opened_from_home', {});
        setProfileOpen(true);
      },
      onOpenEarningsFromHome: () => {
        analytics.capture('home_earnings_pressed', {});
        analytics.capture('earnings_opened', {
          source: 'home_weekly_snapshot',
          window: 'week',
        });
        setEarningsWindow('week');
        router.navigate(SHELL_TAB_HREF.earnings);
      },
    }),
    [
      clearJobsOpenScrollTarget,
      createJobAndOpen,
      earningsWindow,
      jobsListTab,
      jobsOpenScrollNonce,
      jobsOpenScrollTarget,
      mainTab,
      navigateToJobsOpenSection,
      openInbox,
      openJobDetail,
      router,
    ],
  );

  if (!session) {
    return null;
  }

  if (legalGate === 'loading' || analyticsConsentGate === 'loading') {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {legalGate === 'blocked' ? (
        <LegalReacceptanceModal
          visible
          onAccepted={() => {
            void cacheLegalAcceptance({
              userId: session.user.id,
              privacyVersion: REQUIRED_PRIVACY_VERSION,
              termsVersion: REQUIRED_TERMS_VERSION,
            }).catch(() => {});
            setLegalGate('ready');
          }}
        />
      ) : null}
      {legalGate === 'ready' && analyticsConsentGate === 'prompt' ? (
        <AnalyticsConsentPromptModal
          visible
          userId={session.user.id}
          onResolved={() => setAnalyticsConsentGate('ready')}
        />
      ) : null}
      {legalGate === 'ready' && analyticsConsentGate === 'ready' ? (
        <QuickActionsFlowProvider
          onCreateJob={() => createJobAndOpen('primary_action')}
          onQuickCaptureSaved={onQuickCaptureSaved}
          phase3Enabled={phase3Enabled}
        >
          <ShellAppContext.Provider value={shellContextValue}>
            <ShellOverlayProvider value={shellOverlayValue}>
            <ShellChromeProvider>
            <View style={styles.shellColumn}>
              {/*
                Android needs BlurTargetView for dimezis Modal blur. Wrap with an
                inner flex View — native BlurTargetView alone can collapse Slot height.
                Profile/Inbox overlays mount inside each focused tab scene
                (ShellSceneOverlays) so they cannot cover the native tab bar.
              */}
              {Platform.OS === 'android' ? (
                <BlurTargetView ref={shellBlurTargetRef} style={styles.shellMain}>
                  <View style={styles.shellMainInner} collapsable={false}>
                    {children}
                  </View>
                </BlurTargetView>
              ) : (
                <View style={styles.shellMain}>{children}</View>
              )}
              <PrimaryActionOverlay
                blurTargetRef={Platform.OS === 'android' ? shellBlurTargetRef : undefined}
              />
            </View>

            <LiveSessionOverlay
              onSessionEnded={({ jobId }) => onLiveSessionEnded(jobId)}
              phase3Capture={phase3Enabled}
            />

            {fontsLoaded && phase3Enabled ? (
              <CaptureComposerSheet
                typography={typography}
                visible={newJobComposerOpen}
                kind="job"
                onClose={() => setNewJobComposerOpen(false)}
                onJobCreated={onNewJobCreated}
              />
            ) : null}

            {Platform.OS === 'android' && jobDetailMounted ? (
              <View style={styles.jobDetailOverlayHost} testID="job-detail-modal">
                <OverlaySlideHost
                  visible={jobDetailOpen}
                  axis="vertical"
                  enableSwipeDismiss={false}
                  exitAnimated={jobDetailExitAnimated}
                  onRequestClose={() => closeJobDetail()}
                  onExited={() => {
                    setJobDetailMounted(false);
                    setJobDetailExitAnimated(true);
                  }}
                >
                  <View style={styles.jobDetailModalRoot}>
                    <JobDetailScreen
                      loadKey={jobDetailLoadKey}
                      jobId={selectedJobId}
                      entrySource={jobDetailEntrySource}
                      initialEditOpen={jobDetailInitialEditOpen}
                      sessionUserId={session.user.id}
                      sessionEmail={session.user.email ?? null}
                      onRequestClose={closeJobDetail}
                      onSwipeDismissStart={onJobDetailSwipeDismissStart}
                      onSwipeDismissCancel={onJobDetailSwipeDismissCancel}
                      onAndroidHardwareBackHandlerChange={onJobDetailHardwareBackHandlerChange}
                    />
                  </View>
                </OverlaySlideHost>
              </View>
            ) : null}

            {Platform.OS !== 'android' && jobDetailMounted ? (
              <Modal
                testID="job-detail-modal"
                visible={jobDetailOpen}
                animationType={jobDetailModalAnimation}
                presentationStyle="fullScreen"
                onRequestClose={() => closeJobDetail()}
                onDismiss={() => {
                  setJobDetailMounted(false);
                  setJobDetailModalAnimation('slide');
                  jobDetailSwipeClosingRef.current = false;
                }}
              >
                <GestureHandlerRootView style={styles.jobDetailModalRoot}>
                  <JobDetailScreen
                    loadKey={jobDetailLoadKey}
                    jobId={selectedJobId}
                    entrySource={jobDetailEntrySource}
                    initialEditOpen={jobDetailInitialEditOpen}
                    sessionUserId={session.user.id}
                    sessionEmail={session.user.email ?? null}
                    onRequestClose={closeJobDetail}
                    onSwipeDismissStart={onJobDetailSwipeDismissStart}
                    onSwipeDismissCancel={onJobDetailSwipeDismissCancel}
                    onAndroidHardwareBackHandlerChange={onJobDetailHardwareBackHandlerChange}
                  />
                </GestureHandlerRootView>
              </Modal>
            ) : null}
            </ShellChromeProvider>
            </ShellOverlayProvider>
          </ShellAppContext.Provider>
        </QuickActionsFlowProvider>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color('Foundation/Background/Default'),
  },
  shellColumn: {
    flex: 1,
    width: '100%',
    backgroundColor: bg.canvasWarm,
  },
  shellMain: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    backgroundColor: bg.canvasWarm,
  },
  shellMainInner: {
    flex: 1,
    width: '100%',
    minHeight: 0,
  },
  jobDetailOverlayHost: {
    ...StyleSheet.absoluteFill,
    zIndex: 1200,
    elevation: 1200,
  },
  jobDetailModalRoot: {
    flex: 1,
    backgroundColor: bg.canvasWarm,
    overflow: 'visible',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
