import { useFonts } from 'expo-font';
import {
  fieldsoloExpoFontAssets,
  fieldsoloLoadedFonts,
} from '@fieldsolo/design-system/expo/loadFieldSoloFonts';
import {
  createBlankJobForLiveSessionStart,
  createMaterial,
  createNote,
  deleteJobById,
  listRecentJobsForCurrentUser,
  tryBumpJobToInProgressIfNotStarted,
  type RecentJobItem,
} from '@fieldsolo/api-client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Alert, Modal, Platform, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import {
  CaptureComposerSheet,
  DropdownBottomSheet,
  EditMaterialBottomSheet,
  EditNoteBottomSheet,
  type CaptureComposerMaterialValues,
  type CaptureComposerNoteValues,
  type EditMaterialBottomSheetValues,
  type EditNoteBottomSheetValues,
} from '../components/ds';
import {
  QuickActionsBottomSheet,
  type QuickActionsStep,
} from '../components/ds/QuickActionsBottomSheet';
import type { PrimaryActionMenuItemId } from '../components/platform/PlatformPrimaryAction';
import { useJobsListInvalidation } from '../context/JobsListInvalidationContext';
import { useHasLiveSession, useLiveSession } from '../context/LiveSessionContext';
import {
  analytics,
  errorProperties,
  moneyBucket,
  quantityBucket,
  textLengthBucket,
} from '../lib/analytics';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { createTextStyles } from '../theme/nativeTokens';
import {
  CAPTURE_UNIT_OPTIONS,
  formatCaptureError,
  formatLiveSessionJobTitle,
  type CaptureStep,
} from './quickActionsFlowHelpers';

type QuickCaptureKind = 'note' | 'material';
type CaptureMode = 'inbox' | 'job';

type QuickActionsFlowContextValue = {
  handlePrimaryAction: (id: PrimaryActionMenuItemId) => void;
  creatingJob: boolean;
  /** True while inbox note/material capture UI is open. */
  quickActionsVisible: boolean;
};

const QuickActionsFlowContext = createContext<QuickActionsFlowContextValue | null>(null);

export type QuickActionsFlowProviderProps = {
  children: ReactNode;
  onCreateJob: () => Promise<unknown>;
  /** Called after a quick note/material is saved so the underlying screen can refresh. */
  onQuickCaptureSaved?: (info: { mode: CaptureMode; jobId: string | null }) => void;
  /** Enables the Phase 3 composer, quick-material, and direct-live-session flows. */
  phase3Enabled?: boolean;
};

export function QuickActionsFlowProvider({
  children,
  onCreateJob,
  onQuickCaptureSaved,
  phase3Enabled = false,
}: QuickActionsFlowProviderProps) {
  const hasLiveSession = useHasLiveSession();
  const { startLiveSession, refresh: refreshLiveSession } = useLiveSession();
  const { invalidateJobsList } = useJobsListInvalidation();

  const [starting, setStarting] = useState(false);
  const [creatingJob, setCreatingJob] = useState(false);
  const creatingJobRef = useRef(false);
  const startingRef = useRef(false);

  const [captureStep, setCaptureStep] = useState<CaptureStep>('idle');
  const [captureKind, setCaptureKind] = useState<QuickCaptureKind>('note');
  const [captureSaving, setCaptureSaving] = useState(false);
  const [legacyQuickActionsVisible, setLegacyQuickActionsVisible] = useState(false);
  const [legacyStep, setLegacyStep] = useState<QuickActionsStep>('chooseJob');
  const [recentJobs, setRecentJobs] = useState<RecentJobItem[]>([]);
  const [recentJobsLoading, setRecentJobsLoading] = useState(false);
  const [recentJobsError, setRecentJobsError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [draftBody, setDraftBody] = useState('');
  const [matDraftDescription, setMatDraftDescription] = useState('');
  const [matDraftUnitCostCents, setMatDraftUnitCostCents] = useState(0);
  const [matDraftQuantity, setMatDraftQuantity] = useState(1);
  const [matDraftUnit, setMatDraftUnit] = useState('ea');

  const [fontsLoaded] = useFonts(fieldsoloExpoFontAssets);

  const typography = useMemo(
    () => createTextStyles(fieldsoloLoadedFonts),
    [],
  );

  useEffect(() => {
    if (phase3Enabled || !legacyQuickActionsVisible || captureStep !== 'idle') return;
    let cancelled = false;
    setActionError(null);
    setRecentJobsLoading(true);
    setRecentJobsError(null);
    void (async () => {
      if (!isSupabaseConfigured()) {
        if (!cancelled) {
          setRecentJobsError('Supabase is not configured.');
          setRecentJobsLoading(false);
        }
        return;
      }
      try {
        const items = await listRecentJobsForCurrentUser(supabase, { limit: 3 });
        if (!cancelled) {
          setRecentJobs(items);
          analytics.capture('home_quick_actions_opened', {
            recent_job_count: items.length,
            has_live_session: hasLiveSession,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setRecentJobsError(
            error instanceof Error ? error.message : 'Could not load jobs.',
          );
        }
      } finally {
        if (!cancelled) setRecentJobsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [captureStep, hasLiveSession, legacyQuickActionsVisible, phase3Enabled]);

  const resetLegacyCapture = useCallback(() => {
    setCaptureStep('idle');
    setDraftBody('');
    setMatDraftDescription('');
    setMatDraftUnitCostCents(0);
    setMatDraftQuantity(1);
    setMatDraftUnit('ea');
    setCaptureSaving(false);
  }, []);

  const closeLegacyQuickActions = useCallback(() => {
    setLegacyQuickActionsVisible(false);
    resetLegacyCapture();
  }, [resetLegacyCapture]);

  const openLegacyQuickActionsAtStep = useCallback(
    (step: QuickActionsStep) => {
      resetLegacyCapture();
      setLegacyStep(step);
      setActionError(null);
      setLegacyQuickActionsVisible(true);
    },
    [resetLegacyCapture],
  );

  const startLegacySessionForExistingJob = useCallback(
    async (job: RecentJobItem) => {
      if (!isSupabaseConfigured()) {
        setActionError('Supabase is not configured.');
        return;
      }
      setActionError(null);
      setStarting(true);
      analytics.capture('session_start_requested', {
        source: 'quick_actions',
        job_id: job.id,
        placeholder_job: false,
      });
      analytics.capture('home_quick_action_selected', {
        action: 'start_session_existing_job',
        recent_job_count: recentJobs.length,
      });
      try {
        const created = await startLiveSession({
          jobId: job.id,
          jobShortDescription: job.shortDescription,
        });
        await tryBumpJobToInProgressIfNotStarted(supabase, job.id);
        analytics.capture('live_session_started', {
          source: 'quick_actions',
          session_id: created.id,
          job_id: job.id,
          placeholder_job: false,
        });
        closeLegacyQuickActions();
        invalidateJobsList();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[QuickActionsFlow] startLiveSession (existing job)', error);
        void refreshLiveSession();
        analytics.capture('live_session_start_failed', {
          source: 'quick_actions',
          job_id: job.id,
          placeholder_job: false,
          recovery_result: 'refresh_requested',
          ...errorProperties(error),
        });
        setActionError(error instanceof Error ? error.message : 'Could not start session.');
      } finally {
        setStarting(false);
      }
    },
    [
      closeLegacyQuickActions,
      invalidateJobsList,
      recentJobs.length,
      refreshLiveSession,
      startLiveSession,
    ],
  );

  const startLegacySessionForNewJob = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setActionError('Supabase is not configured.');
      return;
    }
    const shortDescription = formatLiveSessionJobTitle(new Date());
    let createdJobId: string | null = null;
    setActionError(null);
    setStarting(true);
    analytics.capture('session_start_requested', {
      source: 'quick_actions',
      placeholder_job: true,
    });
    analytics.capture('home_quick_action_selected', {
      action: 'start_session_new_job',
      recent_job_count: recentJobs.length,
    });
    try {
      createdJobId = await createBlankJobForLiveSessionStart(supabase, { shortDescription });
      const created = await startLiveSession({ jobId: createdJobId, jobShortDescription: shortDescription });
      await tryBumpJobToInProgressIfNotStarted(supabase, createdJobId);
      analytics.capture('live_session_started', {
        source: 'quick_actions',
        session_id: created.id,
        job_id: createdJobId,
        placeholder_job: true,
      });
      closeLegacyQuickActions();
      invalidateJobsList();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[QuickActionsFlow] startLiveSession (new job)', error);
      let recoveredJobId: string | null = null;
      try {
        const recovered = await refreshLiveSession();
        recoveredJobId = recovered?.jobId ?? null;
      } catch {
        // Refresh is best-effort recovery; cleanup below still protects the quick job.
      }
      if (createdJobId && recoveredJobId === createdJobId) {
        analytics.capture('live_session_start_failed', {
          source: 'quick_actions',
          job_id: createdJobId,
          placeholder_job: true,
          recovery_result: 'recovered_created_job_session',
          ...errorProperties(error),
        });
        closeLegacyQuickActions();
        invalidateJobsList();
        return;
      }
      if (createdJobId) {
        try {
          await deleteJobById(supabase, createdJobId);
          invalidateJobsList();
        } catch (cleanupError) {
          // eslint-disable-next-line no-console
          console.error('[QuickActionsFlow] cleanup orphaned quick-session job failed', cleanupError);
        }
      }
      analytics.capture('live_session_start_failed', {
        source: 'quick_actions',
        job_id: createdJobId,
        placeholder_job: true,
        recovery_result: createdJobId ? 'placeholder_job_deleted' : 'no_job_created',
        ...errorProperties(error),
      });
      setActionError(error instanceof Error ? error.message : 'Could not start session.');
    } finally {
      setStarting(false);
    }
  }, [
    closeLegacyQuickActions,
    invalidateJobsList,
    recentJobs.length,
    refreshLiveSession,
    startLiveSession,
  ]);

  const quickActionsVisible = phase3Enabled
    ? captureStep !== 'idle'
    : legacyQuickActionsVisible;

  /**
   * FAB Live Session: skip the old Start Session / attach-job chooser and start
   * immediately. Sessions still require a job row in the DB, so we create a
   * lightweight placeholder the live overlay can edit (same as former
   * "Start New Session").
   */
  const startLiveSessionFromFab = useCallback(async () => {
    if (startingRef.current) return;
    if (!isSupabaseConfigured()) {
      Alert.alert('Start failed', 'Supabase is not configured.');
      return;
    }
    const shortDescription = formatLiveSessionJobTitle(new Date());
    let createdJobId: string | null = null;
    startingRef.current = true;
    setStarting(true);
    analytics.capture('session_start_requested', {
      source: 'quick_actions',
      placeholder_job: true,
    });
    analytics.capture('home_quick_action_selected', {
      action: 'start_session_new_job',
      recent_job_count: 0,
    });
    try {
      createdJobId = await createBlankJobForLiveSessionStart(supabase, { shortDescription });
      const created = await startLiveSession({
        jobId: createdJobId,
        jobShortDescription: shortDescription,
      });
      await tryBumpJobToInProgressIfNotStarted(supabase, createdJobId);
      analytics.capture('job_created', {
        source: 'home_quick_session',
        job_id: createdJobId,
        placeholder: true,
      });
      analytics.capture('live_session_started', {
        source: 'quick_actions',
        session_id: created.id,
        job_id: createdJobId,
        placeholder_job: true,
      });
      invalidateJobsList();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[QuickActionsFlow] startLiveSession (fab)', err);
      let recoveredJobId: string | null = null;
      try {
        const recovered = await refreshLiveSession();
        recoveredJobId = recovered?.jobId ?? null;
      } catch {
        // Refresh is best-effort recovery; cleanup below still protects the quick job.
      }
      if (createdJobId && recoveredJobId === createdJobId) {
        analytics.capture('live_session_start_failed', {
          source: 'quick_actions',
          job_id: createdJobId,
          placeholder_job: true,
          recovery_result: 'recovered_created_job_session',
          ...errorProperties(err),
        });
        invalidateJobsList();
        return;
      }
      if (createdJobId) {
        try {
          await deleteJobById(supabase, createdJobId);
          invalidateJobsList();
        } catch (cleanupErr) {
          // eslint-disable-next-line no-console
          console.error('[QuickActionsFlow] cleanup orphaned quick-session job failed', cleanupErr);
        }
      }
      analytics.capture('live_session_start_failed', {
        source: 'quick_actions',
        job_id: createdJobId,
        placeholder_job: true,
        recovery_result: createdJobId ? 'placeholder_job_deleted' : 'no_job_created',
        ...errorProperties(err),
      });
      Alert.alert(
        'Start failed',
        err instanceof Error ? err.message : 'Could not start session.',
      );
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }, [invalidateJobsList, refreshLiveSession, startLiveSession]);

  const closePhase3QuickActions = useCallback(() => {
    setCaptureStep('idle');
    setCaptureSaving(false);
  }, []);

  const beginInboxCapture = useCallback((kind: QuickCaptureKind) => {
    analytics.capture('home_quick_action_selected', {
      action: kind === 'note' ? 'new_note' : 'new_material',
      recent_job_count: 0,
    });
    analytics.capture(kind === 'note' ? 'note_create_opened' : 'material_create_opened', {
      source: 'quick_actions',
      parent: 'inbox',
    });
    if (phase3Enabled) {
      setCaptureKind(kind);
      setCaptureStep(kind === 'note' ? 'noteEdit' : 'materialEdit');
      return;
    }
    setLegacyQuickActionsVisible(true);
    if (kind === 'note') {
      setDraftBody('');
      setCaptureStep('noteEdit');
    } else {
      setMatDraftDescription('');
      setMatDraftUnitCostCents(0);
      setMatDraftQuantity(1);
      setMatDraftUnit('ea');
      setCaptureStep('materialEdit');
    }
  }, [phase3Enabled, recentJobs.length]);

  const saveCaptureNote = useCallback(
    async ({ body }: CaptureComposerNoteValues) => {
      if (captureSaving) return;
      if (!isSupabaseConfigured()) {
        Alert.alert('Save failed', 'Supabase is not configured.');
        return;
      }
      setCaptureSaving(true);
      try {
        const noteId = await createNote(supabase, {
          jobId: null,
          sessionId: null,
          body,
        });
        analytics.capture('note_created', {
          source: 'quick_actions',
          note_id: noteId,
          parent_type: 'inbox',
          job_id: null,
          session_id: null,
          text_length_bucket: textLengthBucket(body),
        });
        closePhase3QuickActions();
        invalidateJobsList();
        onQuickCaptureSaved?.({
          mode: 'inbox',
          jobId: null,
        });
      } catch (e) {
        analytics.capture('note_create_failed', {
          source: 'quick_actions',
          parent_type: 'inbox',
          ...errorProperties(e),
        });
        Alert.alert('Save failed', formatCaptureError(e) || 'Could not save note.');
      } finally {
        setCaptureSaving(false);
      }
    },
    [captureSaving, closePhase3QuickActions, invalidateJobsList, onQuickCaptureSaved],
  );

  const saveCaptureMaterial = useCallback(
    async (values: CaptureComposerMaterialValues) => {
      if (captureSaving) return;
      if (!isSupabaseConfigured()) {
        Alert.alert('Save failed', 'Supabase is not configured.');
        return;
      }
      setCaptureSaving(true);
      try {
        const quantity = values.quantityExplicit ? values.quantity : 1;
        const unitCostCents = values.unitCostExplicit
          ? Math.max(0, values.unitCostCents)
          : Math.max(0, values.totalCostCents);
        const unit = values.unit.trim() || 'ea';
        const materialId = await createMaterial(supabase, {
          jobId: null,
          sessionId: null,
          description: values.description,
          quantity,
          unit,
          unitCostCents,
          quantityExplicit: values.quantityExplicit,
          unitCostExplicit: values.unitCostExplicit,
          totalCostCents: Math.max(0, values.totalCostCents),
        });
        analytics.capture('material_created', {
          source: 'quick_actions',
          material_id: materialId,
          parent_type: 'inbox',
          job_id: null,
          session_id: null,
          unit,
          quantity_bucket: quantityBucket(quantity),
          cost_bucket: moneyBucket(unitCostCents),
          text_length_bucket: textLengthBucket(values.description),
        });
        closePhase3QuickActions();
        invalidateJobsList();
        onQuickCaptureSaved?.({
          mode: 'inbox',
          jobId: null,
        });
      } catch (e) {
        analytics.capture('material_create_failed', {
          source: 'quick_actions',
          parent_type: 'inbox',
          ...errorProperties(e),
        });
        Alert.alert('Save failed', formatCaptureError(e) || 'Could not save material.');
      } finally {
        setCaptureSaving(false);
      }
    },
    [captureSaving, closePhase3QuickActions, invalidateJobsList, onQuickCaptureSaved],
  );

  const saveLegacyCaptureNote = useCallback(
    async ({ body }: EditNoteBottomSheetValues) => {
      if (captureSaving || !isSupabaseConfigured()) return;
      setCaptureSaving(true);
      try {
        await createNote(supabase, { jobId: null, sessionId: null, body });
        closeLegacyQuickActions();
        invalidateJobsList();
        onQuickCaptureSaved?.({ mode: 'inbox', jobId: null });
      } catch (error) {
        Alert.alert('Save failed', formatCaptureError(error) || 'Could not save note.');
      } finally {
        setCaptureSaving(false);
      }
    },
    [captureSaving, closeLegacyQuickActions, invalidateJobsList, onQuickCaptureSaved],
  );

  const saveLegacyCaptureMaterial = useCallback(
    async (values: EditMaterialBottomSheetValues) => {
      if (captureSaving || !isSupabaseConfigured()) return;
      setCaptureSaving(true);
      try {
        await createMaterial(supabase, {
          jobId: null,
          sessionId: null,
          description: values.description,
          quantity: values.quantity,
          unit: values.unit,
          unitCostCents: values.unitCostCents,
        });
        closeLegacyQuickActions();
        invalidateJobsList();
        onQuickCaptureSaved?.({ mode: 'inbox', jobId: null });
      } catch (error) {
        Alert.alert('Save failed', formatCaptureError(error) || 'Could not save material.');
      } finally {
        setCaptureSaving(false);
      }
    },
    [captureSaving, closeLegacyQuickActions, invalidateJobsList, onQuickCaptureSaved],
  );

  const handlePrimaryAction = useCallback(
    (id: PrimaryActionMenuItemId) => {
      switch (id) {
        case 'new_job': {
          if (creatingJobRef.current) return;
          creatingJobRef.current = true;
          setCreatingJob(true);
          void onCreateJob()
            .catch((error) => {
              Alert.alert(
                'Create job failed',
                error instanceof Error ? error.message : 'Could not create job.',
              );
            })
            .finally(() => {
              creatingJobRef.current = false;
              setCreatingJob(false);
            });
          return;
        }
        case 'live_session':
          if (phase3Enabled) {
            void startLiveSessionFromFab();
          } else {
            openLegacyQuickActionsAtStep('chooseJob');
          }
          return;
        case 'quick_note':
          beginInboxCapture('note');
          return;
        case 'quick_material':
          beginInboxCapture('material');
          return;
        default: {
          const _exhaustive: never = id;
          return _exhaustive;
        }
      }
    },
    [
      beginInboxCapture,
      onCreateJob,
      openLegacyQuickActionsAtStep,
      phase3Enabled,
      startLiveSessionFromFab,
    ],
  );

  const contextValue = useMemo(
    () => ({
      handlePrimaryAction,
      creatingJob: creatingJob || starting,
      quickActionsVisible,
    }),
    [creatingJob, handlePrimaryAction, quickActionsVisible, starting],
  );

  return (
    <QuickActionsFlowContext.Provider value={contextValue}>
      {children}
      {quickActionsVisible && fontsLoaded ? (
        <Modal
          visible
          transparent
          animationType="none"
          statusBarTranslucent
          navigationBarTranslucent={Platform.OS === 'android'}
          onRequestClose={phase3Enabled ? closePhase3QuickActions : closeLegacyQuickActions}
        >
          <GestureHandlerRootView collapsable={false} style={styles.modalHost}>
            {phase3Enabled ? (
              <CaptureComposerSheet
                typography={typography}
                visible={captureStep === 'noteEdit' || captureStep === 'materialEdit'}
                kind={captureKind}
                saving={captureSaving}
                registerInGlobalStack={false}
                onClose={closePhase3QuickActions}
                onSaveNote={(values) => void saveCaptureNote(values)}
                onSaveMaterial={(values) => void saveCaptureMaterial(values)}
              />
            ) : (
              <>
                <QuickActionsBottomSheet
                  typography={typography}
                  visible={captureStep === 'idle'}
                  step={legacyStep}
                  recentJobs={recentJobs}
                  recentJobsLoading={recentJobsLoading}
                  recentJobsError={recentJobsError}
                  actionError={actionError}
                  starting={starting}
                  onClose={closeLegacyQuickActions}
                  onSelectExistingJob={(job) => void startLegacySessionForExistingJob(job)}
                  onStartNewSession={() => void startLegacySessionForNewJob()}
                />
                <EditNoteBottomSheet
                  typography={typography}
                  visible={captureStep === 'noteEdit'}
                  title="New Note"
                  primaryLabel="SAVE NOTE TO INBOX"
                  subtitle="Unassigned quick capture note"
                  values={{ body: draftBody }}
                  assignedSession={null}
                  canAttachSession={false}
                  registerInGlobalStack={false}
                  onClose={closeLegacyQuickActions}
                  onBack={closeLegacyQuickActions}
                  onSavePress={(values) => void saveLegacyCaptureNote(values)}
                  onDeletePress={closeLegacyQuickActions}
                />
                <EditMaterialBottomSheet
                  typography={typography}
                  visible={captureStep === 'materialEdit'}
                  title="New Material"
                  primaryLabel="SAVE MATERIAL TO INBOX"
                  subtitle="Unassigned quick capture material"
                  values={{
                    description: matDraftDescription,
                    unitCostCents: matDraftUnitCostCents,
                    quantity: matDraftQuantity,
                    unit: matDraftUnit,
                  }}
                  assignedSession={null}
                  canAttachSession={false}
                  registerInGlobalStack={false}
                  onClose={closeLegacyQuickActions}
                  onBack={closeLegacyQuickActions}
                  onUnitPress={(values) => {
                    setMatDraftDescription(values.description);
                    setMatDraftUnitCostCents(values.unitCostCents);
                    setMatDraftQuantity(values.quantity);
                    setMatDraftUnit(values.unit);
                    setCaptureStep('materialUnit');
                  }}
                  onSavePress={(values) => void saveLegacyCaptureMaterial(values)}
                  onDeletePress={closeLegacyQuickActions}
                />
                <DropdownBottomSheet
                  typography={typography}
                  visible={captureStep === 'materialUnit'}
                  options={CAPTURE_UNIT_OPTIONS}
                  currentValue={matDraftUnit}
                  allowCustom
                  customPlaceholder="Custom"
                  registerInGlobalStack={false}
                  onClose={closeLegacyQuickActions}
                  onBack={() => setCaptureStep('materialEdit')}
                  onSelect={(unit) => {
                    setMatDraftUnit(unit || 'ea');
                    setCaptureStep('materialEdit');
                  }}
                />
              </>
            )}
          </GestureHandlerRootView>
        </Modal>
      ) : null}
    </QuickActionsFlowContext.Provider>
  );
}

export function useQuickActionsFlow(): QuickActionsFlowContextValue {
  const ctx = useContext(QuickActionsFlowContext);
  if (!ctx) {
    throw new Error('useQuickActionsFlow must be used within QuickActionsFlowProvider');
  }
  return ctx;
}

const styles = StyleSheet.create({
  modalHost: { flex: 1 },
});
