import { useFonts } from 'expo-font';
import {
  fieldsoloExpoFontAssets,
  fieldsoloLoadedFonts,
} from '@fieldsolo/design-system/expo/loadFieldSoloFonts';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Animated, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  createMaterial,
  createNote,
  deleteJobById,
  deleteMaterial,
  deleteNote,
  fetchJobDetail,
  updateJobById,
  updateMaterial,
  updateNote,
} from '@fieldsolo/api-client';
import type {
  JobDetailMaterialLine,
  JobDetailNote,
  JobDetailViewModel,
} from '@fieldsolo/shared-types';

import {
  ChooseSessionBottomSheet,
  DropdownBottomSheet,
  EditJobBottomSheet,
  EditLiveSessionBottomSheet,
  EditMaterialBottomSheet,
  EditNoteBottomSheet,
  LiveSessionBottomSheet,
  MinimizedLiveSessionBar,
  type ChooseSessionBottomSheetSession,
  type DropdownBottomSheetOption,
  type EditJobBottomSheetValues,
  type EditMaterialBottomSheetValues,
  type EditNoteBottomSheetValues,
  type EditLiveSessionSavePayload,
} from './ds';
import { LegacyLiveSessionBottomSheet } from './ds/LegacyLiveSessionBottomSheet';
import {
  useHasRegisteredBottomSheet,
  useBottomSheetStackWriters,
  useTopmostBottomSheet,
} from '../context/BottomSheetStackContext';
import { useLiveSession } from '../context/LiveSessionContext';
import { useJobsListInvalidation } from '../context/JobsListInvalidationContext';
import {
  analytics,
  durationMinutesBetween,
  errorProperties,
  moneyBucket,
  quantityBucket,
  textLengthBucket,
} from '../lib/analytics';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { contentColumnMetrics, createTextStyles } from '../theme/nativeTokens';
import { shellLiveSessionBarBottom } from './platform/shellDockMetrics';

type LiveSessionOverlayProps = {
  /**
   * Called after a live session ends or is deleted. The parent decides whether
   * to refresh an already-open Job Detail or stay on the tab shell.
   */
  onSessionEnded: (input: { jobId: string }) => void;
  /** Phase 3: inline identity + capture; no nested Edit Job / Edit Live sheets. */
  phase3Capture?: boolean;
};

/**
 * Global Live Session UI. Mounted once at the root of `AuthenticatedShell`
 * (after the screen tree) so the floating bar / sheets always render above
 * every screen and persist across navigations.
 *
 * Renders nothing when there is no active live session.
 */
export function LiveSessionOverlay({
  onSessionEnded,
  phase3Capture = false,
}: LiveSessionOverlayProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const minimizedBarMetrics = useMemo(() => contentColumnMetrics(windowWidth), [windowWidth]);
  const sheetStackWriters = useBottomSheetStackWriters();
  const topmostSheet = useTopmostBottomSheet();
  const hasRegisteredSheet = useHasRegisteredBottomSheet();
  const {
    liveSession,
    mode,
    minimize,
    openSheet,
    openEditSheet,
    closeEditSheet,
    minimizeFromEdit,
    endLiveSessionNow,
    updateLiveSessionStartedAt,
    deleteLiveSessionNow,
    updateLiveSessionJobShortDescription,
  } = useLiveSession();
  const { invalidateJobsList } = useJobsListInvalidation();

  const [fontsLoaded] = useFonts(fieldsoloExpoFontAssets);

  const typography = useMemo(
    () =>
      createTextStyles(fieldsoloLoadedFonts),
    [],
  );

  const [jobDetail, setJobDetail] = useState<JobDetailViewModel | null>(null);

  type NoteFlow = 'closed' | 'addNote' | 'editNote' | 'attachSession' | 'editSession';
  const [noteFlow, setNoteFlow] = useState<NoteFlow>('closed');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [draftBody, setDraftBody] = useState('');
  const [draftSessionId, setDraftSessionId] = useState<string | null>(null);
  const [noteSaving, setNoteSaving] = useState(false);

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
  const [materialSaving, setMaterialSaving] = useState(false);
  const [editJobOpen, setEditJobOpen] = useState(false);
  const [editJobMounted, setEditJobMounted] = useState(false);
  const [jobSaving, setJobSaving] = useState(false);

  const refetchJobDetail = useCallback(async () => {
    if (!liveSession || !isSupabaseConfigured()) return;
    try {
      const j = await fetchJobDetail(supabase, liveSession.jobId);
      if (j) setJobDetail(j);
    } catch {
      // best-effort; attachment list may stay stale
    }
  }, [liveSession]);

  useEffect(() => {
    if (!liveSession) {
      setJobDetail(null);
      setNoteFlow('closed');
      setMaterialFlow('closed');
      setEditJobOpen(false);
      return;
    }
    void refetchJobDetail();
  }, [liveSession, refetchJobDetail]);

  useEffect(() => {
    if (liveSession && mode === 'sheet') {
      void refetchJobDetail();
    }
  }, [mode, liveSession, refetchJobDetail]);

  // Note/material/edit-job flows only apply to the main live sheet. Closing that
  // layer (minimize, edit live session) abandons the draft the same as navigating away.
  useEffect(() => {
    if (mode === 'minimized' || mode === 'hidden' || mode === 'editSheet') {
      setNoteFlow('closed');
      setMaterialFlow('closed');
      setEditJobOpen(false);
    }
  }, [mode]);

  const jobId = liveSession?.jobId;
  const elapsedSeconds = useCallback(() => {
    if (!liveSession) return 0;
    const started = Date.parse(liveSession.startedAt);
    if (!Number.isFinite(started)) return 0;
    return Math.max(0, Math.round((Date.now() - started) / 1000));
  }, [liveSession]);

  const findNote = useCallback(
    (noteId: string): JobDetailNote | null => {
      if (!jobDetail) return null;
      for (const bucket of jobDetail.noteBuckets) {
        const hit = bucket.notes.find((n) => n.id === noteId);
        if (hit) return hit;
      }
      return null;
    },
    [jobDetail],
  );

  const findMaterial = useCallback(
    (materialId: string): JobDetailMaterialLine | null => {
      if (!jobDetail) return null;
      for (const bucket of jobDetail.materialBuckets) {
        const hit = bucket.items.find((m) => m.id === materialId);
        if (hit) return hit;
      }
      return null;
    },
    [jobDetail],
  );

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

  const allSessionsList = useMemo(
    () => jobDetail?.allSessions ?? [],
    [jobDetail?.allSessions],
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

  const draftAssignedSession = useMemo(() => {
    if (!draftSessionId) return null;
    const s = allSessionsList.find((x) => x.id === draftSessionId);
    if (!s) return null;
    return { id: s.id, dateLabel: s.dateLabel, timeRangeLabel: s.timeRangeLabel };
  }, [draftSessionId, allSessionsList]);

  const matDraftAssignedSession = useMemo(() => {
    if (!matDraftSessionId) return null;
    const s = allSessionsList.find((x) => x.id === matDraftSessionId);
    if (!s) return null;
    return { id: s.id, dateLabel: s.dateLabel, timeRangeLabel: s.timeRangeLabel };
  }, [matDraftSessionId, allSessionsList]);

  const unitOptions = useMemo<DropdownBottomSheetOption[]>(
    () =>
      (['ea', 'ft', 'pcs', 'kit', 'lb', 'gal', 'lot'] as const).map((u) => ({
        id: u,
        label: u,
        value: u,
      })),
    [],
  );

  const liveAttachments = useMemo(() => {
    if (!jobDetail?.inProgressSession || !liveSession) return [];
    if (jobDetail.inProgressSession.id !== liveSession.id) return [];
    return jobDetail.inProgressSession.attachments;
  }, [jobDetail, liveSession]);

  /** Show the live session capture UI only when no note/material/job sub-flow (swap, not stack). */
  const showLiveSessionMain = useMemo(
    () =>
      mode === 'sheet' &&
      noteFlow === 'closed' &&
      materialFlow === 'closed' &&
      !editJobOpen,
    [mode, materialFlow, noteFlow, editJobOpen],
  );

  const showNoteForm = mode === 'sheet' && (noteFlow === 'addNote' || noteFlow === 'editNote');
  const showNoteSessionPicker =
    mode === 'sheet' && (noteFlow === 'attachSession' || noteFlow === 'editSession');
  const showMaterialForm =
    mode === 'sheet' && (materialFlow === 'addMaterial' || materialFlow === 'editMaterial');
  const showMaterialSessionPicker =
    mode === 'sheet' && (materialFlow === 'attachSession' || materialFlow === 'editSession');
  const showMaterialUnitPicker = mode === 'sheet' && materialFlow === 'chooseUnit';

  const closeNoteFlow = useCallback(() => {
    setNoteFlow('closed');
  }, []);

  const openAddNoteFromLive = useCallback(() => {
    if (!liveSession) return;
    analytics.capture('note_create_opened', {
      source: 'live_session',
      parent: 'session',
      job_id: liveSession.jobId,
      session_id: liveSession.id,
    });
    setEditingNoteId(null);
    setDraftBody('');
    setDraftSessionId(liveSession.id);
    setNoteFlow('addNote');
  }, [liveSession]);

  const openEditNote = useCallback(
    (noteId: string) => {
      const n = findNote(noteId);
      if (!n) return;
      setEditingNoteId(noteId);
      setDraftBody(n.body);
      setDraftSessionId(n.sessionId);
      setNoteFlow('editNote');
    },
    [findNote],
  );

  const openSessionPickerFromNoteSheet = useCallback(() => {
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
      if (!jobId) return;
      setNoteSaving(true);
      try {
        const noteId = await createNote(supabase, {
          jobId,
          sessionId: draftSessionId,
          body,
        });
        await refetchJobDetail();
        closeNoteFlow();
        analytics.capture('note_created', {
          source: 'live_session',
          note_id: noteId,
          parent_type: draftSessionId ? 'session' : 'job',
          job_id: jobId,
          session_id: draftSessionId,
          text_length_bucket: textLengthBucket(body),
        });
      } catch (e) {
        analytics.capture('note_create_failed', {
          source: 'live_session',
          parent_type: draftSessionId ? 'session' : 'job',
          job_id: jobId,
          session_id: draftSessionId,
          ...errorProperties(e),
        });
        Alert.alert('Save failed', formatErrorMessage(e) || 'Could not save note.');
      } finally {
        setNoteSaving(false);
      }
    },
    [closeNoteFlow, draftSessionId, formatErrorMessage, jobId, refetchJobDetail],
  );

  const onSaveNoteChanges = useCallback(
    async ({ body }: EditNoteBottomSheetValues) => {
      if (!editingNoteId || !jobId) return;
      setNoteSaving(true);
      try {
        await updateNote(supabase, editingNoteId, {
          body,
          sessionId: draftSessionId,
          jobId: draftSessionId === null ? jobId : undefined,
        });
        await refetchJobDetail();
        closeNoteFlow();
      } catch (e) {
        Alert.alert('Save failed', formatErrorMessage(e) || 'Could not save note.');
      } finally {
        setNoteSaving(false);
      }
    },
    [closeNoteFlow, draftSessionId, editingNoteId, formatErrorMessage, jobId, refetchJobDetail],
  );

  const onDeleteEditingNote = useCallback(async () => {
    if (!editingNoteId) {
      closeNoteFlow();
      return;
    }
    setNoteSaving(true);
    try {
      await deleteNote(supabase, editingNoteId);
      await refetchJobDetail();
      closeNoteFlow();
    } catch (e) {
      Alert.alert('Delete failed', formatErrorMessage(e) || 'Could not delete note.');
    } finally {
      setNoteSaving(false);
    }
  }, [closeNoteFlow, editingNoteId, formatErrorMessage, refetchJobDetail]);

  const closeMaterialFlow = useCallback(() => {
    setMaterialFlow('closed');
  }, []);

  const openAddMaterialFromLive = useCallback(() => {
    if (!liveSession) return;
    analytics.capture('material_create_opened', {
      source: 'live_session',
      parent: 'session',
      job_id: liveSession.jobId,
      session_id: liveSession.id,
    });
    setEditingMaterialId(null);
    setMatDraftDescription('');
    setMatDraftUnitCostCents(0);
    setMatDraftQuantity(1);
    setMatDraftUnit('ea');
    setMatDraftSessionId(liveSession.id);
    setMaterialFlow('addMaterial');
  }, [liveSession]);

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
      if (!jobId) return;
      setMaterialSaving(true);
      try {
        const totalFirst =
          phase3Capture &&
          values.totalCostCents != null &&
          !(values.quantityExplicit && values.unitCostExplicit);
        const quantity = values.quantityExplicit ? values.quantity : 1;
        const unitCostCents = values.unitCostExplicit
          ? values.unitCostCents
          : Math.max(0, values.totalCostCents ?? 0);
        const materialId = await createMaterial(supabase, {
          jobId,
          sessionId: matDraftSessionId,
          description: values.description,
          quantity,
          unit: values.unit || 'ea',
          unitCostCents,
          quantityExplicit: values.quantityExplicit,
          unitCostExplicit: values.unitCostExplicit,
          totalCostCents: totalFirst
            ? Math.max(0, values.totalCostCents ?? 0)
            : Math.round(quantity * unitCostCents),
        });
        await refetchJobDetail();
        closeMaterialFlow();
        analytics.capture('material_created', {
          source: 'live_session',
          material_id: materialId,
          parent_type: matDraftSessionId ? 'session' : 'job',
          job_id: jobId,
          session_id: matDraftSessionId,
          unit: values.unit,
          quantity_bucket: quantityBucket(quantity),
          cost_bucket: moneyBucket(unitCostCents),
          text_length_bucket: textLengthBucket(values.description),
        });
      } catch (e) {
        analytics.capture('material_create_failed', {
          source: 'live_session',
          parent_type: matDraftSessionId ? 'session' : 'job',
          job_id: jobId,
          session_id: matDraftSessionId,
          ...errorProperties(e),
        });
        Alert.alert('Save failed', formatErrorMessage(e) || 'Could not save material.');
      } finally {
        setMaterialSaving(false);
      }
    },
    [
      closeMaterialFlow,
      formatErrorMessage,
      jobId,
      matDraftSessionId,
      phase3Capture,
      refetchJobDetail,
    ],
  );

  const onSaveMaterialChanges = useCallback(
    async (values: EditMaterialBottomSheetValues) => {
      if (!editingMaterialId || !jobId) return;
      setMaterialSaving(true);
      try {
        await updateMaterial(supabase, editingMaterialId, {
          description: values.description,
          quantity: values.quantity,
          unit: values.unit,
          unitCostCents: values.unitCostCents,
          quantityExplicit: values.quantityExplicit,
          unitCostExplicit: values.unitCostExplicit,
          totalCostCents: values.totalCostCents,
          sessionId: matDraftSessionId,
          jobId: matDraftSessionId === null ? jobId : undefined,
        });
        await refetchJobDetail();
        closeMaterialFlow();
      } catch (e) {
        Alert.alert('Save failed', formatErrorMessage(e) || 'Could not save material.');
      } finally {
        setMaterialSaving(false);
      }
    },
    [
      closeMaterialFlow,
      editingMaterialId,
      formatErrorMessage,
      jobId,
      matDraftSessionId,
      refetchJobDetail],
  );

  const onDeleteEditingMaterial = useCallback(async () => {
    if (!editingMaterialId) {
      closeMaterialFlow();
      return;
    }
    setMaterialSaving(true);
    try {
      await deleteMaterial(supabase, editingMaterialId);
      await refetchJobDetail();
      closeMaterialFlow();
    } catch (e) {
      Alert.alert('Delete failed', formatErrorMessage(e) || 'Could not delete material.');
    } finally {
      setMaterialSaving(false);
    }
  }, [closeMaterialFlow, editingMaterialId, formatErrorMessage, refetchJobDetail]);

  const handleEndSession = useCallback(async () => {
    try {
      const ended = await endLiveSessionNow();
      if (ended) {
        analytics.capture('live_session_ended', {
          session_id: ended.id,
          job_id: ended.jobId,
          duration_minutes: durationMinutesBetween(ended.startedAt, new Date().toISOString()),
          source: 'end_button',
        });
        onSessionEnded({ jobId: ended.jobId });
      }
    } catch (e) {
      analytics.capture('live_session_end_failed', {
        session_id: liveSession?.id ?? null,
        job_id: liveSession?.jobId ?? null,
        ...errorProperties(e),
      });
      Alert.alert('End failed', formatErrorMessage(e) || 'Could not end session.');
    }
  }, [endLiveSessionNow, formatErrorMessage, liveSession, onSessionEnded]);

  const handleEditSave = useCallback(
    async (payload: EditLiveSessionSavePayload) => {
      if (payload.kind === 'updateStart') {
        try {
          const previousStartedAt = liveSession?.startedAt ?? payload.startedAt;
          await updateLiveSessionStartedAt({ startedAt: payload.startedAt });
          analytics.capture('live_session_start_time_changed', {
            session_id: liveSession?.id ?? null,
            job_id: liveSession?.jobId ?? null,
            delta_minutes: Math.round(
              (Date.parse(payload.startedAt) - Date.parse(previousStartedAt)) / 60000,
            ),
          });
        } finally {
          // Return to full sheet whether the network call succeeded or
          // rolled back — the user explicitly tapped Save Changes and the
          // sheet should not stay in edit mode.
          closeEditSheet();
        }
        return;
      }
      // endSession path: persist the new start (if changed), then end.
      if (liveSession && payload.startedAt !== liveSession.startedAt) {
        try {
          await updateLiveSessionStartedAt({ startedAt: payload.startedAt });
          analytics.capture('live_session_start_time_changed', {
            session_id: liveSession.id,
            job_id: liveSession.jobId,
            delta_minutes: Math.round(
              (Date.parse(payload.startedAt) - Date.parse(liveSession.startedAt)) / 60000,
            ),
          });
        } catch {
          // Surface but don't block — the more important transition is
          // ending the session per the user's intent.
        }
      }
      try {
        const ended = await endLiveSessionNow({ endedAt: payload.endedAt });
        if (ended) {
          analytics.capture('live_session_ended', {
            session_id: ended.id,
            job_id: ended.jobId,
            duration_minutes: durationMinutesBetween(ended.startedAt, payload.endedAt),
            source: 'edit_end_time',
          });
          onSessionEnded({ jobId: ended.jobId });
        }
      } catch (e) {
        analytics.capture('live_session_end_failed', {
          session_id: liveSession?.id ?? null,
          job_id: liveSession?.jobId ?? null,
          ...errorProperties(e),
        });
        Alert.alert('End failed', formatErrorMessage(e) || 'Could not end session.');
      }
    },
    [
      closeEditSheet,
      endLiveSessionNow,
      liveSession,
      onSessionEnded,
      formatErrorMessage,
      updateLiveSessionStartedAt,
    ],
  );

  const handleEditDelete = useCallback(async () => {
    try {
      const deleted = await deleteLiveSessionNow();
      if (deleted) {
        analytics.capture('live_session_deleted', {
          session_id: deleted.id,
          job_id: deleted.jobId,
          elapsed_seconds: elapsedSeconds(),
        });
        onSessionEnded({ jobId: deleted.jobId });
      }
    } catch (e) {
      analytics.capture('live_session_delete_failed', {
        session_id: liveSession?.id ?? null,
        job_id: liveSession?.jobId ?? null,
        ...errorProperties(e),
      });
      Alert.alert('Delete failed', formatErrorMessage(e) || 'Could not delete live session.');
    }
  }, [deleteLiveSessionNow, elapsedSeconds, formatErrorMessage, liveSession, onSessionEnded]);

  const editJobValues = useMemo<EditJobBottomSheetValues | undefined>(() => {
    if (!jobDetail) {
      if (!liveSession) return undefined;
      return {
        shortDescription: liveSession.jobShortDescription || '',
        longDescription: '',
        customerName: '',
        serviceAddress: '',
        revenue: '',
      };
    }
    const revenue =
      jobDetail.earnings.revenueCents == null
        ? ''
        : (jobDetail.earnings.revenueCents / 100).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
    return {
      shortDescription: jobDetail.shortDescription,
      longDescription: jobDetail.longDescription ?? '',
      customerName: jobDetail.customerName,
      serviceAddress: jobDetail.serviceAddress,
      revenue,
    };
  }, [jobDetail, liveSession]);

  const openEditJob = useCallback(() => {
    if (!liveSession || phase3Capture) return;
    analytics.capture('job_edit_opened', {
      source: 'live_session_header',
      job_id: liveSession.jobId,
    });
    setEditJobMounted(true);
    setEditJobOpen(true);
  }, [liveSession, phase3Capture]);

  const phase3JobIdentity = useMemo(() => {
    if (!phase3Capture) return undefined;
    if (jobDetail) {
      return {
        shortDescription: jobDetail.shortDescription,
        longDescription: jobDetail.longDescription ?? '',
        customerName: jobDetail.customerName ?? '',
        serviceAddress: jobDetail.serviceAddress ?? '',
        revenueCents: jobDetail.earnings.revenueCents ?? null,
      };
    }
    if (!liveSession) return undefined;
    return {
      shortDescription: liveSession.jobShortDescription || '',
      longDescription: '',
      customerName: '',
      serviceAddress: '',
      revenueCents: null as number | null,
    };
  }, [jobDetail, liveSession, phase3Capture]);

  const onPhase3JobIdentityChange = useCallback(
    async (patch: {
      shortDescription?: string;
      longDescription?: string;
      customerName?: string;
      serviceAddress?: string;
      revenueCents?: number | null;
    }) => {
      if (!liveSession || !phase3Capture) return;
      const base = phase3JobIdentity ?? {
        shortDescription: liveSession.jobShortDescription || '',
        longDescription: '',
        customerName: '',
        serviceAddress: '',
        revenueCents: null as number | null,
      };
      const next = {
        shortDescription: patch.shortDescription ?? base.shortDescription,
        longDescription: patch.longDescription ?? base.longDescription,
        customerName: patch.customerName ?? base.customerName,
        serviceAddress: patch.serviceAddress ?? base.serviceAddress,
        revenueCents:
          patch.revenueCents !== undefined ? patch.revenueCents : base.revenueCents,
      };
      const title = next.shortDescription.trim();
      if (!title) return;
      try {
        await updateJobById(supabase, liveSession.jobId, {
          shortDescription: title,
          longDescription: next.longDescription,
          customerName: next.customerName.trim(),
          serviceAddress: next.serviceAddress.trim(),
          revenueCents: next.revenueCents,
        });
        if (patch.shortDescription !== undefined) {
          updateLiveSessionJobShortDescription({
            jobId: liveSession.jobId,
            jobShortDescription: title,
          });
        }
        await refetchJobDetail();
        invalidateJobsList();
      } catch (e) {
        Alert.alert(
          'Update failed',
          formatErrorMessage(e) || "Couldn't update this job. Try again.",
        );
      }
    },
    [
      formatErrorMessage,
      invalidateJobsList,
      liveSession,
      phase3Capture,
      phase3JobIdentity,
      refetchJobDetail,
      updateLiveSessionJobShortDescription,
    ],
  );

  const onPhase3ChangeStartedAt = useCallback(
    async (iso: string) => {
      if (!liveSession || !phase3Capture) return;
      const previousStartedAt = liveSession.startedAt;
      try {
        await updateLiveSessionStartedAt({ startedAt: iso });
        analytics.capture('live_session_start_time_changed', {
          session_id: liveSession.id,
          job_id: liveSession.jobId,
          delta_minutes: Math.round(
            (Date.parse(iso) - Date.parse(previousStartedAt)) / 60000,
          ),
        });
      } catch (e) {
        Alert.alert(
          'Update failed',
          formatErrorMessage(e) || "Couldn't update start time. Try again.",
        );
        throw e;
      }
    },
    [formatErrorMessage, liveSession, phase3Capture, updateLiveSessionStartedAt],
  );

  const closeEditJob = useCallback(() => {
    setEditJobOpen(false);
  }, []);

  const onSaveEditJob = useCallback(
    async (values: EditJobBottomSheetValues) => {
      if (!liveSession || jobSaving) return;
      const trimmedRevenue = values.revenue.trim().replace(/[$,\s]/g, '');
      const revenueCents =
        trimmedRevenue.length === 0 ? null : Math.round(Number(trimmedRevenue) * 100);
      setJobSaving(true);
      try {
        await updateJobById(supabase, liveSession.jobId, {
          shortDescription: values.shortDescription,
          longDescription: values.longDescription,
          customerName: values.customerName.trim(),
          serviceAddress: values.serviceAddress.trim(),
          revenueCents,
        });
        updateLiveSessionJobShortDescription({
          jobId: liveSession.jobId,
          jobShortDescription: values.shortDescription.trim(),
        });
        await refetchJobDetail();
        invalidateJobsList();
        setEditJobOpen(false);
        analytics.capture('job_saved', {
          job_id: liveSession.jobId,
          source: 'live_session_header',
          revenue_bucket: moneyBucket(revenueCents),
        });
      } catch (e) {
        analytics.capture('job_save_failed', {
          job_id: liveSession.jobId,
          source: 'live_session_header',
          ...errorProperties(e),
        });
        Alert.alert('Save failed', formatErrorMessage(e) || 'Could not save job changes.');
      } finally {
        setJobSaving(false);
      }
    },
    [
      formatErrorMessage,
      invalidateJobsList,
      jobSaving,
      liveSession,
      refetchJobDetail,
      updateLiveSessionJobShortDescription,
    ],
  );

  const onDeleteEditJob = useCallback(async () => {
    if (!liveSession || jobSaving) return;
    setJobSaving(true);
    try {
      await deleteJobById(supabase, liveSession.jobId);
      const deleted = await deleteLiveSessionNow();
      invalidateJobsList();
      setEditJobOpen(false);
      analytics.capture('job_deleted', {
        job_id: liveSession.jobId,
        source: 'live_session_header',
      });
      if (deleted) {
        onSessionEnded({ jobId: deleted.jobId });
      } else {
        onSessionEnded({ jobId: liveSession.jobId });
      }
    } catch (e) {
      analytics.capture('job_delete_failed', {
        job_id: liveSession.jobId,
        source: 'live_session_header',
        ...errorProperties(e),
      });
      Alert.alert('Delete failed', formatErrorMessage(e) || 'Could not delete this job.');
    } finally {
      setJobSaving(false);
    }
  }, [
    deleteLiveSessionNow,
    formatErrorMessage,
    invalidateJobsList,
    jobSaving,
    liveSession,
    onSessionEnded,
  ]);

  // The bar is hidden while another sheet is open. Keep the defensive close
  // here for the narrow case where a sheet registers during the same tap.
  const handleBarPress = useCallback(() => {
    analytics.capture('live_session_reopened', {
      session_id: liveSession?.id ?? null,
      job_id: liveSession?.jobId ?? null,
      elapsed_seconds: elapsedSeconds(),
      source: 'minimized_bar',
    });
    if (topmostSheet) {
      sheetStackWriters?.requestCloseTopmost();
    }
    openSheet();
  }, [elapsedSeconds, liveSession, openSheet, sheetStackWriters, topmostSheet]);

  // The bar's anchor stays pinned above the floating shell dock.
  const fabSlotBottom = shellLiveSessionBarBottom(insets.bottom);

  useEffect(() => {
    if (!liveSession) return;
    if (mode === 'sheet') {
      analytics.capture('live_session_viewed', {
        source: 'opened_sheet',
        session_id: liveSession.id,
        job_id: liveSession.jobId,
        elapsed_seconds: elapsedSeconds(),
      });
    } else if (mode === 'minimized') {
      analytics.capture('live_session_minimized', {
        session_id: liveSession.id,
        job_id: liveSession.jobId,
        elapsed_seconds: elapsedSeconds(),
      });
    } else if (mode === 'editSheet') {
      analytics.capture('live_session_edit_opened', {
        session_id: liveSession.id,
        job_id: liveSession.jobId,
        elapsed_seconds: elapsedSeconds(),
      });
    }
  }, [elapsedSeconds, liveSession, mode]);

  const phase3LiveNotes = useMemo(() => {
    if (!phase3Capture || !jobDetail || !liveSession) return [];
    return jobDetail.noteBuckets
      .flatMap((bucket) => bucket.notes)
      .filter((note) => note.sessionId === liveSession.id)
      .map((note) => ({ id: note.id, body: note.body }));
  }, [jobDetail, liveSession, phase3Capture]);

  const phase3LiveMaterials = useMemo(() => {
    if (!phase3Capture || !jobDetail || !liveSession) return [];
    return jobDetail.materialBuckets
      .flatMap((bucket) => bucket.items)
      .filter((material) => material.sessionId === liveSession.id)
      .map((material) => ({
        id: material.id,
        description: material.name,
        totalCostCents: material.totalCostCents,
      }));
  }, [jobDetail, liveSession, phase3Capture]);

  const onPhase3CreateNote = useCallback(
    async (body: string) => {
      if (!liveSession || !jobId) return;
      try {
        const noteId = await createNote(supabase, {
          jobId,
          sessionId: liveSession.id,
          body,
        });
        await refetchJobDetail();
        analytics.capture('note_created', {
          source: 'live_session',
          note_id: noteId,
          parent_type: 'session',
          job_id: jobId,
          session_id: liveSession.id,
          text_length_bucket: textLengthBucket(body),
        });
      } catch (e) {
        analytics.capture('note_create_failed', {
          source: 'live_session',
          parent_type: 'session',
          job_id: jobId,
          session_id: liveSession.id,
          ...errorProperties(e),
        });
        Alert.alert('Save failed', formatErrorMessage(e) || 'Could not save note.');
        throw e;
      }
    },
    [formatErrorMessage, jobId, liveSession, refetchJobDetail],
  );

  const onPhase3UpdateNote = useCallback(
    async (id: string, body: string) => {
      try {
        await updateNote(supabase, id, { body });
        await refetchJobDetail();
      } catch (e) {
        Alert.alert('Save failed', formatErrorMessage(e) || 'Could not save note.');
      }
    },
    [formatErrorMessage, refetchJobDetail],
  );

  const onPhase3DeleteNote = useCallback(
    async (id: string) => {
      try {
        await deleteNote(supabase, id);
        await refetchJobDetail();
      } catch (e) {
        Alert.alert('Delete failed', formatErrorMessage(e) || 'Could not delete note.');
      }
    },
    [formatErrorMessage, refetchJobDetail],
  );

  const onPhase3CreateMaterial = useCallback(
    async (input: { description: string; totalCostCents: number }) => {
      if (!liveSession || !jobId) return;
      try {
        const materialId = await createMaterial(supabase, {
          jobId,
          sessionId: liveSession.id,
          description: input.description,
          quantity: 1,
          unit: 'ea',
          unitCostCents: Math.max(0, input.totalCostCents),
          quantityExplicit: false,
          unitCostExplicit: false,
          totalCostCents: Math.max(0, input.totalCostCents),
        });
        await refetchJobDetail();
        analytics.capture('material_created', {
          source: 'live_session',
          material_id: materialId,
          parent_type: 'session',
          job_id: jobId,
          session_id: liveSession.id,
          unit: 'ea',
          quantity_bucket: quantityBucket(1),
          cost_bucket: moneyBucket(input.totalCostCents),
          text_length_bucket: textLengthBucket(input.description),
        });
      } catch (e) {
        analytics.capture('material_create_failed', {
          source: 'live_session',
          parent_type: 'session',
          job_id: jobId,
          session_id: liveSession.id,
          ...errorProperties(e),
        });
        Alert.alert('Save failed', formatErrorMessage(e) || 'Could not save material.');
        throw e;
      }
    },
    [formatErrorMessage, jobId, liveSession, refetchJobDetail],
  );

  const onPhase3UpdateMaterial = useCallback(
    async (id: string, input: { description: string; totalCostCents: number }) => {
      try {
        await updateMaterial(supabase, id, {
          description: input.description,
          quantity: 1,
          unit: 'ea',
          unitCostCents: Math.max(0, input.totalCostCents),
          quantityExplicit: false,
          unitCostExplicit: false,
          totalCostCents: Math.max(0, input.totalCostCents),
        });
        await refetchJobDetail();
      } catch (e) {
        Alert.alert('Save failed', formatErrorMessage(e) || 'Could not save material.');
      }
    },
    [formatErrorMessage, refetchJobDetail],
  );

  const onPhase3DeleteMaterial = useCallback(
    async (id: string) => {
      try {
        await deleteMaterial(supabase, id);
        await refetchJobDetail();
      } catch (e) {
        Alert.alert('Delete failed', formatErrorMessage(e) || 'Could not delete material.');
      }
    },
    [formatErrorMessage, refetchJobDetail],
  );

  if (!fontsLoaded || !liveSession) return null;

  const barVisible = mode === 'minimized' && !hasRegisteredSheet;

  return (
    <>
      {/*
        Sheet stack: both BottomSheetShells stay mounted so they can play
        their slide-down animation — visibility flips drive the slide.
      */}
      {phase3Capture ? (
        <LiveSessionBottomSheet
          typography={typography}
          visible={showLiveSessionMain}
          jobShortDescription={liveSession.jobShortDescription}
          startedAt={liveSession.startedAt}
          attachments={liveAttachments}
          phase3Capture
          jobIdentity={phase3JobIdentity}
          onJobIdentityChange={(patch) => {
            void onPhase3JobIdentityChange(patch);
          }}
          onChangeStartedAt={(iso) => {
            void onPhase3ChangeStartedAt(iso);
          }}
          onAddNote={openAddNoteFromLive}
          onAddMaterial={openAddMaterialFromLive}
          onPressAttachment={({ kind, id }) => {
            if (kind === 'note') {
              openEditNote(id);
            } else {
              openEditMaterial(id);
            }
          }}
          liveNotes={phase3LiveNotes}
          liveMaterials={phase3LiveMaterials}
          onCreateNote={onPhase3CreateNote}
          onUpdateNote={onPhase3UpdateNote}
          onDeleteNote={onPhase3DeleteNote}
          onCreateMaterial={onPhase3CreateMaterial}
          onUpdateMaterial={onPhase3UpdateMaterial}
          onDeleteMaterial={onPhase3DeleteMaterial}
          onMinimize={minimize}
          onEndSessionPress={() => void handleEndSession()}
        />
      ) : (
        <LegacyLiveSessionBottomSheet
          typography={typography}
          visible={showLiveSessionMain}
          jobShortDescription={liveSession.jobShortDescription}
          startedAt={liveSession.startedAt}
          attachments={liveAttachments}
          onAddNote={openAddNoteFromLive}
          onAddMaterial={openAddMaterialFromLive}
          onPressAttachment={({ kind, id }) => {
            if (kind === 'note') {
              openEditNote(id);
            } else {
              openEditMaterial(id);
            }
          }}
          onMinimize={minimize}
          onEditPress={openEditSheet}
          onEditJobPress={openEditJob}
          onEndSessionPress={() => void handleEndSession()}
        />
      )}

      {!phase3Capture ? (
      <EditLiveSessionBottomSheet
        typography={typography}
        visible={mode === 'editSheet'}
        startedAt={liveSession.startedAt}
        // Per spec: tapping outside / swiping the edit sheet down should
        // MINIMIZE the live session (not just go back to the full sheet).
        onClose={minimizeFromEdit}
        onBack={closeEditSheet}
        onSavePress={(payload) => void handleEditSave(payload)}
        onDeletePress={() => void handleEditDelete()}
      />
      ) : null}

      {!phase3Capture && editJobMounted ? (
        <EditJobBottomSheet
          typography={typography}
          values={editJobValues}
          visible={editJobOpen && mode === 'sheet'}
          registerInGlobalStack={false}
          onClose={closeEditJob}
          onClosed={() => {
            if (!editJobOpen) setEditJobMounted(false);
          }}
          onSavePress={(values) => {
            void onSaveEditJob(values);
          }}
          onDeletePress={() => {
            void onDeleteEditJob();
          }}
        />
      ) : null}

      {/*
        Note / material + pickers: swap into the same modal layer as the live
        session sheet (same idea as `mode === 'editSheet'` vs `sheet` for
        Edit Live). No second scrim on top of the live session.
        Phase 3 uses inline Job-Edit rows instead of these nested sheets.
      */}
      {!phase3Capture ? (
        <>
      <EditNoteBottomSheet
        typography={typography}
        visible={showNoteForm}
        title={editingNoteId ? 'Edit Note' : 'Add Note'}
        primaryLabel={editingNoteId ? 'SAVE CHANGES' : 'SAVE NEW NOTE'}
        values={{ body: draftBody }}
        assignedSession={draftAssignedSession}
        canAttachSession={chooserSessions.length > 0}
        registerInGlobalStack={false}
        onClose={closeNoteFlow}
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
          setDraftBody(values.body);
          openSessionPickerFromNoteSheet();
        }}
      />
      <ChooseSessionBottomSheet
        typography={typography}
        visible={showNoteSessionPicker}
        mode={noteFlow === 'editSession' ? 'edit' : 'attach'}
        sessions={chooserSessions}
        currentSessionId={draftSessionId}
        registerInGlobalStack={false}
        onClose={closeNoteFlow}
        onBack={returnToNoteSheet}
        onSelect={onSelectDraftSession}
        onRemove={onRemoveDraftSession}
      />
      <EditMaterialBottomSheet
        typography={typography}
        visible={showMaterialForm}
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
        registerInGlobalStack={false}
        onClose={closeMaterialFlow}
        onBack={closeMaterialFlow}
        onSavePress={(values) => {
          if (materialSaving) return;
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
          setMatDraftDescription(values.description);
          setMatDraftUnitCostCents(values.unitCostCents);
          setMatDraftQuantity(values.quantity);
          setMatDraftUnit(values.unit);
          openSessionPickerFromMaterialSheet();
        }}
        onUnitPress={(values) => {
          setMatDraftDescription(values.description);
          setMatDraftUnitCostCents(values.unitCostCents);
          setMatDraftQuantity(values.quantity);
          setMatDraftUnit(values.unit);
          openUnitPickerFromMaterialSheet();
        }}
      />
      <ChooseSessionBottomSheet
        typography={typography}
        visible={showMaterialSessionPicker}
        mode={materialFlow === 'editSession' ? 'edit' : 'attach'}
        sessions={chooserSessions}
        currentSessionId={matDraftSessionId}
        registerInGlobalStack={false}
        onClose={closeMaterialFlow}
        onBack={returnToMaterialSheet}
        onSelect={onSelectMaterialSession}
        onRemove={onRemoveMaterialSession}
      />
      <DropdownBottomSheet
        typography={typography}
        visible={showMaterialUnitPicker}
        options={unitOptions}
        currentValue={matDraftUnit}
        allowCustom
        customPlaceholder="Custom"
        registerInGlobalStack={false}
        onClose={closeMaterialFlow}
        onBack={returnToMaterialSheet}
        onSelect={onSelectMaterialUnit}
      />
        </>
      ) : null}

      {/*
        Bar stays mounted whenever a live session exists, so the morph
        between full sheet ↔ bar is a smooth crossfade rather than a
        mount/unmount jolt. `visible` drives the bar's internal
        opacity/translate/scale animation.
      */}
      <Animated.View
        pointerEvents={hasRegisteredSheet ? 'none' : 'box-none'}
        style={[
          styles.minimizedAnchor,
          barVisible && styles.minimizedAnchorRaised,
          hasRegisteredSheet && styles.minimizedAnchorSuppressed,
          {
            bottom: fabSlotBottom,
            left: minimizedBarMetrics.sideInset,
            right: minimizedBarMetrics.sideInset,
            paddingHorizontal: minimizedBarMetrics.gutter,
          },
        ]}
      >
        <MinimizedLiveSessionBar
          typography={typography}
          visible={barVisible}
          jobShortDescription={liveSession.jobShortDescription}
          startedAt={liveSession.startedAt}
          onPress={handleBarPress}
        />
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  minimizedAnchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  minimizedAnchorRaised: {
    zIndex: 30,
    elevation: 12,
  },
  minimizedAnchorSuppressed: {
    opacity: 0,
  },
});
