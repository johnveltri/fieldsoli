import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { JobsScreen } from './JobsScreen';

jest.mock('expo-font', () => ({
  useFonts: () => [true],
}));

jest.mock('../components/CanvasTiledBackground', () => ({
  CanvasTiledBackground: () => null,
}));

jest.mock('../components/ds', () => {
  const actual = jest.requireActual('../components/ds') as Record<string, unknown>;
  return {
    ...actual,
    JobDetailStatusPill: () => null,
    JobsOpenStackSectionHeader: () => null,
  };
});

jest.mock('../context/JobsListInvalidationContext', () => ({
  useJobsListInvalidation: () => ({
    version: 0,
    invalidateJobsList: jest.fn(),
  }),
}));

jest.mock('@fieldsolo/api-client', () => ({
  listJobsForCurrentUserPage: jest.fn(),
  createBlankJobForCurrentUser: jest.fn(),
}));

jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: jest.fn(() => true),
  supabase: {},
}));

describe('JobsScreen', () => {
  const apiClient = jest.requireMock('@fieldsolo/api-client') as any;
  const supabaseLib = jest.requireMock('../lib/supabase') as any;

  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    supabaseLib.isSupabaseConfigured.mockReturnValue(true);
  });

  it('loads jobs and opens detail for the selected job', async () => {
    apiClient.listJobsForCurrentUserPage.mockResolvedValue({
      items: [
        {
          id: 'job-1',
          shortDescription: 'Install light fixture',
          customerName: 'Alice',
          updatedAt: '2026-04-17T00:00:00.000Z',
          createdAt: '2026-04-10T08:00:00.000Z',
          lastWorkedAt: '2026-04-16T12:00:00.000Z',
          lastWorkedLabel: 'Last worked Apr 16, 2026',
          timeLabel: '1.5h',
          jobType: 'electrical',
          workStatus: 'inProgress',
          jobPaymentState: 'pending',
          revenueCents: 43940,
          materialsCents: -3800,
          costsCents: -5000,
          netEarningsCents: 38940,
          collectedCents: 0,
          isFinanciallyComplete: true,
          hasMaterials: true,
          hasSessions: true,
        },
      ],
      hasMore: false,
    });

    const onOpenJobDetail = jest.fn();
    const screen = render(<JobsScreen onOpenJobDetail={onOpenJobDetail} />);

    await waitFor(() => {
      expect(screen.getByText('Install light fixture')).toBeTruthy();
    });

    expect(apiClient.listJobsForCurrentUserPage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tab: 'all' }),
    );
    expect(apiClient.listJobsForCurrentUserPage.mock.calls.length).toBeGreaterThanOrEqual(3);

    expect(screen.getByText('-$50')).toBeTruthy();
    expect(screen.queryByText('-$38')).toBeNull();
    fireEvent.press(screen.getByText('Install light fixture'));
    expect(onOpenJobDetail).toHaveBeenCalledWith('job-1');
  });

  it('shows load errors from list API failures', async () => {
    apiClient.listJobsForCurrentUserPage.mockRejectedValue(new Error('Network unavailable'));

    const screen = render(<JobsScreen onOpenJobDetail={() => undefined} />);

    await waitFor(() => {
      expect(screen.getByText('Network unavailable')).toBeTruthy();
    });
  });

  it('loads open jobs from prefetch cache without refetching on tab switch', async () => {
    apiClient.listJobsForCurrentUserPage.mockImplementation(
      (_client: unknown, opts: { tab: string }) => {
        if (opts.tab === 'open') {
          return Promise.resolve({ items: [], hasMore: false });
        }
        return Promise.resolve({
          items: [
            {
              id: 'job-all-only',
              shortDescription: 'All tab job',
              customerName: 'Alice',
              updatedAt: '2026-04-17T00:00:00.000Z',
              createdAt: '2026-04-10T08:00:00.000Z',
              lastWorkedAt: '2026-04-16T12:00:00.000Z',
              lastWorkedLabel: 'Last worked Apr 16, 2026',
              timeLabel: '1.5h',
              jobType: 'electrical',
              workStatus: 'inProgress',
              jobPaymentState: 'pending',
              revenueCents: 30000,
              materialsCents: -2000,
              costsCents: -2000,
              netEarningsCents: 28000,
              collectedCents: 0,
              isFinanciallyComplete: true,
              hasMaterials: true,
              hasSessions: true,
            },
          ],
          hasMore: false,
        });
      },
    );

    const screen = render(<JobsScreen onOpenJobDetail={() => undefined} />);

    await waitFor(() => {
      expect(screen.getByText('All tab job')).toBeTruthy();
    });

    const callsAfterLoad = apiClient.listJobsForCurrentUserPage.mock.calls.length;
    expect(callsAfterLoad).toBe(3);

    fireEvent.press(screen.getByText('Open'));

    await waitFor(() => {
      expect(screen.getByText('All caught up! No open jobs.')).toBeTruthy();
    });
    expect(apiClient.listJobsForCurrentUserPage.mock.calls.length).toBe(callsAfterLoad);
  });

  it('loads paid jobs from prefetch cache and uses recency sections', async () => {
    apiClient.listJobsForCurrentUserPage.mockImplementation(
      (_client: unknown, opts: { tab: string }) => {
        if (opts.tab === 'paid') {
          return Promise.resolve({
            items: [
              {
                id: 'job-paid-1',
                shortDescription: 'Paid job',
                customerName: 'Bob',
                updatedAt: '2026-04-17T00:00:00.000Z',
                createdAt: '2026-04-10T08:00:00.000Z',
                lastWorkedAt: '2026-04-16T12:00:00.000Z',
                lastWorkedLabel: 'Last worked Apr 16, 2026',
                timeLabel: '1.0h',
                jobType: '',
                workStatus: 'paid',
                jobPaymentState: 'paid',
                revenueCents: 10000,
                materialsCents: 0,
                costsCents: 0,
                netEarningsCents: 10000,
                collectedCents: 10000,
                isFinanciallyComplete: false,
                hasMaterials: false,
                hasSessions: true,
              },
            ],
            hasMore: false,
          });
        }
        return Promise.resolve({ items: [], hasMore: false });
      },
    );

    const screen = render(<JobsScreen onOpenJobDetail={() => undefined} />);

    await waitFor(() => {
      expect(screen.getByText('No jobs yet.')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Paid'));

    await waitFor(() => {
      expect(screen.queryByText('Financially complete, paid jobs')).toBeNull();
      expect(screen.getByText(/Today|Past Week|Past Month|Older/)).toBeTruthy();
      expect(screen.getByText('Paid job')).toBeTruthy();
    });
  });

  it('shows empty copy when paid tab has no jobs', async () => {
    apiClient.listJobsForCurrentUserPage.mockResolvedValue({ items: [], hasMore: false });

    const screen = render(<JobsScreen onOpenJobDetail={() => undefined} />);

    await waitFor(() => {
      expect(screen.getByText('No jobs yet.')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Paid'));

    await waitFor(() => {
      expect(screen.getByText('No paid jobs yet.')).toBeTruthy();
    });
  });

  it('shows search empty state and hides tabs when search is focused', async () => {
    apiClient.listJobsForCurrentUserPage.mockResolvedValue({ items: [], hasMore: false });

    const screen = render(<JobsScreen onOpenJobDetail={() => undefined} />);

    await waitFor(() => {
      expect(screen.getByText('No jobs yet.')).toBeTruthy();
    });

    expect(screen.getByText('All')).toBeTruthy();

    fireEvent(screen.getByTestId('jobs-search-input'), 'focus');

    await waitFor(() => {
      expect(screen.getByText('Start typing to search jobs')).toBeTruthy();
    });

    expect(screen.queryByText('Loading jobs…')).toBeNull();
    expect(screen.queryByLabelText('Loading jobs')).toBeNull();

    expect(screen.queryByText('All')).toBeNull();
  });

  it('shows close control on the search bar when focused with empty query and exits search when pressed', async () => {
    apiClient.listJobsForCurrentUserPage.mockResolvedValue({ items: [], hasMore: false });

    const screen = render(<JobsScreen onOpenJobDetail={() => undefined} />);

    await waitFor(() => {
      expect(screen.getByText('No jobs yet.')).toBeTruthy();
    });

    fireEvent(screen.getByTestId('jobs-search-input'), 'focus');

    await waitFor(() => {
      expect(screen.getByText('Start typing to search jobs')).toBeTruthy();
    });

    expect(screen.getByLabelText('Close search')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Close search'));

    await waitFor(() => {
      expect(screen.getByText('All')).toBeTruthy();
    });
    expect(screen.queryByText('Start typing to search jobs')).toBeNull();
  });

  it('passes debounced search to the list API', async () => {
    jest.useFakeTimers();
    apiClient.listJobsForCurrentUserPage.mockResolvedValue({ items: [], hasMore: false });

    const screen = render(<JobsScreen onOpenJobDetail={() => undefined} />);

    await waitFor(() => {
      expect(screen.getByText('No jobs yet.')).toBeTruthy();
    });

    const callsAfterLoad = apiClient.listJobsForCurrentUserPage.mock.calls.length;

    fireEvent(screen.getByTestId('jobs-search-input'), 'focus');
    fireEvent.changeText(screen.getByTestId('jobs-search-input'), 'fan');

    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(apiClient.listJobsForCurrentUserPage.mock.calls.length).toBeGreaterThan(callsAfterLoad);
      expect(apiClient.listJobsForCurrentUserPage).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ search: 'fan' }),
      );
    });
  });
});
