import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import { Alert, Pressable, Text } from 'react-native';

import { QuickActionsFlowProvider, useQuickActionsFlow } from './QuickActionsFlowContext';

let mockComposerProps: {
  visible: boolean;
  kind: 'note' | 'material';
  onSaveNote: (values: { body: string }) => void;
  onSaveMaterial: (values: {
    description: string;
    totalCostCents: number;
    quantity: number;
    unit: string;
    unitCostCents: number;
    quantityExplicit: boolean;
    unitCostExplicit: boolean;
  }) => void;
} | null = null;

const mockStartLiveSession = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockRefreshLiveSession = jest.fn<(...args: unknown[]) => Promise<unknown>>();

class TestErrorBoundary extends React.Component<React.PropsWithChildren, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    return this.state.error ? <Text>{`Render error: ${this.state.error.message}`}</Text> : this.props.children;
  }
}

jest.mock('expo-font', () => ({ useFonts: () => [true] }));

jest.mock('@fieldsolo/api-client', () => ({
  createBlankJobForLiveSessionStart: jest.fn(),
  createMaterial: jest.fn(),
  createNote: jest.fn(),
  deleteJobById: jest.fn(),
  tryBumpJobToInProgressIfNotStarted: jest.fn(),
}));

jest.mock('../components/ds', () => ({
  CaptureComposerSheet: (props: typeof mockComposerProps) => {
    mockComposerProps = props;
    return null;
  },
}));

jest.mock('../context/JobsListInvalidationContext', () => ({
  useJobsListInvalidation: () => ({ invalidateJobsList: jest.fn() }),
}));

jest.mock('../context/LiveSessionContext', () => ({
  useLiveSession: () => ({
    startLiveSession: (...args: unknown[]) => mockStartLiveSession(...args),
    refresh: (...args: unknown[]) => mockRefreshLiveSession(...args),
  }),
}));

jest.mock('../lib/analytics', () => ({
  analytics: { capture: jest.fn() },
  errorProperties: () => ({}),
  moneyBucket: () => 'zero',
  quantityBucket: () => 'zero',
  textLengthBucket: () => 'empty',
}));

jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: {},
}));

jest.mock('./quickActionsFlowHelpers', () => ({
  formatCaptureError: (error: unknown) =>
    error instanceof Error ? error.message : 'Could not complete action.',
  formatLiveSessionJobTitle: () => 'Live Session Sep 10 at 9:45 PM',
}));

function Harness() {
  const { creatingJob, handlePrimaryAction, quickActionsVisible } = useQuickActionsFlow();
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create job"
        onPress={() => handlePrimaryAction('new_job')}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Live session"
        onPress={() => handlePrimaryAction('live_session')}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Quick note"
        onPress={() => handlePrimaryAction('quick_note')}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Quick material"
        onPress={() => handlePrimaryAction('quick_material')}
      />
      <Text>{creatingJob ? 'creating' : 'idle'}</Text>
      <Text>{quickActionsVisible ? 'capture-open' : 'capture-closed'}</Text>
    </>
  );
}

describe('QuickActionsFlowProvider', () => {
  let alertSpy: jest.SpiedFunction<typeof Alert.alert>;

  beforeEach(() => {
    mockComposerProps = null;
    mockStartLiveSession.mockReset();
    mockRefreshLiveSession.mockReset();
    const apiClient = jest.requireMock('@fieldsolo/api-client') as any;
    apiClient.createBlankJobForLiveSessionStart.mockReset();
    apiClient.createNote.mockReset();
    apiClient.createMaterial.mockReset();
    apiClient.deleteJobById.mockReset();
    apiClient.tryBumpJobToInProgressIfNotStarted.mockReset();
    apiClient.tryBumpJobToInProgressIfNotStarted.mockResolvedValue(undefined);
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('allows only one job creation while the first request is in flight', async () => {
    let resolveCreate: (() => void) | undefined;
    const onCreateJob = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveCreate = resolve;
        }),
    );
    const screen = render(
      <QuickActionsFlowProvider onCreateJob={onCreateJob}>
        <Harness />
      </QuickActionsFlowProvider>,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Create job' }));
    fireEvent.press(screen.getByRole('button', { name: 'Create job' }));

    expect(onCreateJob).toHaveBeenCalledTimes(1);
    expect(screen.getByText('creating')).toBeTruthy();

    await act(async () => {
      resolveCreate?.();
    });
    await screen.findByText('idle');
  });

  it('reports job creation failures and returns to idle', async () => {
    const onCreateJob = jest.fn<() => Promise<void>>().mockRejectedValue(new Error('Network down'));
    const screen = render(
      <QuickActionsFlowProvider onCreateJob={onCreateJob}>
        <Harness />
      </QuickActionsFlowProvider>,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Create job' }));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Create job failed', 'Network down');
      expect(screen.getByText('idle')).toBeTruthy();
    });
  });

  it('starts a live session immediately without the Start Session chooser', async () => {
    const apiClient = jest.requireMock('@fieldsolo/api-client') as any;
    apiClient.createBlankJobForLiveSessionStart.mockResolvedValue('job-live-1');
    mockStartLiveSession.mockResolvedValue({ id: 'sess-1', jobId: 'job-live-1' });

    const screen = render(
      <QuickActionsFlowProvider onCreateJob={async () => {}}>
        <Harness />
      </QuickActionsFlowProvider>,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Live session' }));

    await waitFor(() => {
      expect(apiClient.createBlankJobForLiveSessionStart).toHaveBeenCalledWith(
        {},
        { shortDescription: 'Live Session Sep 10 at 9:45 PM' },
      );
      expect(mockStartLiveSession).toHaveBeenCalledWith({
        jobId: 'job-live-1',
        jobShortDescription: 'Live Session Sep 10 at 9:45 PM',
      });
    });
    expect(screen.getByText('capture-closed')).toBeTruthy();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('opens Quick Note composer and saves it unassigned to Inbox', async () => {
    const apiClient = jest.requireMock('@fieldsolo/api-client') as any;
    apiClient.createNote.mockResolvedValue('note-1');
    const onQuickCaptureSaved = jest.fn();
    const screen = render(
      <TestErrorBoundary>
        <QuickActionsFlowProvider onCreateJob={async () => {}} onQuickCaptureSaved={onQuickCaptureSaved}>
          <Harness />
        </QuickActionsFlowProvider>
      </TestErrorBoundary>,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Quick note' }));
    await waitFor(() => expect(mockComposerProps?.visible).toBe(true));
    expect(mockComposerProps?.kind).toBe('note');
    expect(screen.getByText('capture-open')).toBeTruthy();
    await act(async () => {
      mockComposerProps?.onSaveNote({ body: 'Captured note' });
    });

    await waitFor(() => {
      expect(apiClient.createNote).toHaveBeenCalledWith(
        {},
        {
          jobId: null,
          sessionId: null,
          body: 'Captured note',
        },
      );
      expect(onQuickCaptureSaved).toHaveBeenCalledWith({ mode: 'inbox', jobId: null });
    });
  });

  it('opens Quick Material composer and saves it unassigned to Inbox', async () => {
    const apiClient = jest.requireMock('@fieldsolo/api-client') as any;
    apiClient.createMaterial.mockResolvedValue('mat-1');
    const onQuickCaptureSaved = jest.fn();
    const screen = render(
      <QuickActionsFlowProvider onCreateJob={async () => {}} onQuickCaptureSaved={onQuickCaptureSaved}>
        <Harness />
      </QuickActionsFlowProvider>,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Quick material' }));
    await waitFor(() => expect(mockComposerProps?.visible).toBe(true));
    expect(mockComposerProps?.kind).toBe('material');
    await act(async () => {
      mockComposerProps?.onSaveMaterial({
        description: 'Wire nuts',
        totalCostCents: 300,
        quantity: 1,
        unit: 'ea',
        unitCostCents: 300,
        quantityExplicit: false,
        unitCostExplicit: false,
      });
    });

    await waitFor(() => {
      expect(apiClient.createMaterial).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          jobId: null,
          sessionId: null,
          description: 'Wire nuts',
          quantity: 1,
          unitCostCents: 300,
        }),
      );
      expect(onQuickCaptureSaved).toHaveBeenCalledWith({ mode: 'inbox', jobId: null });
    });
  });
});
