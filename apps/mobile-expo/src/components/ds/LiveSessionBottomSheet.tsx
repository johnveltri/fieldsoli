import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  Platform,
  Pressable,
  type ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { color, radius, space } from '@fieldsolo/design-system/lib/tokens';
import type { JobDetailSessionAttachment } from '@fieldsolo/shared-types';
import { JOB_SHORT_DESCRIPTION_MAX_LENGTH } from '@fieldsolo/shared-types';

import { bg, cardShadowRn, fg } from '../../theme/nativeTokens';
import type { TextStyles } from '../../theme/nativeTokens';
import { formatUsdCombined } from '../../lib/formatUsd';
import { sanitizeDecimalInput } from '../../lib/moneyInput';
import {
  LiveSessionActiveDotIcon,
  JobDetailIconSectionMaterials,
  JobDetailIconSectionNotes,
  JobDetailIconSectionOtherCosts,
  JobDetailIconSectionSessions,
  JobDetailIconTopClose,
  SessionCardEditPencilIcon,
} from '../figma-icons/JobDetailScreenIcons';
import { PlatformHeaderAction } from '../platform/PlatformHeaderAction';
import {
  EditAddRow,
  EditDescriptionField,
  EditFieldInput,
  EditIconGroup,
  EditIconRow,
  EDIT_KEYBOARD_BOTTOM_CLEARANCE,
  EditKeyboardScrollProvider,
  EditSheet,
  EditTappableValue,
  EditTitleField,
  editSheetRowSeparator,
} from './edit-mode/EditFormRows';
import { EditSwipeableRow } from './edit-mode/EditSwipeableRow';
import { BottomSheetShell } from './BottomSheetShell';
import { CustomerFieldsBlock } from './customer/CustomerFieldsBlock';
import type { CustomerDraft } from './customer/types';
import type { FieldSoloSupabaseClient } from '@fieldsolo/api-client';
import { FullWidthFab } from './FullWidthFab';
import { InlineMonthCalendar } from './InlineMonthCalendar';
import { LiveSessionCaptureCard } from './LiveSessionCaptureCard';

export type LiveSessionJobIdentity = {
  shortDescription: string;
  longDescription: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerId: string | null;
  serviceAddress: string;
  revenueCents: number | null;
};

export type LiveSessionJobIdentityPatch = {
  shortDescription?: string;
  longDescription?: string;
  revenueCents?: number | null;
};

export type LiveSessionInlineNote = {
  id: string;
  body: string;
};

export type LiveSessionInlineMaterial = {
  id: string;
  description: string;
  totalCostCents: number;
};

type ComposerNote = { localId: string; body: string };
type ComposerMaterial = {
  localId: string;
  description: string;
  totalText: string;
};

const EMPTY_NOTES: LiveSessionInlineNote[] = [];
const EMPTY_MATERIALS: LiveSessionInlineMaterial[] = [];

type LiveSessionBottomSheetProps = {
  typography: TextStyles;
  visible: boolean;
  jobShortDescription: string;
  startedAt: string;
  attachments: JobDetailSessionAttachment[];
  onAddNote: () => void;
  onAddMaterial: () => void;
  onPressAttachment: (item: { kind: 'note' | 'material'; id: string }) => void;
  onMinimize: () => void;
  onClosed?: () => void;
  /**
   * Opens Edit Live Session from the capture card.
   * Required when `phase3Capture` is false; unused when true.
   */
  onEditPress?: () => void;
  /**
   * Opens Edit Job from the header.
   * Required when `phase3Capture` is false; unused when true.
   */
  onEditJobPress?: () => void;
  onEndSessionPress: () => void;
  /** Phase 3 capture surface (inline identity + flat list). */
  phase3Capture?: boolean;
  jobIdentity?: LiveSessionJobIdentity;
  onJobIdentityChange?: (patch: LiveSessionJobIdentityPatch) => void;
  onCustomerSnapshotSave?: (draft: CustomerDraft) => void | Promise<void>;
  supabase?: FieldSoloSupabaseClient;
  onChangeStartedAt?: (iso: string) => void | Promise<void>;
  /** Phase 3: persisted notes on the live session (inline edit). */
  liveNotes?: LiveSessionInlineNote[];
  /** Phase 3: persisted materials on the live session (inline edit). */
  liveMaterials?: LiveSessionInlineMaterial[];
  onCreateNote?: (body: string) => Promise<void>;
  onUpdateNote?: (id: string, body: string) => Promise<void>;
  onDeleteNote?: (id: string) => Promise<void>;
  onCreateMaterial?: (input: {
    description: string;
    totalCostCents: number;
  }) => Promise<void>;
  onUpdateMaterial?: (
    id: string,
    input: { description: string; totalCostCents: number },
  ) => Promise<void>;
  onDeleteMaterial?: (id: string) => Promise<void>;
};

function newLocalId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseMoneyToCents(text: string): number | null {
  const cleaned = text.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function combineDateAndTime(dateSource: Date, timeSource: Date): Date {
  const out = new Date(dateSource);
  out.setHours(timeSource.getHours(), timeSource.getMinutes(), 0, 0);
  return out;
}

function customerDraftFromIdentity(identity: LiveSessionJobIdentity): CustomerDraft {
  return {
    customerName: identity.customerName,
    customerPhone: identity.customerPhone,
    customerEmail: identity.customerEmail,
    customerId: identity.customerId,
    serviceAddress: identity.serviceAddress,
  };
}

function customerDraftKey(draft: CustomerDraft): string {
  return [
    draft.customerName,
    draft.customerPhone,
    draft.customerEmail,
    draft.serviceAddress,
    draft.customerId ?? '',
  ].join('\u0001');
}

/**
 * Live Session bottom sheet.
 * Flag-off: capture card + header EDIT.
 * Flag-on (phase3Capture): inline identity tiles, in-place start time,
 * Job-Edit-style note/material rows (no nested capture sheets).
 */
export function LiveSessionBottomSheet({
  typography,
  visible,
  jobShortDescription,
  startedAt,
  attachments,
  onAddNote,
  onAddMaterial,
  onPressAttachment,
  onMinimize,
  onClosed,
  onEditPress,
  onEditJobPress,
  onEndSessionPress,
  phase3Capture = false,
  jobIdentity,
  onJobIdentityChange,
  onCustomerSnapshotSave,
  supabase,
  onChangeStartedAt,
  liveNotes = EMPTY_NOTES,
  liveMaterials = EMPTY_MATERIALS,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
  onCreateMaterial,
  onUpdateMaterial,
  onDeleteMaterial,
}: LiveSessionBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(true);
  const elapsed = useElapsedSeconds(startedAt, visible);

  const startedDate = useMemo(() => new Date(startedAt), [startedAt]);
  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(startedDate),
    [startedDate],
  );
  const startedAtLabel = useMemo(
    () =>
      `Started at: ${new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      }).format(startedDate)}`,
    [startedDate],
  );

  const [title, setTitle] = useState(jobIdentity?.shortDescription ?? jobShortDescription);
  const [longDescription, setLongDescription] = useState(jobIdentity?.longDescription ?? '');
  const initialCustomerDraft = customerDraftFromIdentity(
    jobIdentity ?? {
      shortDescription: jobShortDescription,
      longDescription: '',
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      customerId: null,
      serviceAddress: '',
      revenueCents: null,
    },
  );
  const [customerDraft, setCustomerDraft] = useState<CustomerDraft>(initialCustomerDraft);
  const customerDraftRef = useRef<CustomerDraft>(initialCustomerDraft);
  const lastPersistedCustomerKey = useRef(customerDraftKey(initialCustomerDraft));
  const customerSaveInFlight = useRef<Promise<void> | null>(null);
  const retryCustomerSave = useRef<() => void>(() => undefined);
  const customerSaveAlertOpen = useRef(false);
  const sessionTransitionInFlight = useRef(false);
  const [customerSavePending, setCustomerSavePending] = useState(false);
  const [customerFieldFocused, setCustomerFieldFocused] = useState(false);
  const [revenueText, setRevenueText] = useState(
    jobIdentity?.revenueCents != null && jobIdentity.revenueCents > 0
      ? formatUsdCombined(jobIdentity.revenueCents)
      : '',
  );
  const [pickerDate, setPickerDate] = useState(() => startOfDay(startedDate));
  const [pickerTime, setPickerTime] = useState(() => startedDate);
  const [activePicker, setActivePicker] = useState<'date' | 'startTime' | null>(null);
  const acceptInlineFocusRef = useRef(false);
  const focusedFieldRef = useRef<'title' | 'longDescription' | 'revenue' | null>(null);
  const titleInputRef = useRef<TextInput>(null);
  const sheetScrollRef = useRef<ScrollView | null>(null);
  const sheetScrollContentRef = useRef<View | null>(null);
  const sheetScrollYRef = useRef(0);
  const [startTimeError, setStartTimeError] = useState<string | null>(null);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingStartedAt = useRef<string | null>(null);
  const startTimeSaveInFlight = useRef(false);
  const onChangeStartedAtRef = useRef(onChangeStartedAt);
  const lastPersistedTitle = useRef(jobIdentity?.shortDescription ?? jobShortDescription);
  const lastIdentityKey = useRef<string | null>(null);
  const draftRef = useRef({
    title: jobIdentity?.shortDescription ?? jobShortDescription,
    longDescription: jobIdentity?.longDescription ?? '',
    revenueText:
      jobIdentity?.revenueCents != null && jobIdentity.revenueCents > 0
        ? formatUsdCombined(jobIdentity.revenueCents)
        : '',
  });
  const [composerNotes, setComposerNotes] = useState<ComposerNote[]>([]);
  const [composerMaterials, setComposerMaterials] = useState<ComposerMaterial[]>([]);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [materialDrafts, setMaterialDrafts] = useState<
    Record<string, { description: string; totalText: string }>
  >({});
  const liveNotesRef = useRef(liveNotes);
  const liveMaterialsRef = useRef(liveMaterials);
  const noteDraftsRef = useRef(noteDrafts);
  const materialDraftsRef = useRef(materialDrafts);
  const composerNotesRef = useRef(composerNotes);
  const composerMaterialsRef = useRef(composerMaterials);
  liveNotesRef.current = liveNotes;
  liveMaterialsRef.current = liveMaterials;
  noteDraftsRef.current = noteDrafts;
  materialDraftsRef.current = materialDrafts;
  composerNotesRef.current = composerNotes;
  composerMaterialsRef.current = composerMaterials;

  useEffect(() => {
    if (!visible) {
      setComposerNotes([]);
      setComposerMaterials([]);
      setNoteDrafts({});
      setMaterialDrafts({});
      acceptInlineFocusRef.current = false;
      focusedFieldRef.current = null;
      Keyboard.dismiss();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    // Android grants first-TextInput focus when the overlay appears, which
    // hides END SESSION. Ignore that until the open animation settles.
    acceptInlineFocusRef.current = false;
    focusedFieldRef.current = null;
    Keyboard.dismiss();
    titleInputRef.current?.blur();
    const settle = setTimeout(() => {
      Keyboard.dismiss();
      titleInputRef.current?.blur();
      acceptInlineFocusRef.current = true;
    }, 320);
    return () => {
      clearTimeout(settle);
      acceptInlineFocusRef.current = false;
    };
  }, [visible]);

  useEffect(() => {
    setNoteDrafts((prev) => {
      let changed = false;
      const next: Record<string, string> = {};
      for (const note of liveNotes) {
        if (note.id in prev) {
          next[note.id] = prev[note.id]!;
        } else {
          next[note.id] = note.body;
          changed = true;
        }
      }
      for (const id of Object.keys(prev)) {
        if (!(id in next)) changed = true;
      }
      return changed || Object.keys(prev).length !== Object.keys(next).length
        ? next
        : prev;
    });
  }, [liveNotes]);

  useEffect(() => {
    setMaterialDrafts((prev) => {
      let changed = false;
      const next: Record<string, { description: string; totalText: string }> = {};
      for (const material of liveMaterials) {
        if (material.id in prev) {
          next[material.id] = prev[material.id]!;
        } else {
          next[material.id] = {
            description: material.description,
            totalText:
              material.totalCostCents > 0
                ? formatUsdCombined(material.totalCostCents)
                : '',
          };
          changed = true;
        }
      }
      for (const id of Object.keys(prev)) {
        if (!(id in next)) changed = true;
      }
      return changed || Object.keys(prev).length !== Object.keys(next).length
        ? next
        : prev;
    });
  }, [liveMaterials]);

  useEffect(() => {
    setPickerDate(startOfDay(startedDate));
    setPickerTime(startedDate);
    setActivePicker(null);
    setStartTimeError(null);
  }, [startedDate]);

  useEffect(() => {
    if (!visible || !jobIdentity) return;
    const key = [
      jobIdentity.shortDescription,
      jobIdentity.longDescription,
      jobIdentity.customerName,
      jobIdentity.customerPhone,
      jobIdentity.customerEmail,
      jobIdentity.customerId ?? '',
      jobIdentity.serviceAddress,
      jobIdentity.revenueCents ?? '',
    ].join('\u0001');
    if (key === lastIdentityKey.current) return;
    lastIdentityKey.current = key;
    const focused = focusedFieldRef.current;
    const nextRevenueText =
      jobIdentity.revenueCents != null && jobIdentity.revenueCents > 0
        ? formatUsdCombined(jobIdentity.revenueCents)
        : '';
    if (focused !== 'title') {
      setTitle(jobIdentity.shortDescription);
    }
    if (focused !== 'longDescription') {
      setLongDescription(jobIdentity.longDescription);
    }
    if (
      !customerFieldFocused &&
      !customerSaveInFlight.current &&
      customerDraftKey(customerDraftRef.current) === lastPersistedCustomerKey.current
    ) {
      const nextCustomer = customerDraftFromIdentity(jobIdentity);
      setCustomerDraft(nextCustomer);
      customerDraftRef.current = nextCustomer;
      lastPersistedCustomerKey.current = customerDraftKey(nextCustomer);
    }
    if (focused !== 'revenue') {
      setRevenueText(nextRevenueText);
    }
    draftRef.current = {
      title: focused === 'title' ? draftRef.current.title : jobIdentity.shortDescription,
      longDescription:
        focused === 'longDescription'
          ? draftRef.current.longDescription
          : jobIdentity.longDescription,
      revenueText: focused === 'revenue' ? draftRef.current.revenueText : nextRevenueText,
    };
    if (focused !== 'title') {
      lastPersistedTitle.current = jobIdentity.shortDescription;
    }
  }, [customerFieldFocused, jobIdentity, visible]);

  const flushIdentity = useCallback(
    (next?: LiveSessionJobIdentityPatch) => {
      if (!onJobIdentityChange) return;
      if (persistTimer.current) {
        clearTimeout(persistTimer.current);
        persistTimer.current = null;
      }
      const draft = draftRef.current;
      const nextTitle = (next?.shortDescription ?? draft.title).trim();
      if (!nextTitle) {
        // Defer empty-title persist until blur; do not restore text mid-edit.
        const { shortDescription: _drop, ...rest } = next ?? {};
        if (Object.keys(rest).length === 0) return;
        onJobIdentityChange(rest);
        return;
      }
      const cents =
        next?.revenueCents !== undefined
          ? next.revenueCents
          : parseMoneyToCents(draft.revenueText);
      const patch: LiveSessionJobIdentityPatch = {
        shortDescription: nextTitle.slice(0, JOB_SHORT_DESCRIPTION_MAX_LENGTH),
        longDescription: next?.longDescription ?? draft.longDescription,
        revenueCents: cents,
      };
      onJobIdentityChange(patch);
      lastPersistedTitle.current = nextTitle;
      const customer = customerDraftRef.current;
      lastIdentityKey.current = [
        patch.shortDescription,
        patch.longDescription,
        customer.customerName,
        customer.customerPhone,
        customer.customerEmail,
        customer.customerId ?? '',
        customer.serviceAddress,
        patch.revenueCents ?? '',
      ].join('\u0001');
    },
    [onJobIdentityChange],
  );

  const schedulePersist = useCallback(() => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => flushIdentity(), 500);
  }, [flushIdentity]);

  useEffect(
    () => () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    },
    [],
  );

  useEffect(() => {
    onChangeStartedAtRef.current = onChangeStartedAt;
  }, [onChangeStartedAt]);

  const flushStartedAt = useCallback(async () => {
    if (startTimeSaveInFlight.current) return;
    const next = pendingStartedAt.current;
    const save = onChangeStartedAtRef.current;
    if (!next || !save) return;
    pendingStartedAt.current = null;
    startTimeSaveInFlight.current = true;
    try {
      await save(next);
    } catch {
      // The parent surfaces the persistence error. Keep a later picker value queued.
    } finally {
      startTimeSaveInFlight.current = false;
      if (pendingStartedAt.current) void flushStartedAt();
    }
  }, []);

  const commitStartedAt = useCallback(
    (nextDate: Date, nextTime: Date) => {
      if (!onChangeStartedAt) return;
      const combined = combineDateAndTime(nextDate, nextTime);
      if (combined.getTime() > Date.now()) {
        setStartTimeError("Start time can't be in the future.");
        return;
      }
      setStartTimeError(null);
      const iso = combined.toISOString();
      if (iso === new Date(startedAt).toISOString()) return;
      pendingStartedAt.current = iso;
      void flushStartedAt();
    },
    [flushStartedAt, onChangeStartedAt, startedAt],
  );

  const openDatePicker = useCallback(() => {
    setActivePicker((prev) => (prev === 'date' ? null : 'date'));
  }, []);

  const openTimePicker = useCallback(() => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: pickerTime,
        mode: 'time',
        is24Hour: false,
        onChange: (event: DateTimePickerEvent, selectedDate?: Date) => {
          if (event.type === 'dismissed' || !selectedDate) return;
          setPickerTime(selectedDate);
          commitStartedAt(pickerDate, selectedDate);
        },
      });
      return;
    }
    setActivePicker((prev) => (prev === 'startTime' ? null : 'startTime'));
  }, [commitStartedAt, pickerDate, pickerTime]);

  const timeValueLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      }).format(pickerTime),
    [pickerTime],
  );
  const pickerDateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(pickerDate),
    [pickerDate],
  );

  const iconColor = fg.secondary;

  const addComposerNote = useCallback(() => {
    setActivePicker(null);
    setComposerNotes((prev) => [...prev, { localId: newLocalId(), body: '' }]);
  }, []);

  const addComposerMaterial = useCallback(() => {
    setActivePicker(null);
    setComposerMaterials((prev) => [
      ...prev,
      { localId: newLocalId(), description: '', totalText: '' },
    ]);
  }, []);

  const persistNewNote = useCallback(
    async (localId: string, body: string) => {
      const trimmed = body.trim();
      if (!trimmed || !onCreateNote) {
        setComposerNotes((prev) => prev.filter((n) => n.localId !== localId));
        return;
      }
      try {
        await onCreateNote(trimmed);
      } catch {
        return;
      }
      setComposerNotes((prev) => prev.filter((n) => n.localId !== localId));
    },
    [onCreateNote],
  );

  const persistExistingNote = useCallback(
    async (id: string, body: string) => {
      const trimmed = body.trim();
      const original = liveNotes.find((n) => n.id === id);
      if (!onUpdateNote || !original || trimmed === original.body) return;
      if (!trimmed) return;
      await onUpdateNote(id, trimmed);
    },
    [liveNotes, onUpdateNote],
  );

  const persistNewMaterial = useCallback(
    async (localId: string, description: string, totalText: string) => {
      const desc = description.trim();
      const cents = parseMoneyToCents(totalText);
      if (!desc || cents == null || !onCreateMaterial) {
        if (!desc && (totalText.trim() === '' || cents === 0)) {
          setComposerMaterials((prev) => prev.filter((m) => m.localId !== localId));
        }
        return;
      }
      try {
        await onCreateMaterial({ description: desc, totalCostCents: cents });
      } catch {
        return;
      }
      setComposerMaterials((prev) => prev.filter((m) => m.localId !== localId));
    },
    [onCreateMaterial],
  );

  const persistExistingMaterial = useCallback(
    async (id: string, description: string, totalText: string) => {
      const original = liveMaterials.find((m) => m.id === id);
      if (!onUpdateMaterial || !original) return;
      const desc = description.trim();
      const cents = parseMoneyToCents(totalText) ?? 0;
      if (!desc) return;
      if (desc === original.description && cents === original.totalCostCents) return;
      await onUpdateMaterial(id, { description: desc, totalCostCents: cents });
    },
    [liveMaterials, onUpdateMaterial],
  );

  const dismissStartedPickers = useCallback(() => {
    setActivePicker(null);
  }, []);

  const onInlineFieldFocus = useCallback(
    (field: NonNullable<typeof focusedFieldRef.current>) => {
      setActivePicker(null);
      if (!acceptInlineFocusRef.current) {
        titleInputRef.current?.blur();
        Keyboard.dismiss();
        return;
      }
      focusedFieldRef.current = field;
    },
    [],
  );

  const onInlineFieldBlur = useCallback(
    (field: NonNullable<typeof focusedFieldRef.current>) => {
      if (focusedFieldRef.current === field) {
        focusedFieldRef.current = null;
      }
    },
    [],
  );

  const dismissInlineEditing = useCallback(() => {
    setActivePicker(null);
    focusedFieldRef.current = null;
    setCustomerFieldFocused(false);
    titleInputRef.current?.blur();
    const focused = TextInput.State.currentlyFocusedInput();
    if (focused) {
      TextInput.State.blurTextInput(focused);
    }
    Keyboard.dismiss();
  }, []);

  const updateCustomerDraft = useCallback((patch: Partial<CustomerDraft>) => {
    const next = { ...customerDraftRef.current, ...patch };
    customerDraftRef.current = next;
    setCustomerDraft(next);
  }, []);

  const commitCustomerSnapshot = useCallback(
    async (draft?: CustomerDraft) => {
      if (!onCustomerSnapshotSave) return true;
      if (draft) {
        customerDraftRef.current = draft;
        setCustomerDraft(draft);
      }
      if (customerSaveInFlight.current) {
        try {
          await customerSaveInFlight.current;
          return true;
        } catch {
          return false;
        }
      }

      const saveLatestDraft = async () => {
        while (true) {
          const next = customerDraftRef.current;
          const key = customerDraftKey(next);
          if (key === lastPersistedCustomerKey.current) return;
          await onCustomerSnapshotSave(next);
          lastPersistedCustomerKey.current = key;
          if (customerDraftKey(customerDraftRef.current) === key) return;
        }
      };
      const pending = saveLatestDraft();
      customerSaveInFlight.current = pending;
      setCustomerSavePending(true);
      try {
        await pending;
        customerSaveAlertOpen.current = false;
        return true;
      } catch {
        if (!customerSaveAlertOpen.current) {
          customerSaveAlertOpen.current = true;
          Alert.alert(
            "Couldn't save customer details. Try again.",
            undefined,
            [
              {
                text: 'Try again',
                onPress: () => {
                  customerSaveAlertOpen.current = false;
                  retryCustomerSave.current();
                },
              },
            ],
            { onDismiss: () => { customerSaveAlertOpen.current = false; } },
          );
        }
        return false;
      } finally {
        if (customerSaveInFlight.current === pending) {
          customerSaveInFlight.current = null;
          setCustomerSavePending(false);
        }
      }
    },
    [onCustomerSnapshotSave],
  );
  retryCustomerSave.current = () => {
    void commitCustomerSnapshot();
  };

  const flushPendingEdits = useCallback(async () => {
    const customerSaved = commitCustomerSnapshot();
    flushIdentity();
    for (const note of liveNotesRef.current) {
      void persistExistingNote(note.id, noteDraftsRef.current[note.id] ?? note.body);
    }
    for (const note of composerNotesRef.current) {
      void persistNewNote(note.localId, note.body);
    }
    for (const material of liveMaterialsRef.current) {
      const draft = materialDraftsRef.current[material.id];
      void persistExistingMaterial(
        material.id,
        draft?.description ?? material.description,
        draft?.totalText ??
          (material.totalCostCents > 0 ? formatUsdCombined(material.totalCostCents) : ''),
      );
    }
    for (const material of composerMaterialsRef.current) {
      void persistNewMaterial(material.localId, material.description, material.totalText);
    }
    return customerSaved;
  }, [
    commitCustomerSnapshot,
    flushIdentity,
    persistExistingMaterial,
    persistExistingNote,
    persistNewMaterial,
    persistNewNote,
  ]);

  const handleEndSessionPress = useCallback(async () => {
    if (sessionTransitionInFlight.current) return;
    sessionTransitionInFlight.current = true;
    dismissInlineEditing();
    try {
      if (!(await flushPendingEdits())) return;
      onEndSessionPress();
    } finally {
      sessionTransitionInFlight.current = false;
    }
  }, [dismissInlineEditing, flushPendingEdits, onEndSessionPress]);

  /** Blur + persist drafts before minimizing so X / swipe does not drop in-progress edits. */
  const handleMinimize = useCallback(async () => {
    if (sessionTransitionInFlight.current) return;
    sessionTransitionInFlight.current = true;
    dismissInlineEditing();
    try {
      if (!(await flushPendingEdits())) return;
      onMinimize();
    } finally {
      sessionTransitionInFlight.current = false;
    }
  }, [dismissInlineEditing, flushPendingEdits, onMinimize]);

  const statusBarTop =
    Platform.OS === 'android'
      ? Math.max(insets.top, StatusBar.currentHeight ?? 0)
      : insets.top;
  // Keep Close / ACTIVE SESSION below the status bar at rest. The dark slab
  // still scrolls away with the form — do not pin it.
  const headerTopPad = Math.max(statusBarTop, 0);

  return (
    <EditKeyboardScrollProvider
      scrollViewRef={sheetScrollRef}
      scrollContentRef={sheetScrollContentRef}
      scrollYRef={sheetScrollYRef}
      active={visible && phase3Capture}
    >
    <BottomSheetShell
      visible={visible}
      scrollViewRef={sheetScrollRef}
      onClose={handleMinimize}
      onClosed={onClosed}
      variant="fullbleedDark"
      autoSizeUpToFraction={1}
      // Opt out of the global sheet stack — same as LegacyLiveSessionBottomSheet.
      // Registering would hide NativeTabs while the sheet opens; on Android that
      // races RNScreens fragment updates when restoring from the minimized bar
      // over another overlay (e.g. Inbox) and crashes with "Unexpected fragment
      // manager state".
      registerInGlobalStack={false}
      stickyFooter={
        phase3Capture && !customerFieldFocused ? (
          <FullWidthFab
            typography={typography}
            label="END SESSION"
            accessibilityLabel="End session"
            onPress={handleEndSessionPress}
            includeSafeArea
          />
        ) : undefined
      }
    >
      <View
        style={[
          styles.dark,
          // Keep Close / ACTIVE SESSION below the status bar at rest; they scroll away.
          { paddingTop: headerTopPad + space('Spacing/8') },
        ]}
      >
        <View style={styles.darkContent}>
          <View style={styles.headerTopRow}>
            {/*
              Same icon + hit target as Job Detail close. Skip floating glass here —
              clear Liquid Glass over navy reads as a frosted orb; cream chrome
              matches how that control looks on Job Detail's canvas.
            */}
            <View style={styles.closeChrome}>
              <PlatformHeaderAction
                accessibilityLabel="Close"
                onPress={handleMinimize}
                useFloatingChrome={false}
              >
                <JobDetailIconTopClose color={fg.primary} />
              </PlatformHeaderAction>
            </View>
            <View style={styles.statusSpacer} />
            <View style={styles.statusIdentity}>
              <LiveSessionActiveDotIcon color={color('Brand/Accent')} size={11.5} />
              <Text style={[typography.labelCaps, styles.statusLabel]}>
                ACTIVE SESSION
              </Text>
            </View>
            {!phase3Capture && onEditJobPress ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit job"
                onPress={onEditJobPress}
                style={({ pressed }) => [styles.headerEditButton, pressed && styles.pressed]}
              >
                <SessionCardEditPencilIcon color={fg.primary} />
                <Text style={[typography.pillCompact, styles.headerEditLabel]}>EDIT</Text>
              </Pressable>
            ) : null}
          </View>

          {!phase3Capture ? (
            <View style={styles.titleWrap}>
              <Text style={styles.title}>
                {jobShortDescription || 'Untitled job'}
              </Text>
            </View>
          ) : null}

          <Pressable
            accessible={false}
            onPress={() => {
              dismissStartedPickers();
              dismissInlineEditing();
            }}
            style={styles.timerWrap}
          >
            <Text style={styles.timer}>{formatTimer(elapsed)}</Text>
          </Pressable>
        </View>
      </View>

      <View
        ref={sheetScrollContentRef}
        style={[
          styles.body,
          // Same scroll runway as Job Detail edit — last fields can rise above the IME.
          {
            paddingBottom:
              space('Spacing/32') + insets.bottom + EDIT_KEYBOARD_BOTTOM_CLEARANCE,
          },
        ]}
      >
        {phase3Capture && activePicker != null ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss started picker"
            onPress={dismissStartedPickers}
            style={styles.pickerDismissOverlay}
          />
        ) : null}
        {phase3Capture ? (
          <>
            <View style={styles.pickerHitLayer}>
            <EditSheet>
              <EditTitleField
                ref={titleInputRef}
                typography={typography}
                accessibilityLabel="Job title"
                placeholder="Job title"
                value={title}
                autoFocus={false}
                onChangeText={(t) => {
                  const next = t.slice(0, JOB_SHORT_DESCRIPTION_MAX_LENGTH);
                  setTitle(next);
                  draftRef.current = { ...draftRef.current, title: next };
                  schedulePersist();
                }}
                onFocus={() => onInlineFieldFocus('title')}
                onBlur={() => {
                  onInlineFieldBlur('title');
                  flushIdentity();
                }}
              />
              <EditDescriptionField
                typography={typography}
                accessibilityLabel="Job description"
                placeholder="Description"
                value={longDescription}
                onChangeText={(t) => {
                  setLongDescription(t);
                  draftRef.current = { ...draftRef.current, longDescription: t };
                  schedulePersist();
                }}
                onFocus={() => onInlineFieldFocus('longDescription')}
                onBlur={() => {
                  onInlineFieldBlur('longDescription');
                  flushIdentity();
                }}
              />
            </EditSheet>
            </View>

            <View style={styles.pickerHitLayer}>
            <EditSheet>
              <Pressable
                accessible={false}
                disabled={activePicker == null}
                onPress={dismissStartedPickers}
              >
                <EditIconRow icon={<JobDetailIconSectionSessions color={iconColor} />}>
                  <View style={styles.startedContent}>
                    <Text style={[typography.bodySmall, { color: fg.secondary }]}>Started</Text>
                    <View style={styles.startedValues}>
                      <EditTappableValue
                        typography={typography}
                        value={pickerDateLabel}
                        accessibilityLabel="Started date"
                        onPress={openDatePicker}
                      />
                      <EditTappableValue
                        typography={typography}
                        value={timeValueLabel}
                        accessibilityLabel="Started time"
                        onPress={openTimePicker}
                      />
                    </View>
                  </View>
                </EditIconRow>
              </Pressable>
              {activePicker === 'date' ? (
                <View style={styles.pickerWrap}>
                  <InlineMonthCalendar
                    typography={typography}
                    value={pickerDate}
                    onChange={(picked) => {
                      const next = startOfDay(picked);
                      setPickerDate(next);
                      setActivePicker(null);
                      commitStartedAt(next, pickerTime);
                    }}
                  />
                </View>
              ) : null}
              {activePicker === 'startTime' && Platform.OS === 'ios' ? (
                <View style={styles.pickerWrap}>
                  <DateTimePicker
                    value={pickerTime}
                    mode="time"
                    display="spinner"
                    onChange={(_event, selectedDate) => {
                      if (!selectedDate) return;
                      setPickerTime(selectedDate);
                      commitStartedAt(pickerDate, selectedDate);
                    }}
                  />
                </View>
              ) : null}
              {startTimeError ? (
                <Text style={[typography.bodySmall, styles.startTimeError]}>
                  {startTimeError}
                </Text>
              ) : null}
            </EditSheet>
            </View>

            <View style={styles.pickerHitLayer}>
            {supabase ? (
              <CustomerFieldsBlock
                typography={typography}
                iconColor={iconColor}
                draft={customerDraft}
                onChange={updateCustomerDraft}
                surface="live_session"
                supabase={supabase}
                onFocusChange={(focused) => {
                  setCustomerFieldFocused(focused);
                  if (focused) dismissStartedPickers();
                }}
                onCustomerFieldBlur={() => {
                  void commitCustomerSnapshot();
                }}
                onCustomerCommit={(next) => {
                  void commitCustomerSnapshot(next);
                }}
              />
            ) : null}
            {phase3Capture && customerSavePending ? (
              <Text style={[typography.bodySmall, { color: fg.secondary }]}>Saving customer details…</Text>
            ) : null}

            <EditSheet>
              <EditIconRow icon={<JobDetailIconSectionOtherCosts color={iconColor} />}>
                <EditFieldInput
                  typography={typography}
                  placeholder="Revenue"
                  value={revenueText}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  onChangeText={(t) => {
                    const next = sanitizeDecimalInput(t);
                    setRevenueText(next);
                    draftRef.current = { ...draftRef.current, revenueText: next };
                  }}
                  onFocus={() => onInlineFieldFocus('revenue')}
                  onBlur={() => {
                    onInlineFieldBlur('revenue');
                    const cents = parseMoneyToCents(draftRef.current.revenueText);
                    const formatted =
                      cents != null && cents > 0 ? formatUsdCombined(cents) : '';
                    setRevenueText(formatted);
                    draftRef.current = { ...draftRef.current, revenueText: formatted };
                    flushIdentity({ revenueCents: cents });
                  }}
                />
              </EditIconRow>
            </EditSheet>

            <EditSheet>
              {liveMaterials.map((material, index) => {
                const draft = materialDrafts[material.id] ?? {
                  description: material.description,
                  totalText:
                    material.totalCostCents > 0
                      ? formatUsdCombined(material.totalCostCents)
                      : '',
                };
                return (
                  <EditSwipeableRow
                    key={material.id}
                    typography={typography}
                    accessibilityLabel="Delete material"
                    onDelete={() => {
                      void onDeleteMaterial?.(material.id);
                    }}
                  >
                    <View style={index > 0 ? editSheetRowSeparator : undefined}>
                      <EditIconGroup
                        icon={<JobDetailIconSectionMaterials color={iconColor} />}
                      >
                        <EditFieldInput
                          typography={typography}
                          value={draft.description}
                          onChangeText={(description) =>
                            setMaterialDrafts((prev) => ({
                              ...prev,
                              [material.id]: { ...draft, description },
                            }))
                          }
                          placeholder="Description"
                          onFocus={() => {
                            setActivePicker(null);
                            if (!acceptInlineFocusRef.current) {
                              titleInputRef.current?.blur();
                              Keyboard.dismiss();
                            }
                          }}
                          onBlur={() => {
                            void persistExistingMaterial(
                              material.id,
                              draft.description,
                              draft.totalText,
                            );
                          }}
                        />
                        <EditFieldInput
                          typography={typography}
                          value={draft.totalText}
                          onChangeText={(totalText) => {
                            const sanitized = sanitizeDecimalInput(totalText);
                            setMaterialDrafts((prev) => ({
                              ...prev,
                              [material.id]: { ...draft, totalText: sanitized },
                            }));
                          }}
                          placeholder="Total"
                          keyboardType="decimal-pad"
                          onFocus={() => {
                            setActivePicker(null);
                            if (!acceptInlineFocusRef.current) {
                              titleInputRef.current?.blur();
                              Keyboard.dismiss();
                            }
                          }}
                          onBlur={() => {
                            const cents = parseMoneyToCents(draft.totalText);
                            const formatted =
                              cents != null && cents > 0
                                ? formatUsdCombined(cents)
                                : draft.totalText;
                            setMaterialDrafts((prev) => ({
                              ...prev,
                              [material.id]: { ...draft, totalText: formatted },
                            }));
                            void persistExistingMaterial(
                              material.id,
                              draft.description,
                              draft.totalText,
                            );
                          }}
                        />
                      </EditIconGroup>
                    </View>
                  </EditSwipeableRow>
                );
              })}
              {composerMaterials.map((material, index) => (
                <EditSwipeableRow
                  key={material.localId}
                  typography={typography}
                  accessibilityLabel="Delete material"
                  onDelete={() =>
                    setComposerMaterials((prev) =>
                      prev.filter((m) => m.localId !== material.localId),
                    )
                  }
                >
                  <View
                    style={
                      liveMaterials.length > 0 || index > 0
                        ? editSheetRowSeparator
                        : undefined
                    }
                  >
                    <EditIconGroup
                      icon={<JobDetailIconSectionMaterials color={iconColor} />}
                    >
                      <EditFieldInput
                        typography={typography}
                        value={material.description}
                        onChangeText={(description) =>
                          setComposerMaterials((prev) =>
                            prev.map((m) =>
                              m.localId === material.localId
                                ? { ...m, description }
                                : m,
                            ),
                          )
                        }
                        placeholder="Description"
                        onFocus={() => {
                            setActivePicker(null);
                            if (!acceptInlineFocusRef.current) {
                              titleInputRef.current?.blur();
                              Keyboard.dismiss();
                            }
                          }}
                        onBlur={() => {
                          void persistNewMaterial(
                            material.localId,
                            material.description,
                            material.totalText,
                          );
                        }}
                      />
                      <EditFieldInput
                        typography={typography}
                        value={material.totalText}
                        onChangeText={(totalText) => {
                          const sanitized = sanitizeDecimalInput(totalText);
                          setComposerMaterials((prev) =>
                            prev.map((m) =>
                              m.localId === material.localId
                                ? { ...m, totalText: sanitized }
                                : m,
                            ),
                          );
                        }}
                        placeholder="Total"
                        keyboardType="decimal-pad"
                        onFocus={() => {
                            setActivePicker(null);
                            if (!acceptInlineFocusRef.current) {
                              titleInputRef.current?.blur();
                              Keyboard.dismiss();
                            }
                          }}
                        onBlur={() => {
                          void persistNewMaterial(
                            material.localId,
                            material.description,
                            material.totalText,
                          );
                        }}
                      />
                    </EditIconGroup>
                  </View>
                </EditSwipeableRow>
              ))}
              <EditAddRow
                typography={typography}
                label="Add material"
                icon={<JobDetailIconSectionMaterials color={iconColor} />}
                onPress={addComposerMaterial}
                showTopBorder={liveMaterials.length + composerMaterials.length > 0}
              />
            </EditSheet>

            <EditSheet>
              {liveNotes.map((note, index) => (
                <EditSwipeableRow
                  key={note.id}
                  typography={typography}
                  accessibilityLabel="Delete note"
                  onDelete={() => {
                    void onDeleteNote?.(note.id);
                  }}
                >
                  <View style={index > 0 ? editSheetRowSeparator : undefined}>
                    <EditIconGroup
                      icon={<JobDetailIconSectionNotes color={iconColor} />}
                    >
                      <EditFieldInput
                        typography={typography}
                        value={noteDrafts[note.id] ?? note.body}
                        onChangeText={(body) =>
                          setNoteDrafts((prev) => ({ ...prev, [note.id]: body }))
                        }
                        placeholder="Note"
                        multiline
                        onFocus={() => {
                            setActivePicker(null);
                            if (!acceptInlineFocusRef.current) {
                              titleInputRef.current?.blur();
                              Keyboard.dismiss();
                            }
                          }}
                        onBlur={() => {
                          void persistExistingNote(
                            note.id,
                            noteDrafts[note.id] ?? note.body,
                          );
                        }}
                      />
                    </EditIconGroup>
                  </View>
                </EditSwipeableRow>
              ))}
              {composerNotes.map((note, index) => (
                <EditSwipeableRow
                  key={note.localId}
                  typography={typography}
                  accessibilityLabel="Delete note"
                  onDelete={() =>
                    setComposerNotes((prev) =>
                      prev.filter((n) => n.localId !== note.localId),
                    )
                  }
                >
                  <View
                    style={
                      liveNotes.length > 0 || index > 0
                        ? editSheetRowSeparator
                        : undefined
                    }
                  >
                    <EditIconGroup
                      icon={<JobDetailIconSectionNotes color={iconColor} />}
                    >
                      <EditFieldInput
                        typography={typography}
                        value={note.body}
                        onChangeText={(body) =>
                          setComposerNotes((prev) =>
                            prev.map((n) =>
                              n.localId === note.localId ? { ...n, body } : n,
                            ),
                          )
                        }
                        placeholder="Note"
                        multiline
                        onFocus={() => {
                            setActivePicker(null);
                            if (!acceptInlineFocusRef.current) {
                              titleInputRef.current?.blur();
                              Keyboard.dismiss();
                            }
                          }}
                        onBlur={() => {
                          void persistNewNote(note.localId, note.body);
                        }}
                      />
                    </EditIconGroup>
                  </View>
                </EditSwipeableRow>
              ))}
              <EditAddRow
                typography={typography}
                label="Add note"
                icon={<JobDetailIconSectionNotes color={iconColor} />}
                onPress={addComposerNote}
                showTopBorder={liveNotes.length + composerNotes.length > 0}
              />
            </EditSheet>
            </View>
          </>
        ) : (
          <LiveSessionCaptureCard
            typography={typography}
            dateLabel={dateLabel}
            startedAtLabel={startedAtLabel}
            expanded={expanded}
            onToggle={() => setExpanded((p) => !p)}
            onEditPress={onEditPress!}
            attachments={attachments}
            onAddNote={onAddNote}
            onAddMaterial={onAddMaterial}
            onPressAttachment={onPressAttachment}
          />
        )}
      </View>
    </BottomSheetShell>
    </EditKeyboardScrollProvider>
  );
}

function formatTimer(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hh = Math.floor(safe / 3600);
  const mm = Math.floor((safe % 3600) / 60);
  const ss = safe % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hh === 0) return `${pad(mm)}:${pad(ss)}`;
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

function useElapsedSeconds(startedAt: string, active: boolean): number {
  const startMs = useMemo(() => new Date(startedAt).getTime(), [startedAt]);
  const initial = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
  const [seconds, setSeconds] = useState(initial);

  useEffect(() => {
    setSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    if (!active) return;
    const id = setInterval(() => {
      setSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [active, startMs]);

  return seconds;
}

const styles = StyleSheet.create({
  dark: {
    width: '100%',
    backgroundColor: color('Foundation/Border/Default'),
    paddingHorizontal: space('Spacing/20'),
    paddingBottom: space('Spacing/8'),
    overflow: 'hidden',
    alignItems: 'center',
  },
  darkContent: {
    width: '100%',
    paddingHorizontal: space('Spacing/8'),
    paddingTop: 0,
    paddingBottom: space('Spacing/8'),
    gap: space('Spacing/12'),
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    minHeight: 44,
    gap: space('Spacing/8'),
  },
  closeChrome: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: bg.canvasWarm,
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadowRn,
  },
  statusIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  statusSpacer: {
    flex: 1,
    minWidth: 0,
  },
  statusLabel: {
    color: color('Foundation/Text/Muted'),
  },
  headerEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space('Spacing/8'),
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: space('Spacing/12'),
    paddingVertical: space('Spacing/8'),
    borderRadius: radius('Radius/12'),
    backgroundColor: bg.canvasWarm,
    ...cardShadowRn,
  },
  headerEditLabel: {
    color: fg.primary,
  },
  titleWrap: {
    width: '100%',
  },
  title: {
    fontFamily: 'PTSerif_700Bold',
    fontSize: 24,
    lineHeight: 30,
    color: color('Foundation/Surface/White'),
  },
  timerWrap: {
    width: '100%',
    alignItems: 'center',
    paddingTop: space('Spacing/4'),
  },
  timer: {
    fontFamily: 'Ubuntu_700Bold',
    fontSize: 70,
    lineHeight: 86,
    color: color('Foundation/Surface/White'),
    textAlign: 'center',
  },
  body: {
    width: '100%',
    backgroundColor: bg.canvasWarm,
    paddingHorizontal: space('Spacing/20'),
    paddingTop: space('Spacing/12'),
    gap: space('Spacing/12'),
  },
  startedContent: {
    gap: space('Spacing/4'),
  },
  startedValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space('Spacing/12'),
  },
  pickerWrap: {
    paddingHorizontal: space('Spacing/16'),
    paddingBottom: space('Spacing/12'),
  },
  pickerDismissOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
  pickerHitLayer: {
    zIndex: 2,
    gap: space('Spacing/12'),
  },
  startTimeError: {
    color: color('Semantic/Status/Error/Text'),
    paddingHorizontal: space('Spacing/16'),
    paddingBottom: space('Spacing/12'),
  },
  pressed: { opacity: 0.85 },
});
