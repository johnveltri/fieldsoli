import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { color } from '@fieldsolo/design-system/lib/tokens';

import { HomeScreen } from './HomeScreen';

const mockCreateBlankJobForLiveSessionStart = jest.fn<
  (...args: unknown[]) => Promise<string>
>();
const mockCreateNote = jest.fn<(...args: unknown[]) => Promise<string>>();
const mockCreateMaterial = jest.fn<(...args: unknown[]) => Promise<string>>();
const mockDeleteJobById = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockListRecentJobsForCurrentUser = jest.fn<
  (...args: unknown[]) => Promise<unknown[]>
>();
const mockGetWeeklyNetEarningsCentsForCurrentUser = jest.fn<
  (...args: unknown[]) => Promise<{ netEarningsCents: number; jobCount: number }>
>();
const mockListJobsForCurrentUserPage = jest.fn<
  (...args: unknown[]) => Promise<{ items: unknown[]; hasMore: boolean }>
>();
const mockListRecentDetailedJobsForCurrentUser = jest.fn<
  (...args: unknown[]) => Promise<unknown[]>
>();
const mockFetchFirstJobIdForCurrentUser = jest.fn<(...args: unknown[]) => Promise<string | null>>();
const mockTryBumpJobToInProgressIfNotStarted = jest.fn<
  (...args: unknown[]) => Promise<void>
>();
const mockStartLiveSession = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockRefreshLiveSession = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockInvalidateJobsList = jest.fn<() => void>();
const mockIsSupabaseConfigured = jest.fn<() => boolean>(() => true);

jest.mock('expo-font', () => ({
  useFonts: () => [true],
}));

jest.mock('@fieldsolo/api-client', () => ({
  createBlankJobForLiveSessionStart: (...args: unknown[]) =>
    mockCreateBlankJobForLiveSessionStart(...args),
  createNote: (...args: unknown[]) => mockCreateNote(...args),
  createMaterial: (...args: unknown[]) => mockCreateMaterial(...args),
  deleteJobById: (...args: unknown[]) => mockDeleteJobById(...args),
  listRecentJobsForCurrentUser: (...args: unknown[]) => mockListRecentJobsForCurrentUser(...args),
  getWeeklyNetEarningsCentsForCurrentUser: (...args: unknown[]) =>
    mockGetWeeklyNetEarningsCentsForCurrentUser(...args),
  listJobsForCurrentUserPage: (...args: unknown[]) => mockListJobsForCurrentUserPage(...args),
  listRecentDetailedJobsForCurrentUser: (...args: unknown[]) =>
    mockListRecentDetailedJobsForCurrentUser(...args),
  fetchFirstJobIdForCurrentUser: (...args: unknown[]) =>
    mockFetchFirstJobIdForCurrentUser(...args),
  tryBumpJobToInProgressIfNotStarted: (...args: unknown[]) =>
    mockTryBumpJobToInProgressIfNotStarted(...args),
}));

jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: () => mockIsSupabaseConfigured(),
  supabase: { client: 'supabase' },
}));

jest.mock('../context/LiveSessionContext', () => ({
  useHasLiveSession: () => false,
  useLiveSession: () => ({
    startLiveSession: (...args: unknown[]) => mockStartLiveSession(...args),
    refresh: (...args: unknown[]) => mockRefreshLiveSession(...args),
  }),
}));

jest.mock('../context/JobsListInvalidationContext', () => ({
  useJobsListInvalidation: () => ({
    invalidateJobsList: mockInvalidateJobsList,
    version: 0,
  }),
}));

jest.mock('../components/CanvasTiledBackground', () => ({
  CanvasTiledBackground: () => null,
}));

jest.mock('../components/figma-icons/JobsScreenIcons', () => ({
  JobsFabPlusIcon: () => null,
}));

jest.mock('../components/figma-icons/TopHeaderIcons', () => ({
  TopHeaderProfileIcon: () => null,
}));

jest.mock('../components/shell/ShellBottomNav', () => ({
  shellBottomNavOuterHeight: () => 80,
}));

function job(overrides: Record<string, unknown>) {
  return {
    id: 'job-1',
    shortDescription: 'Install light fixture',
    customerName: 'Alice',
    updatedAt: '2026-05-09T12:00:00.000Z',
    createdAt: '2026-05-01T12:00:00.000Z',
    lastWorkedAt: '2026-05-09T12:00:00.000Z',
    lastWorkedLabel: 'Last worked May 9, 2026',
    timeLabel: '2.0h',
    jobType: 'electrical',
    workStatus: 'inProgress',
    jobPaymentState: 'pending',
    revenueCents: 50000,
    materialsCents: -12000,
    netEarningsCents: 38000,
    collectedCents: 0,
    isFinanciallyComplete: true,
    hasMaterials: true,
    noMaterialsConfirmed: false,
    hasOtherCosts: false,
    noOtherCostsConfirmed: false,
    noRevenueConfirmed: false,
    hasSessions: true,
    ...overrides,
  };
}

describe('HomeScreen quick session', () => {
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockIsSupabaseConfigured.mockReturnValue(true);
    mockListRecentJobsForCurrentUser.mockResolvedValue([]);
    mockGetWeeklyNetEarningsCentsForCurrentUser.mockResolvedValue({
      netEarningsCents: 0,
      jobCount: 0,
    });
    mockListJobsForCurrentUserPage.mockResolvedValue({ items: [], hasMore: false });
    mockListRecentDetailedJobsForCurrentUser.mockResolvedValue([]);
    mockFetchFirstJobIdForCurrentUser.mockResolvedValue('job-existing');
    mockTryBumpJobToInProgressIfNotStarted.mockResolvedValue(undefined);
    mockDeleteJobById.mockResolvedValue(undefined);
    mockCreateNote.mockResolvedValue('note-new-1');
    mockCreateMaterial.mockResolvedValue('mat-new-1');
    mockRefreshLiveSession.mockResolvedValue(null);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders the Dashboard home header', () => {
    const screen = render(
      <HomeScreen
        onOpenProfile={() => undefined}
        onOpenJobDetail={() => undefined}
        onOpenEarnings={() => undefined}
        onOpenJobsOpenTab={() => undefined}
      />,
    );

    expect(screen.getByText(/DASH\s*BOARD/)).toBeTruthy();
    const title = screen.getByText(/DASH\s*BOARD/);
    expect(title.props.accessibilityRole).toBe('header');
    expect(title.props.accessibilityLabel).toBe('Dashboard');
  });

  it('explains zero weekly earnings for an account with jobs', async () => {
    const screen = render(
      <HomeScreen
        onOpenProfile={() => undefined}
        onOpenJobDetail={() => undefined}
        onOpenEarnings={() => undefined}
        onOpenJobsOpenTab={() => undefined}
      />,
    );

    expect(await screen.findByText('No earnings from this week. Complete a job to track earnings here.')).toBeTruthy();
  });

  it('explains zero weekly earnings when incomplete jobs are blocking the count', async () => {
    mockListJobsForCurrentUserPage.mockResolvedValue({
      items: [
        job({
          id: 'job-incomplete',
          shortDescription: 'Untitled Job',
          workStatus: 'notStarted',
          isFinanciallyComplete: false,
          hasMaterials: false,
          hasSessions: false,
          revenueCents: 0,
        }),
      ],
      hasMore: false,
    });

    const screen = render(
      <HomeScreen
        onOpenProfile={() => undefined}
        onOpenJobDetail={() => undefined}
        onOpenEarnings={() => undefined}
        onOpenJobsOpenTab={() => undefined}
      />,
    );

    expect(
      await screen.findByText(
        'No earnings from this week',
      ),
    ).toBeTruthy();
  });

  it('shows the full first-job state and creates a job from its CTA', async () => {
    mockFetchFirstJobIdForCurrentUser.mockResolvedValue(null);
    const onCreateFirstJob = jest.fn<() => Promise<string>>().mockResolvedValue('job-new');
    const screen = render(
      <HomeScreen
        onCreateFirstJob={onCreateFirstJob}
        onOpenProfile={() => undefined}
        onOpenJobDetail={() => undefined}
        onOpenEarnings={() => undefined}
        onOpenJobsOpenTab={() => undefined}
      />,
    );

    expect(await screen.findByText("Looks like you don't have any jobs yet")).toBeTruthy();
    expect(screen.queryByText('Weekly Snapshot')).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'Create my first job' }));
    await waitFor(() => expect(onCreateFirstJob).toHaveBeenCalledTimes(1));
  });

  it('renders home modules from API data and opens job detail from module cards', async () => {
    mockGetWeeklyNetEarningsCentsForCurrentUser.mockResolvedValue({
      netEarningsCents: 123456,
      jobCount: 2,
    });
    const middleIncompletes = Array.from({ length: 9 }, (_, i) =>
      job({
        id: `job-incomplete-${i + 2}`,
        shortDescription: `Finish task ${i + 2}`,
        isFinanciallyComplete: false,
        hasMaterials: false,
        noMaterialsConfirmed: false,
      }),
    );
    mockListJobsForCurrentUserPage.mockResolvedValue({
      items: [
        job({
          id: 'job-incomplete-1',
          shortDescription: 'Untitled Job',
          revenueCents: 0,
          isFinanciallyComplete: false,
          hasMaterials: false,
          hasSessions: false,
        }),
        ...middleIncompletes,
        job({
          id: 'job-incomplete-11',
          shortDescription: 'Wire outlet',
          isFinanciallyComplete: false,
          hasSessions: false,
        }),
      ],
      hasMore: false,
    });
    mockListRecentDetailedJobsForCurrentUser.mockResolvedValue([
      job({
        id: 'job-recent-1',
        shortDescription: 'Replace ceiling fan',
        customerName: 'Sam',
        updatedAt: '2026-05-08T12:00:00.000Z',
      }),
    ]);

    const onOpenJobDetail = jest.fn();
    const onOpenJobsOpenTab = jest.fn();
    const screen = render(
      <HomeScreen
        onOpenProfile={() => undefined}
        onOpenJobDetail={onOpenJobDetail}
        onOpenEarnings={() => undefined}
        onOpenJobsOpenTab={onOpenJobsOpenTab}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('$1,234.56')).toBeTruthy();
    });

    expect(mockGetWeeklyNetEarningsCentsForCurrentUser).toHaveBeenCalledWith({
      client: 'supabase',
    });
    expect(mockListJobsForCurrentUserPage).toHaveBeenCalledWith(
      { client: 'supabase' },
      expect.objectContaining({ tab: 'open', limit: 100, offset: 0 }),
    );
    expect(mockListRecentDetailedJobsForCurrentUser).toHaveBeenCalledWith(
      { client: 'supabase' },
      { limit: 3 },
    );
    expect(screen.getByText('Completed jobs worked in the past 7 days')).toBeTruthy();
    expect(screen.getByText('Needs Attention')).toBeTruthy();
    expect(screen.getByText('Incomplete (11)')).toBeTruthy();
    expect(screen.getByText('Missing key info')).toBeTruthy();
    expect(screen.getByLabelText('Incomplete (11). Missing key info.')).toBeTruthy();
    expect(screen.queryByText('10 of 11 jobs')).toBeNull();
    expect(screen.queryByText('Wire outlet')).toBeNull();
    expect(screen.getByText('Jump Back In')).toBeTruthy();
    expect(screen.getByText('Replace ceiling fan')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Incomplete (11). Missing key info.'));
    expect(onOpenJobsOpenTab).toHaveBeenCalledWith('incomplete');

    fireEvent.press(screen.getByText('Replace ceiling fan'));
    expect(onOpenJobDetail).toHaveBeenCalledWith('job-recent-1');
  });

  it('renders negative weekly net earnings in red', async () => {
    mockGetWeeklyNetEarningsCentsForCurrentUser.mockResolvedValue({
      netEarningsCents: -5000,
      jobCount: 1,
    });
    mockListJobsForCurrentUserPage.mockResolvedValue({
      items: [job({ id: 'job-open-1', shortDescription: 'Open job' })],
      hasMore: false,
    });
    mockListRecentDetailedJobsForCurrentUser.mockResolvedValue([]);

    const screen = render(
      <HomeScreen
        onOpenProfile={() => undefined}
        onOpenJobDetail={() => undefined}
        onOpenEarnings={() => undefined}
        onOpenJobsOpenTab={() => undefined}
      />,
    );

    const value = await screen.findByText('-$50.00');
    const flatStyle = StyleSheet.flatten(value.props.style);
    expect(flatStyle.color).toBe(color('Semantic/Financial/Negative'));
  });

  it('shows an In Progress summary for financially complete in-progress open jobs', async () => {
    mockListJobsForCurrentUserPage.mockResolvedValue({
      items: [
        job({
          id: 'job-review-1',
          shortDescription: 'Patch drywall',
          isFinanciallyComplete: true,
          workStatus: 'inProgress',
          lastWorkedAt: '2026-05-08T12:00:00.000Z',
        }),
        job({
          id: 'job-review-not-started',
          shortDescription: 'Estimate panel',
          isFinanciallyComplete: true,
          workStatus: 'notStarted',
          lastWorkedAt: '2026-05-08T12:00:00.000Z',
        }),
        job({
          id: 'job-review-on-hold',
          shortDescription: 'Paused repair',
          isFinanciallyComplete: true,
          workStatus: 'onHold',
          lastWorkedAt: '2026-05-08T12:00:00.000Z',
        }),
      ],
      hasMore: false,
    });

    const screen = render(
      <HomeScreen
        onOpenProfile={() => undefined}
        onOpenJobDetail={() => undefined}
        onOpenEarnings={() => undefined}
        onOpenJobsOpenTab={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('In Progress (1)')).toBeTruthy();
    });
    expect(screen.getByText('Active work underway')).toBeTruthy();
    expect(screen.getByLabelText('In Progress (1). Active work underway.')).toBeTruthy();
    expect(screen.queryByText('Patch drywall')).toBeNull();
    expect(screen.queryByText('Estimate panel')).toBeNull();
    expect(screen.queryByText('Paused repair')).toBeNull();
  });

  it('shows an Unpaid summary for completed open jobs pending payment', async () => {
    mockListJobsForCurrentUserPage.mockResolvedValue({
      items: [
        job({
          id: 'job-payment-1',
          shortDescription: 'Garbage Disposal Install',
          isFinanciallyComplete: true,
          workStatus: 'completed',
          jobPaymentState: 'pending',
          lastWorkedAt: '2026-05-08T12:00:00.000Z',
        }),
        job({
          id: 'job-payment-paid',
          shortDescription: 'Paid faucet repair',
          isFinanciallyComplete: true,
          workStatus: 'paid',
          jobPaymentState: 'paid',
          lastWorkedAt: '2026-05-08T12:00:00.000Z',
        }),
      ],
      hasMore: false,
    });

    const onOpenJobsOpenTab = jest.fn();
    const screen = render(
      <HomeScreen
        onOpenProfile={() => undefined}
        onOpenJobDetail={() => undefined}
        onOpenEarnings={() => undefined}
        onOpenJobsOpenTab={onOpenJobsOpenTab}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Unpaid (1)')).toBeTruthy();
    });
    expect(screen.getByText('Completed but not paid')).toBeTruthy();
    expect(screen.getByLabelText('Unpaid (1). Completed but not paid.')).toBeTruthy();
    expect(screen.queryByText('Garbage Disposal Install')).toBeNull();
    expect(screen.queryByText('Paid faucet repair')).toBeNull();

    fireEvent.press(screen.getByLabelText('Unpaid (1). Completed but not paid.'));
    expect(onOpenJobsOpenTab).toHaveBeenCalledWith('unpaid');
  });
});
