/**
 * Job detail screen — single job: header, earnings, CTAs, metrics, sessions, materials, notes.
 *
 * **Layout:** Full-screen `CanvasTiledBackground` → `ScrollView` (transparent so the lined canvas shows in gutters)
 * → optional fixed `BottomNavJobs` pinned to the bottom (outside the scroll so it stays visible).
 *
 * **Width:** Content uses the shared responsive content column (16/20 pt gutters, 640 pt large-screen cap).
 *
 * **Typography:** `createTextStyles` maps `typography.json` roles to loaded Expo fonts (see `nativeTokens.ts`).
 * **Money:** `formatUsdCombined` in `lib/formatUsd.ts` + `JobDetailSummaryCard` use DS color tokens for tones.
 */
import { useFonts } from 'expo-font';
import {
  fieldsoloExpoFontAssets,
  fieldsoloLoadedFonts,
} from '@fieldsolo/design-system/expo/loadFieldSoloFonts';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Alert,
  Easing,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  PanGestureHandler,
  ScrollView as GHScrollView,
  State,
  type PanGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler';

import {
  ChooseSessionBottomSheet,
  ConfirmMinimumInfoBottomSheet,
  DropdownBottomSheet,
  EditJobBottomSheet,
  EditMaterialBottomSheet,
  EditNoteBottomSheet,
  EditOtherCostBottomSheet,
  EditSessionBottomSheet,
  JobDetailCtaRow,
  JobDetailJobHeader,
  JobDetailMetricTertiary,
  JobDetailSummaryCard,
  LiveSessionStartTile,
  NewSessionBottomSheet,
  nextStatusAfterPrimaryAction,
  SessionCard,
  ViewMaterialsBuckets,
  ViewNotesBuckets,
  ViewOtherCostsBuckets,
  ViewSessionsBuckets,
  type ChooseSessionBottomSheetSession,
  type DropdownBottomSheetOption,
  type EditMaterialBottomSheetValues,
  type EditNoteBottomSheetValues,
  type EditOtherCostBottomSheetValues,
  type EditSessionBottomSheetValues,
} from '../components/ds';
import { CanvasTiledBackground } from '../components/CanvasTiledBackground';
import { PlatformHeaderAction } from '../components/platform/PlatformHeaderAction';
import { usePlatformGlass } from '../components/platform/usePlatformGlass';
import {
  JobDetailIconCtaMore,
  JobDetailIconSectionAdd,
  JobDetailIconTopClose,
  JobDetailIconTopEdit,
} from '../components/figma-icons/JobDetailScreenIcons';
import { EditIconPerson } from '../components/ds/edit-mode/EditModeIcons';
import { buildCustomerContactActions } from '@fieldsolo/api-client';
import { showCustomerContactMenu } from '../lib/customerContactMenu';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, colorWithAlpha, radius } from '@fieldsolo/design-system/lib/tokens';
import {
  applyJobDetailEdit,
  createManualSession,
  createMaterial,
  createNote,
  countCompletedJobsForCurrentUser,
  deleteMaterial,
  deleteNote,
  deleteSession,
  deleteJobById,
  endLiveSession,
  fetchFirstJobIdForCurrentUser,
  fetchJobDetail,
  updateJobById,
  createOtherCost,
  deleteOtherCost,
  updateJobCostsReviewed,
  updateJobOtherCostsReviewed,
  updateJobStatusById,
  updateOtherCost,
  updateMaterial,
  updateNote,
  updateSessionTimes,
} from '@fieldsolo/api-client';
import type {
  JobDetailMaterialLine,
  JobDetailNote,
  JobDetailSession,
  JobDetailViewModel,
  JobDetailWorkStatus,
} from '@fieldsolo/shared-types';

import { useJobsListInvalidation } from '../context/JobsListInvalidationContext';
import { isStaleJwtError, useLiveSession } from '../context/LiveSessionContext';
import {
  buildJobStatusSheetOptions,
  isJobDetailWorkStatus,
} from '../lib/jobStatusSheet';
import {
  analytics,
  changedFields,
  durationMinutesBetween,
  errorProperties,
  moneyBucket,
  quantityBucket,
  textLengthBucket,
} from '../lib/analytics';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  claimFeedbackPromptMilestone,
  markFeedbackSent,
  openFeedbackEmail,
} from '../lib/feedback';
import {
  bg,
  border,
  cardShadowRn,
  createTextStyles,
  fg,
  space,
} from '../theme/nativeTokens';
import type { TextStyles } from '../theme/nativeTokens';
import { useContentColumn } from '../theme/useContentColumn';
import type { EditJobBottomSheetValues } from '../components/ds/EditJobBottomSheet';
import { useJobDetailFullscreenEditFlag } from '../lib/featureFlags';
import { JobDetailEditMode } from './jobDetailEdit/JobDetailEditMode';
import type {
  JobDetailEditFocusTarget,
  JobEditOpenedSource,
} from './jobDetailEdit/jobDetailFocusTarget';
import { useJobEditDraft } from './jobDetailEdit/useJobEditDraft';

type MarkCompleteWizardCloseOptions = {
  /** Successful wizard step — keep advancing instead of cancelling mark-complete. */
  keepWizardActive?: boolean;
};
import {
  financialCompletenessGaps,
  incompletePillsForJobDetail,
  isCompletedOrPaidWorkStatus,
  isJobFinanciallyComplete,
  shouldDemoteCompletedOrPaidForIncompleteFinancials,
  type FinancialCompletenessGap,
} from '../lib/jobFinancialCompleteness';
import {
  OTHER_COST_TYPE_OPTIONS,
  type JobOtherCostType,
} from '../lib/otherCostTypes';

/** Vertical gap between stacked blocks in the main column (`Spacing/20` = 16 + 4). */
const SLOT_GAP = space('Spacing/24');

function supabaseApiHostLabel(): string {
  const u = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  try {
    return new URL(u).host || u;
  } catch {
    return u.length > 48 ? `${u.slice(0, 48)}…` : u;
  }
}

function jobFinancialContext(job: JobDetailViewModel) {
  return { job };
}

function jobDetailIsFinanciallyComplete(job: JobDetailViewModel): boolean {
  return isJobFinanciallyComplete(jobFinancialContext(job));
}

export type JobDetailCloseOptions = {
  /**
   * When false, the parent Modal/host should unmount without its slide animation
   * (content already left the screen via an interactive swipe).
   * @default true
   */
  animated?: boolean;
};

export type JobDetailScreenProps = {
  /** Top-left close (X): return to the tab shell (HOME / JOBS / EARNINGS). */
  onRequestClose?: (options?: JobDetailCloseOptions) => void;
  /**
   * Called as soon as a swipe dismiss commits (before the off-screen timing
   * finishes) so the parent can arm exitAnimation=none / ignore late animated closes.
   */
  onSwipeDismissStart?: () => void;
  /** Called if the swipe exit animation is interrupted before close. */
  onSwipeDismissCancel?: () => void;
  /** Signed-in user (refetch job list when this changes). */
  sessionUserId?: string | null;
  sessionEmail?: string | null;
  /** Optional explicit job id to load (used by Jobs screen card taps / new job). */
  jobId?: string | null;
  /** Analytics source for the navigation that opened this detail view. */
  entrySource?: string;
  /** Parent increments when navigating to this screen (e.g. "View job") to force reload. */
  loadKey?: number;
  /** When true, open the edit job sheet once after the job finishes loading (e.g. new job FAB). */
  initialEditOpen?: boolean;
  /** Android hardware Back while Edit is open (discard rules apply). */
  onAndroidHardwareBackHandlerChange?: (handler: (() => boolean) | null) => void;
};

export function JobDetailScreen({
  onRequestClose,
  onSwipeDismissStart,
  onSwipeDismissCancel,
  sessionUserId,
  sessionEmail,
  jobId,
  entrySource = 'unknown',
  loadKey = 0,
  initialEditOpen = false,
  onAndroidHardwareBackHandlerChange,
}: JobDetailScreenProps = {}) {
  /** Top safe area (status bar); bottom inset used for scroll padding + nav. */
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { columnStyle } = useContentColumn();
  const scrollY = useMemo(() => new Animated.Value(0), []);
  /** Tracks scroll offset for swipe-down-to-close when presented as a modal. */
  const scrollOffsetY = useRef(0);
  const [scrollAtTop, setScrollAtTop] = useState(true);
  const jobDetailPanRef = useRef<PanGestureHandler>(null);
  const dismissY = useRef(new Animated.Value(0)).current;
  const dismissOpacity = useRef(new Animated.Value(1)).current;
  const closingFromSwipeRef = useRef(false);

  const onJobDetailPanGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: dismissY } }],
    {
      useNativeDriver: true,
      listener: (event: { nativeEvent: { translationY: number } }) => {
        const ty = event.nativeEvent.translationY;
        if (ty < 0 || scrollOffsetY.current > 4) {
          dismissY.setValue(0);
        }
      },
    },
  );

  /** Shared swipe exit: animate off-screen, then hide Modal without a second slide. */
  const finishSwipeDismiss = useCallback(
    (fromY: number) => {
      if (!onRequestClose || closingFromSwipeRef.current) return;
      const start = Math.max(0, fromY);
      dismissY.setValue(start);
      const remaining = Math.max(1, windowHeight - start);
      const duration = Math.max(140, Math.min(280, remaining * 0.32));
      closingFromSwipeRef.current = true;
      // Arm parent immediately so X / back cannot start a second animated exit
      // while this timing is still running.
      onSwipeDismissStart?.();
      Animated.parallel([
        Animated.timing(dismissY, {
          toValue: windowHeight,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(dismissOpacity, {
          toValue: 0,
          duration: Math.min(200, duration),
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) {
          closingFromSwipeRef.current = false;
          onSwipeDismissCancel?.();
          return;
        }
        // Content is already off-screen — skip RN Modal/host slide replay.
        onRequestClose({ animated: false });
      });
    },
    [
      dismissOpacity,
      dismissY,
      onRequestClose,
      onSwipeDismissCancel,
      onSwipeDismissStart,
      windowHeight,
    ],
  );

  const onJobDetailPanStateChange = useCallback(
    (event: PanGestureHandlerStateChangeEvent) => {
      if (!onRequestClose || closingFromSwipeRef.current) return;
      const { state, oldState, translationY, velocityY } = event.nativeEvent;
      if (oldState === State.ACTIVE) {
        if (scrollOffsetY.current > 4) {
          Animated.spring(dismissY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
          return;
        }
        if (translationY > 56 || velocityY > 900) {
          finishSwipeDismiss(translationY);
          return;
        }
        Animated.spring(dismissY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 0,
        }).start();
      }
      if (state === State.BEGAN && !closingFromSwipeRef.current) {
        dismissY.setValue(0);
      }
    },
    [dismissY, finishSwipeDismiss, onRequestClose],
  );

  const onJobDetailScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      const y = event.nativeEvent.contentOffset.y;
      scrollOffsetY.current = y;
      scrollY.setValue(y);
      const atTop = y <= 4;
      setScrollAtTop((prev) => (prev === atTop ? prev : atTop));
    },
    [scrollY],
  );

  const onScrollEndDragDismiss = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number }; velocity?: { y: number } } }) => {
      // Android: pan handler owns dismiss. Overscroll + sheet exit reads as a double slide.
      if (Platform.OS === 'android') return;
      if (!onRequestClose || closingFromSwipeRef.current || scrollOffsetY.current > 4) return;
      const { y } = event.nativeEvent.contentOffset;
      const vy = event.nativeEvent.velocity?.y ?? 0;
      if (y < -28 || (y <= 0 && vy < -0.35)) {
        finishSwipeDismiss(Math.max(0, -y));
      }
    },
    [finishSwipeDismiss, onRequestClose],
  );
  /**
   * Height of the scrollable content, reported via the scrollview's
   * `onContentSizeChange`. Passed to `CanvasTiledBackground` so the ruled
   * layer covers the entire scroll height — otherwise the lines + cream
   * fill run out below one viewport and expose the root bg.
   */
  const [scrollContentHeight, setScrollContentHeight] = useState(0);

  /** Load DS fonts before rendering text (avoids flash of system font / layout jump). */
  const [fontsLoaded] = useFonts(fieldsoloExpoFontAssets);

  /** Memoized text style bundle (serif headings + mono body) tied to loaded font postscript names. */
  const typography = useMemo(
    () =>
      createTextStyles(fieldsoloLoadedFonts),
    [],
  );

  const supabaseReady = isSupabaseConfigured();
  const { invalidateJobsList } = useJobsListInvalidation();
  const [job, setJob] = useState<JobDetailViewModel | null>(null);
  /** Latest job detail — updated synchronously before `setJob` so wizard advance can seed Edit from a fresh snapshot. */
  const jobRef = useRef<JobDetailViewModel | null>(null);
  const [jobLoading, setJobLoading] = useState(supabaseReady);
  const [jobSaving, setJobSaving] = useState(false);
  const [editSheetMounted, setEditSheetMounted] = useState(false);
  const [editSheetVisible, setEditSheetVisible] = useState(false);
  type DetailMode = 'view' | 'edit';
  const [detailMode, setDetailMode] = useState<DetailMode>('view');
  const [editSaving, setEditSaving] = useState(false);
  // State updates are asynchronous; this ref closes the small double-tap /
  // navigation window before the Saving render reaches the edit controls.
  const editSavingRef = useRef(false);
  const editApi = useJobEditDraft(job);
  useEffect(() => {
    jobRef.current = job;
  }, [job]);
  const { enabled: fullscreenEditEnabled, ready: fullscreenEditReady } =
    useJobDetailFullscreenEditFlag(sessionUserId);
  const useFullscreenEdit = fullscreenEditReady && fullscreenEditEnabled;
  const { reduceMotion } = usePlatformGlass();
  const [editFocusTarget, setEditFocusTarget] = useState<JobDetailEditFocusTarget | null>(null);
  const modeProgress = useRef(new Animated.Value(0)).current;
  const [statusSheetMounted, setStatusSheetMounted] = useState(false);
  const [statusSheetVisible, setStatusSheetVisible] = useState(false);
  const [statusActionPending, setStatusActionPending] = useState(false);

  /** State machine for the session add/edit flow. */
  type SessionFlow = 'closed' | 'chooser' | 'addForm' | 'editForm';
  const [sessionFlow, setSessionFlow] = useState<SessionFlow>('closed');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  /** Which session card (by id) is expanded; only one at a time. */
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  /** Mount flag lets BottomSheetShell play its exit animation before unmounting. */
  const [sessionSheetMounted, setSessionSheetMounted] = useState(false);
  const [sessionSaving, setSessionSaving] = useState(false);

  /**
   * State machine for the note add/edit flow. Mirrors the session flow:
   * - `addNote` / `editNote` — the EditNoteBottomSheet.
   * - `attachSession` / `editSession` — the ChooseSessionBottomSheet,
   *   reachable from the note sheet via the `+SESSION` / pencil pill.
   */
  type NoteFlow = 'closed' | 'addNote' | 'editNote' | 'attachSession' | 'editSession';
  const [noteFlow, setNoteFlow] = useState<NoteFlow>('closed');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [draftBody, setDraftBody] = useState('');
  const [draftSessionId, setDraftSessionId] = useState<string | null>(null);
  const [noteSheetMounted, setNoteSheetMounted] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);

  /**
   * State machine for the material add/edit flow. Mirrors the note flow with
   * an extra `chooseUnit` state for the unit-of-measure dropdown:
   * - `addMaterial` / `editMaterial` — the EditMaterialBottomSheet.
   * - `attachSession` / `editSession` — the ChooseSessionBottomSheet.
   * - `chooseUnit` — the DropdownBottomSheet.
   */
  type MaterialFlow =
    | 'closed'
    | 'addMaterial'
    | 'editMaterial'
    | 'attachSession'
    | 'editSession'
    | 'chooseUnit';
  const [materialFlow, setMaterialFlow] = useState<MaterialFlow>('closed');
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [matDraftDescription, setMatDraftDescription] = useState('');
  const [matDraftUnitCostCents, setMatDraftUnitCostCents] = useState(0);
  const [matDraftQuantity, setMatDraftQuantity] = useState(1);
  const [matDraftUnit, setMatDraftUnit] = useState('ea');
  const [matDraftSessionId, setMatDraftSessionId] = useState<string | null>(null);
  const [materialSheetMounted, setMaterialSheetMounted] = useState(false);
  const [materialSaving, setMaterialSaving] = useState(false);
  const [noMaterialsSaving, setNoMaterialsSaving] = useState(false);
  const [noOtherCostsSaving, setNoOtherCostsSaving] = useState(false);
  const [otherCostSaving, setOtherCostSaving] = useState(false);


  type OtherCostFlow =
    | 'closed'
    | 'addOtherCost'
    | 'editOtherCost'
    | 'attachSession'
    | 'editSession'
    | 'chooseCostType';
  const [otherCostFlow, setOtherCostFlow] = useState<OtherCostFlow>('closed');
  const [editingOtherCostId, setEditingOtherCostId] = useState<string | null>(null);
  const [ocDraftCostType, setOcDraftCostType] = useState<JobOtherCostType>('helper_labor');
  const [ocDraftCostCents, setOcDraftCostCents] = useState(0);
  const [ocDraftDescription, setOcDraftDescription] = useState('');
  const [ocDraftSessionId, setOcDraftSessionId] = useState<string | null>(null);
  const [otherCostSheetMounted, setOtherCostSheetMounted] = useState(false);

  const completeWizardActiveRef = useRef(false);
  const pendingStatusAfterWizardRef = useRef<'completed' | 'paid'>('completed');
  const [markCompleteWizardActive, setMarkCompleteWizardActive] = useState(false);
  const advanceMarkCompleteWizardRef = useRef<(refreshedJob: JobDetailViewModel) => void>(() => {});
  const [minimumInfoGateMounted, setMinimumInfoGateMounted] = useState(false);
  const [minimumInfoGateVisible, setMinimumInfoGateVisible] = useState(false);
  const [editJobRevenueError, setEditJobRevenueError] = useState<string | undefined>();
  const [sessionWizardBanner, setSessionWizardBanner] = useState<string | undefined>();
  const [materialWizardMode, setMaterialWizardMode] = useState(false);
  const [materialWizardError, setMaterialWizardError] = useState<string | undefined>();
  const [otherCostWizardMode, setOtherCostWizardMode] = useState(false);
  const [otherCostWizardError, setOtherCostWizardError] = useState<string | undefined>();

  const setCompleteWizardActive = useCallback((active: boolean) => {
    completeWizardActiveRef.current = active;
    setMarkCompleteWizardActive(active);
  }, []);

  const cancelMarkCompleteWizard = useCallback(() => {
    setCompleteWizardActive(false);
    pendingStatusAfterWizardRef.current = 'completed';
    setMaterialWizardMode(false);
    setMaterialWizardError(undefined);
    setOtherCostWizardMode(false);
    setOtherCostWizardError(undefined);
    setEditJobRevenueError(undefined);
    setSessionWizardBanner(undefined);
  }, [setCompleteWizardActive]);

  const financialCompletenessCtx = useMemo(
    () => (job ? jobFinancialContext(job) : null),
    [job],
  );

  const costTypeOptions = useMemo<DropdownBottomSheetOption[]>(
    () =>
      OTHER_COST_TYPE_OPTIONS.map((o) => ({
        id: o.id,
        label: o.label,
        value: o.value,
      })),
    [],
  );

  /** Set when Supabase is configured but fetch returns null or throws (no silent mock). */
  const [jobLoadError, setJobLoadError] = useState<string | null>(null);
  /** Ensures we only auto-open the edit sheet once per navigation (see `initialEditOpen`). */
  const autoEditOpenedRef = useRef(false);

  useEffect(() => {
    autoEditOpenedRef.current = false;
    setDetailMode('view');
    setEditFocusTarget(null);
    modeProgress.setValue(0);
  }, [loadKey, jobId, modeProgress]);

  useEffect(() => {
    // Android: opacity crossfade + card elevation paints solid gray “rectangle”
    // shells over Other Costs / Notes while opening edit from Materials. Snap the
    // transition instead of compositing two elevated trees.
    const duration =
      reduceMotion || Platform.OS === 'android' ? 0 : 500;
    Animated.timing(modeProgress, {
      toValue: detailMode === 'edit' ? 1 : 0,
      duration,
      easing: Easing.out(Easing.cubic),
      // JS driver: native-driver opacity on the body wrappers prevented Yoga
      // from laying out ScrollView children (blank body on device).
      useNativeDriver: false,
    }).start();
  }, [detailMode, modeProgress, reduceMotion]);

  useEffect(() => {
    if (
      !initialEditOpen
      || jobLoading
      || !job
      || autoEditOpenedRef.current
      || !fullscreenEditReady
    ) {
      return;
    }
    autoEditOpenedRef.current = true;
    if (useFullscreenEdit) {
      editApi.resetFromJob(job);
      setDetailMode('edit');
      return;
    }
    setEditSheetMounted(true);
    setEditSheetVisible(true);
  }, [editApi, initialEditOpen, jobLoading, job, fullscreenEditReady, useFullscreenEdit]);

  useEffect(() => {
    if (!supabaseReady) {
      setJobLoading(false);
      setJob(null);
      setJobLoadError(
        'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
      );
      return;
    }
    let cancelled = false;

    const load = async () => {
      setJobLoading(true);
      setJobLoadError(null);
      try {
        const resolvedJobId = jobId ?? (await fetchFirstJobIdForCurrentUser(supabase));
        if (cancelled) return;
        if (!resolvedJobId) {
          setJob(null);
          setJobLoadError('No jobs yet.');
          return;
        }

        const j = await fetchJobDetail(supabase, resolvedJobId);
        if (cancelled) return;
        if (j) {
          setJob(j);
          analytics.capture('job_detail_opened', {
            source: entrySource,
            job_id: j.id,
            job_status: j.workStatus,
            financially_complete: jobDetailIsFinanciallyComplete(j),
            has_sessions: j.displaySessions.length > 0,
            has_materials: j.materialBuckets.some((b) => b.items.length > 0),
            has_notes: j.noteBuckets.some((b) => b.notes.length > 0),
          });
        } else {
          setJob(null);
          setJobLoadError('Could not load that job.');
        }
      } catch (e) {
        if (!cancelled) {
          setJob(null);
          setJobLoadError(e instanceof Error ? e.message : 'Could not load job.');
          analytics.capture('api_request_failed', {
            operation: 'fetch_job_detail',
            screen: 'job_detail',
            job_id: jobId ?? null,
            retryable: true,
            ...errorProperties(e),
          });
        }
      } finally {
        if (!cancelled) setJobLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [entrySource, initialEditOpen, supabaseReady, sessionUserId, loadKey, jobId]);

  const onClose = useCallback(() => {
    if (closingFromSwipeRef.current) return;
    onRequestClose?.();
  }, [onRequestClose]);

  // Reset interactive-dismiss transforms when (re)opening a job so a prior
  // swipe-off doesn't leave the sheet translated for the next presentation.
  useEffect(() => {
    closingFromSwipeRef.current = false;
    dismissY.setValue(0);
    dismissOpacity.setValue(1);
  }, [dismissOpacity, dismissY, loadKey, jobId]);
  const captureJobEditOpened = useCallback(
    (source: JobEditOpenedSource) => {
      if (!job) return;
      analytics.capture('job_edit_opened', {
        source,
        job_id: job.id,
        existing_completeness: jobDetailIsFinanciallyComplete(job)
          ? 'complete'
          : 'incomplete',
        job_status: job.workStatus,
      });
    },
    [job],
  );

  const openEditFromView = useCallback(
    (
      focusTarget: JobDetailEditFocusTarget,
      source: JobEditOpenedSource,
      jobSeed?: JobDetailViewModel,
    ) => {
      const seed = jobSeed ?? jobRef.current ?? job;
      if (!seed || !useFullscreenEdit) return;
      captureJobEditOpened(source);
      editApi.resetFromJob(seed);
      setEditFocusTarget(focusTarget);
      setDetailMode('edit');
    },
    [captureJobEditOpened, editApi, job, useFullscreenEdit],
  );

  const openEditMode = useCallback(
    (focusTarget: JobDetailEditFocusTarget | null = null) => {
      if (!job) return;
      editApi.resetFromJob(job);
      setEditFocusTarget(focusTarget);
      setDetailMode('edit');
    },
    [editApi, job],
  );

  const openEditJobSheet = useCallback(() => {
    setEditSheetMounted(true);
    setEditSheetVisible(true);
  }, []);

  const onEdit = useCallback(() => {
    captureJobEditOpened('header');
    if (useFullscreenEdit) {
      openEditMode(null);
      return;
    }
    openEditJobSheet();
  }, [captureJobEditOpened, openEditJobSheet, openEditMode, useFullscreenEdit]);
  const onCloseEditSheet = useCallback(
    (options?: MarkCompleteWizardCloseOptions) => {
      if (completeWizardActiveRef.current && !options?.keepWizardActive) {
        cancelMarkCompleteWizard();
      } else if (options?.keepWizardActive) {
        setEditJobRevenueError(undefined);
      }
      setEditSheetVisible(false);
    },
    [cancelMarkCompleteWizard],
  );

  const toEditValues = useCallback((j: JobDetailViewModel): EditJobBottomSheetValues => {
    const revenue = j.earnings.revenueCents == null
      ? ''
      : (j.earnings.revenueCents / 100).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
    return {
      shortDescription: j.shortDescription,
      longDescription: j.longDescription ?? '',
      customerName: j.customerName,
      customerPhone: j.customerPhone,
      customerEmail: j.customerEmail,
      customerId: j.customerId,
      serviceAddress: j.serviceAddress,
      revenue,
    };
  }, []);

  const onSaveJobSheet = useCallback(
    async (values: EditJobBottomSheetValues) => {
      if (!job) return;
      const trimmedRevenue = values.revenue.trim().replace(/[$,\s]/g, '');
      const revenueCents =
        trimmedRevenue.length === 0 ? null : Math.round(Number(trimmedRevenue) * 100);

      setJobSaving(true);
      try {
        const before = toEditValues(job);
        await applyJobDetailEdit(supabase, job.id, {
          job: {
            shortDescription: values.shortDescription.trim(),
            longDescription: values.longDescription,
            customerName: values.customerName.trim(),
            customerPhone: values.customerPhone.trim() || null,
            customerEmail: values.customerEmail.trim() || null,
            customerId: values.customerId ?? null,
            serviceAddress: values.serviceAddress.trim(),
            revenueCents,
            noRevenueConfirmed: job.noRevenueConfirmed,
            noMaterialsConfirmed: job.noMaterialsConfirmed,
            noOtherCostsConfirmed: job.noOtherCostsConfirmed,
          },
          sessions: { create: [], update: [], deleteIds: [] },
          notes: { create: [], update: [], deleteIds: [] },
          materials: { create: [], update: [], deleteIds: [] },
          otherCosts: { create: [], update: [], deleteIds: [] },
        });
        const refreshed = await fetchJobDetail(supabase, job.id);
        if (refreshed) setJob(refreshed);
        const keepWizard = completeWizardActiveRef.current;
        onCloseEditSheet({ keepWizardActive: keepWizard });
        invalidateJobsList();
        if (keepWizard && refreshed) {
          advanceMarkCompleteWizardRef.current(refreshed);
        }
        analytics.capture('job_saved', {
          job_id: job.id,
          changed_fields: changedFields(before, values),
          completeness_before: jobDetailIsFinanciallyComplete(job)
            ? 'complete'
            : 'incomplete',
          completeness_after:
            refreshed &&
            jobDetailIsFinanciallyComplete(refreshed)
              ? 'complete'
              : 'incomplete',
          revenue_bucket: moneyBucket(revenueCents),
        });
      } catch (e) {
        const msg =
          e instanceof Error
            ? e.message
            : typeof e === 'object' &&
                e !== null &&
                'message' in e &&
                typeof (e as { message: unknown }).message === 'string'
              ? (e as { message: string }).message
            : String(e);
        analytics.capture('job_save_failed', {
          job_id: job.id,
          changed_fields: changedFields(toEditValues(job), values),
          ...errorProperties(e),
        });
        Alert.alert('Save failed', msg || 'Could not save job changes.');
      } finally {
        setJobSaving(false);
      }
    },
    [invalidateJobsList, job, onCloseEditSheet, toEditValues],
  );

  // --- Session add/edit flow ---

  const openSessionChooser = useCallback(() => {
    if (job) analytics.capture('manual_session_create_opened', { job_id: job.id });
    setSessionSheetMounted(true);
    setSessionFlow('chooser');
    setEditingSessionId(null);
  }, [job]);

  const closeSessionFlow = useCallback(
    (options?: MarkCompleteWizardCloseOptions) => {
      if (completeWizardActiveRef.current && !options?.keepWizardActive) {
        cancelMarkCompleteWizard();
      } else if (options?.keepWizardActive) {
        setSessionWizardBanner(undefined);
      }
      setSessionFlow('closed');
    },
    [cancelMarkCompleteWizard],
  );

  const openAddSession = useCallback(() => {
    setSessionFlow('addForm');
  }, []);

  // --- Live session integration ---

  const liveSessionCtx = useLiveSession();
  const liveSessionForThisJob =
    liveSessionCtx.liveSession?.jobId === job?.id ? liveSessionCtx.liveSession : null;

  // Push job-rename updates into the live-session context so the floating
  // bar / live-session sheet re-render with the new title without waiting
  // for an app reload. Fires when:
  //   - There is a live session AND it's for THIS job.
  //   - The job's shortDescription differs from the cached title in the
  //     live session payload.
  // The context method itself is a no-op in any of those cases too, so
  // this effect is safe to fire on every job update.
  // Pull the function reference out so this effect doesn't re-run every
  // time the context value re-mints (mode flips, timer ticks, etc.).
  const updateLiveJobName = liveSessionCtx.updateLiveSessionJobShortDescription;
  useEffect(() => {
    if (!job) return;
    updateLiveJobName({
      jobId: job.id,
      jobShortDescription: job.shortDescription,
    });
  }, [job?.id, job?.shortDescription, updateLiveJobName]);

  /**
   * "Live Session" tile on the New Session chooser (Figma `1286:602`):
   * starts a brand new in-progress session for THIS job and immediately
   * opens the global LiveSessionBottomSheet via `LiveSessionContext`.
   *
   * Fails (without opening anything) when the user already has an
   * in-progress session — we surface a brief alert and refresh the
   * context so the existing session's floating bar reappears if it
   * was missed.
   */
  const onStartLiveSession = useCallback(async () => {
    if (!job) return;
    closeSessionFlow();
    analytics.capture('session_start_requested', {
      source: 'job_detail',
      job_id: job.id,
      placeholder_job: false,
    });
    // eslint-disable-next-line no-console
    console.log('[LiveSession] startLiveSession requested', {
      jobId: job.id,
      jobShortDescription: job.shortDescription,
    });
    try {
      const created = await liveSessionCtx.startLiveSession({
        jobId: job.id,
        jobShortDescription: job.shortDescription,
      });
      analytics.capture('live_session_started', {
        source: 'job_detail',
        session_id: created.id,
        job_id: job.id,
        job_status: job.workStatus,
        placeholder_job: false,
      });
      // eslint-disable-next-line no-console
      console.log('[LiveSession] startLiveSession success', created);
      onClose();
    } catch (err) {
      // Inspect the underlying Supabase error shape (PG code lives on
      // `.code`, with `.message` / `.details` usually carrying the raw
      // SQLSTATE text). Fall back to `.message` for plain Errors.
      const errorObj = (err ?? {}) as {
        code?: string;
        message?: string;
        details?: string;
        hint?: string;
      };
      const code = typeof errorObj.code === 'string' ? errorObj.code : '';
      const message =
        typeof errorObj.message === 'string'
          ? errorObj.message
          : err instanceof Error
            ? err.message
            : 'Could not start live session.';

      // Stale JWT (typically after a `supabase db reset` wiped auth.users
      // while the device still holds the old token): the LiveSessionContext
      // will sign the user out on the next refresh — just skip the
      // misleading "Could not start live session" alert and don't pollute
      // dev logs.
      if (isStaleJwtError(err)) {
        analytics.capture('stale_auth_session_detected', {
          source_operation: 'start_live_session',
          recovery_action: 'refresh_live_session',
        });
        void liveSessionCtx.refresh();
        return;
      }

      // eslint-disable-next-line no-console
      console.error('[LiveSession] startLiveSession failed', { code, message, err });

      // PG 23505 = unique_violation. Could be either:
      //   - sessions_one_active_per_user_idx (the new per-user index) — in
      //     this case the user already has an active session, so we just
      //     refresh and surface IT.
      //   - sessions_one_active_per_job_idx (pre-existing per-job index)
      //     hit by a stale row that doesn't belong to this user — in this
      //     case refresh comes up empty and we MUST tell the user instead
      //     of going silent.
      if (code === '23505' || message.includes('23505')) {
        const recovered = await liveSessionCtx.refresh();
        if (recovered) {
          analytics.capture('live_session_start_failed', {
            source: 'job_detail',
            job_id: job.id,
            placeholder_job: false,
            recovery_result: 'recovered_existing_live_session',
            ...errorProperties(err),
          });
          onClose();
          return; // bar / sheet will appear via context update
        }
        analytics.capture('live_session_start_failed', {
          source: 'job_detail',
          job_id: job.id,
          placeholder_job: false,
          recovery_result: 'stale_job_live_session',
          ...errorProperties(err),
        });
        Alert.alert(
          'Could not start live session',
          'A previous in-progress session for this job is still open in the database (likely a stale row). Open it and end it before starting a new one, or contact support.',
        );
        return;
      }

      const detail = [message, errorObj.details, errorObj.hint]
        .filter((s): s is string => typeof s === 'string' && s.length > 0)
        .join('\n');
      Alert.alert(
        'Could not start live session',
        detail.length > 0 ? detail : 'Unknown error.',
      );
      analytics.capture('live_session_start_failed', {
        source: 'job_detail',
        job_id: job.id,
        placeholder_job: false,
        recovery_result: 'none',
        ...errorProperties(err),
      });
    }
  }, [closeSessionFlow, job, liveSessionCtx, onClose]);

  /**
   * Re-fetch the job detail whenever the live session for THIS job ends
   * (transitions from non-null → null). The newly-ended session needs to
   * appear as a past session card; the API filters out in-progress rows
   * so this is a clean "render the new past session" trigger.
   */
  const previousLiveIdForThisJob = useRef<string | null>(null);
  useEffect(() => {
    if (!job) return;
    const currentId = liveSessionForThisJob?.id ?? null;
    const previousId = previousLiveIdForThisJob.current;
    previousLiveIdForThisJob.current = currentId;
    if (previousId && !currentId) {
      void (async () => {
        try {
          const refreshed = await fetchJobDetail(supabase, job.id);
          if (refreshed) setJob(refreshed);
        } catch {
          // best-effort refresh; user can pull-to-refresh / re-open
        }
      })();
    }
  }, [job, liveSessionForThisJob]);

  const openEditSession = useCallback((sessionId: string) => {
    setEditingSessionId(sessionId);
    setSessionSheetMounted(true);
    setSessionFlow('editForm');
  }, []);

  const editingSession = useMemo<JobDetailSession | null>(() => {
    if (!editingSessionId || !job) return null;
    return job.displaySessions.find((s) => s.id === editingSessionId) ?? null;
  }, [editingSessionId, job]);

  const refetchJob = useCallback(async (): Promise<JobDetailViewModel | undefined> => {
    if (!job) return undefined;
    const refreshed = await fetchJobDetail(supabase, job.id);
    if (refreshed) setJob(refreshed);
    return refreshed ?? undefined;
  }, [job]);

  const financialCompleteSnapshotRef = useRef<boolean | null>(null);
  const demoteStatusInFlightRef = useRef(false);

  useEffect(() => {
    financialCompleteSnapshotRef.current = null;
  }, [job?.id]);

  const formatErrorMessage = useCallback((e: unknown): string => {
    if (e instanceof Error) return e.message;
    if (
      typeof e === 'object' &&
      e !== null &&
      'message' in e &&
      typeof (e as { message: unknown }).message === 'string'
    ) {
      return (e as { message: string }).message;
    }
    return String(e);
  }, []);

  /**
   * End an in-progress live session for this job before the completeness gate
   * or status write. Returns the job to check (refreshed when a session ended),
   * or undefined when end failed and the complete attempt must abort.
   */
  const endLiveSessionBeforeMarkComplete = useCallback(async (): Promise<
    JobDetailViewModel | undefined
  > => {
    if (!job) return undefined;
    const liveForThisJob = liveSessionCtx.liveSession?.jobId === job.id;
    if (!liveForThisJob && !job.inProgressSession) {
      return job;
    }
    try {
      if (liveForThisJob) {
        await liveSessionCtx.endLiveSessionNow();
      } else if (job.inProgressSession) {
        await endLiveSession(supabase, job.inProgressSession.id);
      }
      const refreshed = await refetchJob();
      invalidateJobsList();
      return refreshed ?? job;
    } catch (e) {
      Alert.alert(
        'Could not end session',
        formatErrorMessage(e) || 'Could not end the live session.',
      );
      return undefined;
    }
  }, [formatErrorMessage, invalidateJobsList, job, liveSessionCtx, refetchJob]);

  const onDeleteSessionFromView = useCallback(
    (sessionId: string) => {
      if (!job) return;
      Alert.alert('Delete this session?', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteSession(supabase, sessionId);
                await refetchJob();
                invalidateJobsList();
                analytics.capture('session_deleted', {
                  session_id: sessionId,
                  job_id: job.id,
                  source: 'job_detail_view',
                });
              } catch (e) {
                analytics.capture('session_delete_failed', {
                  session_id: sessionId,
                  job_id: job.id,
                  source: 'job_detail_view',
                  ...errorProperties(e),
                });
                Alert.alert('Delete failed', formatErrorMessage(e) || 'Could not delete session.');
              }
            })();
          },
        },
      ]);
    },
    [formatErrorMessage, invalidateJobsList, job, refetchJob],
  );

  const onDeleteMaterialFromView = useCallback(
    (materialId: string) => {
      if (!job) return;
      Alert.alert('Delete this material?', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteMaterial(supabase, materialId);
                await refetchJob();
                invalidateJobsList();
                analytics.capture('material_deleted', {
                  material_id: materialId,
                  job_id: job.id,
                  source: 'job_detail_view',
                });
              } catch (e) {
                analytics.capture('material_delete_failed', {
                  material_id: materialId,
                  job_id: job.id,
                  source: 'job_detail_view',
                  ...errorProperties(e),
                });
                Alert.alert('Delete failed', formatErrorMessage(e) || 'Could not delete material.');
              }
            })();
          },
        },
      ]);
    },
    [formatErrorMessage, invalidateJobsList, job, refetchJob],
  );

  const onDeleteOtherCostFromView = useCallback(
    (otherCostId: string) => {
      if (!job) return;
      Alert.alert('Delete this other cost?', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteOtherCost(supabase, otherCostId);
                await refetchJob();
                invalidateJobsList();
                analytics.capture('other_cost_deleted', {
                  other_cost_id: otherCostId,
                  job_id: job.id,
                  source: 'job_detail_view',
                });
              } catch (e) {
                analytics.capture('other_cost_delete_failed', {
                  other_cost_id: otherCostId,
                  job_id: job.id,
                  source: 'job_detail_view',
                  ...errorProperties(e),
                });
                Alert.alert('Delete failed', formatErrorMessage(e) || 'Could not delete other cost.');
              }
            })();
          },
        },
      ]);
    },
    [formatErrorMessage, invalidateJobsList, job, refetchJob],
  );

  const onDeleteNoteFromView = useCallback(
    (noteId: string) => {
      if (!job) return;
      Alert.alert('Delete this note?', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteNote(supabase, noteId);
                await refetchJob();
                analytics.capture('note_deleted', {
                  note_id: noteId,
                  source: 'job_detail_view',
                });
              } catch (e) {
                analytics.capture('note_delete_failed', {
                  note_id: noteId,
                  source: 'job_detail_view',
                  ...errorProperties(e),
                });
                Alert.alert('Delete failed', formatErrorMessage(e) || 'Could not delete note.');
              }
            })();
          },
        },
      ]);
    },
    [formatErrorMessage, job, refetchJob],
  );

  useEffect(() => {
    if (!job || jobLoading || !supabaseReady) return;

    const nowComplete = jobDetailIsFinanciallyComplete(job);
    const previousComplete = financialCompleteSnapshotRef.current;
    const shouldDemote = shouldDemoteCompletedOrPaidForIncompleteFinancials({
      previousFinanciallyComplete: previousComplete,
      nowFinanciallyComplete: nowComplete,
      workStatus: job.workStatus,
    });

    if (!shouldDemote) {
      financialCompleteSnapshotRef.current = nowComplete;
      return;
    }

    if (
      statusActionPending ||
      completeWizardActiveRef.current ||
      demoteStatusInFlightRef.current
    ) {
      return;
    }

    financialCompleteSnapshotRef.current = nowComplete;
    demoteStatusInFlightRef.current = true;
    const fromStatus = job.workStatus;
    void (async () => {
      try {
        await updateJobStatusById(supabase, job.id, 'inProgress');
        invalidateJobsList();
        const refreshed = await fetchJobDetail(supabase, job.id);
        if (refreshed) {
          setJob(refreshed);
          financialCompleteSnapshotRef.current = jobDetailIsFinanciallyComplete(refreshed);
        }
        analytics.capture('job_status_changed', {
          job_id: job.id,
          from_status: fromStatus,
          to_status: 'inProgress',
          source: 'financial_incompleteness',
        });
      } catch (e) {
        analytics.capture('job_status_change_failed', {
          job_id: job.id,
          from_status: fromStatus,
          attempted_status: 'inProgress',
          source: 'financial_incompleteness',
          ...errorProperties(e),
        });
        Alert.alert(
          'Status update failed',
          formatErrorMessage(e) || 'Could not set job back to in progress.',
        );
      } finally {
        demoteStatusInFlightRef.current = false;
      }
    })();
  }, [
    formatErrorMessage,
    invalidateJobsList,
    job,
    jobLoading,
    statusActionPending,
    supabaseReady,
  ]);

  const closeStatusSheet = useCallback(() => {
    setStatusSheetVisible(false);
  }, []);

  const openStatusSheet = useCallback(() => {
    setStatusSheetMounted(true);
    setStatusSheetVisible(true);
  }, []);

  const jobStatusSheetOptions = useMemo<DropdownBottomSheetOption[]>(
    () => buildJobStatusSheetOptions(),
    [],
  );

  const maybeShowCompletionFeedbackPrompt = useCallback(async () => {
    if (!sessionUserId) return;
    try {
      const completedJobCount = await countCompletedJobsForCurrentUser(supabase);
      const milestone = await claimFeedbackPromptMilestone(sessionUserId, completedJobCount);
      if (milestone == null) return;

      analytics.capture('feedback_prompt_shown', {
        source: 'job_completion',
        completed_job_milestone: milestone,
      });
      Alert.alert(
        "How's FieldSoli working for you?",
        `You just completed your ${milestone === 1 ? 'first' : 'third'} job. What felt confusing or missing?`,
        [
          {
            text: 'Not now',
            style: 'cancel',
            onPress: () => analytics.capture('feedback_prompt_dismissed', {
              completed_job_milestone: milestone,
            }),
          },
          {
            text: 'Send feedback',
            onPress: () => {
              analytics.capture('feedback_composer_opened', {
                source: 'completion_prompt',
                completed_job_milestone: milestone,
              });
              void openFeedbackEmail('completion_prompt')
                .then(() => markFeedbackSent(sessionUserId))
                .catch((error) => {
                  analytics.capture('feedback_composer_failed', {
                    source: 'completion_prompt',
                    ...errorProperties(error),
                  });
                  Alert.alert('Email unavailable', 'Email us directly at support@fieldsoli.com.');
                });
            },
          },
        ],
      );
    } catch (error) {
      analytics.capture('feedback_prompt_check_failed', {
        source: 'job_completion',
        ...errorProperties(error),
      });
    }
  }, [sessionUserId]);

  const prepareCompletenessGatedStatus = useCallback(
    async (next: 'completed' | 'paid'): Promise<'proceed' | 'stopped'> => {
      setStatusActionPending(true);
      const prepared = await endLiveSessionBeforeMarkComplete();
      if (!prepared) {
        setStatusActionPending(false);
        return 'stopped';
      }
      if (!isJobFinanciallyComplete(jobFinancialContext(prepared))) {
        setStatusActionPending(false);
        pendingStatusAfterWizardRef.current = next;
        setMinimumInfoGateMounted(true);
        setMinimumInfoGateVisible(true);
        return 'stopped';
      }
      return 'proceed';
    },
    [endLiveSessionBeforeMarkComplete],
  );

  const onPrimaryStatusCta = useCallback(async () => {
    if (!job || statusActionPending) return;
    const next = nextStatusAfterPrimaryAction(job.workStatus);
    if (isCompletedOrPaidWorkStatus(next)) {
      const prepared = await prepareCompletenessGatedStatus(next);
      if (prepared === 'stopped') return;
    } else {
      setStatusActionPending(true);
    }
    try {
      await updateJobStatusById(supabase, job.id, next);
      await refetchJob();
      analytics.capture('job_status_changed', {
        job_id: job.id,
        from_status: job.workStatus,
        to_status: next,
        source: 'primary_cta',
      });
      if (job.workStatus !== 'completed' && next === 'completed') {
        void maybeShowCompletionFeedbackPrompt();
      }
    } catch (e) {
      analytics.capture('job_status_change_failed', {
        job_id: job.id,
        from_status: job.workStatus,
        attempted_status: next,
        source: 'primary_cta',
        ...errorProperties(e),
      });
      Alert.alert(
        'Update failed',
        formatErrorMessage(e) || 'Could not update job status.',
      );
    } finally {
      setStatusActionPending(false);
    }
  }, [
    formatErrorMessage,
    job,
    maybeShowCompletionFeedbackPrompt,
    prepareCompletenessGatedStatus,
    refetchJob,
    statusActionPending,
  ]);

  const onSelectJobStatusFromSheet = useCallback(
    async (value: string) => {
      if (!job || statusActionPending) return;
      if (!isJobDetailWorkStatus(value)) return;
      const next = value;
      if (isCompletedOrPaidWorkStatus(next)) {
        const prepared = await prepareCompletenessGatedStatus(next);
        if (prepared === 'stopped') {
          closeStatusSheet();
          return;
        }
      } else {
        setStatusActionPending(true);
      }
      try {
        await updateJobStatusById(supabase, job.id, next);
        await refetchJob();
        closeStatusSheet();
        analytics.capture('job_status_changed', {
          job_id: job.id,
          from_status: job.workStatus,
          to_status: next,
          source: 'status_sheet',
        });
        if (job.workStatus !== 'completed' && next === 'completed') {
          void maybeShowCompletionFeedbackPrompt();
        }
        if (job.workStatus !== 'completed' && job.workStatus !== 'paid' && next === 'paid') {
          void maybeShowCompletionFeedbackPrompt();
        }
      } catch (e) {
        analytics.capture('job_status_change_failed', {
          job_id: job.id,
          from_status: job.workStatus,
          attempted_status: next,
          source: 'status_sheet',
          ...errorProperties(e),
        });
        Alert.alert(
          'Update failed',
          formatErrorMessage(e) || 'Could not update job status.',
        );
      } finally {
        setStatusActionPending(false);
      }
    },
    [
      closeStatusSheet,
      formatErrorMessage,
      job,
      maybeShowCompletionFeedbackPrompt,
      prepareCompletenessGatedStatus,
      refetchJob,
      statusActionPending,
    ],
  );

  const onSaveNewSession = useCallback(
    async (values: EditSessionBottomSheetValues) => {
      if (!job) return;
      setSessionSaving(true);
      try {
        const sessionId = await createManualSession(supabase, {
          jobId: job.id,
          startedAt: values.startedAt,
          endedAt: values.endedAt,
        });
        await refetchJob();
        invalidateJobsList();
        const keepWizard = completeWizardActiveRef.current;
        closeSessionFlow({ keepWizardActive: keepWizard });
        if (keepWizard) {
          const refreshed = await fetchJobDetail(supabase, job.id);
          if (refreshed) advanceMarkCompleteWizardRef.current(refreshed);
        }
        analytics.capture('manual_session_created', {
          job_id: job.id,
          session_id: sessionId,
          duration_minutes: durationMinutesBetween(values.startedAt, values.endedAt),
        });
      } catch (e) {
        analytics.capture('manual_session_create_failed', {
          job_id: job.id,
          ...errorProperties(e),
        });
        Alert.alert('Save failed', formatErrorMessage(e) || 'Could not save session.');
      } finally {
        setSessionSaving(false);
      }
    },
    [closeSessionFlow, formatErrorMessage, invalidateJobsList, job, refetchJob],
  );

  const onSaveSessionChanges = useCallback(
    async (values: EditSessionBottomSheetValues) => {
      if (!editingSessionId) return;
      setSessionSaving(true);
      try {
        const previous = editingSession;
        await updateSessionTimes(supabase, editingSessionId, {
          startedAt: values.startedAt,
          endedAt: values.endedAt,
        });
        await refetchJob();
        invalidateJobsList();
        closeSessionFlow();
        analytics.capture('manual_session_updated', {
          session_id: editingSessionId,
          job_id: job?.id ?? null,
          changed_fields: changedFields(
            {
              startedAt: previous?.startedAt,
              endedAt: previous?.endedAt,
            },
            values,
          ),
          duration_delta_minutes:
            previous?.startedAt && previous?.endedAt
              ? durationMinutesBetween(values.startedAt, values.endedAt) -
                durationMinutesBetween(previous.startedAt, previous.endedAt)
              : null,
        });
      } catch (e) {
        analytics.capture('manual_session_update_failed', {
          session_id: editingSessionId,
          job_id: job?.id ?? null,
          ...errorProperties(e),
        });
        Alert.alert('Save failed', formatErrorMessage(e) || 'Could not save session.');
      } finally {
        setSessionSaving(false);
      }
    },
    [
      closeSessionFlow,
      editingSession,
      editingSessionId,
      formatErrorMessage,
      invalidateJobsList,
      job?.id,
      refetchJob,
    ],
  );

  const onDeleteEditingSession = useCallback(async () => {
    if (!editingSessionId) return;
    setSessionSaving(true);
    try {
      await deleteSession(supabase, editingSessionId);
      await refetchJob();
      invalidateJobsList();
      closeSessionFlow();
      analytics.capture('session_deleted', {
        session_id: editingSessionId,
        job_id: job?.id ?? null,
      });
    } catch (e) {
      analytics.capture('session_delete_failed', {
        session_id: editingSessionId,
        job_id: job?.id ?? null,
        ...errorProperties(e),
      });
      Alert.alert('Delete failed', formatErrorMessage(e) || 'Could not delete session.');
    } finally {
      setSessionSaving(false);
    }
  }, [closeSessionFlow, editingSessionId, formatErrorMessage, invalidateJobsList, job?.id, refetchJob]);

  // --- Note add/edit flow ---

  /** Find a note across all buckets by id (used when opening Edit Note from a tap). */
  const findNote = useCallback(
    (noteId: string): JobDetailNote | null => {
      if (!job) return null;
      for (const bucket of job.noteBuckets) {
        const hit = bucket.notes.find((n) => n.id === noteId);
        if (hit) return hit;
      }
      return null;
    },
    [job],
  );

  const closeNoteFlow = useCallback(() => {
    setNoteFlow('closed');
  }, []);

  const openAddNote = useCallback(() => {
    if (job) {
      analytics.capture('note_create_opened', {
        source: 'job_detail',
        parent: 'job',
        job_id: job.id,
      });
    }
    setEditingNoteId(null);
    setDraftBody('');
    setDraftSessionId(null);
    setNoteSheetMounted(true);
    setNoteFlow('addNote');
  }, [job]);

  const openAddNoteForSession = useCallback((sessionId: string) => {
    if (job) {
      analytics.capture('note_create_opened', {
        source: 'job_detail',
        parent: 'session',
        job_id: job.id,
        session_id: sessionId,
      });
    }
    setEditingNoteId(null);
    setDraftBody('');
    setDraftSessionId(sessionId);
    setNoteSheetMounted(true);
    setNoteFlow('addNote');
  }, [job]);

  const openEditNote = useCallback(
    (noteId: string) => {
      const n = findNote(noteId);
      if (!n) return;
      setEditingNoteId(noteId);
      setDraftBody(n.body);
      setDraftSessionId(n.sessionId);
      setNoteSheetMounted(true);
      setNoteFlow('editNote');
    },
    [findNote],
  );

  const openSessionPickerFromNoteSheet = useCallback(() => {
    // Edit mode when the note already has a session, attach mode otherwise.
    setNoteFlow(draftSessionId ? 'editSession' : 'attachSession');
  }, [draftSessionId]);

  const returnToNoteSheet = useCallback(() => {
    setNoteFlow(editingNoteId ? 'editNote' : 'addNote');
  }, [editingNoteId]);

  const onSelectDraftSession = useCallback(
    (sessionId: string) => {
      setDraftSessionId(sessionId);
      returnToNoteSheet();
    },
    [returnToNoteSheet],
  );

  const onRemoveDraftSession = useCallback(() => {
    setDraftSessionId(null);
    returnToNoteSheet();
  }, [returnToNoteSheet]);

  const onSaveNewNote = useCallback(
    async ({ body }: EditNoteBottomSheetValues) => {
      if (!job) return;
      setNoteSaving(true);
      try {
        // Exactly one of jobId / sessionId is set (notes_exactly_one_parent).
        const noteId = await createNote(supabase, {
          jobId: job.id,
          sessionId: draftSessionId,
          body,
        });
        await refetchJob();
        closeNoteFlow();
        analytics.capture('note_created', {
          source: 'job_detail',
          note_id: noteId,
          parent_type: draftSessionId ? 'session' : 'job',
          job_id: job.id,
          session_id: draftSessionId,
          text_length_bucket: textLengthBucket(body),
        });
      } catch (e) {
        analytics.capture('note_create_failed', {
          source: 'job_detail',
          parent_type: draftSessionId ? 'session' : 'job',
          job_id: job.id,
          session_id: draftSessionId,
          ...errorProperties(e),
        });
        Alert.alert('Save failed', formatErrorMessage(e) || 'Could not save note.');
      } finally {
        setNoteSaving(false);
      }
    },
    [closeNoteFlow, draftSessionId, formatErrorMessage, job, refetchJob],
  );

  const onSaveNoteChanges = useCallback(
    async ({ body }: EditNoteBottomSheetValues) => {
      if (!editingNoteId || !job) return;
      setNoteSaving(true);
      try {
        const previous = findNote(editingNoteId);
        // Pass sessionId unconditionally so the api-client re-parents to the
        // current draft assignment (including `null` → back to unassigned).
        await updateNote(supabase, editingNoteId, {
          body,
          sessionId: draftSessionId,
          jobId: draftSessionId === null ? job.id : undefined,
        });
        await refetchJob();
        closeNoteFlow();
        analytics.capture('note_updated', {
          note_id: editingNoteId,
          job_id: job.id,
          session_id: draftSessionId,
          changed_fields: changedFields(
            {
              body: previous?.body ?? '',
              sessionId: previous?.sessionId ?? null,
            },
            {
              body,
              sessionId: draftSessionId,
            },
          ),
          parent_changed: (previous?.sessionId ?? null) !== draftSessionId,
          text_length_bucket: textLengthBucket(body),
        });
      } catch (e) {
        analytics.capture('note_update_failed', {
          note_id: editingNoteId,
          job_id: job.id,
          session_id: draftSessionId,
          ...errorProperties(e),
        });
        Alert.alert('Save failed', formatErrorMessage(e) || 'Could not save note.');
      } finally {
        setNoteSaving(false);
      }
    },
    [closeNoteFlow, draftSessionId, editingNoteId, findNote, formatErrorMessage, job, refetchJob],
  );

  const onDeleteEditingNote = useCallback(async () => {
    if (!editingNoteId) {
      // Add flow — trash simply abandons the draft.
      closeNoteFlow();
      return;
    }
    setNoteSaving(true);
    try {
      await deleteNote(supabase, editingNoteId);
      await refetchJob();
      closeNoteFlow();
      analytics.capture('note_deleted', {
        note_id: editingNoteId,
        source: 'job_detail',
      });
    } catch (e) {
      analytics.capture('note_delete_failed', {
        note_id: editingNoteId,
        source: 'job_detail',
        ...errorProperties(e),
      });
      Alert.alert('Delete failed', formatErrorMessage(e) || 'Could not delete note.');
    } finally {
      setNoteSaving(false);
    }
  }, [closeNoteFlow, editingNoteId, formatErrorMessage, refetchJob]);

  // --- Material add/edit flow ---

  const findMaterial = useCallback(
    (materialId: string): JobDetailMaterialLine | null => {
      if (!job) return null;
      for (const bucket of job.materialBuckets) {
        const hit = bucket.items.find((m) => m.id === materialId);
        if (hit) return hit;
      }
      return null;
    },
    [job],
  );

  const closeMaterialFlow = useCallback(
    (options?: MarkCompleteWizardCloseOptions) => {
      if (completeWizardActiveRef.current && !options?.keepWizardActive) {
        cancelMarkCompleteWizard();
      } else if (options?.keepWizardActive) {
        setMaterialWizardMode(false);
        setMaterialWizardError(undefined);
      }
      setMaterialFlow('closed');
    },
    [cancelMarkCompleteWizard],
  );

  const openAddMaterial = useCallback(() => {
    if (job) {
      analytics.capture('material_create_opened', {
        source: 'job_detail',
        parent: 'job',
        job_id: job.id,
      });
    }
    setEditingMaterialId(null);
    setMatDraftDescription('');
    setMatDraftUnitCostCents(0);
    setMatDraftQuantity(1);
    setMatDraftUnit('ea');
    setMatDraftSessionId(null);
    setMaterialSheetMounted(true);
    setMaterialFlow('addMaterial');
  }, [job]);

  const openAddMaterialForSession = useCallback((sessionId: string) => {
    if (job) {
      analytics.capture('material_create_opened', {
        source: 'job_detail',
        parent: 'session',
        job_id: job.id,
        session_id: sessionId,
      });
    }
    setEditingMaterialId(null);
    setMatDraftDescription('');
    setMatDraftUnitCostCents(0);
    setMatDraftQuantity(1);
    setMatDraftUnit('ea');
    setMatDraftSessionId(sessionId);
    setMaterialSheetMounted(true);
    setMaterialFlow('addMaterial');
  }, [job]);

  const openEditMaterial = useCallback(
    (materialId: string) => {
      const m = findMaterial(materialId);
      if (!m) return;
      setEditingMaterialId(materialId);
      setMatDraftDescription(m.name);
      setMatDraftUnitCostCents(m.unitCostCents ?? 0);
      setMatDraftQuantity(m.quantity ?? 0);
      setMatDraftUnit(m.unit || 'ea');
      setMatDraftSessionId(m.sessionId);
      setMaterialSheetMounted(true);
      setMaterialFlow('editMaterial');
    },
    [findMaterial],
  );

  const returnToMaterialSheet = useCallback(() => {
    setMaterialFlow(editingMaterialId ? 'editMaterial' : 'addMaterial');
  }, [editingMaterialId]);

  const openSessionPickerFromMaterialSheet = useCallback(() => {
    setMaterialFlow(matDraftSessionId ? 'editSession' : 'attachSession');
  }, [matDraftSessionId]);

  const openUnitPickerFromMaterialSheet = useCallback(() => {
    setMaterialFlow('chooseUnit');
  }, []);

  const onSelectMaterialSession = useCallback(
    (sessionId: string) => {
      setMatDraftSessionId(sessionId);
      returnToMaterialSheet();
    },
    [returnToMaterialSheet],
  );

  const onRemoveMaterialSession = useCallback(() => {
    setMatDraftSessionId(null);
    returnToMaterialSheet();
  }, [returnToMaterialSheet]);

  const onSelectMaterialUnit = useCallback(
    (unit: string) => {
      setMatDraftUnit(unit || 'ea');
      returnToMaterialSheet();
    },
    [returnToMaterialSheet],
  );

  const onSaveNewMaterial = useCallback(
    async (values: EditMaterialBottomSheetValues) => {
      if (!job) return;
      setMaterialSaving(true);
      try {
        const materialId = await createMaterial(supabase, {
          jobId: job.id,
          sessionId: matDraftSessionId,
          description: values.description,
          quantity: values.quantity,
          unit: values.unit,
          unitCostCents: values.unitCostCents,
        });
        await refetchJob();
        invalidateJobsList();
        const keepWizard = completeWizardActiveRef.current;
        closeMaterialFlow({ keepWizardActive: keepWizard });
        if (keepWizard) {
          const refreshed = await fetchJobDetail(supabase, job.id);
          if (refreshed) advanceMarkCompleteWizardRef.current(refreshed);
        }
        analytics.capture('material_created', {
          source: 'job_detail',
          material_id: materialId,
          parent_type: matDraftSessionId ? 'session' : 'job',
          job_id: job.id,
          session_id: matDraftSessionId,
          unit: values.unit,
          quantity_bucket: quantityBucket(values.quantity),
          cost_bucket: moneyBucket(values.unitCostCents),
          text_length_bucket: textLengthBucket(values.description),
        });
      } catch (e) {
        analytics.capture('material_create_failed', {
          source: 'job_detail',
          parent_type: matDraftSessionId ? 'session' : 'job',
          job_id: job.id,
          session_id: matDraftSessionId,
          ...errorProperties(e),
        });
        Alert.alert(
          'Save failed',
          formatErrorMessage(e) || 'Could not save material.',
        );
      } finally {
        setMaterialSaving(false);
      }
    },
    [closeMaterialFlow, formatErrorMessage, invalidateJobsList, job, matDraftSessionId, refetchJob],
  );

  const onSaveMaterialChanges = useCallback(
    async (values: EditMaterialBottomSheetValues) => {
      if (!editingMaterialId || !job) return;
      setMaterialSaving(true);
      try {
        const previous = findMaterial(editingMaterialId);
        // Pass sessionId unconditionally so the api-client re-parents the row
        // (including `null` → back to unassigned under the current job).
        await updateMaterial(supabase, editingMaterialId, {
          description: values.description,
          quantity: values.quantity,
          unit: values.unit,
          unitCostCents: values.unitCostCents,
          sessionId: matDraftSessionId,
          jobId: matDraftSessionId === null ? job.id : undefined,
        });
        await refetchJob();
        invalidateJobsList();
        closeMaterialFlow();
        analytics.capture('material_updated', {
          material_id: editingMaterialId,
          job_id: job.id,
          session_id: matDraftSessionId,
          changed_fields: changedFields(
            {
              description: previous?.name ?? '',
              quantity: previous?.quantity ?? null,
              unit: previous?.unit ?? '',
              unitCostCents: previous?.unitCostCents ?? null,
              sessionId: previous?.sessionId ?? null,
            },
            {
              description: values.description,
              quantity: values.quantity,
              unit: values.unit,
              unitCostCents: values.unitCostCents,
              sessionId: matDraftSessionId,
            },
          ),
          parent_changed: (previous?.sessionId ?? null) !== matDraftSessionId,
          unit: values.unit,
          quantity_bucket: quantityBucket(values.quantity),
          cost_bucket: moneyBucket(values.unitCostCents),
        });
      } catch (e) {
        analytics.capture('material_update_failed', {
          material_id: editingMaterialId,
          job_id: job.id,
          session_id: matDraftSessionId,
          ...errorProperties(e),
        });
        Alert.alert(
          'Save failed',
          formatErrorMessage(e) || 'Could not save material.',
        );
      } finally {
        setMaterialSaving(false);
      }
    },
    [
      closeMaterialFlow,
      editingMaterialId,
      formatErrorMessage,
      invalidateJobsList,
      job,
      matDraftSessionId,
      refetchJob,
      findMaterial,
    ],
  );

  const onDeleteEditingMaterial = useCallback(async () => {
    if (!editingMaterialId) {
      // Add flow — trash simply abandons the draft.
      closeMaterialFlow();
      return;
    }
    setMaterialSaving(true);
    try {
      await deleteMaterial(supabase, editingMaterialId);
      await refetchJob();
      invalidateJobsList();
      closeMaterialFlow();
      analytics.capture('material_deleted', {
        material_id: editingMaterialId,
        source: 'job_detail',
      });
    } catch (e) {
      analytics.capture('material_delete_failed', {
        material_id: editingMaterialId,
        source: 'job_detail',
        ...errorProperties(e),
      });
      Alert.alert(
        'Delete failed',
        formatErrorMessage(e) || 'Could not delete material.',
      );
    } finally {
      setMaterialSaving(false);
    }
  }, [closeMaterialFlow, editingMaterialId, formatErrorMessage, invalidateJobsList, refetchJob]);

  const onConfirmNoMaterialsUsed = useCallback(async () => {
    if (!job || noMaterialsSaving || !supabaseReady) return;
    setNoMaterialsSaving(true);
    try {
      await updateJobCostsReviewed(supabase, job.id, true);
      await refetchJob();
      invalidateJobsList();
      analytics.capture('no_materials_confirmed', {
        job_id: job.id,
        source: 'job_detail',
      });
    } catch (e) {
      analytics.capture('no_materials_confirmation_failed', {
        job_id: job.id,
        action: 'confirm',
        ...errorProperties(e),
      });
      Alert.alert(
        'Update failed',
        formatErrorMessage(e) || 'Could not confirm materials.',
      );
    } finally {
      setNoMaterialsSaving(false);
    }
  }, [
    formatErrorMessage,
    invalidateJobsList,
    job,
    noMaterialsSaving,
    refetchJob,
    supabaseReady,
  ]);

  const onUndoNoMaterialsUsed = useCallback(async () => {
    if (!job || noMaterialsSaving || !supabaseReady) return;
    setNoMaterialsSaving(true);
    try {
      await updateJobCostsReviewed(supabase, job.id, false);
      await refetchJob();
      invalidateJobsList();
      analytics.capture('no_materials_confirmation_undone', {
        job_id: job.id,
        source: 'job_detail',
      });
    } catch (e) {
      analytics.capture('no_materials_confirmation_failed', {
        job_id: job.id,
        action: 'undo',
        ...errorProperties(e),
      });
      Alert.alert(
        'Update failed',
        formatErrorMessage(e) || 'Could not undo materials confirmation.',
      );
    } finally {
      setNoMaterialsSaving(false);
    }
  }, [
    formatErrorMessage,
    invalidateJobsList,
    job,
    noMaterialsSaving,
    refetchJob,
    supabaseReady,
  ]);

  const performMarkJobCompleted = useCallback(async () => {
    if (!job) return;
    const toStatus = pendingStatusAfterWizardRef.current;
    setStatusActionPending(true);
    try {
      const fromStatus = job.workStatus;
      await updateJobStatusById(supabase, job.id, toStatus);
      await refetchJob();
      analytics.capture('job_status_changed', {
        job_id: job.id,
        from_status: fromStatus,
        to_status: toStatus,
        source: 'primary_cta',
      });
      if (
        fromStatus !== 'completed' &&
        fromStatus !== 'paid' &&
        isCompletedOrPaidWorkStatus(toStatus)
      ) {
        void maybeShowCompletionFeedbackPrompt();
      }
    } catch (e) {
      analytics.capture('job_status_change_failed', {
        job_id: job.id,
        from_status: job.workStatus,
        attempted_status: toStatus,
        source: 'mark_complete_wizard',
        ...errorProperties(e),
      });
      Alert.alert(
        'Update failed',
        formatErrorMessage(e) || 'Could not update job status.',
      );
    } finally {
      pendingStatusAfterWizardRef.current = 'completed';
      setStatusActionPending(false);
      setMaterialWizardMode(false);
      setMaterialWizardError(undefined);
      setOtherCostWizardMode(false);
      setOtherCostWizardError(undefined);
      setEditJobRevenueError(undefined);
      setSessionWizardBanner(undefined);
    }
  }, [formatErrorMessage, job, maybeShowCompletionFeedbackPrompt, refetchJob]);

  const openMarkCompleteGap = useCallback(
    (gap: FinancialCompletenessGap, jobSeed?: JobDetailViewModel) => {
      const seed = jobSeed ?? jobRef.current ?? job;
      if (useFullscreenEdit && seed) {
        switch (gap) {
          case 'revenue':
            openEditFromView('revenue', 'complete_wizard', seed);
            return;
          case 'session':
            openEditFromView('sessions', 'complete_wizard', seed);
            return;
          case 'materials':
            openEditFromView('materials', 'complete_wizard', seed);
            return;
          case 'otherCosts':
            openEditFromView('otherCosts', 'complete_wizard', seed);
            return;
        }
      }
      switch (gap) {
        case 'revenue':
          setEditJobRevenueError('Missing Revenue');
          setEditSheetMounted(true);
          setEditSheetVisible(true);
          break;
        case 'session':
          setSessionWizardBanner('Missing Session');
          setSessionSheetMounted(true);
          setSessionFlow('addForm');
          setEditingSessionId(null);
          break;
        case 'materials':
          setMaterialWizardMode(true);
          setMaterialWizardError('Missing materials');
          setEditingMaterialId(null);
          setMatDraftDescription('');
          setMatDraftUnitCostCents(0);
          setMatDraftQuantity(1);
          setMatDraftUnit('ea');
          setMatDraftSessionId(null);
          setMaterialSheetMounted(true);
          setMaterialFlow('addMaterial');
          break;
        case 'otherCosts':
          setOtherCostWizardMode(true);
          setOtherCostWizardError('Missing other costs');
          setEditingOtherCostId(null);
          setOcDraftCostType('helper_labor');
          setOcDraftCostCents(0);
          setOcDraftDescription('');
          setOcDraftSessionId(null);
          setOtherCostSheetMounted(true);
          setOtherCostFlow('addOtherCost');
          break;
      }
    },
    [job, openEditFromView, useFullscreenEdit],
  );

  const advanceMarkCompleteWizard = useCallback(
    (refreshedJob: JobDetailViewModel) => {
      if (!completeWizardActiveRef.current) return;
      const ctx = jobFinancialContext(refreshedJob);
      const gaps = financialCompletenessGaps(ctx);
      if (gaps.length === 0) {
        setCompleteWizardActive(false);
        void performMarkJobCompleted();
        return;
      }
      openMarkCompleteGap(gaps[0], refreshedJob);
    },
    [openMarkCompleteGap, performMarkJobCompleted, setCompleteWizardActive],
  );

  useEffect(() => {
    advanceMarkCompleteWizardRef.current = advanceMarkCompleteWizard;
  }, [advanceMarkCompleteWizard]);

  const onConfirmMinimumInfo = useCallback(() => {
    if (!job) return;
    setCompleteWizardActive(true);
    setMinimumInfoGateVisible(false);
    advanceMarkCompleteWizard(job);
  }, [advanceMarkCompleteWizard, job, setCompleteWizardActive]);

  const closeMinimumInfoGate = useCallback(() => {
    pendingStatusAfterWizardRef.current = 'completed';
    setMinimumInfoGateVisible(false);
  }, []);

  const onConfirmNoOtherCosts = useCallback(async () => {
    if (!job || noOtherCostsSaving || !supabaseReady) return;
    setNoOtherCostsSaving(true);
    try {
      await updateJobOtherCostsReviewed(supabase, job.id, true);
      await refetchJob();
      invalidateJobsList();
      if (completeWizardActiveRef.current) {
        const refreshed = await fetchJobDetail(supabase, job.id);
        if (refreshed) advanceMarkCompleteWizard(refreshed);
      }
    } catch (e) {
      Alert.alert(
        'Update failed',
        formatErrorMessage(e) || 'Could not confirm other costs.',
      );
    } finally {
      setNoOtherCostsSaving(false);
    }
  }, [
    advanceMarkCompleteWizard,
    formatErrorMessage,
    invalidateJobsList,
    job,
    noOtherCostsSaving,
    refetchJob,
    supabaseReady,
  ]);

  const onUndoNoOtherCosts = useCallback(async () => {
    if (!job || noOtherCostsSaving || !supabaseReady) return;
    setNoOtherCostsSaving(true);
    try {
      await updateJobOtherCostsReviewed(supabase, job.id, false);
      await refetchJob();
      invalidateJobsList();
    } catch (e) {
      Alert.alert(
        'Update failed',
        formatErrorMessage(e) || 'Could not undo other costs confirmation.',
      );
    } finally {
      setNoOtherCostsSaving(false);
    }
  }, [
    formatErrorMessage,
    invalidateJobsList,
    job,
    noOtherCostsSaving,
    refetchJob,
    supabaseReady,
  ]);

  // --- Other cost add/edit flow ---

  const findOtherCostLine = useCallback(
    (otherCostId: string) => {
      if (!job) return null;
      for (const bucket of job.otherCostBuckets) {
        const item = bucket.items.find((line) => line.id === otherCostId);
        if (item) return item;
      }
      return null;
    },
    [job],
  );

  const closeOtherCostFlow = useCallback(
    (options?: MarkCompleteWizardCloseOptions) => {
      if (completeWizardActiveRef.current && !options?.keepWizardActive) {
        cancelMarkCompleteWizard();
      } else if (options?.keepWizardActive) {
        setOtherCostWizardMode(false);
        setOtherCostWizardError(undefined);
      }
      setOtherCostFlow('closed');
    },
    [cancelMarkCompleteWizard],
  );

  const openAddOtherCost = useCallback(() => {
    setEditingOtherCostId(null);
    setOcDraftCostType('helper_labor');
    setOcDraftCostCents(0);
    setOcDraftDescription('');
    setOcDraftSessionId(null);
    setOtherCostSheetMounted(true);
    setOtherCostFlow('addOtherCost');
  }, []);

  const openEditOtherCost = useCallback(
    (otherCostId: string) => {
      const line = findOtherCostLine(otherCostId);
      if (!line) return;
      setEditingOtherCostId(otherCostId);
      setOcDraftCostType(line.costType as JobOtherCostType);
      setOcDraftCostCents(line.costCents);
      setOcDraftDescription(line.description);
      setOcDraftSessionId(line.sessionId);
      setOtherCostSheetMounted(true);
      setOtherCostFlow('editOtherCost');
    },
    [findOtherCostLine],
  );

  const returnToOtherCostSheet = useCallback(() => {
    setOtherCostFlow(editingOtherCostId ? 'editOtherCost' : 'addOtherCost');
  }, [editingOtherCostId]);

  const openSessionPickerFromOtherCostSheet = useCallback(() => {
    setOtherCostFlow(ocDraftSessionId ? 'editSession' : 'attachSession');
  }, [ocDraftSessionId]);

  const openCostTypePickerFromOtherCostSheet = useCallback(() => {
    setOtherCostFlow('chooseCostType');
  }, []);

  const onSelectOtherCostSession = useCallback(
    (sessionId: string) => {
      setOcDraftSessionId(sessionId);
      returnToOtherCostSheet();
    },
    [returnToOtherCostSheet],
  );

  const onRemoveOtherCostSession = useCallback(() => {
    setOcDraftSessionId(null);
    returnToOtherCostSheet();
  }, [returnToOtherCostSheet]);

  const onSelectOtherCostType = useCallback(
    (value: string) => {
      setOcDraftCostType((value as JobOtherCostType) || 'other');
      returnToOtherCostSheet();
    },
    [returnToOtherCostSheet],
  );

  const saveOtherCostLine = useCallback(
    async (values: EditOtherCostBottomSheetValues, lineId: string | null) => {
      if (!job || otherCostSaving || !supabaseReady) return;
      setOtherCostSaving(true);
      try {
        if (lineId) {
          await updateOtherCost(supabase, lineId, {
            costType: values.costType,
            description: values.description,
            costCents: values.costCents,
            sessionId: ocDraftSessionId,
            jobId: ocDraftSessionId ? null : job.id,
          });
        } else {
          await createOtherCost(supabase, {
            jobId: ocDraftSessionId ? null : job.id,
            sessionId: ocDraftSessionId,
            costType: values.costType,
            description: values.description,
            costCents: values.costCents,
          });
        }
        await refetchJob();
        invalidateJobsList();
        const keepWizard = completeWizardActiveRef.current;
        closeOtherCostFlow({ keepWizardActive: keepWizard });
        const refreshed = await fetchJobDetail(supabase, job.id);
        if (refreshed && keepWizard) {
          advanceMarkCompleteWizard(refreshed);
        }
      } catch (e) {
        Alert.alert(
          'Save failed',
          formatErrorMessage(e) || 'Could not save other cost.',
        );
      } finally {
        setOtherCostSaving(false);
      }
    },
    [
      advanceMarkCompleteWizard,
      closeOtherCostFlow,
      formatErrorMessage,
      invalidateJobsList,
      job,
      ocDraftSessionId,
      otherCostSaving,
      refetchJob,
      supabaseReady,
    ],
  );

  const onSaveNewOtherCost = useCallback(
    (values: EditOtherCostBottomSheetValues) => {
      void saveOtherCostLine(values, null);
    },
    [saveOtherCostLine],
  );

  const onSaveOtherCostChanges = useCallback(
    (values: EditOtherCostBottomSheetValues) => {
      if (!editingOtherCostId) return;
      void saveOtherCostLine(values, editingOtherCostId);
    },
    [editingOtherCostId, saveOtherCostLine],
  );

  const onDeleteEditingOtherCost = useCallback(async () => {
    if (!job || !editingOtherCostId) {
      closeOtherCostFlow();
      return;
    }
    if (otherCostSaving) return;
    setOtherCostSaving(true);
    try {
      await deleteOtherCost(supabase, editingOtherCostId);
      await refetchJob();
      invalidateJobsList();
      closeOtherCostFlow();
    } catch (e) {
      Alert.alert(
        'Delete failed',
        formatErrorMessage(e) || 'Could not delete other cost.',
      );
    } finally {
      setOtherCostSaving(false);
    }
  }, [
    closeOtherCostFlow,
    editingOtherCostId,
    formatErrorMessage,
    invalidateJobsList,
    job,
    otherCostSaving,
    refetchJob,
  ]);

  const onConfirmNoOtherCostsFromWizard = useCallback(async () => {
    if (!job || noOtherCostsSaving || !supabaseReady) return;
    setNoOtherCostsSaving(true);
    try {
      await updateJobOtherCostsReviewed(supabase, job.id, true);
      await refetchJob();
      invalidateJobsList();
      const keepWizard = completeWizardActiveRef.current;
      closeOtherCostFlow({ keepWizardActive: keepWizard });
      const refreshed = await fetchJobDetail(supabase, job.id);
      if (refreshed && keepWizard) {
        advanceMarkCompleteWizard(refreshed);
      }
    } catch (e) {
      Alert.alert(
        'Update failed',
        formatErrorMessage(e) || 'Could not confirm other costs.',
      );
    } finally {
      setNoOtherCostsSaving(false);
    }
  }, [
    advanceMarkCompleteWizard,
    closeOtherCostFlow,
    formatErrorMessage,
    invalidateJobsList,
    job,
    noOtherCostsSaving,
    refetchJob,
    supabaseReady,
  ]);

  const onConfirmNoMaterialsFromWizard = useCallback(async () => {
    if (!job || noMaterialsSaving || !supabaseReady) return;
    setNoMaterialsSaving(true);
    try {
      await updateJobCostsReviewed(supabase, job.id, true);
      await refetchJob();
      invalidateJobsList();
      const keepWizard = completeWizardActiveRef.current;
      closeMaterialFlow({ keepWizardActive: keepWizard });
      const refreshed = await fetchJobDetail(supabase, job.id);
      if (refreshed && keepWizard) {
        advanceMarkCompleteWizard(refreshed);
      }
    } catch (e) {
      Alert.alert(
        'Update failed',
        formatErrorMessage(e) || 'Could not confirm materials.',
      );
    } finally {
      setNoMaterialsSaving(false);
    }
  }, [
    advanceMarkCompleteWizard,
    closeMaterialFlow,
    formatErrorMessage,
    invalidateJobsList,
    job,
    noMaterialsSaving,
    refetchJob,
    supabaseReady,
  ]);

  /** Sessions visible in current Job Detail UI (completed only). */
  const visibleSessions = useMemo(
    () => job?.displaySessions ?? [],
    [job],
  );

  /**
   * All non-deleted sessions (ended + in progress) for the session picker and
   * draft session labels — matches `job.allSessions`.
   */
  const allSessionsList = useMemo(
    () => job?.allSessions ?? [],
    [job?.allSessions],
  );

  const chooserSessions = useMemo<ChooseSessionBottomSheetSession[]>(
    () =>
      allSessionsList.map((s) => ({
        id: s.id,
        dateLabel: s.dateLabel,
        durationLabel: s.durationLabel,
      })),
    [allSessionsList],
  );

  /** Hydrated version of `draftSessionId` used by the note sheet subtitle + pill icon. */
  const draftAssignedSession = useMemo(() => {
    if (!draftSessionId) return null;
    const s = allSessionsList.find((x) => x.id === draftSessionId);
    if (!s) return null;
    return { id: s.id, dateLabel: s.dateLabel, timeRangeLabel: s.timeRangeLabel };
  }, [draftSessionId, allSessionsList]);

  /** Hydrated version of `matDraftSessionId` used by the material sheet subtitle + pill. */
  const matDraftAssignedSession = useMemo(() => {
    if (!matDraftSessionId) return null;
    const s = allSessionsList.find((x) => x.id === matDraftSessionId);
    if (!s) return null;
    return { id: s.id, dateLabel: s.dateLabel, timeRangeLabel: s.timeRangeLabel };
  }, [matDraftSessionId, allSessionsList]);

  const ocDraftAssignedSession = useMemo(() => {
    if (!ocDraftSessionId) return null;
    const s = allSessionsList.find((x) => x.id === ocDraftSessionId);
    if (!s) return null;
    return { id: s.id, dateLabel: s.dateLabel, timeRangeLabel: s.timeRangeLabel };
  }, [ocDraftSessionId, allSessionsList]);

  /** Preset UOM options for the unit-of-measure dropdown (Figma `1882:1781`). */
  const unitOptions = useMemo<DropdownBottomSheetOption[]>(
    () =>
      (['ea', 'ft', 'pcs', 'kit', 'lb', 'gal', 'lot'] as const).map((u) => ({
        id: u,
        label: u,
        value: u,
      })),
    [],
  );

  const onDeleteJobSheet = useCallback(async () => {
    if (!job) return;
    setJobSaving(true);
    try {
      await deleteJobById(supabase, job.id);
      onCloseEditSheet();
      onRequestClose?.();
      analytics.capture('job_deleted', {
        job_id: job.id,
        source: 'job_detail',
      });
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === 'object' &&
              e !== null &&
              'message' in e &&
              typeof (e as { message: unknown }).message === 'string'
            ? (e as { message: string }).message
            : String(e);
      analytics.capture('job_delete_failed', {
        job_id: job.id,
        source: 'job_detail',
        ...errorProperties(e),
      });
      Alert.alert('Delete failed', msg || 'Could not delete this job.');
    } finally {
      setJobSaving(false);
    }
  }, [job, onCloseEditSheet, onRequestClose]);

  const leaveEditMode = useCallback(() => {
    Keyboard.dismiss();
    setDetailMode('view');
    setEditFocusTarget(null);
  }, []);

  const onBackFromEdit = useCallback(() => {
    if (editSavingRef.current) return;
    if (editApi.isDirty()) {
      Alert.alert('Discard changes?', undefined, [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            editApi.discardDraft();
            if (completeWizardActiveRef.current) {
              cancelMarkCompleteWizard();
            }
            leaveEditMode();
          },
        },
      ]);
      return;
    }
    if (completeWizardActiveRef.current) {
      cancelMarkCompleteWizard();
    }
    leaveEditMode();
  }, [cancelMarkCompleteWizard, editApi, leaveEditMode]);

  useEffect(() => {
    if (!onAndroidHardwareBackHandlerChange) return;
    if (detailMode !== 'edit') {
      onAndroidHardwareBackHandlerChange(null);
      return;
    }
    onAndroidHardwareBackHandlerChange(() => {
      editApi.requestBack(onBackFromEdit);
      return true;
    });
    return () => onAndroidHardwareBackHandlerChange(null);
  }, [detailMode, editApi, onAndroidHardwareBackHandlerChange, onBackFromEdit]);

  const onDoneFromEdit = useCallback(async () => {
    if (!job || editSavingRef.current) return;
    const payload = editApi.buildPayload();
    if (!payload) return;
    editSavingRef.current = true;
    setEditSaving(true);
    try {
      await applyJobDetailEdit(supabase, job.id, payload);
      const refreshed = await fetchJobDetail(supabase, job.id);
      if (refreshed) {
        jobRef.current = refreshed;
        setJob(refreshed);
        editApi.resetFromJob(refreshed);
      }
      leaveEditMode();
      invalidateJobsList();
      if (completeWizardActiveRef.current && refreshed) {
        advanceMarkCompleteWizard(refreshed);
      }
      analytics.capture('job_saved', {
        job_id: job.id,
        changed_fields: ['job_detail_edit'],
        completeness_before: jobDetailIsFinanciallyComplete(job) ? 'complete' : 'incomplete',
        completeness_after:
          refreshed && jobDetailIsFinanciallyComplete(refreshed) ? 'complete' : 'incomplete',
        revenue_bucket: moneyBucket(refreshed?.earnings.revenueCents ?? null),
      });
    } catch {
      analytics.capture('job_save_failed', {
        job_id: job.id,
        changed_fields: ['job_detail_edit'],
      });
      Alert.alert("Couldn't save this job. Try again.");
    } finally {
      editSavingRef.current = false;
      setEditSaving(false);
    }
  }, [advanceMarkCompleteWizard, editApi, invalidateJobsList, job, leaveEditMode]);

  const onDeleteJobFromEdit = useCallback(async () => {
    if (!job || editSavingRef.current) return;
    editSavingRef.current = true;
    setEditSaving(true);
    try {
      await deleteJobById(supabase, job.id);
      leaveEditMode();
      onRequestClose?.();
      invalidateJobsList();
      analytics.capture('job_deleted', {
        job_id: job.id,
        source: 'job_detail_edit',
      });
    } catch {
      analytics.capture('job_delete_failed', {
        job_id: job.id,
        source: 'job_detail_edit',
      });
      Alert.alert("Couldn't delete this job. Try again.");
    } finally {
      editSavingRef.current = false;
      setEditSaving(false);
    }
  }, [invalidateJobsList, job, leaveEditMode, onRequestClose]);

  /** Spinner state: same canvas background as main screen so the transition does not flash a flat color. */
  if (!fontsLoaded || (supabaseReady && jobLoading)) {
    return (
      <View testID="job-detail-loading" style={styles.loading}>
        <CanvasTiledBackground scrollY={scrollY} />
        <ActivityIndicator
          accessibilityLabel={!fontsLoaded ? 'Loading fonts' : 'Loading job'}
        />
      </View>
    );
  }

  if (supabaseReady && !job) {
    const headerTopPad = Math.max(insets.top - space('Spacing/8'), 0);
    return (
      <View style={styles.root}>
        <CanvasTiledBackground scrollY={scrollY} />
        {onRequestClose ? (
          <View
            style={[
              styles.topHeader,
              styles.topHeaderModal,
              columnStyle,
              { paddingTop: headerTopPad + space('Spacing/4') },
            ]}
          >
            <View style={styles.topHeaderRow}>
              <View style={styles.closeChromeOffset}>
                <PlatformHeaderAction accessibilityLabel="Close" onPress={onClose}>
                  <JobDetailIconTopClose color={fg.primary} />
                </PlatformHeaderAction>
              </View>
            </View>
          </View>
        ) : null}
        <View style={[styles.errorBody, columnStyle]}>
          {__DEV__ ? (
            <Text
              style={[
                typography.bodySmall,
                {
                  color: fg.muted,
                  paddingHorizontal: space('Spacing/20'),
                  textAlign: 'center',
                  marginBottom: space('Spacing/12'),
                },
              ]}
            >
              {sessionEmail ?? '(no email)'} · API {supabaseApiHostLabel()}
            </Text>
          ) : null}
          <Text
            style={[
              typography.body,
              { color: fg.primary, paddingHorizontal: space('Spacing/20'), textAlign: 'center' },
            ]}
          >
            {jobLoadError ?? 'Unable to load job.'}
          </Text>
        </View>
      </View>
    );
  }

  if (!job) {
    return (
      <View testID="job-detail-loading" style={styles.loading}>
        <CanvasTiledBackground scrollY={scrollY} />
        <ActivityIndicator accessibilityLabel="Loading job" />
      </View>
    );
  }

  /** Bottom inset for modal presentation (no shell tab bar). */
  const bottomInset = insets.bottom;
  /** Match tab screens: minimal inset under the status bar (modal — no double padding). */
  const headerTopPad = Math.max(insets.top - space('Spacing/8'), 0);
  const simplifiedView = useFullscreenEdit;
  const incompletePills = incompletePillsForJobDetail(job);
  const viewBodyOpacity = simplifiedView
    ? modeProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] })
    : 1;
  const editBodyOpacity = simplifiedView
    ? modeProgress
    : 0;
  const editDoneDisabled = !editApi.validation.canDone || editSaving;
  const wizardRemainingGaps =
    markCompleteWizardActive && financialCompletenessCtx
      ? financialCompletenessGaps(financialCompletenessCtx)
      : [];
  const editCommitLabel =
    markCompleteWizardActive && detailMode === 'edit' && wizardRemainingGaps.length > 1
      ? 'Next'
      : 'Done';

  const customerContactActions = buildCustomerContactActions(
    job.customerPhone,
    job.customerEmail,
  );
  const contactCustomerButton =
    customerContactActions.length > 0 ? (
      <PlatformHeaderAction
        accessibilityLabel="Contact customer"
        onPress={() => showCustomerContactMenu(job.customerPhone, job.customerEmail)}
      >
        <EditIconPerson color={fg.primary} />
      </PlatformHeaderAction>
    ) : null;

  const sharedTopHeader = (
    <View style={styles.sharedTopHeader}>
      <PlatformHeaderAction
        accessibilityLabel="Close"
        onPress={
          detailMode === 'edit'
            ? () => editApi.requestBack(onBackFromEdit)
            : onClose
        }
        disabled={detailMode === 'edit' && editSaving}
        style={detailMode === 'edit' && editSaving ? styles.controlDisabled : undefined}
      >
        <JobDetailIconTopClose color={fg.primary} />
      </PlatformHeaderAction>
      {detailMode === 'edit' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={editCommitLabel}
          disabled={editDoneDisabled}
          onPress={() => {
            editApi.requestDone(() => {
              void onDoneFromEdit();
            });
          }}
          style={({ pressed }) => [
            styles.doneButton,
            editDoneDisabled && styles.doneButtonDisabled,
            pressed && !editDoneDisabled && styles.pressed,
          ]}
        >
          {editSaving ? (
            <ActivityIndicator color={bg.canvasWarm} size="small" />
          ) : (
            <Text style={[typography.pillCompact, styles.actionButtonLabelOnDark]}>
              {editCommitLabel}
            </Text>
          )}
        </Pressable>
      ) : (
        <View style={styles.headerActionRow}>
          {contactCustomerButton}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit job"
            onPress={onEdit}
            style={({ pressed }) => [styles.editButton, pressed && styles.pressed, styles.editButtonShared]}
          >
            <JobDetailIconTopEdit color={bg.canvasWarm} />
            <Text style={[typography.pillCompact, styles.actionButtonLabelOnDark]}>EDIT</Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  const viewScrollPaddingTop = simplifiedView
    ? space('Spacing/8')
    : Math.max(headerTopPad + space('Spacing/4') - space('Spacing/24'), 0) + 48;

  const viewColumn = (
    <View style={columnStyle}>
      {simplifiedView ? null : (
        <View style={[styles.topHeader, styles.topHeaderModal]}>
          <View style={styles.topHeaderRow}>
            <View style={styles.closeChromeOffset}>
              <PlatformHeaderAction accessibilityLabel="Close" onPress={onClose}>
                <JobDetailIconTopClose color={fg.primary} />
              </PlatformHeaderAction>
            </View>
            <View style={styles.headerActionRow}>
              {contactCustomerButton}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit job"
                onPress={onEdit}
                style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
              >
                <JobDetailIconTopEdit color={bg.canvasWarm} />
                <Text style={[typography.pillCompact, styles.actionButtonLabelOnDark]}>EDIT</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      <View style={styles.slot}>
        <JobDetailJobHeader
          title={job.shortDescription}
          longDescription={job.longDescription}
          customerName={job.customerName}
          customerPhone={job.customerPhone}
          customerEmail={job.customerEmail}
          serviceAddress={job.serviceAddress}
          lastWorkedLabel={job.lastWorkedLabel}
          workStatus={job.workStatus}
          typography={typography}
          onTitlePress={
            simplifiedView
              ? () => openEditFromView('title', 'view_row')
              : undefined
          }
          onCustomerPress={
            simplifiedView
              ? () => openEditFromView('customer', 'customer')
              : undefined
          }
        />
        <JobDetailSummaryCard
          earnings={job.earnings}
          typography={typography}
          noRevenueConfirmed={job.noRevenueConfirmed}
          onPress={simplifiedView ? () => openEditFromView('metrics', 'view_row') : undefined}
        />
        <JobDetailCtaRow
          workStatus={job.workStatus}
          typography={typography}
          onPrimaryPress={() => {
            void onPrimaryStatusCta();
          }}
          onMorePress={openStatusSheet}
          MoreIcon={<JobDetailIconCtaMore color={fg.primary} />}
          primaryDisabled={statusActionPending}
          moreDisabled={statusActionPending}
        />
        {simplifiedView && incompletePills.length > 0 ? (
          <Text style={[typography.bodySmall, styles.incompleteReasons]}>
            {`Missing: ${incompletePills.join(', ')}`}
          </Text>
        ) : null}
        <JobDetailMetricTertiary
          metrics={job.metrics}
          netEarningsCents={job.earnings.netEarningsCents}
          typography={typography}
        />
      </View>

      <SectionHeaderFigma
        title="Sessions"
        typography={typography}
        showAdd={!simplifiedView}
        onAddPress={openSessionChooser}
        trailing={
          simplifiedView &&
          !liveSessionCtx.hasLiveSession &&
          !job.inProgressSession ? (
            <LiveSessionStartTile
              typography={typography}
              onPress={() => void onStartLiveSession()}
            />
          ) : null
        }
      />
      <View style={styles.sessionList}>
        {visibleSessions.length === 0 ? (
          <SectionEmptyStateCard
            message="No sessions recorded"
            typography={typography}
            onPress={
              simplifiedView
                ? () => openEditFromView('sessions', 'view_empty')
                : undefined
            }
          />
        ) : simplifiedView ? (
          <ViewSessionsBuckets
            sessions={visibleSessions}
            typography={typography}
            emphasizeCriticalEmpty
            onCardPress={() => openEditFromView('sessions', 'view_row')}
            onDeleteSession={onDeleteSessionFromView}
          />
        ) : (
          visibleSessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              typography={typography}
              expanded={expandedSessionId === s.id}
              onToggle={() =>
                setExpandedSessionId((prev) => (prev === s.id ? null : s.id))
              }
              onEditPress={() => openEditSession(s.id)}
              onAddNote={() => openAddNoteForSession(s.id)}
              onAddMaterial={() => openAddMaterialForSession(s.id)}
              onPressAttachment={({ kind, id }) => {
                if (kind === 'note') {
                  openEditNote(id);
                } else {
                  openEditMaterial(id);
                }
              }}
            />
          ))
        )}
      </View>

      <SectionHeaderFigma
        title="Materials"
        typography={typography}
        showAdd={!simplifiedView}
        onAddPress={openAddMaterial}
      />
      {job.materialBuckets.length === 0 ? (
        simplifiedView ? (
          <SectionEmptyStateCard
            message={
              job.noMaterialsConfirmed
                ? 'No materials confirmed'
                : 'No materials recorded'
            }
            typography={typography}
            onPress={() => openEditFromView('materials', 'view_empty')}
          />
        ) : job.noMaterialsConfirmed ? (
          <MaterialsConfirmedNoUseCard
            typography={typography}
            onUndo={onUndoNoMaterialsUsed}
            undoDisabled={noMaterialsSaving}
          />
        ) : (
          <MaterialsEmptyStateCard
            typography={typography}
            onConfirmNoMaterials={onConfirmNoMaterialsUsed}
            confirmDisabled={noMaterialsSaving}
          />
        )
      ) : (
        <ViewMaterialsBuckets
          buckets={job.materialBuckets}
          typography={typography}
          emphasizeCriticalEmpty={simplifiedView}
          onCardPress={
            simplifiedView ? () => openEditFromView('materials', 'view_row') : undefined
          }
          onDeleteMaterial={simplifiedView ? onDeleteMaterialFromView : undefined}
          onMaterialPress={
            simplifiedView
              ? undefined
              : (materialId) => {
                  openEditMaterial(materialId);
                }
          }
        />
      )}

      <SectionHeaderFigma
        title="Other Costs"
        typography={typography}
        showAdd={!simplifiedView}
        onAddPress={openAddOtherCost}
      />
      {job.otherCostBuckets.length === 0 ? (
        simplifiedView ? (
          <SectionEmptyStateCard
            message={
              job.noOtherCostsConfirmed
                ? 'No other costs confirmed'
                : 'No other costs recorded'
            }
            typography={typography}
            onPress={() => openEditFromView('otherCosts', 'view_empty')}
          />
        ) : job.noOtherCostsConfirmed ? (
          <OtherCostsConfirmedNoUseCard
            typography={typography}
            onUndo={onUndoNoOtherCosts}
          />
        ) : (
          <OtherCostsEmptyStateCard
            typography={typography}
            onConfirmNoOtherCosts={onConfirmNoOtherCosts}
          />
        )
      ) : (
        <ViewOtherCostsBuckets
          buckets={job.otherCostBuckets}
          typography={typography}
          emphasizeCriticalEmpty={simplifiedView}
          onCardPress={
            simplifiedView ? () => openEditFromView('otherCosts', 'view_row') : undefined
          }
          onDeleteOtherCost={simplifiedView ? onDeleteOtherCostFromView : undefined}
          onOtherCostPress={
            simplifiedView
              ? undefined
              : (otherCostId) => {
                  openEditOtherCost(otherCostId);
                }
          }
        />
      )}

      <SectionHeaderFigma
        title="Notes"
        typography={typography}
        showAdd={!simplifiedView}
        onAddPress={openAddNote}
      />
      {job.noteBuckets.length === 0 ? (
        <SectionEmptyStateCard
          message="No notes recorded"
          typography={typography}
          onPress={
            simplifiedView ? () => openEditFromView('notes', 'view_empty') : undefined
          }
        />
      ) : (
        <ViewNotesBuckets
          buckets={job.noteBuckets}
          typography={typography}
          readOnlyExpand={simplifiedView}
          onCardPress={
            simplifiedView ? () => openEditFromView('notes', 'view_row') : undefined
          }
          onDeleteNote={simplifiedView ? onDeleteNoteFromView : undefined}
          onNotePress={simplifiedView ? undefined : openEditNote}
          showNoteIcon={false}
        />
      )}
    </View>
  );

  const viewScroll = (
    <GHScrollView
      waitFor={scrollAtTop ? jobDetailPanRef : undefined}
      style={[styles.scroll, styles.scrollTransparent]}
      onScroll={onJobDetailScroll}
      onContentSizeChange={(_w, h) => setScrollContentHeight(h)}
      scrollEventThrottle={16}
      onScrollEndDrag={onScrollEndDragDismiss}
      bounces={!!onRequestClose}
      overScrollMode="never"
      nestedScrollEnabled
      contentContainerStyle={{
        width: '100%',
        paddingTop: viewScrollPaddingTop,
        paddingBottom: space('Spacing/20') + bottomInset,
        alignItems: 'stretch',
      }}
      keyboardShouldPersistTaps="handled"
    >
      {viewColumn}
    </GHScrollView>
  );

  return (
    <PanGestureHandler
      ref={jobDetailPanRef}
      enabled={!!onRequestClose && scrollAtTop && detailMode === 'view'}
      activeOffsetY={10}
      failOffsetY={-5}
      failOffsetX={[-24, 24]}
      onGestureEvent={onJobDetailPanGestureEvent}
      onHandlerStateChange={onJobDetailPanStateChange}
    >
    <Animated.View
      testID="job-detail-screen"
      style={[
        styles.root,
        {
          opacity: dismissOpacity,
          transform: [{ translateY: dismissY }],
        },
      ]}
    >
      {/* Lined canvas + cream fill — behind all scroll content. Sized to
          the scrollable content height so the ruled texture doesn't cut
          off on long screens. */}
      <CanvasTiledBackground
        scrollY={scrollY}
        contentHeight={scrollContentHeight}
      />
      {simplifiedView ? (
        <View style={styles.fullscreenEditHost} collapsable={false}>
          <View
            style={[
              styles.sharedHeaderWrap,
              columnStyle,
              { paddingTop: headerTopPad + space('Spacing/4') },
            ]}
          >
            {sharedTopHeader}
          </View>
          <View style={styles.bodyHost} collapsable={false}>
            <Animated.View
              style={[
                detailMode === 'view' ? styles.bodyInFlow : styles.bodyInactive,
                { opacity: viewBodyOpacity },
              ]}
              pointerEvents={detailMode === 'view' ? 'auto' : 'none'}
              collapsable={false}
            >
              {viewScroll}
            </Animated.View>
            <Animated.View
              style={[
                detailMode === 'edit' ? styles.bodyInFlow : styles.bodyInactive,
                { opacity: editBodyOpacity },
              ]}
              pointerEvents={detailMode === 'edit' ? 'auto' : 'none'}
              collapsable={false}
            >
              <JobDetailEditMode
                job={job}
                typography={typography}
                headerTopPad={headerTopPad}
                bottomInset={bottomInset}
                columnStyle={columnStyle}
                saving={editSaving}
                hideHeader
                active={detailMode === 'edit'}
                focusTarget={editFocusTarget}
                onBack={onBackFromEdit}
                onDone={() => {
                  void onDoneFromEdit();
                }}
                onDeleteJob={() => {
                  void onDeleteJobFromEdit();
                }}
                editApi={editApi}
                supabase={supabase}
              />
            </Animated.View>
          </View>
        </View>
      ) : detailMode === 'edit' ? (
        <JobDetailEditMode
          job={job}
          typography={typography}
          headerTopPad={headerTopPad}
          bottomInset={bottomInset}
          columnStyle={columnStyle}
          saving={editSaving}
          onBack={onBackFromEdit}
          onDone={() => {
            void onDoneFromEdit();
          }}
          onDeleteJob={() => {
            void onDeleteJobFromEdit();
          }}
          editApi={editApi}
          supabase={supabase}
        />
      ) : (
        viewScroll
      )}

      {editSheetMounted ? (
        <EditJobBottomSheet
          typography={typography}
          values={job ? toEditValues(job) : undefined}
          supabase={supabase}
          revenueError={editJobRevenueError}
          visible={editSheetVisible}
          onClose={onCloseEditSheet}
          onClosed={() => setEditSheetMounted(false)}
          onSavePress={onSaveJobSheet}
          onDeletePress={() => {
            void onDeleteJobSheet();
          }}
        />
      ) : null}
      {statusSheetMounted ? (
        <DropdownBottomSheet
          typography={typography}
          visible={statusSheetVisible}
          options={jobStatusSheetOptions}
          currentValue={job?.workStatus ?? null}
          allowCustom={false}
          onClose={closeStatusSheet}
          onClosed={() => {
            setStatusSheetMounted(false);
          }}
          onSelect={(value) => {
            void onSelectJobStatusFromSheet(value);
          }}
        />
      ) : null}
      {noteSheetMounted ? (
        <>
          <EditNoteBottomSheet
            typography={typography}
            visible={noteFlow === 'addNote' || noteFlow === 'editNote'}
            // Derive stable title/primaryLabel from editingNoteId (not noteFlow)
            // so they do not flicker during the slide-down close animation.
            title={editingNoteId ? 'Edit Note' : 'Add Note'}
            primaryLabel={editingNoteId ? 'SAVE CHANGES' : 'SAVE NEW NOTE'}
            values={{ body: draftBody }}
            assignedSession={draftAssignedSession}
            canAttachSession={chooserSessions.length > 0}
            onClose={closeNoteFlow}
            onClosed={() => {
              if (noteFlow === 'closed') setNoteSheetMounted(false);
            }}
            onBack={closeNoteFlow}
            onSavePress={(values) => {
              if (noteSaving) return;
              if (editingNoteId) {
                void onSaveNoteChanges(values);
              } else {
                void onSaveNewNote(values);
              }
            }}
            onDeletePress={() => {
              if (noteSaving) return;
              void onDeleteEditingNote();
            }}
            onSessionPillPress={(values) => {
              // Lift the typed body into parent draft state before swapping
              // to the session picker — the note sheet is hidden (and its
              // local state reseeded from `values.body`) on return, so
              // without this cache the typed body would reset.
              setDraftBody(values.body);
              openSessionPickerFromNoteSheet();
            }}
          />
          <ChooseSessionBottomSheet
            typography={typography}
            visible={noteFlow === 'attachSession' || noteFlow === 'editSession'}
            mode={noteFlow === 'editSession' ? 'edit' : 'attach'}
            sessions={chooserSessions}
            currentSessionId={draftSessionId}
            onClose={closeNoteFlow}
            onClosed={() => {
              if (noteFlow === 'closed') setNoteSheetMounted(false);
            }}
            onBack={returnToNoteSheet}
            onSelect={onSelectDraftSession}
            onRemove={onRemoveDraftSession}
          />
        </>
      ) : null}
      {materialSheetMounted ? (
        <>
          <EditMaterialBottomSheet
            typography={typography}
            visible={materialFlow === 'addMaterial' || materialFlow === 'editMaterial'}
            // Derive stable title/primaryLabel from editingMaterialId (not
            // materialFlow) so they do not flicker during the slide-down.
            title={editingMaterialId ? 'Edit Material' : 'Add Material'}
            primaryLabel={editingMaterialId ? 'SAVE CHANGES' : 'SAVE NEW MATERIAL'}
            values={{
              description: matDraftDescription,
              unitCostCents: matDraftUnitCostCents,
              quantity: matDraftQuantity,
              unit: matDraftUnit,
            }}
            assignedSession={matDraftAssignedSession}
            canAttachSession={chooserSessions.length > 0}
            onClose={closeMaterialFlow}
            onClosed={() => {
              if (materialFlow === 'closed') setMaterialSheetMounted(false);
            }}
            onBack={closeMaterialFlow}
            onSavePress={(values) => {
              if (materialSaving) return;
              // Capture the latest draft values so a subsequent open of the
              // same sheet (e.g. after re-picking session) shows them.
              setMatDraftDescription(values.description);
              setMatDraftUnitCostCents(values.unitCostCents);
              setMatDraftQuantity(values.quantity);
              setMatDraftUnit(values.unit);
              if (editingMaterialId) {
                void onSaveMaterialChanges(values);
              } else {
                void onSaveNewMaterial(values);
              }
            }}
            onDeletePress={() => {
              if (materialSaving) return;
              void onDeleteEditingMaterial();
            }}
            onSessionPillPress={(values) => {
              // Lift the in-sheet text edits into parent draft state before
              // swapping to the session picker — the material sheet is
              // hidden (and its local state reseeded from `values`) on
              // return, so without this cache the inputs would reset.
              setMatDraftDescription(values.description);
              setMatDraftUnitCostCents(values.unitCostCents);
              setMatDraftQuantity(values.quantity);
              setMatDraftUnit(values.unit);
              openSessionPickerFromMaterialSheet();
            }}
            onUnitPress={(values) => {
              // Same lift pattern as the session pill — without this the
              // description / price / qty reset when returning from the
              // unit picker.
              setMatDraftDescription(values.description);
              setMatDraftUnitCostCents(values.unitCostCents);
              setMatDraftQuantity(values.quantity);
              setMatDraftUnit(values.unit);
              openUnitPickerFromMaterialSheet();
            }}
            materialError={materialWizardError}
            noneConfirmLabel={
              materialWizardMode && !useFullscreenEdit
                ? 'CONFIRM NO MATERIALS USED'
                : undefined
            }
            onNoneConfirmPress={
              materialWizardMode && !useFullscreenEdit
                ? () => {
                    void onConfirmNoMaterialsFromWizard();
                  }
                : undefined
            }
          />
          <ChooseSessionBottomSheet
            typography={typography}
            visible={
              materialFlow === 'attachSession' || materialFlow === 'editSession'
            }
            mode={materialFlow === 'editSession' ? 'edit' : 'attach'}
            sessions={chooserSessions}
            currentSessionId={matDraftSessionId}
            onClose={closeMaterialFlow}
            onClosed={() => {
              if (materialFlow === 'closed') setMaterialSheetMounted(false);
            }}
            onBack={returnToMaterialSheet}
            onSelect={onSelectMaterialSession}
            onRemove={onRemoveMaterialSession}
          />
          <DropdownBottomSheet
            typography={typography}
            visible={materialFlow === 'chooseUnit'}
            options={unitOptions}
            currentValue={matDraftUnit}
            allowCustom
            customPlaceholder="Custom"
            onClose={closeMaterialFlow}
            onClosed={() => {
              if (materialFlow === 'closed') setMaterialSheetMounted(false);
            }}
            onBack={returnToMaterialSheet}
            onSelect={onSelectMaterialUnit}
          />
        </>
      ) : null}
      {sessionSheetMounted ? (
        <>
          <NewSessionBottomSheet
            typography={typography}
            visible={sessionFlow === 'chooser'}
            onClose={closeSessionFlow}
            onClosed={() => {
              if (sessionFlow === 'closed') setSessionSheetMounted(false);
            }}
            onLiveSessionPress={() => void onStartLiveSession()}
            onLogPastPress={openAddSession}
          />
          <EditSessionBottomSheet
            typography={typography}
            visible={sessionFlow === 'addForm' || sessionFlow === 'editForm'}
            // Derive mode from editingSessionId (not sessionFlow) so the title /
            // primary label stay stable during the slide-down close animation,
            // where sessionFlow has already flipped to 'closed'.
            title={editingSessionId ? 'Edit Session' : 'Add Session'}
            primaryLabel={editingSessionId ? 'SAVE CHANGES' : 'SAVE NEW SESSION'}
            sessionError={sessionWizardBanner}
            values={
              editingSessionId && editingSession
                ? {
                    startedAt: editingSession.startedAt,
                    endedAt:
                      editingSession.endedAt ?? editingSession.startedAt,
                  }
                : undefined
            }
            onClose={closeSessionFlow}
            onClosed={() => {
              if (sessionFlow === 'closed') setSessionSheetMounted(false);
            }}
            onBack={() => {
              if (sessionFlow === 'addForm') {
                setSessionFlow('chooser');
              } else {
                closeSessionFlow();
              }
            }}
            onSavePress={(values) => {
              if (sessionSaving) return;
              if (sessionFlow === 'editForm') {
                void onSaveSessionChanges(values);
              } else {
                void onSaveNewSession(values);
              }
            }}
            onDeletePress={() => {
              if (sessionSaving) return;
              if (sessionFlow === 'editForm') {
                void onDeleteEditingSession();
              } else {
                closeSessionFlow();
              }
            }}
          />
        </>
      ) : null}
      {otherCostSheetMounted ? (
        <>
          <EditOtherCostBottomSheet
            typography={typography}
            visible={
              otherCostFlow === 'addOtherCost' || otherCostFlow === 'editOtherCost'
            }
            title={editingOtherCostId ? 'Edit Other Cost' : 'Add Other Cost'}
            primaryLabel={editingOtherCostId ? 'SAVE CHANGES' : 'SAVE NEW COST'}
            values={{
              costType: ocDraftCostType,
              costCents: ocDraftCostCents,
              description: ocDraftDescription,
            }}
            assignedSession={ocDraftAssignedSession}
            canAttachSession={chooserSessions.length > 0}
            otherCostError={otherCostWizardError}
            noneConfirmLabel={
              otherCostWizardMode && !useFullscreenEdit
                ? 'CONFIRM NO OTHER COSTS'
                : undefined
            }
            onNoneConfirmPress={
              otherCostWizardMode && !useFullscreenEdit
                ? onConfirmNoOtherCostsFromWizard
                : undefined
            }
            onClose={closeOtherCostFlow}
            onClosed={() => {
              if (otherCostFlow === 'closed') setOtherCostSheetMounted(false);
            }}
            onBack={closeOtherCostFlow}
            onSavePress={(values) => {
              setOcDraftCostType(values.costType);
              setOcDraftCostCents(values.costCents);
              setOcDraftDescription(values.description);
              if (editingOtherCostId) {
                onSaveOtherCostChanges(values);
              } else {
                onSaveNewOtherCost(values);
              }
            }}
            onDeletePress={onDeleteEditingOtherCost}
            onSessionPillPress={(values) => {
              setOcDraftCostType(values.costType);
              setOcDraftCostCents(values.costCents);
              setOcDraftDescription(values.description);
              openSessionPickerFromOtherCostSheet();
            }}
            onCostTypePress={(values) => {
              setOcDraftCostType(values.costType);
              setOcDraftCostCents(values.costCents);
              setOcDraftDescription(values.description);
              openCostTypePickerFromOtherCostSheet();
            }}
          />
          <ChooseSessionBottomSheet
            typography={typography}
            visible={
              otherCostFlow === 'attachSession' || otherCostFlow === 'editSession'
            }
            mode={otherCostFlow === 'editSession' ? 'edit' : 'attach'}
            sessions={chooserSessions}
            currentSessionId={ocDraftSessionId}
            onClose={closeOtherCostFlow}
            onClosed={() => {
              if (otherCostFlow === 'closed') setOtherCostSheetMounted(false);
            }}
            onBack={returnToOtherCostSheet}
            onSelect={onSelectOtherCostSession}
            onRemove={onRemoveOtherCostSession}
          />
          <DropdownBottomSheet
            typography={typography}
            visible={otherCostFlow === 'chooseCostType'}
            options={costTypeOptions}
            currentValue={ocDraftCostType}
            allowCustom={false}
            onClose={closeOtherCostFlow}
            onClosed={() => {
              if (otherCostFlow === 'closed') setOtherCostSheetMounted(false);
            }}
            onBack={returnToOtherCostSheet}
            onSelect={onSelectOtherCostType}
          />
        </>
      ) : null}
      {minimumInfoGateMounted ? (
        <ConfirmMinimumInfoBottomSheet
          typography={typography}
          visible={minimumInfoGateVisible}
          onClose={closeMinimumInfoGate}
          onClosed={() => {
            if (!minimumInfoGateVisible) setMinimumInfoGateMounted(false);
          }}
          onConfirmPress={onConfirmMinimumInfo}
        />
      ) : null}
    </Animated.View>
    </PanGestureHandler>
  );
}

// --- Section empty states (Figma `787:73`, `787:97`) ---

function SectionEmptyStateCard({
  message,
  typography,
  onPress,
}: {
  message: string;
  typography: TextStyles;
  onPress?: () => void;
}) {
  const label = (
    <Text style={[typography.body, { color: fg.secondary, textAlign: 'center' }]}>{message}</Text>
  );
  return (
    <View style={styles.viewCardOuter}>
      {onPress ? (
        // Elevation stays on the outer lift — Android paints a gray slab when
        // opacity/ripple is applied to the same view that owns elevation.
        <View style={[styles.sectionEmptyCardLift, cardShadowRn]}>
          <Pressable
            accessibilityRole="button"
            onPress={onPress}
            android_ripple={{
              color: colorWithAlpha('Foundation/Text/Primary', 0.08),
              borderless: false,
            }}
            style={({ pressed }) => [
              styles.viewCardBorder,
              styles.sectionEmptyCardPad,
              Platform.OS === 'ios' && pressed && styles.pressed,
            ]}
          >
            {label}
          </Pressable>
        </View>
      ) : (
        <View style={[styles.viewCardBorder, cardShadowRn, styles.sectionEmptyCardPad]}>{label}</View>
      )}
    </View>
  );
}

function MaterialsEmptyStateCard({
  typography,
  onConfirmNoMaterials,
  confirmDisabled,
}: {
  typography: TextStyles;
  onConfirmNoMaterials: () => void;
  confirmDisabled?: boolean;
}) {
  const ctaColor = color('Foundation/Surface/White');
  return (
    <View style={styles.viewCardOuter}>
      <View style={[styles.viewCardBorder, cardShadowRn, styles.materialsEmptyCardPad]}>
        <Text style={[typography.body, { color: fg.secondary, textAlign: 'center' }]}>
          No materials recorded
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Confirm no materials used"
          onPress={onConfirmNoMaterials}
          disabled={confirmDisabled}
          style={({ pressed }) => [
            styles.materialsConfirmCta,
            pressed && !confirmDisabled && styles.pressed,
            confirmDisabled ? { opacity: 0.5 } : null,
          ]}
        >
          <Text style={[typography.metricSLabel, styles.materialsConfirmCtaLabel, { color: ctaColor }]}>
            CONFIRM NO MATERIALS USED
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function MaterialsConfirmedNoUseCard({
  typography,
  onUndo,
  undoDisabled,
}: {
  typography: TextStyles;
  onUndo: () => void;
  undoDisabled?: boolean;
}) {
  const ok = color('Semantic/Status/Success/Text');
  return (
    <View style={styles.viewCardOuter}>
      <View style={[styles.viewCardBorder, cardShadowRn, styles.materialsEmptyCardPad]}>
        <Text style={[typography.bodyBold, { color: ok, textAlign: 'center' }]}>
          ✓ No materials used
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Undo no materials confirmation"
          onPress={onUndo}
          disabled={undoDisabled}
          style={({ pressed }) => [pressed && !undoDisabled && styles.pressed, undoDisabled ? { opacity: 0.5 } : null]}
        >
          <Text
            style={[
              typography.bodySmall,
              {
                color: fg.secondary,
                textDecorationLine: 'underline',
                textAlign: 'center',
                marginTop: space('Spacing/12'),
              },
            ]}
          >
            Undo
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function OtherCostsEmptyStateCard({
  typography,
  onConfirmNoOtherCosts,
  confirmDisabled,
}: {
  typography: TextStyles;
  onConfirmNoOtherCosts: () => void;
  confirmDisabled?: boolean;
}) {
  const ctaColor = color('Foundation/Surface/White');
  return (
    <View style={styles.viewCardOuter}>
      <View style={[styles.viewCardBorder, cardShadowRn, styles.materialsEmptyCardPad]}>
        <Text style={[typography.body, { color: fg.secondary, textAlign: 'center' }]}>
          No other costs recorded
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Confirm no other costs"
          onPress={onConfirmNoOtherCosts}
          disabled={confirmDisabled}
          style={({ pressed }) => [
            styles.materialsConfirmCta,
            pressed && !confirmDisabled && styles.pressed,
            confirmDisabled ? { opacity: 0.5 } : null,
          ]}
        >
          <Text style={[typography.metricSLabel, styles.materialsConfirmCtaLabel, { color: ctaColor }]}>
            CONFIRM NO OTHER COSTS
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function OtherCostsConfirmedNoUseCard({
  typography,
  onUndo,
  undoDisabled,
}: {
  typography: TextStyles;
  onUndo: () => void;
  undoDisabled?: boolean;
}) {
  const ok = color('Semantic/Status/Success/Text');
  return (
    <View style={styles.viewCardOuter}>
      <View style={[styles.viewCardBorder, cardShadowRn, styles.materialsEmptyCardPad]}>
        <Text style={[typography.bodyBold, { color: ok, textAlign: 'center' }]}>
          ✓ No other costs
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Undo no other costs confirmation"
          onPress={onUndo}
          disabled={undoDisabled}
          style={({ pressed }) => [pressed && !undoDisabled && styles.pressed, undoDisabled ? { opacity: 0.5 } : null]}
        >
          <Text
            style={[
              typography.bodySmall,
              {
                color: fg.secondary,
                textDecorationLine: 'underline',
                textAlign: 'center',
                marginTop: space('Spacing/12'),
              },
            ]}
          >
            Undo
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// --- Section header (Figma `371:2179` Row) ---

/** Section title; optional trailing ADD button or custom trailing control. */
function SectionHeaderFigma({
  title,
  typography,
  showAdd,
  onAddPress,
  trailing,
}: {
  title: string;
  typography: TextStyles;
  showAdd: boolean;
  onAddPress?: () => void;
  trailing?: ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLead}>
        <View style={styles.sectionHeaderTitleWrap}>
          <Text style={typography.titleH3}>{title}</Text>
        </View>
      </View>
      {trailing != null ? (
        trailing
      ) : showAdd ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Add ${title}`}
          onPress={onAddPress}
          disabled={!onAddPress}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
        >
          <JobDetailIconSectionAdd color={bg.canvasWarm} />
          <Text style={[typography.pillCompact, styles.actionButtonLabelOnDark]}>
            ADD
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// `ViewMaterialsBuckets` / `ViewNotesBuckets` and the `bucketSessionHeaderTitle`
// helper now live in `components/ds/ViewActivityBuckets` so the Inbox can reuse
// the same Job / session card + rows.

// Bottom chrome is the shell NativeTabs + PrimaryActionOverlay (Slack dock removed).

// -----------------------------------------------------------------------------
// Styles — grouped roughly top-to-bottom to match the component tree
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  /**
   * Screen root: one column. The ruled-line texture is painted by
   * `CanvasTiledBackground` layered above this root, but we also set
   * the cream fill here as a safety net — if the tiled layer ever lags
   * behind a layout change (e.g. content grew but `onContentSizeChange`
   * hasn't fired yet), users see the same cream colour instead of iOS's
   * default system background bleeding through.
   */
  root: { flex: 1, backgroundColor: bg.canvasWarm, overflow: 'visible' },
  /** Centered spinner over the same lined background as the loaded screen. */
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: bg.canvasWarm },
  errorBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space('Spacing/20'),
  },
  /** Scroll fills root; flex lets the fixed bottom nav sit in the same column without overlapping scroll height math incorrectly. */
  scroll: { flex: 1, zIndex: 1 },
  /** Default scroll content background can read as white on iOS; keep lines visible. */
  scrollTransparent: { backgroundColor: 'transparent' },
  /** Shared pressed state for `Pressable` opacity feedback. */
  pressed: { opacity: 0.75 },

  /**
   * Toolbar chrome only — no fill so `CanvasTiledBackground` (sibling under `ScrollView`) shows the same
   * cream + ruled lines here as in the body. Shadow still separates the header band from content below.
   */
  topHeader: {
    width: '100%',
    alignSelf: 'center',
    backgroundColor: 'transparent',
    paddingTop: space('Spacing/12'),
  },
  /** Modal uses safe-area padding on the scroll container — no extra header inset. */
  topHeaderModal: {
    paddingTop: 0,
  },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    paddingBottom: space('Spacing/4'),
  },
  closeChromeOffset: {
    transform: [{ translateY: -space('Spacing/12') }],
  },
  editButton: {
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
    marginTop: space('Spacing/12'),
    ...cardShadowRn,
  },
  editButtonShared: {
    marginTop: 0,
  },
  headerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space('Spacing/8'),
  },
  sharedTopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space('Spacing/4'),
    width: '100%',
  },
  sharedHeaderWrap: {
    width: '100%',
    alignSelf: 'center',
  },
  fullscreenEditHost: {
    flex: 1,
    zIndex: 1,
  },
  bodyHost: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  bodyInFlow: {
    flex: 1,
    zIndex: 2,
    ...(Platform.OS === 'android' ? { elevation: 2 } : null),
  },
  /** Inactive crossfade pane — overlay so it does not stack and split height. */
  bodyInactive: {
    ...StyleSheet.absoluteFill,
    elevation: 0,
    zIndex: 0,
  },
  doneButton: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: space('Spacing/16'),
    paddingVertical: space('Spacing/8'),
    borderRadius: radius('Radius/12'),
    backgroundColor: color('Brand/Primary'),
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadowRn,
  },
  doneButtonDisabled: {
    opacity: 0.45,
  },
  controlDisabled: {
    opacity: 0.45,
  },
  incompleteReasons: {
    color: color('Semantic/Status/Error/Text'),
    width: '100%',
  },
  actionButtonLabel: {
    color: fg.primary,
  },
  actionButtonLabelOnDark: {
    color: bg.canvasWarm,
  },

  /** Hero block: job header, summary, CTAs, metric card — width from parent column. */
  slot: {
    width: '100%',
    paddingHorizontal: 0,
    gap: SLOT_GAP,
    alignItems: 'center',
  },

  /** Section title + optional ADD — horizontal inset from parent column. */
  sectionHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: space('Spacing/24'),
    paddingBottom: space('Spacing/12'),
    paddingHorizontal: 0,
  },
  sectionHeaderLead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space('Spacing/8'),
    flex: 1,
    minWidth: 0,
  },
  sectionHeaderTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  addButton: {
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

  /** Column wrapper for the Sessions list — caps to DS content width. */
  sessionList: {
    width: '100%',
  },

  sectionEmptyCardPad: {
    paddingVertical: space('Spacing/20'),
    paddingHorizontal: space('Spacing/16'),
    alignItems: 'center',
  },
  materialsEmptyCardPad: {
    paddingVertical: space('Spacing/20'),
    paddingHorizontal: space('Spacing/16'),
    alignItems: 'center',
    gap: space('Spacing/16'),
  },
  materialsConfirmCta: {
    ...cardShadowRn,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: space('Spacing/12'),
    paddingHorizontal: space('Spacing/16'),
    borderRadius: radius('Radius/12'),
    backgroundColor: color('Semantic/Status/Success/Text'),
  },
  materialsConfirmCtaLabel: {
    textAlign: 'center',
  },

  /** Bottom breathing room below materials/notes cards; top aligns with Sessions (no extra pad). */
  viewCardOuter: {
    width: '100%',
    paddingBottom: space('Spacing/8'),
  },
  /** Owns card elevation so Pressable opacity/ripple never sit on an elevated surface. */
  sectionEmptyCardLift: {
    width: '100%',
    borderRadius: radius('Radius/16'),
    backgroundColor: bg.surfaceWhite,
  },
  /** Single surface: rounded rect, clip children so bucket headers respect corner radius. */
  viewCardBorder: {
    borderRadius: radius('Radius/16'),
    borderWidth: 1,
    borderColor: border.subtle,
    backgroundColor: bg.surfaceWhite,
    overflow: 'hidden',
  },
});
