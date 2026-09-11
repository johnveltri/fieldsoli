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
  tryBumpJobToInProgressIfNotStarted,
} from '@fieldsolo/api-client';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Alert, Modal, Platform, StyleSheet, View } from 'react-native';

import {
  CaptureComposerSheet,
  type CaptureComposerMaterialValues,
  type CaptureComposerNoteValues,
} from '../components/ds';
import type { PrimaryActionMenuItemId } from '../components/platform/PlatformPrimaryAction';
import { useJobsListInvalidation } from '../context/JobsListInvalidationContext';
import { useLiveSession } from '../context/LiveSessionContext';
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
  /**
   * Kept for call-site compatibility. Quick capture always uses description + total.
   */
  totalFirstMaterialCapture?: boolean;
};

export function QuickActionsFlowProvider({
  children,
  onCreateJob,
  onQuickCaptureSaved,
}: QuickActionsFlowProviderProps) {
  const { startLiveSession, refresh: refreshLiveSession } = useLiveSession();
  const { invalidateJobsList } = useJobsListInvalidation();

  const [starting, setStarting] = useState(false);
  const [creatingJob, setCreatingJob] = useState(false);
  const creatingJobRef = useRef(false);
  const startingRef = useRef(false);

  const [captureStep, setCaptureStep] = useState<CaptureStep>('idle');
  const [captureKind, setCaptureKind] = useState<QuickCaptureKind>('note');
  const [captureSaving, setCaptureSaving] = useState(false);

  const [fontsLoaded] = useFonts(fieldsoloExpoFontAssets);

  const typography = useMemo(
    () => createTextStyles(fieldsoloLoadedFonts),
    [],
  );

  const quickActionsVisible = captureStep !== 'idle';

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

  const closeQuickActions = useCallback(() => {
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
    setCaptureKind(kind);
    setCaptureStep(kind === 'note' ? 'noteEdit' : 'materialEdit');
  }, []);

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
        closeQuickActions();
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
    [captureSaving, closeQuickActions, invalidateJobsList, onQuickCaptureSaved],
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
        const totalFirst = !(values.quantityExplicit && values.unitCostExplicit);
        const quantity = totalFirst ? 1 : values.quantity;
        const unitCostCents = totalFirst
          ? Math.max(0, values.totalCostCents)
          : Math.max(0, values.unitCostCents);
        const unit = values.unit.trim() || 'ea';
        const materialId = await createMaterial(supabase, {
          jobId: null,
          sessionId: null,
          description: values.description,
          quantity,
          unit,
          unitCostCents,
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
        closeQuickActions();
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
    [captureSaving, closeQuickActions, invalidateJobsList, onQuickCaptureSaved],
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
          void startLiveSessionFromFab();
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
    [beginInboxCapture, onCreateJob, startLiveSessionFromFab],
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
          onRequestClose={closeQuickActions}
        >
          <View style={styles.modalHost}>
            <CaptureComposerSheet
              typography={typography}
              visible={captureStep === 'noteEdit' || captureStep === 'materialEdit'}
              kind={captureKind}
              saving={captureSaving}
              onClose={closeQuickActions}
              onSaveNote={(values) => void saveCaptureNote(values)}
              onSaveMaterial={(values) => void saveCaptureMaterial(values)}
            />
          </View>
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
