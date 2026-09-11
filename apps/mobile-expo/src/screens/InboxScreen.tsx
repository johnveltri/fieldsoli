import { useFonts } from 'expo-font';
import {
  fieldsoloExpoFontAssets,
  fieldsoloLoadedFonts,
} from '@fieldsolo/design-system/expo/loadFieldSoloFonts';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius } from '@fieldsolo/design-system/lib/tokens';

import { PlatformHeaderAction } from '../components/platform/PlatformHeaderAction';
import {
  PlatformHeaderTitle,
  platformHeaderRowStyle,
} from '../components/platform/platformHeaderMetrics';
import {
  deleteMaterial,
  deleteNote,
  listInboxMaterials,
  listInboxNotes,
  updateMaterial,
  updateNote,
  listJobsForCurrentUserPage,
  type InboxMaterialItem,
  type InboxNoteItem,
} from '@fieldsolo/api-client';
import type {
  JobDetailMaterialBucket,
  JobDetailNoteBucket,
} from '@fieldsolo/shared-types';

import { CanvasTiledBackground } from '../components/CanvasTiledBackground';
import {
  CaptureComposerSheet,
  ChooseJobBottomSheet,
  SectionHeader,
  ViewMaterialsBuckets,
  ViewNotesBuckets,
  type CaptureComposerMaterialValues,
  type CaptureComposerNoteValues,
  type ChooseJobBottomSheetJob,
} from '../components/ds';
import { TopHeaderBackIcon } from '../components/figma-icons/TopHeaderIcons';
import { shellBottomNavOuterHeight } from '../components/platform/shellDockMetrics';
import { useAuth } from '../context/AuthContext';
import { useJobsListInvalidation } from '../context/JobsListInvalidationContext';
import { analytics, errorProperties } from '../lib/analytics';
import { useJobDetailFullscreenEditFlag } from '../lib/featureFlags/useJobDetailFullscreenEditFlag';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  recencyBucket,
  RECENCY_BUCKET_ORDER,
  RECENCY_BUCKET_TITLE,
  type RecencyBucket,
} from '../lib/timeBuckets';
import {
  bg,
  cardShadowRn,
  createTextStyles,
  fg,
  space,
} from '../theme/nativeTokens';
import { useContentColumn } from '../theme/useContentColumn';
import { screenHeaderA11y } from '../lib/accessibility';

type InboxTab = 'notes' | 'materials';

const ASSIGN_JOBS_PAGE_SIZE = 100;

export type InboxScreenProps = {
  /** Bump to force a refetch when the screen is (re)opened. */
  loadKey?: number;
  onRequestClose: () => void;
};

type AssignTarget = { kind: InboxTab; id: string } | null;

async function listAllJobsForAssign(): Promise<ChooseJobBottomSheetJob[]> {
  const jobs: ChooseJobBottomSheetJob[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const page = await listJobsForCurrentUserPage(supabase, {
      limit: ASSIGN_JOBS_PAGE_SIZE,
      offset,
      tab: 'all',
    });
    jobs.push(
      ...page.items.map((j) => ({
        id: j.id,
        shortDescription: j.shortDescription,
        customerName: j.customerName,
      })),
    );
    hasMore = page.hasMore && page.items.length > 0;
    offset += page.items.length;
  }

  return jobs;
}

function groupByRecency<T extends { createdAt: string }>(
  items: T[],
): { bucket: RecencyBucket; items: T[] }[] {
  const nowMs = Date.now();
  const byBucket = new Map<RecencyBucket, T[]>();
  for (const item of items) {
    const b = recencyBucket(null, item.createdAt, nowMs);
    const list = byBucket.get(b);
    if (list) list.push(item);
    else byBucket.set(b, [item]);
  }
  return RECENCY_BUCKET_ORDER.filter((b) => byBucket.has(b)).map((b) => ({
    bucket: b,
    items: byBucket.get(b)!,
  }));
}

function excerptNote(body: string, max = 120): string {
  const t = body.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

/**
 * Inbox screen — quick-capture notes / materials with no parent job. Grouped
 * by recency (TODAY / PAST WEEK / PAST MONTH / OLDER) using the shared
 * `timeBuckets` logic. Flag-off: tapping an item opens the "Add to Job"
 * sheet. Flag-on: tap opens edit; assign via JOB pill; swipe deletes.
 */
export function InboxScreen({ loadKey = 0, onRequestClose }: InboxScreenProps) {
  const insets = useSafeAreaInsets();
  const { columnStyle } = useContentColumn();
  const scrollY = useMemo(() => new Animated.Value(0), []);
  const { invalidateJobsList, version } = useJobsListInvalidation();
  const { session } = useAuth();
  const { enabled: fullscreenEditEnabled, ready: fullscreenEditReady } =
    useJobDetailFullscreenEditFlag(session?.user.id);
  const phase3 = fullscreenEditReady && fullscreenEditEnabled;

  const [fontsLoaded] = useFonts(fieldsoloExpoFontAssets);

  const typography = useMemo(
    () =>
      createTextStyles(fieldsoloLoadedFonts),
    [],
  );

  const [activeTab, setActiveTab] = useState<InboxTab>('notes');
  const [notes, setNotes] = useState<InboxNoteItem[]>([]);
  const [materials, setMaterials] = useState<InboxMaterialItem[]>([]);
  const activeTabRef = useRef<InboxTab>('notes');
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);
  // Once the user taps a tab we stop auto-selecting based on which inbox has items.
  const userPickedTabRef = useRef(false);
  const selectTab = useCallback((tab: InboxTab) => {
    userPickedTabRef.current = true;
    if (tab !== activeTab) {
      analytics.capture('inbox_tab_changed', {
        from_tab: activeTab,
        to_tab: tab,
        notes_count: notes.length,
        materials_count: materials.length,
      });
    }
    setActiveTab(tab);
  }, [activeTab, materials.length, notes.length]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scrollContentHeight, setScrollContentHeight] = useState(0);

  const [assignTarget, setAssignTarget] = useState<AssignTarget>(null);
  const [assignJobs, setAssignJobs] = useState<ChooseJobBottomSheetJob[]>([]);
  const [assignJobsLoading, setAssignJobsLoading] = useState(false);
  const [assignJobsError, setAssignJobsError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const hasLoadedInboxRef = useRef(false);
  const prevLoadKeyRef = useRef(loadKey);

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteSheetVisible, setNoteSheetVisible] = useState(false);
  const [draftBody, setDraftBody] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [materialSheetVisible, setMaterialSheetVisible] = useState(false);
  const [matDraft, setMatDraft] = useState<CaptureComposerMaterialValues | null>(
    null,
  );
  const [materialSaving, setMaterialSaving] = useState(false);

  const refetch = useCallback(async (isCancelled: () => boolean) => {
    const startedAt = Date.now();
    if (!isSupabaseConfigured()) {
      if (!isCancelled()) {
        setError('Supabase is not configured.');
        setNotes([]);
        setMaterials([]);
        analytics.capture('supabase_not_configured_seen', {
          screen: 'inbox',
          operation: 'inbox_loaded',
        });
      }
      return;
    }
    if (!isCancelled()) setError(null);
    try {
      const [n, m] = await Promise.all([
        listInboxNotes(supabase),
        listInboxMaterials(supabase),
      ]);
      if (!isCancelled()) {
        setNotes(n);
        setMaterials(m);
        analytics.capture('inbox_loaded', {
          notes_count: n.length,
          materials_count: m.length,
          active_tab: activeTabRef.current,
          load_duration_ms: Date.now() - startedAt,
        });
      }
    } catch (err) {
      if (!isCancelled()) {
        setError(err instanceof Error ? err.message : 'Failed to load inbox.');
        setNotes([]);
        setMaterials([]);
        analytics.capture('inbox_load_failed', {
          active_tab: activeTabRef.current,
          load_duration_ms: Date.now() - startedAt,
          ...errorProperties(err),
        });
      }
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const loadKeyChanged = prevLoadKeyRef.current !== loadKey;
    if (loadKeyChanged) {
      userPickedTabRef.current = false;
      prevLoadKeyRef.current = loadKey;
    }
    if (!hasLoadedInboxRef.current) {
      setLoading(true);
    }
    void (async () => {
      await refetch(() => !alive);
      if (alive) {
        setLoading(false);
        hasLoadedInboxRef.current = true;
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadKey, version, refetch]);

  // Open to whichever inbox has items: if Notes is empty but Materials has
  // something, land on Materials (and vice versa). Skipped once the user has
  // manually chosen a tab.
  useEffect(() => {
    if (loading || userPickedTabRef.current) return;
    if (notes.length === 0 && materials.length > 0) {
      setActiveTab('materials');
    } else if (materials.length === 0 && notes.length > 0) {
      setActiveTab('notes');
    }
  }, [loading, notes, materials]);

  const noteGroups = useMemo(() => groupByRecency(notes), [notes]);
  const materialGroups = useMemo(() => groupByRecency(materials), [materials]);

  const closeNoteEdit = useCallback(() => {
    setNoteSheetVisible(false);
    setEditingNoteId(null);
    setDraftBody('');
  }, []);

  const closeMaterialEdit = useCallback(() => {
    setMaterialSheetVisible(false);
    setEditingMaterialId(null);
    setMatDraft(null);
  }, []);

  const openAssign = useCallback((
    kind: InboxTab,
    id: string,
    options?: { fromEdit?: boolean },
  ) => {
    const startedAt = Date.now();
    const item =
      kind === 'notes'
        ? notes.find((n) => n.id === id)
        : materials.find((m) => m.id === id);
    analytics.capture('inbox_item_selected', {
      kind,
      item_id: id,
      action: options?.fromEdit ? 'assign_from_edit' : 'assign',
      age_bucket: item ? recencyBucket(null, item.createdAt, Date.now()) : null,
    });
    setAssignTarget({ kind, id });
    setAssignJobs([]);
    setAssignJobsError(null);
    setAssignJobsLoading(true);
    void (async () => {
      try {
        if (!isSupabaseConfigured()) {
          setAssignJobsError('Supabase is not configured.');
          return;
        }
        const jobs = await listAllJobsForAssign();
        setAssignJobs(jobs);
        analytics.capture('inbox_assign_jobs_loaded', {
          jobs_count: jobs.length,
          load_duration_ms: Date.now() - startedAt,
        });
      } catch (err) {
        setAssignJobsError(
          err instanceof Error ? err.message : 'Failed to load jobs.',
        );
        analytics.capture('inbox_assign_jobs_load_failed', {
          load_duration_ms: Date.now() - startedAt,
          ...errorProperties(err),
        });
      } finally {
        setAssignJobsLoading(false);
      }
    })();
  }, [materials, notes]);

  const openEditNote = useCallback(
    (id: string) => {
      const item = notes.find((n) => n.id === id);
      if (!item) return;
      analytics.capture('inbox_item_selected', {
        kind: 'notes',
        item_id: id,
        action: 'edit',
        age_bucket: recencyBucket(null, item.createdAt, Date.now()),
      });
      setEditingNoteId(id);
      setDraftBody(item.body);
      setNoteSheetVisible(true);
    },
    [notes],
  );

  const openEditMaterial = useCallback(
    (id: string) => {
      const item = materials.find((m) => m.id === id);
      if (!item) return;
      analytics.capture('inbox_item_selected', {
        kind: 'materials',
        item_id: id,
        action: 'edit',
        age_bucket: recencyBucket(null, item.createdAt, Date.now()),
      });
      const totalCostCents = item.totalCostCents ?? 0;
      const quantity =
        item.quantity != null && item.quantity > 0 ? item.quantity : 1;
      const unitCostCents = item.unitCostCents ?? 0;
      setEditingMaterialId(id);
      setMatDraft({
        description: item.name,
        totalCostCents,
        quantity,
        unit: item.unit?.trim() || 'ea',
        unitCostCents,
        quantityExplicit: item.quantityExplicit,
        unitCostExplicit: item.unitCostExplicit,
      });
      setMaterialSheetVisible(true);
    },
    [materials],
  );

  const onNotePress = useCallback(
    (id: string) => {
      if (phase3) openEditNote(id);
      else openAssign('notes', id);
    },
    [openAssign, openEditNote, phase3],
  );

  const onMaterialPress = useCallback(
    (id: string) => {
      if (phase3) openEditMaterial(id);
      else openAssign('materials', id);
    },
    [openAssign, openEditMaterial, phase3],
  );

  const closeAssign = useCallback(() => {
    setAssignTarget(null);
  }, []);

  const onAssignToJob = useCallback(
    async (jobId: string) => {
      if (!assignTarget || assigning) return;
      if (!isSupabaseConfigured()) {
        Alert.alert('Assign failed', 'Supabase is not configured.');
        return;
      }
      const target = assignTarget;
      setAssigning(true);
      try {
        if (target.kind === 'notes') {
          const patch: { sessionId: null; jobId: string; body?: string } = {
            sessionId: null,
            jobId,
          };
          if (editingNoteId === target.id && draftBody.trim().length > 0) {
            patch.body = draftBody;
          }
          await updateNote(supabase, target.id, patch);
          setNotes((prev) => prev.filter((n) => n.id !== target.id));
          closeNoteEdit();
        } else {
          const patch: {
            sessionId: null;
            jobId: string;
            description?: string;
            quantity?: number;
            unit?: string;
            unitCostCents?: number;
            quantityExplicit?: boolean;
            unitCostExplicit?: boolean;
            totalCostCents?: number;
          } = { sessionId: null, jobId };
          if (editingMaterialId === target.id && matDraft) {
            patch.description = matDraft.description;
            patch.quantity = matDraft.quantityExplicit
              ? Math.max(1, matDraft.quantity)
              : 1;
            patch.unit = matDraft.unit || 'ea';
            patch.unitCostCents = matDraft.unitCostExplicit
              ? Math.max(0, matDraft.unitCostCents)
              : Math.max(0, matDraft.totalCostCents);
            patch.quantityExplicit = matDraft.quantityExplicit;
            patch.unitCostExplicit = matDraft.unitCostExplicit;
            patch.totalCostCents = Math.max(0, matDraft.totalCostCents);
          }
          await updateMaterial(supabase, target.id, patch);
          setMaterials((prev) => prev.filter((m) => m.id !== target.id));
          closeMaterialEdit();
        }
        analytics.capture('inbox_item_assigned_to_job', {
          kind: target.kind,
          item_id: target.id,
          job_id: jobId,
        });
        setAssignTarget(null);
        invalidateJobsList();
      } catch (e) {
        analytics.capture('inbox_item_assign_failed', {
          kind: target.kind,
          item_id: target.id,
          job_id: jobId,
          ...errorProperties(e),
        });
        Alert.alert('Assign failed', e instanceof Error ? e.message : 'Could not add to job.');
      } finally {
        setAssigning(false);
      }
    },
    [
      assignTarget,
      assigning,
      closeMaterialEdit,
      closeNoteEdit,
      draftBody,
      editingMaterialId,
      editingNoteId,
      invalidateJobsList,
      matDraft,
    ],
  );

  const onSaveNoteChanges = useCallback(
    async ({ body }: CaptureComposerNoteValues) => {
      if (!editingNoteId || noteSaving) return;
      if (!isSupabaseConfigured()) {
        Alert.alert('Save failed', 'Supabase is not configured.');
        return;
      }
      setNoteSaving(true);
      try {
        await updateNote(supabase, editingNoteId, { body });
        const savedId = editingNoteId;
        setNotes((prev) =>
          prev.map((n) =>
            n.id === savedId
              ? { ...n, body, excerpt: excerptNote(body) }
              : n,
          ),
        );
        analytics.capture('note_updated', {
          note_id: savedId,
          source: 'inbox',
        });
        closeNoteEdit();
      } catch (e) {
        analytics.capture('note_update_failed', {
          note_id: editingNoteId,
          source: 'inbox',
          ...errorProperties(e),
        });
        Alert.alert('Save failed', e instanceof Error ? e.message : 'Could not save note.');
      } finally {
        setNoteSaving(false);
      }
    },
    [closeNoteEdit, editingNoteId, noteSaving],
  );

  const onSaveMaterialChanges = useCallback(
    async (values: CaptureComposerMaterialValues) => {
      if (!editingMaterialId || materialSaving) return;
      if (!isSupabaseConfigured()) {
        Alert.alert('Save failed', 'Supabase is not configured.');
        return;
      }
      setMaterialSaving(true);
      try {
        const quantity = values.quantityExplicit ? values.quantity : 1;
        const unitCostCents = values.unitCostExplicit
          ? values.unitCostCents
          : Math.max(0, values.totalCostCents);
        await updateMaterial(supabase, editingMaterialId, {
          description: values.description,
          quantity,
          unit: values.unit || 'ea',
          unitCostCents,
          quantityExplicit: values.quantityExplicit,
          unitCostExplicit: values.unitCostExplicit,
          totalCostCents: Math.max(0, values.totalCostCents),
        });
        const savedId = editingMaterialId;
        const totalCostCents = Math.max(0, values.totalCostCents);
        setMaterials((prev) =>
          prev.map((m) =>
            m.id === savedId
              ? {
                  ...m,
                  name: values.description.trim() || 'Material',
                  quantity: values.quantityExplicit ? quantity : null,
                  unit: values.unit || 'ea',
                  unitCostCents: values.unitCostExplicit ? unitCostCents : null,
                  totalCostCents,
                  quantityExplicit: values.quantityExplicit,
                  unitCostExplicit: values.unitCostExplicit,
                }
              : m,
          ),
        );
        analytics.capture('material_updated', {
          material_id: savedId,
          source: 'inbox',
        });
        closeMaterialEdit();
      } catch (e) {
        analytics.capture('material_update_failed', {
          material_id: editingMaterialId,
          source: 'inbox',
          ...errorProperties(e),
        });
        Alert.alert(
          'Save failed',
          e instanceof Error ? e.message : 'Could not save material.',
        );
      } finally {
        setMaterialSaving(false);
      }
    },
    [closeMaterialEdit, editingMaterialId, materialSaving],
  );

  const performDeleteNote = useCallback(
    async (noteId: string) => {
      if (!isSupabaseConfigured()) {
        Alert.alert('Delete failed', 'Supabase is not configured.');
        return;
      }
      try {
        await deleteNote(supabase, noteId);
        setNotes((prev) => prev.filter((n) => n.id !== noteId));
        if (editingNoteId === noteId) closeNoteEdit();
        analytics.capture('note_deleted', {
          note_id: noteId,
          source: 'inbox',
        });
      } catch (e) {
        analytics.capture('note_delete_failed', {
          note_id: noteId,
          source: 'inbox',
          ...errorProperties(e),
        });
        Alert.alert('Delete failed', e instanceof Error ? e.message : 'Could not delete note.');
      }
    },
    [closeNoteEdit, editingNoteId],
  );

  const performDeleteMaterial = useCallback(
    async (materialId: string) => {
      if (!isSupabaseConfigured()) {
        Alert.alert('Delete failed', 'Supabase is not configured.');
        return;
      }
      try {
        await deleteMaterial(supabase, materialId);
        setMaterials((prev) => prev.filter((m) => m.id !== materialId));
        if (editingMaterialId === materialId) closeMaterialEdit();
        analytics.capture('material_deleted', {
          material_id: materialId,
          source: 'inbox',
        });
      } catch (e) {
        analytics.capture('material_delete_failed', {
          material_id: materialId,
          source: 'inbox',
          ...errorProperties(e),
        });
        Alert.alert(
          'Delete failed',
          e instanceof Error ? e.message : 'Could not delete material.',
        );
      }
    },
    [closeMaterialEdit, editingMaterialId],
  );

  const onDeleteNote = useCallback(
    (noteId: string) => {
      Alert.alert('Delete this note?', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void performDeleteNote(noteId);
          },
        },
      ]);
    },
    [performDeleteNote],
  );

  const onDeleteMaterial = useCallback(
    (materialId: string) => {
      Alert.alert('Delete this material?', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void performDeleteMaterial(materialId);
          },
        },
      ]);
    },
    [performDeleteMaterial],
  );

  const onAddToJobFromNote = useCallback(
    (values: CaptureComposerNoteValues) => {
      if (!editingNoteId) return;
      setDraftBody(values.body);
      setNoteSheetVisible(false);
      openAssign('notes', editingNoteId, { fromEdit: true });
    },
    [editingNoteId, openAssign],
  );

  const onAddToJobFromMaterial = useCallback(
    (values: CaptureComposerMaterialValues) => {
      if (!editingMaterialId) return;
      setMatDraft(values);
      setMaterialSheetVisible(false);
      openAssign('materials', editingMaterialId, { fromEdit: true });
    },
    [editingMaterialId, openAssign],
  );

  // If assign is dismissed without selecting, restore the edit sheet when we
  // still have an editing id from the Add-to-job path.
  const onAssignClosed = useCallback(() => {
    closeAssign();
    if (editingNoteId) setNoteSheetVisible(true);
    if (editingMaterialId) setMaterialSheetVisible(true);
  }, [closeAssign, editingMaterialId, editingNoteId]);

  const noteInitial = useMemo(
    (): CaptureComposerNoteValues | null =>
      editingNoteId ? { body: draftBody } : null,
    [draftBody, editingNoteId],
  );
  const bottomNavReservedHeight = shellBottomNavOuterHeight(insets.bottom);

  if (!fontsLoaded) {
    return (
      <View style={styles.root}>
        <CanvasTiledBackground scrollY={scrollY} contentHeight={scrollContentHeight} />
      </View>
    );
  }

  const activeEmpty =
    activeTab === 'notes' ? noteGroups.length === 0 : materialGroups.length === 0;

  return (
    <View style={styles.root}>
      <CanvasTiledBackground scrollY={scrollY} contentHeight={scrollContentHeight} />
      <Animated.ScrollView
        style={[styles.scroll]}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        onContentSizeChange={(_w, h) => setScrollContentHeight(h)}
        scrollEventThrottle={16}
        contentContainerStyle={{
          width: '100%',
          paddingTop: Math.max(0, insets.top - space('Spacing/6')),
          paddingBottom: space('Spacing/20') + bottomNavReservedHeight,
          alignItems: 'stretch',
        }}
      >
        <View style={columnStyle}>
        <View style={styles.topHeader}>
          <View style={platformHeaderRowStyle(styles.topHeaderChromeRow)}>
            <PlatformHeaderAction
              accessibilityLabel="Back"
              onPress={onRequestClose}
            >
              <TopHeaderBackIcon size={28} color={fg.primary} />
            </PlatformHeaderAction>
            <PlatformHeaderTitle
              {...screenHeaderA11y()}
              typography={typography.displayH1}
            >
              INBOX
            </PlatformHeaderTitle>
          </View>
        </View>

        <View style={styles.tabsWrap}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: activeTab === 'notes' }}
            onPress={() => selectTab('notes')}
            style={({ pressed }) => [
              activeTab === 'notes' ? styles.tabActive : styles.tabIdle,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                typography.statusPillLabel,
                styles.tabLabel,
                { color: activeTab === 'notes' ? fg.primary : fg.secondary },
              ]}
            >
              Notes
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: activeTab === 'materials' }}
            onPress={() => selectTab('materials')}
            style={({ pressed }) => [
              activeTab === 'materials' ? styles.tabActive : styles.tabIdle,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                typography.statusPillLabel,
                styles.tabLabel,
                { color: activeTab === 'materials' ? fg.primary : fg.secondary },
              ]}
            >
              Materials
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator
            color={color('Brand/Primary')}
            style={{ marginTop: space('Spacing/32') }}
          />
        ) : error != null && error !== '' ? (
          <Text
            style={[
              typography.bodySmall,
              styles.inlineError,
              { color: color('Semantic/Status/Error/Text') },
            ]}
          >
            {error}
          </Text>
        ) : activeEmpty ? (
          <View style={styles.emptyWrap}>
            <Text style={[typography.body, { color: fg.primary, textAlign: 'center' }]}>
              {activeTab === 'notes'
                ? 'All caught up! No unassigned notes.'
                : 'All caught up! No unassigned materials.'}
            </Text>
          </View>
        ) : activeTab === 'notes' ? (
          noteGroups.map((group) => {
            const bucket: JobDetailNoteBucket = {
              id: `notes-${group.bucket}`,
              kind: 'unassigned',
              notes: group.items,
            };
            return (
              <View key={group.bucket} style={styles.groupWrap}>
                <SectionHeader
                  title={RECENCY_BUCKET_TITLE[group.bucket]}
                  tone="neutral"
                  typography={typography}
                  contentInset={0}
                />
                <ViewNotesBuckets
                  buckets={[bucket]}
                  typography={typography}
                  onNotePress={onNotePress}
                  onDeleteNote={phase3 ? onDeleteNote : undefined}
                  showNoteIcon={false}
                  hideBucketHeaders
                />
              </View>
            );
          })
        ) : (
          materialGroups.map((group) => {
            const bucket: JobDetailMaterialBucket = {
              id: `materials-${group.bucket}`,
              kind: 'unassigned',
              items: group.items,
            };
            return (
              <View key={group.bucket} style={styles.groupWrap}>
                <SectionHeader
                  title={RECENCY_BUCKET_TITLE[group.bucket]}
                  tone="neutral"
                  typography={typography}
                  contentInset={0}
                />
                <ViewMaterialsBuckets
                  buckets={[bucket]}
                  typography={typography}
                  onMaterialPress={onMaterialPress}
                  onDeleteMaterial={phase3 ? onDeleteMaterial : undefined}
                  hideBucketHeaders
                />
              </View>
            );
          })
        )}
        </View>
      </Animated.ScrollView>

      <ChooseJobBottomSheet
        typography={typography}
        visible={assignTarget !== null}
        jobs={assignJobs}
        loading={assignJobsLoading}
        error={assignJobsError}
        busy={assigning}
        onClose={onAssignClosed}
        onBack={onAssignClosed}
        onSelect={(jobId) => void onAssignToJob(jobId)}
      />

      {phase3 ? (
        <>
          <CaptureComposerSheet
            typography={typography}
            visible={noteSheetVisible && assignTarget === null}
            kind="note-edit"
            saving={noteSaving}
            initialNote={noteInitial}
            onClose={closeNoteEdit}
            onSaveNote={(values) => {
              setDraftBody(values.body);
              void onSaveNoteChanges(values);
            }}
            onAddToJobNote={onAddToJobFromNote}
          />

          <CaptureComposerSheet
            typography={typography}
            visible={materialSheetVisible && assignTarget === null}
            kind="material-edit"
            saving={materialSaving}
            initialMaterial={matDraft}
            onClose={closeMaterialEdit}
            onSaveMaterial={(values) => {
              setMatDraft(values);
              void onSaveMaterialChanges(values);
            }}
            onAddToJobMaterial={onAddToJobFromMaterial}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', backgroundColor: bg.canvasWarm },
  scroll: { flex: 1, width: '100%', backgroundColor: 'transparent', zIndex: 1 },
  topHeader: {
    width: '100%',
    paddingHorizontal: 0,
    paddingTop: space('Spacing/16'),
    paddingBottom: space('Spacing/8'),
  },
  topHeaderChromeRow: {
    width: '100%',
    justifyContent: 'flex-start',
    gap: space('Spacing/12'),
  },
  tabsWrap: {
    width: '100%',
    marginTop: space('Spacing/12'),
    backgroundColor: bg.subtle,
    borderRadius: radius('Radius/Full'),
    padding: space('Spacing/4'),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tabActive: {
    flex: 1,
    backgroundColor: bg.surfaceWhite,
    borderRadius: radius('Radius/Full'),
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    ...cardShadowRn,
  },
  tabIdle: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabLabel: {
    textTransform: 'uppercase',
  },
  groupWrap: {
    width: '100%',
    alignItems: 'stretch',
  },
  inlineError: {
    textAlign: 'center',
    marginTop: space('Spacing/32'),
    paddingHorizontal: 0,
  },
  emptyWrap: {
    width: '100%',
    paddingHorizontal: 0,
    paddingTop: space('Spacing/40'),
  },
  pressed: { opacity: 0.75 },
});
