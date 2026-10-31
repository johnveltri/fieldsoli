import React, { useState } from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { EarningsScreen, type EarningsWindow } from './EarningsScreen';

const mockGetEarningsSnapshotForCurrentUser = jest.fn<
  (...args: unknown[]) => Promise<{
    aggregate: {
      netEarningsCents: number;
      revenueCents: number;
      materialsCents: number;
      costsCents: number;
      totalHours: number;
      jobCount: number;
      netPerHrCents: number | null;
    };
    jobs: unknown[];
  }>
>();
const mockGetOutstandingPaymentsForCurrentUser = jest.fn<
  (...args: unknown[]) => Promise<{ count: number; revenueCents: number }>
>();
const mockIsSupabaseConfigured = jest.fn<() => boolean>(() => true);

jest.mock('expo-font', () => ({
  useFonts: () => [true],
}));

jest.mock('@fieldsolo/api-client', () => ({
  getEarningsSnapshotForCurrentUser: (...args: unknown[]) =>
    mockGetEarningsSnapshotForCurrentUser(...args),
  getOutstandingPaymentsForCurrentUser: (...args: unknown[]) =>
    mockGetOutstandingPaymentsForCurrentUser(...args),
}));

jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: () => mockIsSupabaseConfigured(),
  supabase: { client: 'supabase' },
}));

jest.mock('../context/JobsListInvalidationContext', () => ({
  useJobsListInvalidation: () => ({ version: 0 }),
}));

jest.mock('../components/CanvasTiledBackground', () => ({
  CanvasTiledBackground: () => null,
}));

function job(overrides: Record<string, unknown>) {
  return {
    id: 'job-high',
    shortDescription: 'Panel Upgrade',
    customerName: 'Ada',
    revenueCents: 120000,
    materialsCents: -40000,
    costsCents: -40000,
    netEarningsCents: 80000,
    hours: 2,
    netPerHrCents: 40000,
    ...overrides,
  };
}

function renderHarness() {
  const onOpenJobsOpenTab = jest.fn();
  const onOpenJobDetail = jest.fn();

  function Harness() {
    const [window, setWindow] = useState<EarningsWindow>('week');
    return (
      <EarningsScreen
        window={window}
        onWindowChange={setWindow}
        onOpenJobsOpenTab={onOpenJobsOpenTab}
        onOpenJobDetail={onOpenJobDetail}
      />
    );
  }

  const screen = render(<Harness />);
  return { screen, onOpenJobsOpenTab, onOpenJobDetail };
}

describe('EarningsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsSupabaseConfigured.mockReturnValue(true);
    mockGetOutstandingPaymentsForCurrentUser.mockResolvedValue({
      count: 2,
      revenueCents: 150000,
    });
    mockGetEarningsSnapshotForCurrentUser.mockImplementation(async (_client, options) => {
      const windowDays = (options as { windowDays: number }).windowDays;
      return {
        aggregate: {
          netEarningsCents: windowDays === 30 ? 123000 : 95000,
          revenueCents: windowDays === 30 ? 170000 : 140000,
          materialsCents: windowDays === 30 ? -47000 : -45000,
          costsCents: windowDays === 30 ? -47000 : -45000,
          totalHours: windowDays === 30 ? 4 : 3,
          jobCount: 2,
          netPerHrCents: windowDays === 30 ? 30750 : 95000 / 3,
        },
        jobs: [
          job({
            id: 'job-high',
            shortDescription: 'Panel Upgrade',
            customerName: 'Ada',
            netEarningsCents: 80000,
            netPerHrCents: 40000,
          }),
          job({
            id: 'job-low',
            shortDescription: 'Outlet Repair',
            customerName: 'Ben',
            revenueCents: 20000,
            materialsCents: -5000,
            costsCents: -5000,
            netEarningsCents: 15000,
            hours: 1,
            netPerHrCents: 15000,
          }),
        ],
      };
    });
  });

  it('shows all costs rather than materials in every earnings window', async () => {
    mockGetEarningsSnapshotForCurrentUser.mockResolvedValue({
      aggregate: { revenueCents: 43940, materialsCents: -3800, costsCents: -5000,
        netEarningsCents: 38940, totalHours: 1, jobCount: 1, netPerHrCents: 38940 },
      jobs: [],
    });
    const { screen } = renderHarness();
    expect(await screen.findByText('-$50.00')).toBeTruthy();
    for (const tab of ['MONTH', 'YEAR']) {
      fireEvent.press(screen.getByText(tab));
      expect(await screen.findByText('-$50.00')).toBeTruthy();
      expect(screen.getByText('$389.40')).toBeTruthy();
      expect(screen.queryByText('-$38.00')).toBeNull();
    }
  });

  it('loads earnings data and opens linked jobs from the ranked rows and outstanding card', async () => {
    const { screen, onOpenJobsOpenTab, onOpenJobDetail } = renderHarness();

    await waitFor(() => {
      expect(screen.getByText('Weekly Snapshot')).toBeTruthy();
    });

    expect(mockGetEarningsSnapshotForCurrentUser).toHaveBeenCalledWith(
      { client: 'supabase' },
      { windowDays: 7 },
    );
    expect(mockGetOutstandingPaymentsForCurrentUser).toHaveBeenCalledWith({
      client: 'supabase',
    });
    expect(screen.getByText('$950.00')).toBeTruthy();
    expect(screen.getByText('$1,400.00')).toBeTruthy();
    expect(screen.getByText('-$450.00')).toBeTruthy();
    expect(screen.getByText('3.0h')).toBeTruthy();
    expect(screen.getByText('$317/hr')).toBeTruthy();
    expect(screen.getByText('$1,500.00')).toBeTruthy();

    fireEvent.press(
      screen.getByLabelText('Unpaid (2). Completed but not paid. $1,500.00.'),
    );
    expect(onOpenJobsOpenTab).toHaveBeenCalledWith('unpaid');

    fireEvent.press(screen.getByLabelText('Rank 1. Panel Upgrade. Ada. $800.'));
    expect(onOpenJobDetail).toHaveBeenCalledWith('job-high');
  });

  it('hides the outstanding payments card when there are no pending jobs', async () => {
    mockGetOutstandingPaymentsForCurrentUser.mockResolvedValue({
      count: 0,
      revenueCents: 0,
    });

    const { screen } = renderHarness();

    await waitFor(() => {
      expect(screen.getByText('Weekly Snapshot')).toBeTruthy();
    });

    expect(screen.queryByText(/Unpaid \(/)).toBeNull();
    expect(screen.queryByText('Completed but not paid')).toBeNull();
  });

  it('reloads the snapshot when the selected earnings window changes', async () => {
    const { screen } = renderHarness();

    await waitFor(() => {
      expect(mockGetEarningsSnapshotForCurrentUser).toHaveBeenCalledWith(
        { client: 'supabase' },
        { windowDays: 7 },
      );
    });

    fireEvent.press(screen.getByText('MONTH'));

    await waitFor(() => {
      expect(mockGetEarningsSnapshotForCurrentUser).toHaveBeenCalledWith(
        { client: 'supabase' },
        { windowDays: 30 },
      );
    });
    expect(screen.getByText('Monthly Snapshot')).toBeTruthy();
    expect(screen.getByText('$1,230.00')).toBeTruthy();
  });
});
