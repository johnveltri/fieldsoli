import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { JobDetailScreen } from './JobDetailScreen';
import type { JobDetailViewModel } from '@fieldsolo/shared-types';

const mockClaimFeedbackPromptMilestone = jest.fn<(...args: unknown[]) => Promise<1 | 3 | null>>();
const mockMarkFeedbackSent = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockOpenFeedbackEmail = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockStartLiveSession = jest.fn<(...args: unknown[]) => Promise<{ id: string }>>();
const mockEndLiveSessionNow = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockRefreshLiveSession = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockUpdateLiveSessionJobShortDescription = jest.fn();
let mockFullscreenEditFlagState = { enabled: true, ready: true };
let mockLiveSession: { id: string; jobId: string } | null = null;

jest.mock('../lib/feedback', () => ({
  claimFeedbackPromptMilestone: (...args: unknown[]) => mockClaimFeedbackPromptMilestone(...args),
  markFeedbackSent: (...args: unknown[]) => mockMarkFeedbackSent(...args),
  openFeedbackEmail: (...args: unknown[]) => mockOpenFeedbackEmail(...args),
}));

jest.mock('expo-font', () => ({
  useFonts: () => [true],
}));

// JobDetailScreen consumes the global LiveSessionContext to wire the
// "Live Session" tile on the New Session chooser and to refetch when the
// in-progress live session for the current job ends. The full provider
// requires Supabase env + AuthContext + AppState wiring that's out of
// scope for these tests, so we stub it here with a no-op shape that
// reports "no live session in progress".
jest.mock('../context/JobsListInvalidationContext', () => ({
  useJobsListInvalidation: () => ({
    version: 0,
    invalidateJobsList: jest.fn(),
  }),
}));

jest.mock('../context/LiveSessionContext', () => ({
  useLiveSession: () => ({
    liveSession: mockLiveSession,
    hydrating: false,
    hasLiveSession: false,
    mode: 'hidden' as const,
    startLiveSession: mockStartLiveSession,
    openSheet: jest.fn(),
    minimize: jest.fn(),
    openEditSheet: jest.fn(),
    closeEditSheet: jest.fn(),
    minimizeFromEdit: jest.fn(),
    endLiveSessionNow: mockEndLiveSessionNow,
    updateLiveSessionStartedAt: jest.fn(),
    deleteLiveSessionNow: jest.fn(),
    updateLiveSessionJobShortDescription: mockUpdateLiveSessionJobShortDescription,
    refresh: mockRefreshLiveSession,
  }),
  useHasLiveSession: () => false,
}));

jest.mock('../components/CanvasTiledBackground', () => ({
  CanvasTiledBackground: () => null,
}));

jest.mock('../components/bottom-nav/BottomNavTabIcons', () => ({
  BottomNavIconEarnings: () => null,
  BottomNavIconHome: () => null,
  BottomNavIconJobs: () => null,
}));

jest.mock('../components/figma-icons/JobDetailScreenIcons', () => ({
  JobDetailIconCtaMore: () => null,
  JobDetailIconSectionAdd: () => null,
  JobDetailIconSectionMaterials: () => null,
  JobDetailIconSectionNotes: () => null,
  JobDetailIconSectionOtherCosts: () => null,
  JobDetailIconSectionSessions: () => null,
  JobDetailIconTopClose: () => null,
  JobDetailIconTopEdit: () => null,
  JobDetailIconViewNote: () => null,
}));

jest.mock('../components/platform/usePlatformGlass', () => ({
  usePlatformGlass: () => ({ useGlass: false, reduceTransparency: false, reduceMotion: true }),
}));

jest.mock('../components/ds', () => ({
  nextStatusAfterPrimaryAction: (status: string) => {
    if (status === 'inProgress') return 'completed';
    if (status === 'completed') return 'paid';
    return 'completed';
  },
  EditJobBottomSheet: ({ visible }: { visible: boolean }) => {
    const { Text } = require('react-native');
    return visible ? <Text accessibilityLabel="Legacy edit">Legacy Edit Job</Text> : null;
  },
  ConfirmMinimumInfoBottomSheet: ({
    visible,
    onConfirmPress,
  }: {
    visible: boolean;
    onConfirmPress?: () => void;
  }) => {
    const { Text } = require('react-native');
    return visible ? (
      <>
        <Text>Confirm minimum info before marking complete</Text>
        <Text onPress={() => onConfirmPress?.()}>Confirm Info</Text>
      </>
    ) : null;
  },
  EditOtherCostBottomSheet: () => null,
  JobDetailCtaRow: ({
    onPrimaryPress,
    onMorePress,
  }: {
    onPrimaryPress: () => void;
    onMorePress?: () => void;
  }) => {
    const { Text } = require('react-native');
    return (
      <>
        <Text onPress={onPrimaryPress}>Primary status action</Text>
        {onMorePress ? <Text onPress={onMorePress}>Open status sheet</Text> : null}
      </>
    );
  },
  JobDetailJobHeader: ({
    title,
    longDescription,
    customerName,
    serviceAddress,
    onTitlePress,
    onCustomerPress,
  }: {
    title: string;
    longDescription?: string;
    customerName: string;
    serviceAddress: string;
    onTitlePress?: () => void;
    onCustomerPress?: () => void;
  }) => {
    const { Pressable, Text, View } = require('react-native');
    return (
      <View>
        {onTitlePress ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Edit job title" onPress={onTitlePress}>
            <Text>{title}</Text>
            {longDescription ? <Text>{longDescription}</Text> : null}
          </Pressable>
        ) : (
          <>
            <Text>{title}</Text>
            {longDescription ? <Text>{longDescription}</Text> : null}
          </>
        )}
        {onCustomerPress ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Edit customer" onPress={onCustomerPress}>
            <Text>{customerName || 'No Customer'}</Text>
            <Text>{serviceAddress.trim() || 'No Address'}</Text>
          </Pressable>
        ) : (
          <>
            <Text>{customerName || 'No Customer'}</Text>
            <Text>{serviceAddress.trim() || 'No Address'}</Text>
          </>
        )}
      </View>
    );
  },
  JobDetailMetricTertiary: () => null,
  JobDetailSummaryCard: ({ onPress }: { onPress?: () => void }) => {
    const { Pressable, Text } = require('react-native');
    return onPress ? (
      <Pressable accessibilityRole="button" accessibilityLabel="Edit earnings" onPress={onPress}>
        <Text>Summary</Text>
      </Pressable>
    ) : (
      <Text>Summary</Text>
    );
  },
  EditMaterialBottomSheet: ({
    visible,
    title,
    values,
    assignedSession,
    onSavePress,
    onDeletePress,
    onSessionPillPress,
    onUnitPress,
  }: {
    visible: boolean;
    title: string;
    values: {
      description: string;
      quantity: number;
      unit: string;
      unitCostCents: number;
    };
    assignedSession: { id: string } | null;
    onSavePress?: (values: {
      description: string;
      unitCostCents: number;
      quantity: number;
      unit: string;
    }) => void;
    onDeletePress?: () => void;
    onSessionPillPress?: (values: {
      description: string;
      unitCostCents: number;
      quantity: number;
      unit: string;
    }) => void;
    onUnitPress?: (values: {
      description: string;
      unitCostCents: number;
      quantity: number;
      unit: string;
    }) => void;
  }) => {
    const { Text, View } = require('react-native');
    // The real sheet holds description / price / qty in LOCAL state and must
    // lift them to the parent when the user taps the unit / session pill —
    // otherwise they reset when the sheet becomes hidden and is reopened.
    // The mock below forwards the `values` prop as-is for the baseline calls,
    // and exposes an explicit "Type Draft and Open Unit Picker" action the
    // tests can use to simulate a user who typed overrides before tapping
    // the unit cell.
    const typedDraft = {
      description: 'Copper wire',
      unitCostCents: 250,
      quantity: 3,
      unit: values.unit,
    };
    return visible ? (
      <View>
        <Text>{title}</Text>
        <Text>{`Description ${values.description}`}</Text>
        <Text>{`Unit Cost Cents ${values.unitCostCents}`}</Text>
        <Text>{`Quantity ${values.quantity}`}</Text>
        <Text>{`Unit ${values.unit}`}</Text>
        <Text>
          {assignedSession
            ? `Material assigned ${assignedSession.id}`
            : 'Material unassigned'}
        </Text>
        <Text onPress={() => onSessionPillPress?.(values)}>Open Material Session Picker</Text>
        <Text onPress={() => onUnitPress?.(values)}>Open Unit Picker</Text>
        <Text onPress={() => onUnitPress?.(typedDraft)}>
          Type Draft and Open Unit Picker
        </Text>
        <Text onPress={() => onSavePress?.(typedDraft)}>Save Material</Text>
        <Text onPress={() => onDeletePress?.()}>Delete Material</Text>
      </View>
    ) : null;
  },
  DropdownBottomSheet: ({
    visible,
    options,
    onSelect,
  }: {
    visible: boolean;
    options: Array<{ id: string; label: string; value: string }>;
    onSelect: (value: string) => void;
  }) => {
    const { Text, View } = require('react-native');
    return visible ? (
      <View>
        {options.map((o) => (
          <Text key={o.id} onPress={() => onSelect(o.value)}>{`Pick unit ${o.value}`}</Text>
        ))}
      </View>
    ) : null;
  },
  NewSessionBottomSheet: ({
    visible,
    onLiveSessionPress,
    onLogPastPress,
  }: {
    visible: boolean;
    onLiveSessionPress?: () => void;
    onLogPastPress?: () => void;
  }) => {
    const { Text, View } = require('react-native');
    return visible ? (
      <View>
        <Text>new-session-sheet</Text>
        <Text onPress={() => onLiveSessionPress?.()}>Live Session</Text>
        <Text onPress={() => onLogPastPress?.()}>Log Past Session</Text>
      </View>
    ) : null;
  },
  EditSessionBottomSheet: ({
    visible,
    title,
    onSavePress,
    onDeletePress,
  }: {
    visible: boolean;
    title: string;
    onSavePress?: (values: { startedAt: string; endedAt: string }) => void;
    onDeletePress?: () => void;
  }) => {
    const { Text, View } = require('react-native');
    return visible ? (
      <View>
        <Text>{title}</Text>
        <Text
          onPress={() =>
            onSavePress?.({
              startedAt: '2026-04-18T14:00:00.000Z',
              endedAt: '2026-04-18T16:00:00.000Z',
            })
          }
        >
          Save Session
        </Text>
        <Text onPress={() => onDeletePress?.()}>Delete Session</Text>
      </View>
    ) : null;
  },
  // Keep this mock's signature in sync with the real EditNoteBottomSheet
  // contract: `onSessionPillPress` lifts the current body up to the parent.
  EditNoteBottomSheet: ({
    visible,
    title,
    assignedSession,
    onSavePress,
    onDeletePress,
    onSessionPillPress,
  }: {
    visible: boolean;
    title: string;
    assignedSession: { id: string } | null;
    onSavePress?: (values: { body: string }) => void;
    onDeletePress?: () => void;
    onSessionPillPress?: (values: { body: string }) => void;
  }) => {
    const { Text, View } = require('react-native');
    return visible ? (
      <View>
        <Text>{title}</Text>
        <Text>{assignedSession ? `Assigned ${assignedSession.id}` : 'Unassigned'}</Text>
        <Text onPress={() => onSessionPillPress?.({ body: 'Saved note body' })}>
          Open Session Picker
        </Text>
        <Text onPress={() => onSavePress?.({ body: 'Saved note body' })}>Save Note</Text>
        <Text onPress={() => onDeletePress?.()}>Delete Note</Text>
      </View>
    ) : null;
  },
  ChooseSessionBottomSheet: ({
    visible,
    sessions,
    onSelect,
    onRemove,
  }: {
    visible: boolean;
    sessions: Array<{ id: string }>;
    onSelect: (sessionId: string) => void;
    onRemove?: () => void;
  }) => {
    const { Text, View } = require('react-native');
    return visible ? (
      <View>
        {sessions.map((s) => (
          <Text key={s.id} onPress={() => onSelect(s.id)}>{`Pick ${s.id}`}</Text>
        ))}
        <Text onPress={() => onRemove?.()}>Remove Session</Text>
      </View>
    ) : null;
  },
  ViewMaterialsBuckets: ({
    buckets,
    onMaterialPress,
    onCardPress,
  }: {
    buckets: Array<{
      items: Array<{
        id: string;
        name: string;
        quantityLabel: string;
        priceLabel: string;
      }>;
    }>;
    onMaterialPress?: (materialId: string) => void;
    onCardPress?: () => void;
  }) => {
    const { Text, View } = require('react-native');
    return (
      <View>
        {onCardPress ? (
          <Text onPress={onCardPress}>Edit materials</Text>
        ) : null}
        {buckets
          .flatMap((b) => b.items)
          .map((m) => (
            <View key={m.id}>
              <Text onPress={() => onMaterialPress?.(m.id)}>{m.name}</Text>
              <Text>{m.quantityLabel}</Text>
              <Text>{m.priceLabel}</Text>
            </View>
          ))}
      </View>
    );
  },
  ViewOtherCostsBuckets: ({
    onCardPress,
  }: {
    onCardPress?: () => void;
  }) => {
    const { Text, View } = require('react-native');
    return onCardPress ? (
      <View>
        <Text onPress={onCardPress}>Edit other costs</Text>
      </View>
    ) : null;
  },
  ViewNotesBuckets: ({
    buckets,
    onNotePress,
    onCardPress,
  }: {
    buckets: Array<{
      notes: Array<{
        id: string;
        excerpt: string;
        dateLabel: string;
      }>;
    }>;
    onNotePress?: (noteId: string) => void;
    onCardPress?: () => void;
  }) => {
    const { Text, View } = require('react-native');
    return (
      <View>
        {onCardPress ? <Text onPress={onCardPress}>Edit notes</Text> : null}
        {buckets
          .flatMap((b) => b.notes)
          .map((n) => (
            <View key={n.id}>
              <Text onPress={() => onNotePress?.(n.id)}>{n.excerpt}</Text>
              <Text>{n.dateLabel}</Text>
            </View>
          ))}
      </View>
    );
  },
  ViewSessionsBuckets: ({
    sessions,
    onCardPress,
    emphasizeCriticalEmpty,
  }: {
    sessions: Array<{
      id: string;
      dateLabel: string;
      durationLabel?: string;
      startedAt?: string;
      endedAt?: string | null;
      clockStartExplicit?: boolean;
      clockEndExplicit?: boolean;
      clockTimesExplicit?: boolean;
      timeRangeLabel?: string;
    }>;
    onCardPress?: () => void;
    emphasizeCriticalEmpty?: boolean;
  }) => {
    const { Text, View } = require('react-native');
    const { sessionViewTimeLabel } = require('../lib/jobDetailRowHealth');
    return (
      <View>
        {onCardPress ? <Text onPress={onCardPress}>Edit sessions</Text> : null}
        {sessions.map((s) => {
          const timeLabel = sessionViewTimeLabel(s);
          return (
            <View key={s.id}>
              <Text>{s.dateLabel}</Text>
              {timeLabel ? <Text>{timeLabel}</Text> : null}
              {emphasizeCriticalEmpty && s.durationLabel ? (
                <Text>{s.durationLabel}</Text>
              ) : null}
            </View>
          );
        })}
      </View>
    );
  },
  SessionCard: ({
    session,
    onEditPress,
    onRowBodyPress,
    onAddNote,
    onAddMaterial,
    onPressAttachment,
    readOnlyExpand,
    viewMode,
    missingLine,
  }: {
    session: {
      id: string;
      dateLabel: string;
      durationLabel?: string;
      attachments?: Array<{ kind: 'note' | 'material'; id: string; title: string }>;
    };
    onEditPress: () => void;
    onRowBodyPress?: () => void;
    onAddNote?: () => void;
    onAddMaterial?: () => void;
    onPressAttachment?: (item: { kind: 'note' | 'material'; id: string }) => void;
    readOnlyExpand?: boolean;
    viewMode?: boolean;
    missingLine?: string | null;
  }) => {
    const { Text, View } = require('react-native');
    const flatView = viewMode ?? readOnlyExpand;
    return (
      <View>
        <Text>{session.dateLabel}</Text>
        {missingLine ? <Text>{missingLine}</Text> : null}
        {flatView && onRowBodyPress ? (
          <Text onPress={onRowBodyPress}>{`Open session ${session.id}`}</Text>
        ) : (
          <Text onPress={onEditPress}>{`Edit session ${session.id}`}</Text>
        )}
        {!flatView && onAddNote ? (
          <Text onPress={onAddNote}>{`Add note to session ${session.id}`}</Text>
        ) : null}
        {!flatView && onAddMaterial ? (
          <Text onPress={onAddMaterial}>{`Add material to session ${session.id}`}</Text>
        ) : null}
        {!flatView &&
          session.attachments?.map((item) => (
            <Text
              key={`${item.kind}-${item.id}`}
              onPress={() => onPressAttachment?.({ kind: item.kind, id: item.id })}
            >
              {`Open ${item.kind} attachment ${item.id}`}
            </Text>
          ))}
      </View>
    );
  },
}));

jest.mock('../lib/featureFlags', () => ({
  useJobDetailFullscreenEditFlag: () => mockFullscreenEditFlagState,
}));

jest.mock('./jobDetailEdit/JobDetailEditMode', () => ({
  JobDetailEditMode: ({
    onBack,
    onDone,
    onDeleteJob,
    saving,
    hideHeader,
    focusTarget,
    editApi,
  }: {
    onBack: () => void;
    onDone: () => void;
    onDeleteJob: () => void;
    saving: boolean;
    hideHeader?: boolean;
    focusTarget?: unknown;
    editApi?: {
      draft: { noMaterialsConfirmed?: boolean; noOtherCostsConfirmed?: boolean } | null;
      updateDraft: (patch: Record<string, unknown>) => void;
    };
  }) => {
    const { Pressable, Text, View } = require('react-native');
    const materialsConfirmed = !!editApi?.draft?.noMaterialsConfirmed;
    const otherCostsConfirmed = !!editApi?.draft?.noOtherCostsConfirmed;
    return (
      <View>
        {hideHeader ? null : (
          <>
            <Pressable accessibilityRole="button" accessibilityLabel="Back" disabled={saving} onPress={onBack}>
              <Text>Back</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Done" disabled={saving} onPress={onDone}>
              <Text>Done</Text>
            </Pressable>
          </>
        )}
        {focusTarget != null ? (
          <Text testID="edit-focus-target">{JSON.stringify(focusTarget)}</Text>
        ) : null}
        {focusTarget === 'materials' ? (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel={materialsConfirmed ? 'No materials confirmed' : 'Confirm no materials'}
            accessibilityState={{ checked: materialsConfirmed }}
            onPress={() =>
              editApi?.updateDraft({ noMaterialsConfirmed: !materialsConfirmed })
            }
          >
            <Text>{materialsConfirmed ? 'No materials confirmed' : 'Confirm no materials'}</Text>
          </Pressable>
        ) : null}
        {focusTarget === 'otherCosts' ? (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel={
              otherCostsConfirmed ? 'No other costs confirmed' : 'Confirm no other costs'
            }
            accessibilityState={{ checked: otherCostsConfirmed }}
            onPress={() =>
              editApi?.updateDraft({ noOtherCostsConfirmed: !otherCostsConfirmed })
            }
          >
            <Text>
              {otherCostsConfirmed ? 'No other costs confirmed' : 'Confirm no other costs'}
            </Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Delete job" disabled={saving} onPress={onDeleteJob}>
          <Text>Delete job</Text>
        </Pressable>
      </View>
    );
  },
}));

jest.mock('@fieldsolo/api-client', () => {
  const actual = jest.requireActual('@fieldsolo/api-client') as Record<string, unknown>;
  return {
    ...actual,
    applyJobDetailEdit: jest.fn(),
    countCompletedJobsForCurrentUser: jest.fn(),
    createManualSession: jest.fn(),
    createMaterial: jest.fn(),
    createNote: jest.fn(),
    deleteMaterial: jest.fn(),
    deleteNote: jest.fn(),
    deleteSession: jest.fn(),
    deleteJobById: jest.fn(),
    fetchFirstJobIdForCurrentUser: jest.fn(),
    fetchJobDetail: jest.fn(),
    updateJobById: jest.fn(),
    updateJobNoMaterialsConfirmed: jest.fn(),
    updateJobCostsReviewed: jest.fn(),
    updateJobNoRevenueConfirmed: jest.fn(),
    updateJobOtherCostsReviewed: jest.fn(),
    createOtherCost: jest.fn(),
    updateOtherCost: jest.fn(),
    deleteOtherCost: jest.fn(),
    isNoMaterialsConfirmedColumnMissingError: jest.fn(() => false),
    updateJobStatusById: jest.fn(),
    updateMaterial: jest.fn(),
    updateNote: jest.fn(),
    updateSessionTimes: jest.fn(),
    endLiveSession: jest.fn(),
  };
});

jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: jest.fn(() => true),
  supabase: {},
}));

function setupDefaultApiMocks(apiClient: {
  fetchJobDetail: { mockResolvedValue: (v: unknown) => void };
  createManualSession: { mockResolvedValue: (v: unknown) => void };
  updateSessionTimes: { mockResolvedValue: (v: unknown) => void };
  deleteSession: { mockResolvedValue: (v: unknown) => void };
  createNote: { mockResolvedValue: (v: unknown) => void };
  updateNote: { mockResolvedValue: (v: unknown) => void };
  deleteNote: { mockResolvedValue: (v: unknown) => void };
  createMaterial: { mockResolvedValue: (v: unknown) => void };
  updateMaterial: { mockResolvedValue: (v: unknown) => void };
  deleteMaterial: { mockResolvedValue: (v: unknown) => void };
  updateJobNoMaterialsConfirmed: { mockResolvedValue: (v: unknown) => void };
  updateJobCostsReviewed: { mockResolvedValue: (v: unknown) => void };
  updateJobNoRevenueConfirmed: { mockResolvedValue: (v: unknown) => void };
  updateJobOtherCostsReviewed: { mockResolvedValue: (v: unknown) => void };
  createOtherCost: { mockResolvedValue: (v: unknown) => void };
  updateOtherCost: { mockResolvedValue: (v: unknown) => void };
  deleteOtherCost: { mockResolvedValue: (v: unknown) => void };
  updateJobStatusById: { mockResolvedValue: (v: unknown) => void };
  countCompletedJobsForCurrentUser: { mockResolvedValue: (v: unknown) => void };
  applyJobDetailEdit: { mockResolvedValue: (v: unknown) => void };
  endLiveSession: { mockResolvedValue: (v: unknown) => void };
}) {
  apiClient.createManualSession.mockResolvedValue('sess-new-1');
  apiClient.updateSessionTimes.mockResolvedValue(undefined);
  apiClient.deleteSession.mockResolvedValue(undefined);
  apiClient.createNote.mockResolvedValue('note-new-1');
  apiClient.updateNote.mockResolvedValue(undefined);
  apiClient.deleteNote.mockResolvedValue(undefined);
  apiClient.createMaterial.mockResolvedValue('mat-new-1');
  apiClient.updateMaterial.mockResolvedValue(undefined);
  apiClient.deleteMaterial.mockResolvedValue(undefined);
  apiClient.updateJobNoMaterialsConfirmed.mockResolvedValue(undefined);
  apiClient.updateJobCostsReviewed.mockResolvedValue(undefined);
  apiClient.updateJobNoRevenueConfirmed.mockResolvedValue(undefined);
  apiClient.updateJobOtherCostsReviewed.mockResolvedValue(undefined);
  apiClient.createOtherCost.mockResolvedValue('oc-new-1');
  apiClient.updateOtherCost.mockResolvedValue(undefined);
  apiClient.deleteOtherCost.mockResolvedValue(undefined);
  apiClient.updateJobStatusById.mockResolvedValue(undefined);
  apiClient.countCompletedJobsForCurrentUser.mockResolvedValue(1);
  apiClient.applyJobDetailEdit.mockResolvedValue(undefined);
  apiClient.endLiveSession.mockResolvedValue(undefined);
  mockStartLiveSession.mockResolvedValue({ id: 'sess-live-1' });
  mockEndLiveSessionNow.mockResolvedValue(null);
  mockLiveSession = null;
  mockRefreshLiveSession.mockResolvedValue(null);
  mockClaimFeedbackPromptMilestone.mockResolvedValue(null);
  mockMarkFeedbackSent.mockResolvedValue(undefined);
  mockOpenFeedbackEmail.mockResolvedValue(undefined);
}

describe('JobDetailScreen manual session and note flows', () => {
  const apiClient = jest.requireMock('@fieldsolo/api-client') as any;

  const baseJob: JobDetailViewModel = {
    id: 'job-1',
    shortDescription: 'Fixture install',
    longDescription: '',
    customerName: 'Alice',
    serviceAddress: '1 Main St',
    jobType: 'electrical',
    lastWorkedLabel: 'Last worked Apr 18, 2026',
    workStatus: 'inProgress',
    earnings: {
      revenueCents: 10000,
      materialsCents: -500,
      otherCostsCents: 0,
      feesCents: 0,
      netEarningsCents: 9500,
    },
    metrics: {
      timeLabel: '2.0h',
      netPerHrDisplay: '$47.50/hr',
      sessionCount: 1,
    },
    displaySessions: [
      {
        id: 'sess-1',
        startedAt: '2026-04-17T14:00:00.000Z',
        endedAt: '2026-04-17T15:00:00.000Z',
        dateLabel: 'Apr 17, 2026',
        timeRangeLabel: '9:00 AM – 10:00 AM',
        durationLabel: '1.0h',
        clockTimesExplicit: true,
        clockStartExplicit: true,
        clockEndExplicit: true,
        calendarDateExplicit: true,
        attachments: [],
      },
    ],
    allSessions: [
      {
        id: 'sess-1',
        startedAt: '2026-04-17T14:00:00.000Z',
        endedAt: '2026-04-17T15:00:00.000Z',
        dateLabel: 'Apr 17, 2026',
        timeRangeLabel: '9:00 AM – 10:00 AM',
        durationLabel: '1.0h',
        clockTimesExplicit: true,
        clockStartExplicit: true,
        clockEndExplicit: true,
        calendarDateExplicit: true,
        attachments: [],
      },
    ],
    inProgressSession: null,
    materialBuckets: [],
    noteBuckets: [
      {
        id: 'note-unassigned',
        kind: 'unassigned',
        notes: [
          {
            id: 'note-1',
            body: 'Existing note body',
            sessionId: null,
            excerpt: 'Existing note excerpt',
            dateLabel: 'Apr 18, 2026',
          },
        ],
      },
    ],
    noMaterialsConfirmed: false,
    otherCostBuckets: [],
    noOtherCostsConfirmed: false,
    noRevenueConfirmed: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFullscreenEditFlagState = { enabled: false, ready: true };
    setupDefaultApiMocks(apiClient);
    apiClient.fetchJobDetail.mockResolvedValue(baseJob);
  });

  it('offers feedback after the first completed job', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockClaimFeedbackPromptMilestone.mockResolvedValueOnce(1);
    let jobState: JobDetailViewModel = {
      ...baseJob,
      noMaterialsConfirmed: true,
      noOtherCostsConfirmed: false,
    };
    apiClient.updateJobOtherCostsReviewed.mockImplementation(async () => {
      jobState = { ...jobState, noOtherCostsConfirmed: true };
    });
    apiClient.fetchJobDetail.mockImplementation(async () => ({ ...jobState }));
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);

    await waitFor(() => expect(screen.getByText('CONFIRM NO OTHER COSTS')).toBeTruthy());
    fireEvent.press(screen.getByText('CONFIRM NO OTHER COSTS'));

    await waitFor(() =>
      expect(apiClient.updateJobOtherCostsReviewed).toHaveBeenCalledWith({}, 'job-1', true),
    );

    await waitFor(() => expect(screen.getByText('Primary status action')).toBeTruthy());
    fireEvent.press(screen.getByText('Primary status action'));

    await waitFor(() => {
      expect(apiClient.countCompletedJobsForCurrentUser).toHaveBeenCalledWith({});
      expect(mockClaimFeedbackPromptMilestone).toHaveBeenCalledWith('user-1', 1);
      expect(alertSpy).toHaveBeenCalledWith(
        "How's FieldSoli working for you?",
        'You just completed your first job. What felt confusing or missing?',
        expect.any(Array),
      );
    });
    alertSpy.mockRestore();
  });

  it('creates a manual session from add flow', async () => {
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);

    await waitFor(() => {
      expect(apiClient.fetchJobDetail).toHaveBeenCalledWith({}, 'job-1');
    });

    fireEvent.press(screen.getByLabelText('Add Sessions'));
    fireEvent.press(screen.getByText('Log Past Session'));
    fireEvent.press(screen.getByText('Save Session'));

    await waitFor(() => {
      expect(apiClient.createManualSession).toHaveBeenCalledWith({}, {
        jobId: 'job-1',
        startedAt: '2026-04-18T14:00:00.000Z',
        endedAt: '2026-04-18T16:00:00.000Z',
      });
    });
  });

  it('closes job detail after starting a live session', async () => {
    const onRequestClose = jest.fn();
    const screen = render(
      <JobDetailScreen
        jobId="job-1"
        sessionUserId="user-1"
        onRequestClose={onRequestClose}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Add Sessions')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Add Sessions'));
    fireEvent.press(screen.getByText('Live Session'));

    await waitFor(() => {
      expect(mockStartLiveSession).toHaveBeenCalledWith({
        jobId: 'job-1',
        jobShortDescription: 'Fixture install',
      });
      expect(onRequestClose).toHaveBeenCalledTimes(1);
    });
  });

  it('updates an existing session from edit flow', async () => {
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText('Edit session sess-1')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Edit session sess-1'));
    fireEvent.press(screen.getByText('Save Session'));

    await waitFor(() => {
      expect(apiClient.updateSessionTimes).toHaveBeenCalledWith({}, 'sess-1', {
        startedAt: '2026-04-18T14:00:00.000Z',
        endedAt: '2026-04-18T16:00:00.000Z',
      });
    });
  });

  it('deletes a session from edit flow', async () => {
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText('Edit session sess-1')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Edit session sess-1'));
    fireEvent.press(screen.getByText('Delete Session'));

    await waitFor(() => {
      expect(apiClient.deleteSession).toHaveBeenCalledWith({}, 'sess-1');
    });
  });

  it('creates a note without session assignment', async () => {
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);

    await waitFor(() => {
      expect(screen.getByLabelText('Add Notes')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Add Notes'));
    fireEvent.press(screen.getByText('Save Note'));

    await waitFor(() => {
      expect(apiClient.createNote).toHaveBeenCalledWith({}, {
        jobId: 'job-1',
        sessionId: null,
        body: 'Saved note body',
      });
    });
  });

  it('creates a note assigned to a selected session', async () => {
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);

    await waitFor(() => {
      expect(screen.getByLabelText('Add Notes')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Add Notes'));
    fireEvent.press(screen.getByText('Open Session Picker'));
    fireEvent.press(screen.getByText('Pick sess-1'));
    fireEvent.press(screen.getByText('Save Note'));

    await waitFor(() => {
      expect(apiClient.createNote).toHaveBeenCalledWith({}, {
        jobId: 'job-1',
        sessionId: 'sess-1',
        body: 'Saved note body',
      });
    });
  });

  it('creates a note from a session card add action', async () => {
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText('Add note to session sess-1')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Add note to session sess-1'));
    expect(screen.getByText('Assigned sess-1')).toBeTruthy();
    fireEvent.press(screen.getByText('Save Note'));

    await waitFor(() => {
      expect(apiClient.createNote).toHaveBeenCalledWith({}, {
        jobId: 'job-1',
        sessionId: 'sess-1',
        body: 'Saved note body',
      });
    });
  });

  it('updates an existing note from edit flow', async () => {
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText('Existing note excerpt')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Existing note excerpt'));
    fireEvent.press(screen.getByText('Save Note'));

    await waitFor(() => {
      expect(apiClient.updateNote).toHaveBeenCalledWith({}, 'note-1', {
        body: 'Saved note body',
        sessionId: null,
        jobId: 'job-1',
      });
    });
  });

  it('soft-deletes an existing note from edit flow', async () => {
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText('Existing note excerpt')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Existing note excerpt'));
    fireEvent.press(screen.getByText('Delete Note'));

    await waitFor(() => {
      expect(apiClient.deleteNote).toHaveBeenCalledWith({}, 'note-1');
    });
  });

  it('hides in-progress sessions from session cards but lists them in the session picker', async () => {
    apiClient.fetchJobDetail.mockResolvedValueOnce({
      ...baseJob,
      displaySessions: [
        ...baseJob.displaySessions,
      ],
      allSessions: [
        ...baseJob.allSessions,
        {
          id: 'sess-progress',
          startedAt: '2026-04-18T09:00:00.000Z',
          endedAt: null,
          dateLabel: 'Apr 18, 2026',
          timeRangeLabel: '9:00 AM',
          durationLabel: '0.2h',
          clockTimesExplicit: true,
          clockStartExplicit: true,
          clockEndExplicit: false,
          attachments: [],
        },
      ],
      inProgressSession: {
        id: 'sess-progress',
        startedAt: '2026-04-18T09:00:00.000Z',
        endedAt: null,
        dateLabel: 'Apr 18, 2026',
        timeRangeLabel: '9:00 AM',
        durationLabel: '0.2h',
        clockTimesExplicit: true,
        clockStartExplicit: true,
        clockEndExplicit: false,
        attachments: [],
      },
    });

    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText('Edit session sess-1')).toBeTruthy();
    });
    expect(screen.queryByText('Edit session sess-progress')).toBeNull();

    fireEvent.press(screen.getByLabelText('Add Notes'));
    fireEvent.press(screen.getByText('Open Session Picker'));
    expect(screen.getByText('Pick sess-1')).toBeTruthy();
    expect(screen.getByText('Pick sess-progress')).toBeTruthy();
  });

  // --- Materials ---

  const jobWithMaterial: JobDetailViewModel = {
    ...baseJob,
    materialBuckets: [
      {
        id: 'mat-unassigned',
        kind: 'unassigned',
        items: [
          {
            id: 'mat-1',
            sessionId: null,
            name: 'Existing material',
            quantity: 2,
            quantityExplicit: true,
            unit: 'ea',
            unitCostCents: 500,
            unitCostExplicit: true,
            totalCostCents: 1000,
            quantityLabel: '2 ea @ $5.00',
            priceLabel: '$10.00',
          },
        ],
      },
    ],
  };

  it('creates a material without session assignment', async () => {
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);

    await waitFor(() => {
      expect(screen.getByLabelText('Add Materials')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Add Materials'));
    fireEvent.press(screen.getByText('Save Material'));

    await waitFor(() => {
      expect(apiClient.createMaterial).toHaveBeenCalledWith({}, {
        jobId: 'job-1',
        sessionId: null,
        description: 'Copper wire',
        quantity: 3,
        unit: 'ea',
        unitCostCents: 250,
      });
    });
  });

  it('creates a material assigned to a selected session', async () => {
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);

    await waitFor(() => {
      expect(screen.getByLabelText('Add Materials')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Add Materials'));
    fireEvent.press(screen.getByText('Open Material Session Picker'));
    fireEvent.press(screen.getByText('Pick sess-1'));
    fireEvent.press(screen.getByText('Save Material'));

    await waitFor(() => {
      expect(apiClient.createMaterial).toHaveBeenCalledWith({}, {
        jobId: 'job-1',
        sessionId: 'sess-1',
        description: 'Copper wire',
        quantity: 3,
        unit: 'ea',
        unitCostCents: 250,
      });
    });
  });

  it('creates a material from a session card add action', async () => {
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText('Add material to session sess-1')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Add material to session sess-1'));
    expect(screen.getByText('Material assigned sess-1')).toBeTruthy();
    fireEvent.press(screen.getByText('Save Material'));

    await waitFor(() => {
      expect(apiClient.createMaterial).toHaveBeenCalledWith({}, {
        jobId: 'job-1',
        sessionId: 'sess-1',
        description: 'Copper wire',
        quantity: 3,
        unit: 'ea',
        unitCostCents: 250,
      });
    });
  });

  it('opens the unit dropdown and applies the selected unit on save', async () => {
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);

    await waitFor(() => {
      expect(screen.getByLabelText('Add Materials')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Add Materials'));
    // Default unit prefill.
    expect(screen.getByText('Unit ea')).toBeTruthy();
    fireEvent.press(screen.getByText('Open Unit Picker'));
    fireEvent.press(screen.getByText('Pick unit ft'));
    // Back on the material sheet — unit label refreshed.
    expect(screen.getByText('Unit ft')).toBeTruthy();
    fireEvent.press(screen.getByText('Save Material'));

    await waitFor(() => {
      expect(apiClient.createMaterial).toHaveBeenCalledWith({}, {
        jobId: 'job-1',
        sessionId: null,
        description: 'Copper wire',
        quantity: 3,
        unit: 'ft',
        unitCostCents: 250,
      });
    });
  });

  // Regression: tapping the unit cell (or the session pill) while the user
  // has typed values must lift those values up into parent draft state,
  // otherwise the sheet resets to its pre-edit values on return. See
  // https://… (bug: "cleared everything I had previously entered" after
  // selecting a unit in the dropdown).
  it('preserves typed draft values across the unit-picker round-trip', async () => {
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);

    await waitFor(() => {
      expect(screen.getByLabelText('Add Materials')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Add Materials'));
    // Initial blanks from openAddMaterial.
    expect(screen.getByText('Description ')).toBeTruthy();
    expect(screen.getByText('Unit Cost Cents 0')).toBeTruthy();
    expect(screen.getByText('Quantity 1')).toBeTruthy();

    // Simulate: user typed description / price / qty, then tapped the unit
    // cell — the mock emits those values via `onUnitPress(currentDraft)`.
    fireEvent.press(screen.getByText('Type Draft and Open Unit Picker'));
    fireEvent.press(screen.getByText('Pick unit ft'));

    // On return the sheet must be reseeded from the cached draft, not from
    // the pristine openAddMaterial defaults.
    expect(screen.getByText('Description Copper wire')).toBeTruthy();
    expect(screen.getByText('Unit Cost Cents 250')).toBeTruthy();
    expect(screen.getByText('Quantity 3')).toBeTruthy();
    expect(screen.getByText('Unit ft')).toBeTruthy();
  });

  it('updates an existing material from edit flow', async () => {
    apiClient.fetchJobDetail.mockResolvedValue(jobWithMaterial);
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText('Existing material')).toBeTruthy();
    });

    // View-only row shows qty + unit + per-unit cost inline ("2 ea @ $5.00"),
    // while the right column continues to render the total (`priceLabel`).
    expect(screen.getByText('2 ea @ $5.00')).toBeTruthy();
    expect(screen.getByText('$10.00')).toBeTruthy();

    fireEvent.press(screen.getByText('Existing material'));
    fireEvent.press(screen.getByText('Save Material'));

    await waitFor(() => {
      expect(apiClient.updateMaterial).toHaveBeenCalledWith({}, 'mat-1', {
        description: 'Copper wire',
        quantity: 3,
        unit: 'ea',
        unitCostCents: 250,
        sessionId: null,
        jobId: 'job-1',
      });
    });
  });

  it('soft-deletes an existing material from edit flow', async () => {
    apiClient.fetchJobDetail.mockResolvedValue(jobWithMaterial);
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText('Existing material')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Existing material'));
    fireEvent.press(screen.getByText('Delete Material'));

    await waitFor(() => {
      expect(apiClient.deleteMaterial).toHaveBeenCalledWith({}, 'mat-1');
    });
  });

  it('blocks mark paid when the job is financially incomplete', async () => {
    apiClient.fetchJobDetail.mockResolvedValue({
      ...baseJob,
      workStatus: 'completed',
      earnings: {
        ...baseJob.earnings,
        revenueCents: 0,
        netEarningsCents: 0,
      },
    });
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);

    await waitFor(() => expect(screen.getByText('Primary status action')).toBeTruthy());
    fireEvent.press(screen.getByText('Primary status action'));

    await waitFor(() =>
      expect(screen.getByText('Confirm minimum info before marking complete')).toBeTruthy(),
    );
    expect(apiClient.updateJobStatusById).not.toHaveBeenCalled();
  });

  it('sets completed job back to in progress when other costs confirmation is undone', async () => {
    let jobState: JobDetailViewModel = {
      ...baseJob,
      workStatus: 'completed',
      noMaterialsConfirmed: true,
      noOtherCostsConfirmed: true,
    };
    apiClient.fetchJobDetail.mockImplementation(async () => ({ ...jobState }));
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);

    await waitFor(() =>
      expect(screen.getByLabelText('Undo no other costs confirmation')).toBeTruthy(),
    );

    jobState = {
      ...jobState,
      noOtherCostsConfirmed: false,
    };
    fireEvent.press(screen.getByLabelText('Undo no other costs confirmation'));

    await waitFor(() => {
      expect(apiClient.updateJobOtherCostsReviewed).toHaveBeenCalledWith({}, 'job-1', false);
      expect(apiClient.updateJobStatusById).toHaveBeenCalledWith({}, 'job-1', 'inProgress');
    });

    jobState = { ...jobState, workStatus: 'inProgress' };
  });
});

describe('JobDetailScreen edit mode', () => {
  const apiClient = jest.requireMock('@fieldsolo/api-client') as any;

  const baseJob: JobDetailViewModel = {
    id: 'job-1',
    shortDescription: 'Fixture install',
    longDescription: '',
    customerName: 'Alice',
    serviceAddress: '1 Main St',
    jobType: 'electrical',
    lastWorkedLabel: 'Last worked Apr 18, 2026',
    workStatus: 'inProgress',
    earnings: {
      revenueCents: 10000,
      materialsCents: -500,
      otherCostsCents: 0,
      feesCents: 0,
      netEarningsCents: 9500,
    },
    metrics: {
      timeLabel: '2.0h',
      netPerHrDisplay: '$47.50/hr',
      sessionCount: 1,
    },
    displaySessions: [],
    allSessions: [],
    inProgressSession: null,
    materialBuckets: [],
    otherCostBuckets: [],
    noteBuckets: [],
    noMaterialsConfirmed: false,
    noOtherCostsConfirmed: false,
    noRevenueConfirmed: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFullscreenEditFlagState = { enabled: true, ready: true };
    setupDefaultApiMocks(apiClient);
    apiClient.fetchJobDetail.mockResolvedValue(baseJob);
  });

  it('opens edit mode from the header EDIT pill', async () => {
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);
    await waitFor(() => expect(screen.getByLabelText('Edit job')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Edit job'));
    expect(screen.getByLabelText('Done')).toBeTruthy();
    expect(screen.getByLabelText('Close')).toBeTruthy();
  });

  it('opens the legacy edit sheet from the header when fullscreen editing is disabled', async () => {
    mockFullscreenEditFlagState = { enabled: false, ready: true };
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);
    await waitFor(() => expect(screen.getByLabelText('Edit job')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('Edit job'));

    await waitFor(() => expect(screen.getByLabelText('Legacy edit')).toBeTruthy());
    expect(screen.queryByLabelText('Done')).toBeNull();
  });

  it('opens edit mode when initialEditOpen is set', async () => {
    const screen = render(
      <JobDetailScreen jobId="job-1" sessionUserId="user-1" initialEditOpen />,
    );
    await waitFor(() => expect(screen.getByLabelText('Done')).toBeTruthy());
  });

  it('opens the legacy edit sheet for initialEditOpen when fullscreen editing is disabled', async () => {
    mockFullscreenEditFlagState = { enabled: false, ready: true };
    const screen = render(
      <JobDetailScreen jobId="job-1" sessionUserId="user-1" initialEditOpen />,
    );

    await waitFor(() => expect(screen.getByLabelText('Legacy edit')).toBeTruthy());
    expect(screen.queryByLabelText('Done')).toBeNull();
  });

  it('fails closed to one legacy edit sheet when flag readiness resolves unavailable', async () => {
    mockFullscreenEditFlagState = { enabled: false, ready: false };
    const screen = render(
      <JobDetailScreen jobId="job-1" sessionUserId="user-1" initialEditOpen />,
    );

    await waitFor(() => expect(screen.getByLabelText('Edit job')).toBeTruthy());
    expect(screen.queryByLabelText('Legacy edit')).toBeNull();

    mockFullscreenEditFlagState = { enabled: false, ready: true };
    screen.rerender(
      <JobDetailScreen jobId="job-1" sessionUserId="user-1" initialEditOpen />,
    );
    await waitFor(() => expect(screen.getByLabelText('Legacy edit')).toBeTruthy());

    screen.rerender(
      <JobDetailScreen jobId="job-1" sessionUserId="user-1" initialEditOpen />,
    );
    expect(screen.getAllByLabelText('Legacy edit')).toHaveLength(1);
  });

  it('calls applyJobDetailEdit when Done is pressed', async () => {
    const refreshed = { ...baseJob, shortDescription: 'Updated' };
    apiClient.fetchJobDetail
      .mockResolvedValueOnce(baseJob)
      .mockResolvedValueOnce(refreshed);
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);
    await waitFor(() => expect(screen.getByLabelText('Edit job')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Edit job'));
    fireEvent.press(screen.getByLabelText('Done'));
    await waitFor(() =>
      expect(apiClient.applyJobDetailEdit).toHaveBeenCalledWith({}, 'job-1', expect.any(Object)),
    );
  });

  it('locks Done, Close, and Delete job while the apply request is pending', async () => {
    let resolveApply: (() => void) | undefined;
    apiClient.applyJobDetailEdit.mockImplementationOnce(
      () => new Promise<void>((resolve) => {
        resolveApply = resolve;
      }),
    );
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);
    await waitFor(() => expect(screen.getByLabelText('Edit job')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Edit job'));
    fireEvent.press(screen.getByLabelText('Done'));

    await waitFor(() => expect(apiClient.applyJobDetailEdit).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText('Done').props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByLabelText('Close').props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByLabelText('Delete job').props.accessibilityState?.disabled).toBe(true);

    fireEvent.press(screen.getByLabelText('Done'));
    fireEvent.press(screen.getByLabelText('Close'));
    fireEvent.press(screen.getByLabelText('Delete job'));
    expect(apiClient.applyJobDetailEdit).toHaveBeenCalledTimes(1);
    expect(apiClient.deleteJobById).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Done')).toBeTruthy();

    await act(async () => {
      resolveApply?.();
    });
  });
});

describe('JobDetailScreen simplified view (flag on)', () => {
  const apiClient = jest.requireMock('@fieldsolo/api-client') as any;

  const incompleteJob: JobDetailViewModel = {
    id: 'job-1',
    shortDescription: 'Untitled Job',
    longDescription: '',
    customerName: 'Alice',
    serviceAddress: '1 Main St',
    jobType: 'electrical',
    lastWorkedLabel: 'Last worked Apr 18, 2026',
    workStatus: 'inProgress',
    earnings: {
      revenueCents: 0,
      materialsCents: 0,
      otherCostsCents: 0,
      feesCents: 0,
      netEarningsCents: 0,
    },
    metrics: {
      timeLabel: '0.0h',
      netPerHrDisplay: '$0.00/hr',
      sessionCount: 0,
    },
    displaySessions: [
      {
        id: 'sess-partial',
        startedAt: '2026-04-17T14:00:00.000Z',
        endedAt: '2026-04-17T15:00:00.000Z',
        dateLabel: 'No Session Date',
        timeRangeLabel: '',
        durationLabel: 'No duration',
        clockTimesExplicit: false,
        clockStartExplicit: false,
        clockEndExplicit: false,
        calendarDateExplicit: false,
        attachments: [],
      },
    ],
    allSessions: [],
    inProgressSession: null,
    materialBuckets: [],
    otherCostBuckets: [],
    noteBuckets: [],
    noMaterialsConfirmed: false,
    noOtherCostsConfirmed: false,
    noRevenueConfirmed: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFullscreenEditFlagState = { enabled: true, ready: true };
    setupDefaultApiMocks(apiClient);
    apiClient.fetchJobDetail.mockResolvedValue(incompleteJob);
  });

  it('TEST-V01 hides section ADD pills', async () => {
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);
    await waitFor(() => expect(screen.getByText('Sessions')).toBeTruthy());
    expect(screen.queryByLabelText('Add Sessions')).toBeNull();
    expect(screen.queryByLabelText('Add Materials')).toBeNull();
  });

  it('TEST-V14 shows Missing line for incomplete jobs', async () => {
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);
    await waitFor(() =>
      expect(screen.getByText('Missing: revenue, sessions, materials, costs')).toBeTruthy(),
    );
    expect(screen.queryByText(/description/)).toBeNull();
  });

  it('TEST-V15 shows critical session empty placeholders without a duplicate missing line', async () => {
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);
    await waitFor(() => expect(screen.getByText('No Session Date')).toBeTruthy());
    expect(screen.getByText('No duration')).toBeTruthy();
    expect(screen.queryByText('No Session Date · No duration')).toBeNull();
  });

  it('shows start time on View when end clock is missing', async () => {
    const startAt = '2026-04-17T14:00:00.000Z';
    apiClient.fetchJobDetail.mockResolvedValue({
      ...incompleteJob,
      displaySessions: [
        {
          id: 'sess-start-only',
          startedAt: startAt,
          endedAt: null,
          dateLabel: 'Apr 17, 2026',
          timeRangeLabel: '',
          durationLabel: 'No duration',
          clockTimesExplicit: true,
          clockStartExplicit: true,
          clockEndExplicit: false,
          calendarDateExplicit: true,
          attachments: [],
        },
      ],
    });

    const { formatSessionTimeLabel } = require('@fieldsolo/api-client');
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);
    await waitFor(() => expect(screen.getByText('Apr 17, 2026')).toBeTruthy());
    expect(screen.getByText(formatSessionTimeLabel(startAt))).toBeTruthy();
    expect(screen.queryByText(/–/)).toBeNull();
  });

  it('TEST-V03 hides confirm-none cards on empty materials', async () => {
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);
    await waitFor(() => expect(screen.getByText('No materials recorded')).toBeTruthy());
    expect(screen.queryByText('CONFIRM NO MATERIALS USED')).toBeNull();
  });

  it('shows confirmed empty copy on View when none is confirmed', async () => {
    apiClient.fetchJobDetail.mockResolvedValue({
      ...incompleteJob,
      noMaterialsConfirmed: true,
      noOtherCostsConfirmed: true,
    });
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);
    await waitFor(() => expect(screen.getByText('No materials confirmed')).toBeTruthy());
    expect(screen.getByText('No other costs confirmed')).toBeTruthy();
    expect(screen.queryByText('No materials recorded')).toBeNull();
    expect(screen.queryByText('No other costs recorded')).toBeNull();
  });

  it('does not show No sessions recorded while a live session is in progress', async () => {
    apiClient.fetchJobDetail.mockResolvedValue({
      ...incompleteJob,
      displaySessions: [],
      inProgressSession: {
        id: 'sess-live-1',
        startedAt: '2026-04-18T09:00:00.000Z',
        endedAt: null,
        dateLabel: 'Apr 18, 2026',
        timeRangeLabel: '9:00 AM',
        durationLabel: '0.2h',
        clockTimesExplicit: true,
        clockStartExplicit: true,
        clockEndExplicit: false,
        calendarDateExplicit: true,
        attachments: [],
      },
    });
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);
    await waitFor(() => expect(screen.getByText('Live session in progress')).toBeTruthy());
    expect(screen.queryByText('No sessions recorded')).toBeNull();
  });

  it('blocks Paid from the status sheet until financial completeness is met', async () => {
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);
    await waitFor(() => expect(screen.getByText('Open status sheet')).toBeTruthy());
    fireEvent.press(screen.getByText('Open status sheet'));
    fireEvent.press(screen.getByText('Pick unit paid'));

    await waitFor(() =>
      expect(screen.getByText('Confirm minimum info before marking complete')).toBeTruthy(),
    );
    expect(apiClient.updateJobStatusById).not.toHaveBeenCalled();
  });

  it('allows Paid from the status sheet when the job is financially complete', async () => {
    apiClient.fetchJobDetail.mockResolvedValue({
      ...incompleteJob,
      earnings: {
        ...incompleteJob.earnings,
        revenueCents: 40000,
        netEarningsCents: 40000,
      },
      displaySessions: [
        {
          id: 'sess-1',
          startedAt: '2026-04-17T14:00:00.000Z',
          endedAt: '2026-04-17T16:00:00.000Z',
          dateLabel: 'Apr 17, 2026',
          timeRangeLabel: '9:00 AM – 11:00 AM',
          durationLabel: '2.0h',
          clockTimesExplicit: true,
          clockStartExplicit: true,
          clockEndExplicit: true,
          calendarDateExplicit: true,
          attachments: [],
        },
      ],
      noMaterialsConfirmed: true,
      noOtherCostsConfirmed: true,
    });
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);
    await waitFor(() => expect(screen.getByText('Open status sheet')).toBeTruthy());
    fireEvent.press(screen.getByText('Open status sheet'));
    fireEvent.press(screen.getByText('Pick unit paid'));
    await waitFor(() =>
      expect(apiClient.updateJobStatusById).toHaveBeenCalledWith({}, 'job-1', 'paid'),
    );
  });

  it('TEST-V05 opens edit from title, customer and earnings taps', async () => {
    apiClient.fetchJobDetail.mockResolvedValue({
      ...incompleteJob,
      longDescription: 'Replace the valve and recaulk.',
    });
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);
    await waitFor(() => expect(screen.getByText('Replace the valve and recaulk.')).toBeTruthy());
    fireEvent.press(screen.getByText('Replace the valve and recaulk.'));
    await waitFor(() =>
      expect(screen.getByTestId('edit-focus-target')).toHaveTextContent('"title"'),
    );
    fireEvent.press(screen.getByLabelText('Close'));
    await waitFor(() => expect(screen.getByLabelText('Edit customer')).toBeTruthy());
    expect(screen.getByText('1 Main St')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Edit customer'));
    await waitFor(() =>
      expect(screen.getByTestId('edit-focus-target')).toHaveTextContent('"customer"'),
    );
    fireEvent.press(screen.getByLabelText('Close'));
    await waitFor(() => expect(screen.getByLabelText('Edit earnings')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Edit earnings'));
    await waitFor(() =>
      expect(screen.getByTestId('edit-focus-target')).toHaveTextContent('"metrics"'),
    );
    fireEvent.press(screen.getByLabelText('Close'));
    await waitFor(() => expect(screen.getByText('Primary status action')).toBeTruthy());
    fireEvent.press(screen.getByText('Primary status action'));
    await waitFor(() =>
      expect(screen.getByText('Confirm minimum info before marking complete')).toBeTruthy(),
    );
    expect(screen.queryByTestId('edit-focus-target')).toBeNull();
  });

  it('TEST-V16 clears note focusTarget when returning to view before opening another field', async () => {
    apiClient.fetchJobDetail.mockResolvedValue({
      ...incompleteJob,
      noteBuckets: [
        {
          id: 'note-unassigned',
          kind: 'unassigned',
          notes: [
            {
              id: 'note-1',
              body: 'Existing note body',
              sessionId: null,
              excerpt: 'Existing note excerpt',
              dateLabel: 'Apr 18, 2026',
            },
          ],
        },
      ],
    });
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);
    await waitFor(() => expect(screen.getByText('Edit notes')).toBeTruthy());
    fireEvent.press(screen.getByText('Edit notes'));
    await waitFor(() =>
      expect(screen.getByTestId('edit-focus-target')).toHaveTextContent('"notes"'),
    );
    fireEvent.press(screen.getByLabelText('Close'));
    await waitFor(() => expect(screen.queryByTestId('edit-focus-target')).toBeNull());
    fireEvent.press(screen.getByLabelText('Edit customer'));
    await waitFor(() =>
      expect(screen.getByTestId('edit-focus-target')).toHaveTextContent('"customer"'),
    );
  });

  it('TEST-V10 passes focusTarget when opening edit from a sessions card', async () => {
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);
    await waitFor(() => expect(screen.getByText('Edit sessions')).toBeTruthy());
    fireEvent.press(screen.getByText('Edit sessions'));
    await waitFor(() =>
      expect(screen.getByTestId('edit-focus-target')).toHaveTextContent('"sessions"'),
    );
  });

  it('TEST-V13 keeps Close and swaps EDIT for Done in the shared header', async () => {
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);
    await waitFor(() => expect(screen.getByLabelText('Edit job')).toBeTruthy());
    expect(screen.getByLabelText('Close')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Edit job'));
    expect(screen.getByLabelText('Done')).toBeTruthy();
    expect(screen.queryByLabelText('Edit job')).toBeNull();
    expect(screen.getByLabelText('Close')).toBeTruthy();
  });

  it('TEST-V02 hides session expand chrome when view mode is on', async () => {
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);
    await waitFor(() => expect(screen.getByText('Edit sessions')).toBeTruthy());
    expect(screen.queryByText('Add note to session sess-partial')).toBeNull();
    expect(screen.queryByText('Edit session sess-partial')).toBeNull();
  });

  it('TEST-V04 does not open item sheets from view taps', async () => {
    const jobWithMaterial: JobDetailViewModel = {
      ...incompleteJob,
      shortDescription: 'Fixture install',
      earnings: { ...incompleteJob.earnings, revenueCents: 10000 },
      metrics: { ...incompleteJob.metrics, sessionCount: 1 },
      materialBuckets: [
        {
          id: 'mat-unassigned',
          kind: 'unassigned',
          items: [
            {
              id: 'mat-1',
              sessionId: null,
              name: 'Copper wire',
              quantity: 2,
              quantityExplicit: true,
              unit: 'ea',
              unitCostCents: 500,
              unitCostExplicit: true,
              totalCostCents: 1000,
              quantityLabel: '2 ea @ $5.00',
              priceLabel: '$10.00',
            },
          ],
        },
      ],
    };
    apiClient.fetchJobDetail.mockResolvedValue(jobWithMaterial);
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);
    await waitFor(() => expect(screen.getByText('Edit materials')).toBeTruthy());
    fireEvent.press(screen.getByText('Edit materials'));
    await waitFor(() =>
      expect(screen.getByTestId('edit-focus-target')).toHaveTextContent('"materials"'),
    );
    expect(screen.queryByText('Save Material')).toBeNull();
  });

  it('TEST-V07 wizard edit discard cancels mark-complete', async () => {
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);
    await waitFor(() => expect(screen.getByText('Primary status action')).toBeTruthy());
    fireEvent.press(screen.getByText('Primary status action'));
    await waitFor(() =>
      expect(screen.getByText('Confirm minimum info before marking complete')).toBeTruthy(),
    );
    fireEvent.press(screen.getByText('Confirm Info'));
    await waitFor(() =>
      expect(screen.getByTestId('edit-focus-target')).toHaveTextContent('"revenue"'),
    );
    expect(screen.getByLabelText('Next')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Close'));
    await waitFor(() => expect(screen.getByLabelText('Edit job')).toBeTruthy());
    expect(apiClient.updateJobStatusById).not.toHaveBeenCalledWith({}, 'job-1', 'completed');
  });

  it('wizard commit pill says Next with multiple gaps and Done on the last gap', async () => {
    apiClient.fetchJobDetail.mockResolvedValue({
      ...incompleteJob,
      shortDescription: 'Named job',
      earnings: { ...incompleteJob.earnings, revenueCents: 10000 },
      metrics: { ...incompleteJob.metrics, sessionCount: 1 },
      displaySessions: [
        {
          id: 'sess-usable',
          startedAt: '2026-04-17T14:00:00.000Z',
          endedAt: '2026-04-17T15:00:00.000Z',
          dateLabel: 'Apr 17, 2026',
          timeRangeLabel: '9:00 AM – 10:00 AM',
          durationLabel: '1.0h',
          clockTimesExplicit: true,
          clockStartExplicit: true,
          clockEndExplicit: true,
          calendarDateExplicit: true,
          attachments: [],
        },
      ],
    });
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);
    await waitFor(() => expect(screen.getByText('Primary status action')).toBeTruthy());
    fireEvent.press(screen.getByText('Primary status action'));
    await waitFor(() => expect(screen.getByText('Confirm Info')).toBeTruthy());
    fireEvent.press(screen.getByText('Confirm Info'));
    await waitFor(() =>
      expect(screen.getByTestId('edit-focus-target')).toHaveTextContent('"materials"'),
    );
    expect(screen.getByLabelText('Next')).toBeTruthy();
    expect(screen.queryByLabelText('Done')).toBeNull();
    fireEvent.press(screen.getByLabelText('Close'));
    await waitFor(() => expect(screen.getByLabelText('Edit job')).toBeTruthy());

    apiClient.fetchJobDetail.mockResolvedValue({
      ...incompleteJob,
      shortDescription: 'Named job',
      earnings: { ...incompleteJob.earnings, revenueCents: 10000 },
      metrics: { ...incompleteJob.metrics, sessionCount: 1 },
      displaySessions: [
        {
          id: 'sess-usable',
          startedAt: '2026-04-17T14:00:00.000Z',
          endedAt: '2026-04-17T15:00:00.000Z',
          dateLabel: 'Apr 17, 2026',
          timeRangeLabel: '9:00 AM – 10:00 AM',
          durationLabel: '1.0h',
          clockTimesExplicit: true,
          clockStartExplicit: true,
          clockEndExplicit: true,
          calendarDateExplicit: true,
          attachments: [],
        },
      ],
      noMaterialsConfirmed: true,
      noOtherCostsConfirmed: false,
    });
    const lastGapScreen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);
    await waitFor(() => expect(lastGapScreen.getByText('Primary status action')).toBeTruthy());
    fireEvent.press(lastGapScreen.getByText('Primary status action'));
    await waitFor(() => expect(lastGapScreen.getByText('Confirm Info')).toBeTruthy());
    fireEvent.press(lastGapScreen.getByText('Confirm Info'));
    await waitFor(() =>
      expect(lastGapScreen.getByTestId('edit-focus-target')).toHaveTextContent('"otherCosts"'),
    );
    expect(lastGapScreen.getByLabelText('Done')).toBeTruthy();
    expect(lastGapScreen.queryByLabelText('Next')).toBeNull();
  });

  it('TEST-V08 materials confirm-none checkbox in Edit advances completeness gap', async () => {
    const materialsGapJob: JobDetailViewModel = {
      ...incompleteJob,
      shortDescription: 'Fixture install',
      earnings: { ...incompleteJob.earnings, revenueCents: 10000 },
      metrics: { ...incompleteJob.metrics, sessionCount: 1 },
      displaySessions: [
        {
          id: 'sess-usable',
          startedAt: '2026-04-17T14:00:00.000Z',
          endedAt: '2026-04-17T15:00:00.000Z',
          dateLabel: 'Apr 17, 2026',
          timeRangeLabel: '9:00 AM – 10:00 AM',
          durationLabel: '1.0h',
          clockTimesExplicit: true,
          clockStartExplicit: true,
          clockEndExplicit: true,
          calendarDateExplicit: true,
          attachments: [],
        },
      ],
      noOtherCostsConfirmed: true,
    };
    apiClient.fetchJobDetail.mockImplementation(async () => ({ ...materialsGapJob }));
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);
    await waitFor(() => expect(screen.getByText('Primary status action')).toBeTruthy());
    fireEvent.press(screen.getByText('Primary status action'));
    await waitFor(() => expect(screen.getByText('Confirm Info')).toBeTruthy());
    fireEvent.press(screen.getByText('Confirm Info'));
    await waitFor(() =>
      expect(screen.getByTestId('edit-focus-target')).toHaveTextContent('"materials"'),
    );
    fireEvent.press(screen.getByLabelText('Confirm no materials'));
    fireEvent.press(screen.getByLabelText('Done'));
    await waitFor(() =>
      expect(apiClient.applyJobDetailEdit).toHaveBeenCalledWith(
        {},
        'job-1',
        expect.objectContaining({
          job: expect.objectContaining({ noMaterialsConfirmed: true }),
        }),
      ),
    );
    expect(apiClient.updateJobCostsReviewed).not.toHaveBeenCalled();
  });

  it('ends the live session before opening the mark-complete gate', async () => {
    mockLiveSession = { id: 'sess-live-1', jobId: 'job-1' };
    mockEndLiveSessionNow.mockResolvedValue({ id: 'sess-live-1', jobId: 'job-1' });
    apiClient.fetchJobDetail.mockResolvedValue({
      ...incompleteJob,
      inProgressSession: {
        id: 'sess-live-1',
        startedAt: '2026-04-18T09:00:00.000Z',
        endedAt: null,
        dateLabel: 'Apr 18, 2026',
        timeRangeLabel: '9:00 AM',
        durationLabel: '0.2h',
        clockTimesExplicit: true,
        clockStartExplicit: true,
        clockEndExplicit: false,
        calendarDateExplicit: true,
        attachments: [],
      },
    });
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);
    await waitFor(() => expect(screen.getByText('Primary status action')).toBeTruthy());
    fireEvent.press(screen.getByText('Primary status action'));
    await waitFor(() => {
      expect(mockEndLiveSessionNow).toHaveBeenCalled();
    });
    expect(apiClient.endLiveSession).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByText('Confirm minimum info before marking complete')).toBeTruthy(),
    );
    expect(apiClient.updateJobStatusById).not.toHaveBeenCalledWith({}, 'job-1', 'completed');
  });

  it('TEST-V09 flag off keeps ADD pills and confirm cards', async () => {
    mockFullscreenEditFlagState = { enabled: false, ready: true };
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);
    await waitFor(() => expect(screen.getByLabelText('Add Materials')).toBeTruthy());
    expect(screen.getByText('CONFIRM NO MATERIALS USED')).toBeTruthy();
  });

  it('TEST-V11 shows empty and gate copy strings', async () => {
    const screen = render(<JobDetailScreen jobId="job-1" sessionUserId="user-1" />);
    await waitFor(() => expect(screen.getByText('No materials recorded')).toBeTruthy());
    expect(screen.getByText('No other costs recorded')).toBeTruthy();
    expect(screen.getByText('No notes recorded')).toBeTruthy();
    fireEvent.press(screen.getByText('Primary status action'));
    await waitFor(() =>
      expect(screen.getByText('Confirm minimum info before marking complete')).toBeTruthy(),
    );
  });
});
