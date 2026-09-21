import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { color } from '@fieldsolo/design-system/lib/tokens';

import { JobExportScreen } from './JobExportScreen';

jest.mock('expo-font', () => ({ useFonts: () => [true] }));
jest.mock('../components/CanvasTiledBackground', () => ({ CanvasTiledBackground: () => null }));
jest.mock('../lib/supabase', () => ({ supabase: {} }));
jest.mock('../components/figma-icons/TopHeaderIcons', () => ({ TopHeaderBackIcon: () => null }));
const mockRequestJobExport = jest.fn<(...args: [unknown, unknown]) => Promise<unknown>>();
class MockJobExportRequestError extends Error {
  status: number | null = null;
  retryAt: string | null = null;
}
jest.mock('@fieldsolo/api-client', () => ({
  requestJobExport: (...args: [unknown, unknown]) => mockRequestJobExport(...args),
  JobExportRequestError: MockJobExportRequestError,
}));

let mockSession = {
  user: {
    id: 'user-1',
    email: 'tech@example.com',
    email_confirmed_at: '2026-01-02T00:00:00Z' as string | null,
    created_at: '2026-02-01T12:00:00Z',
  },
};
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ session: mockSession }),
}));

describe('JobExportScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: new Date('2026-08-29T12:00:00Z') });
    mockSession = {
      user: {
        id: 'user-1',
        email: 'tech@example.com',
        email_confirmed_at: '2026-01-02T00:00:00Z',
        created_at: '2026-02-01T12:00:00Z',
      },
    };
    mockRequestJobExport.mockResolvedValue({
      status: 'confirmed',
      requestId: 'request-1',
      recipientEmail: 'tech@example.com',
      deduplicated: false,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('builds the year selector locally and waits to request until pressed', async () => {
    const screen = render(<JobExportScreen onBack={jest.fn()} onBackToHome={jest.fn()} />);
    expect(screen.getByText('EXPORT JOBS')).toBeTruthy();
    expect(screen.getByText('2026')).toBeTruthy();
    expect(mockRequestJobExport).not.toHaveBeenCalled();
    expect(screen.getByText('tech@example.com')).toBeTruthy();
    expect(screen.getByText(/customer names, phone numbers, emails, service addresses/)).toBeTruthy();
    expect(screen.queryByText('Time zone')).toBeNull();
    expect(screen.queryByText(/This file may contain sensitive customer/)).toBeNull();
  });

  it('submits only the selected year and resolved timezone', async () => {
    const screen = render(<JobExportScreen onBack={jest.fn()} onBackToHome={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('Export year 2026'));
    expect(screen.getByText('Export year')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('2026'));
    });
    await waitFor(() => expect(screen.getByLabelText('Request Export')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Request Export'));
    });
    expect(mockRequestJobExport).toHaveBeenCalledWith(expect.anything(), {
      year: 2026,
      timeZone: expect.any(String),
    });
  });

  it('does not allow an export request until the account email is verified', async () => {
    mockSession.user.email_confirmed_at = null;
    const screen = render(<JobExportScreen onBack={jest.fn()} onBackToHome={jest.fn()} />);

    expect(screen.getByText('Verify your email before requesting an export.')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Request Export'));
    expect(mockRequestJobExport).not.toHaveBeenCalled();
  });

  it('shows the exact confirmation copy', async () => {
    const screen = render(<JobExportScreen onBack={jest.fn()} onBackToHome={jest.fn()} />);
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Request Export'));
    });
    expect(screen.getByText(/Your 2026 job export has been requested/)).toBeTruthy();
    expect(screen.getByText('Export requested')).toBeTruthy();
    expect(screen.getByText('EXPORT JOBS')).toBeTruthy();
    expect(screen.getByText(/within a few minutes/)).toBeTruthy();
    expect(screen.getByLabelText('Back to Home')).toBeTruthy();
    expect(screen.queryByLabelText('Request Export')).toBeNull();
    expect(screen.queryByLabelText('Export year 2026')).toBeNull();
  });

  it('shows no-jobs state and closes both overlays through Back to Home', async () => {
    mockRequestJobExport.mockResolvedValue({ status: 'no_eligible_jobs' });
    const onBackToHome = jest.fn();
    const screen = render(<JobExportScreen onBack={jest.fn()} onBackToHome={onBackToHome} />);
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Request Export'));
    });
    expect(screen.getByText('No completed jobs found for 2026.')).toBeTruthy();
    expect(screen.getByLabelText('Back to Home')).toBeTruthy();
    expect(screen.queryByLabelText('Request Export')).toBeNull();
    expect(screen.queryByLabelText('Export year 2026')).toBeNull();
    fireEvent.press(screen.getByLabelText('Back to Home'));
    expect(onBackToHome).toHaveBeenCalledTimes(1);
  });

  it('surfaces rate limiting and generic failures without persisting a cooldown', async () => {
    mockRequestJobExport.mockResolvedValueOnce({
      status: 'rate_limited',
      retryAt: '2026-08-29T13:00:00Z',
    });
    const screen = render(<JobExportScreen onBack={jest.fn()} onBackToHome={jest.fn()} />);
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Request Export'));
    });
    expect(screen.getByText(/You’ve reached the export limit/)).toBeTruthy();
    expect(screen.getByTestId('job-export-request-error')).toHaveStyle({
      color: color('Semantic/Status/Error/Text'),
    });
    expect(screen.queryByTestId('job-export-result-card')).toBeNull();
    expect(screen.getByLabelText('Request Export')).toBeTruthy();

    mockRequestJobExport.mockRejectedValueOnce(new Error('offline'));
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Request Export'));
    });
    await waitFor(() => expect(screen.getByText('Couldn’t request your export. Try again later.')).toBeTruthy());
    expect(screen.getByTestId('job-export-request-error')).toHaveStyle({
      color: color('Semantic/Status/Error/Text'),
    });
  });
});
