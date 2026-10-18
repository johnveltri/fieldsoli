import React from 'react';
import { Alert, Linking, Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ProfileScreen } from './ProfileScreen';
import { ShellChromeProvider, useShellChrome } from '../shell/ShellChromeContext';

function ChromeProbe() {
  const { hideBottomChrome } = useShellChrome();
  return <Text testID="chrome">{hideBottomChrome ? 'hidden' : 'visible'}</Text>;
}

jest.mock('expo-font', () => ({
  useFonts: () => [true],
}));

jest.mock('../lib/featureFlags', () => ({ useInvoicingFlag: () => ({ enabled: true, ready: true }) }));

jest.mock('../components/CanvasTiledBackground', () => ({
  CanvasTiledBackground: () => null,
}));

const mockSignOut = jest.fn(async () => {});
const mockUpdatePassword = jest.fn(async () => ({ error: null }));
const mockDeleteAccount = jest.fn(async () => ({ error: null }));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    session: { user: { id: 'user-1', email: 'tech@example.com' } },
    user: { id: 'user-1', email: 'tech@example.com' },
    loading: false,
    signIn: jest.fn(),
    signUp: jest.fn(),
    signOut: mockSignOut,
    updatePassword: mockUpdatePassword,
    deleteAccount: mockDeleteAccount,
  }),
}));

jest.mock('../lib/supabase', () => ({
  supabase: {},
  isSupabaseConfigured: () => true,
}));

jest.mock('../lib/analytics/consentSync', () => ({
  resolveAnalyticsConsentForUser: jest.fn(async () => 'withdrawn'),
  grantAnalyticsConsent: jest.fn(async () => undefined),
  withdrawAnalyticsConsent: jest.fn(async () => undefined),
}));

type ProfileShape = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  trades: string[];
};
const mockFetchProfile = jest.fn<() => Promise<ProfileShape | null>>();
const mockUpdateProfile = jest.fn<(...args: unknown[]) => Promise<ProfileShape>>();
jest.mock('@fieldsolo/api-client', () => ({
  ...jest.requireActual<object>('@fieldsolo/api-client'),
  fetchBusinessSettings: jest.fn(async () => jest.requireActual<{ DEFAULT_BUSINESS_SETTINGS: object }>('@fieldsolo/api-client').DEFAULT_BUSINESS_SETTINGS),
  fetchCurrentUserProfile: (...args: unknown[]) => mockFetchProfile(...(args as [])),
  updateCurrentUserProfile: (...args: unknown[]) => mockUpdateProfile(...(args as [])),
}));

jest.mock('../components/shell/ShellBottomNav', () => ({
  shellBottomNavOuterHeight: () => 80,
}));

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchProfile.mockResolvedValue({
      id: 'user-1',
      firstName: 'Alex',
      lastName: 'Builder',
      trades: ['Plumbing', 'Handyman'],
    });
    mockUpdateProfile.mockResolvedValue({
      id: 'user-1',
      firstName: 'Alex',
      lastName: 'Builder',
      trades: ['Electrical', 'Handyman'],
    });
  });

  it('groups the Account hub without personal summaries or an edit pill', async () => {
    const screen = render(<ProfileScreen onBack={jest.fn()} />);
    await waitFor(() => expect(mockFetchProfile).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('ACCOUNT')).toBeTruthy());
    expect(screen.getAllByRole('button').map((button) => button.props.accessibilityLabel)).toEqual([
      'Back', 'Business Details', 'Estimates & Invoices', 'Export Job Summary', 'Personal Details',
      'Change Password', 'Help & Support', 'Privacy Choices', 'Send Feedback', 'Log Out', 'Delete Account',
    ]);
    for (const label of ['Business', 'Business Details', 'Estimates & Invoices', 'Export Job Summary',
      'Account', 'Personal Details', 'Change Password', 'Help & Privacy', 'Help & Support',
      'Privacy Choices', 'Send Feedback', 'Log Out', 'Delete Account']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.queryByText('Alex Builder')).toBeNull();
    expect(screen.queryByText('Your data')).toBeNull();
    expect(screen.queryByLabelText('EDIT')).toBeNull();
  });

  it.each([
    ['Business Details', 'Business name'],
    ['Estimates & Invoices', 'Default material markup'],
  ])('returns from %s after the slide closes', async (label, field) => {
    const screen = render(<ProfileScreen onBack={jest.fn()} />);
    await act(async () => {});
    fireEvent.press(screen.getByText(label));
    await screen.findByLabelText(field);
    expect(screen.queryByText('ACCOUNT')).toBeNull();
    fireEvent.press(screen.getByLabelText('Back'));
    await waitFor(() => expect(screen.getByText('ACCOUNT')).toBeTruthy());
    expect(screen.queryByLabelText(field)).toBeNull();
  });

  it('logs the user out when "Log Out" is pressed', async () => {
    const screen = render(<ProfileScreen onBack={jest.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Log Out')).toBeTruthy();
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Log Out'));
    });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('opens a prefilled feedback email from the Help & Privacy section', async () => {
    const openUrlSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const screen = render(<ProfileScreen onBack={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Send Feedback')).toBeTruthy());
    fireEvent.press(screen.getByText('Send Feedback'));

    await waitFor(() => {
      expect(openUrlSpy).toHaveBeenCalledWith(expect.stringContaining('mailto:support@fieldsoli.com'));
    });
    openUrlSpy.mockRestore();
  });

  it('opens Personal Details even when no profile row exists', async () => {
    mockFetchProfile.mockResolvedValueOnce(null);
    const screen = render(<ProfileScreen onBack={jest.fn()} />);
    await waitFor(() => expect(mockFetchProfile).toHaveBeenCalled());
    fireEvent.press(screen.getByText('Personal Details'));
    expect(screen.getByLabelText('First name').props.value).toBe('');
    expect(screen.getByLabelText('Sign-in email (read-only)').props.editable).toBe(false);
  });

  it('stages name and trade edits together until Save Changes', async () => {
    const screen = render(<ProfileScreen onBack={jest.fn()} />);
    await waitFor(() => expect(mockFetchProfile).toHaveBeenCalled());
    await act(async () => {});
    fireEvent.press(screen.getByText('Personal Details'));
    fireEvent.changeText(screen.getByLabelText('First name'), ' Jamie ');
    fireEvent.press(screen.getByRole('checkbox', { name: 'Plumbing' }));
    fireEvent.press(screen.getByRole('checkbox', { name: 'Electrical' }));
    fireEvent.changeText(screen.getByLabelText('Custom trade'), 'Stonework');
    expect(screen.queryByLabelText('Add custom trade')).toBeNull();
    expect(mockUpdateProfile).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText('SAVE CHANGES'));
    await waitFor(() => expect(mockUpdateProfile).toHaveBeenCalledWith(
      expect.anything(), { firstName: 'Jamie', lastName: 'Builder', trades: ['Handyman', 'Electrical', 'Stonework'] },
    ));
    await waitFor(() => expect(screen.getByText('ACCOUNT')).toBeTruthy());
  });

  it('leaves Personal Details without prompting after reverting equivalent edits', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const screen = render(<ProfileScreen onBack={jest.fn()} />);
    await act(async () => {});
    fireEvent.press(screen.getByText('Personal Details'));
    fireEvent.changeText(screen.getByLabelText('First name'), 'Changed');
    fireEvent.changeText(screen.getByLabelText('First name'), ' Alex ');
    fireEvent.press(screen.getByRole('checkbox', { name: 'Plumbing' }));
    fireEvent.press(screen.getByRole('checkbox', { name: 'Plumbing' }));
    fireEvent.changeText(screen.getByLabelText('Custom trade'), 'plumbing');
    fireEvent.press(screen.getByLabelText('Back'));
    expect(alert).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText('ACCOUNT')).toBeTruthy());
    expect(mockUpdateProfile).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('leaves untouched Personal Details without prompting', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const screen = render(<ProfileScreen onBack={jest.fn()} />);
    await act(async () => {});
    fireEvent.press(screen.getByText('Personal Details'));
    fireEvent.press(screen.getByLabelText('Back'));
    expect(alert).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText('ACCOUNT')).toBeTruthy());
    alert.mockRestore();
  });

  it('discards draft changes without saving', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const screen = render(<ProfileScreen onBack={jest.fn()} />);
    await act(async () => {});
    fireEvent.press(screen.getByText('Personal Details'));
    fireEvent.changeText(screen.getByLabelText('First name'), 'Unsaved');
    fireEvent.press(screen.getByLabelText('Back'));
    expect(alertSpy).toHaveBeenCalledWith('Discard changes?', undefined, expect.any(Array));
    const buttons = alertSpy.mock.calls[0][2];
    act(() => buttons?.find((button) => button.text === 'Discard')?.onPress?.());
    expect(mockUpdateProfile).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText('ACCOUNT')).toBeTruthy());
    fireEvent.press(screen.getByText('Personal Details'));
    expect(screen.getByLabelText('First name').props.value).toBe('Alex');
    alertSpy.mockRestore();
  });

  it('opens Privacy Choices from Help & Privacy', async () => {
    const screen = render(<ProfileScreen onBack={jest.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Privacy Choices')).toBeTruthy();
    });
    fireEvent.press(screen.getByText('Privacy Choices'));
    await waitFor(() => {
      expect(screen.getByRole('header', { name: 'Privacy Choices' })).toBeTruthy();
    });
  });

  it('opens Help & Support from Help & Privacy', async () => {
    const screen = render(<ProfileScreen onBack={jest.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Help & Support')).toBeTruthy();
    });
    fireEvent.press(screen.getByText('Help & Support'));
    await waitFor(() => {
      expect(screen.getByRole('header', { name: 'Help & Support' })).toBeTruthy();
      expect(screen.getByText('support@fieldsoli.com')).toBeTruthy();
    });
  });

  it('keeps the personal draft after a failed save so it can be retried', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockUpdateProfile.mockRejectedValueOnce(new Error('offline'));
    const screen = render(<ProfileScreen onBack={jest.fn()} />);
    await act(async () => {});
    fireEvent.press(screen.getByText('Personal Details'));
    fireEvent.changeText(screen.getByLabelText('First name'), 'Jamie');
    fireEvent.press(screen.getByLabelText('SAVE CHANGES'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(screen.getByLabelText('First name').props.value).toBe('Jamie');
    fireEvent.press(screen.getByLabelText('SAVE CHANGES'));
    await waitFor(() => expect(screen.getByText('ACCOUNT')).toBeTruthy());
    expect(mockUpdateProfile).toHaveBeenCalledTimes(2);
    alertSpy.mockRestore();
  });

  it('hides shell navigation for the whole Account flow and restores it on exit', async () => {
    const screen = render(<ShellChromeProvider><ProfileScreen onBack={jest.fn()} /><ChromeProbe /></ShellChromeProvider>);
    await waitFor(() => expect(screen.getByTestId('chrome').props.children).toBe('hidden'));
    fireEvent.press(screen.getByText('Personal Details'));
    expect(screen.getByTestId('chrome').props.children).toBe('hidden');
    screen.rerender(<ShellChromeProvider><ChromeProbe /></ShellChromeProvider>);
    expect(screen.getByTestId('chrome').props.children).toBe('visible');
  });

  it('validates the Change Password page and keeps the existing success behavior', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const screen = render(<ProfileScreen onBack={jest.fn()} />);
    await act(async () => {});
    fireEvent.press(screen.getByText('Change Password'));
    expect(screen.getByRole('header', { name: 'Change Password' })).toBeTruthy();
    expect(screen.getByLabelText('SAVE NEW PASSWORD').props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(screen.getByPlaceholderText('New Password'), 'Password123!');
    fireEvent.changeText(screen.getByPlaceholderText('Repeat Password'), 'Different123!');
    expect(screen.getByText('Password does not match')).toBeTruthy();
    expect(mockUpdatePassword).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByPlaceholderText('Repeat Password'), 'Password123!');
    fireEvent.press(screen.getByLabelText('SAVE NEW PASSWORD'));
    await waitFor(() => expect(mockUpdatePassword).toHaveBeenCalledWith('Password123!'));
    expect(alert).toHaveBeenCalledWith('Password updated');
    await waitFor(() => expect(screen.getByText('ACCOUNT')).toBeTruthy());
    alert.mockRestore();
  });

  it('returns from a security page and clears its input on reopening', async () => {
    const screen = render(<ProfileScreen onBack={jest.fn()} />);
    await act(async () => {});
    fireEvent.press(screen.getByText('Change Password'));
    fireEvent.changeText(screen.getByPlaceholderText('New Password'), 'Unsaved123!');
    fireEvent.press(screen.getByLabelText('Back'));
    await waitFor(() => expect(screen.getByText('ACCOUNT')).toBeTruthy());
    expect(mockUpdatePassword).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText('Change Password'));
    expect(screen.getByPlaceholderText('New Password').props.value).toBe('');
  });

  it('opens the Delete Account page before showing the system confirmation', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const screen = render(<ProfileScreen onBack={jest.fn()} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete Account' })).toBeTruthy();
    });

    fireEvent.press(screen.getByRole('button', { name: 'Delete Account' }));
    expect(alertSpy).not.toHaveBeenCalled();
    expect(screen.getByText('Delete Account')).toBeTruthy();

    fireEvent.changeText(screen.getByPlaceholderText('delete account'), 'delete account');
    fireEvent.press(screen.getByLabelText('DELETE ACCOUNT'));

    expect(alertSpy).toHaveBeenCalled();
    const [title] = alertSpy.mock.calls[0];
    expect(title).toBe('Delete account?');
    alertSpy.mockRestore();
  });
});
