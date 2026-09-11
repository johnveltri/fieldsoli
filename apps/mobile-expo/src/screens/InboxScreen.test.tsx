import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { InboxScreen } from './InboxScreen';

const mockListInboxNotes = jest.fn<(...args: unknown[]) => Promise<unknown[]>>();
const mockListInboxMaterials = jest.fn<(...args: unknown[]) => Promise<unknown[]>>();
const mockListJobsForCurrentUserPage = jest.fn<
  (...args: unknown[]) => Promise<{ items: unknown[]; hasMore: boolean }>
>();
const mockUpdateNote = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockUpdateMaterial = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockDeleteNote = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockDeleteMaterial = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockInvalidateJobsList = jest.fn<() => void>();
const mockIsSupabaseConfigured = jest.fn<() => boolean>(() => true);
const mockFullscreenEditFlagState = { enabled: false, ready: true };

jest.mock('expo-font', () => ({ useFonts: () => [true] }));

jest.mock('@fieldsolo/api-client', () => ({
  listInboxNotes: (...args: unknown[]) => mockListInboxNotes(...args),
  listInboxMaterials: (...args: unknown[]) => mockListInboxMaterials(...args),
  listJobsForCurrentUserPage: (...args: unknown[]) => mockListJobsForCurrentUserPage(...args),
  updateNote: (...args: unknown[]) => mockUpdateNote(...args),
  updateMaterial: (...args: unknown[]) => mockUpdateMaterial(...args),
  deleteNote: (...args: unknown[]) => mockDeleteNote(...args),
  deleteMaterial: (...args: unknown[]) => mockDeleteMaterial(...args),
}));

jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: () => mockIsSupabaseConfigured(),
  supabase: { client: 'supabase' },
}));

jest.mock('../context/JobsListInvalidationContext', () => ({
  useJobsListInvalidation: () => ({ invalidateJobsList: mockInvalidateJobsList, version: 0 }),
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('../lib/featureFlags/useJobDetailFullscreenEditFlag', () => ({
  useJobDetailFullscreenEditFlag: () => mockFullscreenEditFlagState,
}));

jest.mock('../components/CanvasTiledBackground', () => ({
  CanvasTiledBackground: () => null,
}));

jest.mock('../components/figma-icons/TopHeaderIcons', () => ({
  TopHeaderBackIcon: () => null,
}));

jest.mock('../components/shell/ShellBottomNav', () => ({
  shellBottomNavOuterHeight: () => 80,
}));

jest.mock('../components/ds', () => {
  const { Text, View, Pressable } = require('react-native');
  return {
    SectionHeader: ({ title }: { title: string }) => <Text>{title}</Text>,
    ViewNotesBuckets: ({
      buckets,
      onNotePress,
      onDeleteNote,
    }: {
      buckets: { notes: { id: string; excerpt: string }[] }[];
      onNotePress: (id: string) => void;
      onDeleteNote?: (id: string) => void;
    }) => (
      <View>
        {buckets
          .flatMap((b) => b.notes)
          .map((n) => (
            <View key={n.id}>
              <Text onPress={() => onNotePress(n.id)}>{n.excerpt}</Text>
              {onDeleteNote ? (
                <Text
                  accessibilityRole="button"
                  accessibilityLabel={`Delete note ${n.id}`}
                  onPress={() => onDeleteNote(n.id)}
                >
                  Swipe delete
                </Text>
              ) : null}
            </View>
          ))}
      </View>
    ),
    ViewMaterialsBuckets: ({
      buckets,
      onMaterialPress,
    }: {
      buckets: { items: { id: string; name: string }[] }[];
      onMaterialPress: (id: string) => void;
    }) => (
      <View>
        {buckets
          .flatMap((b) => b.items)
          .map((m) => (
            <Text key={m.id} onPress={() => onMaterialPress(m.id)}>
              {m.name}
            </Text>
          ))}
      </View>
    ),
    ChooseJobBottomSheet: ({
      visible,
      jobs,
      onSelect,
    }: {
      visible: boolean;
      jobs: { id: string; shortDescription: string }[];
      onSelect: (jobId: string) => void;
    }) => {
      if (!visible) return null;
      return (
        <View>
          {jobs.map((j) => (
            <Pressable key={j.id} accessibilityRole="button" onPress={() => onSelect(j.id)}>
              <Text>{`pick ${j.shortDescription}`}</Text>
            </Pressable>
          ))}
        </View>
      );
    },
    CaptureComposerSheet: ({
      visible,
      kind,
      initialNote,
      initialMaterial,
      onAddToJobNote,
      onAddToJobMaterial,
      onSaveNote,
      onSaveMaterial,
    }: {
      visible: boolean;
      kind: 'note' | 'material' | 'note-edit' | 'material-edit' | 'job';
      initialNote?: { body: string } | null;
      initialMaterial?: { description: string } | null;
      onAddToJobNote?: (values: { body: string }) => void;
      onAddToJobMaterial?: (values: {
        description: string;
        totalCostCents: number;
        quantity: number;
        unit: string;
        unitCostCents: number;
        quantityExplicit: boolean;
        unitCostExplicit: boolean;
      }) => void;
      onSaveNote?: (values: { body: string }) => void;
      onSaveMaterial?: (values: { description: string }) => void;
    }) => {
      if (!visible) return null;
      return (
        <View>
          <Text>{`capture:${kind}`}</Text>
          {kind === 'note' || kind === 'note-edit' ? (
            <Text>{`edit-note:${initialNote?.body ?? ''}`}</Text>
          ) : null}
          {kind === 'material' || kind === 'material-edit' ? (
            <Text>{`edit-material:${initialMaterial?.description ?? ''}`}</Text>
          ) : null}
          {onAddToJobNote ? (
            <Text
              accessibilityRole="button"
              accessibilityLabel="Add to job"
              onPress={() =>
                onAddToJobNote({ body: initialNote?.body ?? '' })
              }
            >
              Add to job
            </Text>
          ) : null}
          {onAddToJobMaterial ? (
            <Text
              accessibilityRole="button"
              accessibilityLabel="Add to job"
              onPress={() =>
                onAddToJobMaterial({
                  description: initialMaterial?.description ?? '',
                  totalCostCents: 0,
                  quantity: 1,
                  unit: 'ea',
                  unitCostCents: 0,
                  quantityExplicit: false,
                  unitCostExplicit: false,
                })
              }
            >
              Add to job
            </Text>
          ) : null}
          {onSaveNote ? (
            <Text
              accessibilityRole="button"
              accessibilityLabel="Save note to inbox"
              onPress={() => onSaveNote({ body: initialNote?.body ?? '' })}
            >
              Save note
            </Text>
          ) : null}
          {onSaveMaterial ? (
            <Text
              accessibilityRole="button"
              accessibilityLabel="Save material to inbox"
              onPress={() =>
                onSaveMaterial({
                  description: initialMaterial?.description ?? '',
                })
              }
            >
              Save material
            </Text>
          ) : null}
        </View>
      );
    },
    DropdownBottomSheet: () => null,
  };
});

function nowIso(): string {
  return new Date().toISOString();
}

describe('InboxScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsSupabaseConfigured.mockReturnValue(true);
    mockListInboxNotes.mockResolvedValue([]);
    mockListInboxMaterials.mockResolvedValue([]);
    mockListJobsForCurrentUserPage.mockResolvedValue({ items: [], hasMore: false });
    mockUpdateNote.mockResolvedValue(undefined);
    mockUpdateMaterial.mockResolvedValue(undefined);
    mockDeleteNote.mockResolvedValue(undefined);
    mockDeleteMaterial.mockResolvedValue(undefined);
    mockFullscreenEditFlagState.enabled = false;
    mockFullscreenEditFlagState.ready = true;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('lists unassigned notes under a recency header and assigns one to a job', async () => {
    mockListInboxNotes.mockResolvedValue([
      {
        id: 'note-1',
        body: 'Buy a new gasket',
        sessionId: null,
        excerpt: 'Buy a new gasket',
        dateLabel: 'Jun 7, 2026',
        createdAt: nowIso(),
      },
    ]);
    mockListJobsForCurrentUserPage
      .mockResolvedValueOnce({
        items: [{ id: 'job-1', shortDescription: 'First page job', customerName: 'Bob' }],
        hasMore: true,
      })
      .mockResolvedValueOnce({
        items: [{ id: 'job-9', shortDescription: 'Kitchen remodel', customerName: 'Alice' }],
        hasMore: false,
      });

    const onRequestClose = jest.fn();
    const screen = render(
      <InboxScreen loadKey={1} onRequestClose={onRequestClose} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Buy a new gasket')).toBeTruthy();
    });
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('Notes')).toBeTruthy();
    expect(screen.queryByText('JOB')).toBeNull();

    fireEvent.press(screen.getByText('Buy a new gasket'));

    await waitFor(() => {
      expect(screen.getByText('pick Kitchen remodel')).toBeTruthy();
    });
    expect(mockListJobsForCurrentUserPage).toHaveBeenNthCalledWith(
      1,
      { client: 'supabase' },
      { limit: 100, offset: 0, tab: 'all' },
    );
    expect(mockListJobsForCurrentUserPage).toHaveBeenNthCalledWith(
      2,
      { client: 'supabase' },
      { limit: 100, offset: 1, tab: 'all' },
    );

    fireEvent.press(screen.getByText('pick Kitchen remodel'));

    await waitFor(() => {
      expect(mockUpdateNote).toHaveBeenCalledWith(
        { client: 'supabase' },
        'note-1',
        { sessionId: null, jobId: 'job-9' },
      );
    });
    expect(mockInvalidateJobsList).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByText('Buy a new gasket')).toBeNull();
    });
  });

  it('shows the materials tab with an empty state', async () => {
    mockListInboxNotes.mockResolvedValue([]);
    mockListInboxMaterials.mockResolvedValue([]);

    const screen = render(
      <InboxScreen loadKey={1} onRequestClose={() => undefined} />,
    );

    await waitFor(() => {
      expect(screen.getByText('All caught up! No unassigned notes.')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Materials'));
    expect(screen.getByText('All caught up! No unassigned materials.')).toBeTruthy();
  });

  it('flag on: tapping a note opens the edit sheet instead of assign', async () => {
    mockFullscreenEditFlagState.enabled = true;
    mockFullscreenEditFlagState.ready = true;
    mockListInboxNotes.mockResolvedValue([
      {
        id: 'note-1',
        body: 'Buy a new gasket',
        sessionId: null,
        excerpt: 'Buy a new gasket',
        dateLabel: 'Jun 7, 2026',
        createdAt: nowIso(),
      },
    ]);

    const screen = render(
      <InboxScreen loadKey={1} onRequestClose={() => undefined} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Buy a new gasket')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Buy a new gasket'));

    await waitFor(() => {
      expect(screen.getByText('capture:note-edit')).toBeTruthy();
      expect(screen.getByText('edit-note:Buy a new gasket')).toBeTruthy();
    });
    expect(screen.queryByText(/pick /)).toBeNull();
    expect(mockListJobsForCurrentUserPage).not.toHaveBeenCalled();
  });

  it('flag on: tapping a material opens CaptureComposerSheet', async () => {
    mockFullscreenEditFlagState.enabled = true;
    mockFullscreenEditFlagState.ready = true;
    mockListInboxNotes.mockResolvedValue([]);
    mockListInboxMaterials.mockResolvedValue([
      {
        id: 'mat-1',
        sessionId: null,
        name: 'Copper pipe',
        quantity: 1,
        quantityExplicit: false,
        unit: 'ea',
        unitCostCents: 2500,
        unitCostExplicit: false,
        totalCostCents: 2500,
        quantityLabel: '—',
        priceLabel: '$25.00',
        createdAt: nowIso(),
      },
    ]);

    const screen = render(
      <InboxScreen loadKey={1} onRequestClose={() => undefined} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Copper pipe')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Copper pipe'));

    await waitFor(() => {
      expect(screen.getByText('capture:material-edit')).toBeTruthy();
      expect(screen.getByText('edit-material:Copper pipe')).toBeTruthy();
    });
    expect(screen.queryByText(/pick /)).toBeNull();
  });

  it('TEST-I02 flag on: Add to job assigns and keeps the user in Inbox', async () => {
    mockFullscreenEditFlagState.enabled = true;
    mockFullscreenEditFlagState.ready = true;
    mockListInboxNotes.mockResolvedValue([
      {
        id: 'note-1',
        body: 'Buy a new gasket',
        sessionId: null,
        excerpt: 'Buy a new gasket',
        dateLabel: 'Jun 7, 2026',
        createdAt: nowIso(),
      },
    ]);
    mockListJobsForCurrentUserPage.mockResolvedValue({
      items: [{ id: 'job-1', shortDescription: 'Kitchen remodel', customerName: 'Alice' }],
      hasMore: false,
    });

    const onRequestClose = jest.fn();
    const screen = render(
      <InboxScreen loadKey={1} onRequestClose={onRequestClose} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Buy a new gasket')).toBeTruthy();
    });
    fireEvent.press(screen.getByText('Buy a new gasket'));
    await waitFor(() => expect(screen.getByLabelText('Add to job')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Add to job'));

    await waitFor(() => {
      expect(screen.getByText('pick Kitchen remodel')).toBeTruthy();
    });
    fireEvent.press(screen.getByText('pick Kitchen remodel'));

    await waitFor(() => {
      expect(mockUpdateNote).toHaveBeenCalledWith(
        { client: 'supabase' },
        'note-1',
        expect.objectContaining({ jobId: 'job-1', sessionId: null }),
      );
    });
    expect(onRequestClose).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByText('Buy a new gasket')).toBeNull();
    });
  });

  it('TEST-I03 flag on: swipe delete confirms and deletes the note', async () => {
    mockFullscreenEditFlagState.enabled = true;
    mockFullscreenEditFlagState.ready = true;
    const alertSpy = jest.spyOn(Alert, 'alert');
    mockListInboxNotes.mockResolvedValue([
      {
        id: 'note-1',
        body: 'Buy a new gasket',
        sessionId: null,
        excerpt: 'Buy a new gasket',
        dateLabel: 'Jun 7, 2026',
        createdAt: nowIso(),
      },
    ]);

    const screen = render(
      <InboxScreen loadKey={1} onRequestClose={() => undefined} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Buy a new gasket')).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText('Delete note note-1'));

    expect(alertSpy).toHaveBeenCalled();
    const buttons = alertSpy.mock.calls[0]?.[2] as Array<{
      text: string;
      onPress?: () => void;
    }>;
    const deleteBtn = buttons.find((b) => b.text === 'Delete');
    deleteBtn?.onPress?.();

    await waitFor(() => {
      expect(mockDeleteNote).toHaveBeenCalledWith({ client: 'supabase' }, 'note-1');
    });
    alertSpy.mockRestore();
  });
});
