import React from 'react';
import { Alert, AppState, type AppStateStatus } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { PrivacyChoicesScreen } from './PrivacyChoicesScreen';
import { manageDevicePermission, readDevicePermissions, type DevicePermissions } from '../lib/devicePermissions';

jest.mock('../lib/devicePermissions', () => ({
  readDevicePermissions: jest.fn<() => Promise<DevicePermissions>>(),
  manageDevicePermission: jest.fn(),
}));

jest.mock('expo-font', () => ({
  useFonts: () => [true],
}));

jest.mock('../components/CanvasTiledBackground', () => ({
  CanvasTiledBackground: () => null,
}));

const mockResolve = jest.fn<(userId: string) => Promise<'granted' | 'withdrawn' | 'missing' | 'unavailable'>>();
const mockGrant = jest.fn<(userId: string) => Promise<void>>(async () => undefined);
const mockWithdraw = jest.fn<(userId: string) => Promise<void>>(async () => undefined);

jest.mock('../lib/analytics/consentSync', () => ({
  resolveAnalyticsConsentForUser: (userId: string) => mockResolve(userId),
  grantAnalyticsConsent: (userId: string) => mockGrant(userId),
  withdrawAnalyticsConsent: (userId: string) => mockWithdraw(userId),
}));

describe('PrivacyChoicesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolve.mockResolvedValue('withdrawn');
    jest.mocked(readDevicePermissions).mockResolvedValue({ location: 'off', contacts: 'off' });
    jest.mocked(manageDevicePermission).mockResolvedValue(undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('loads consent state and renders the analytics toggle off when withdrawn', async () => {
    const screen = render(
      <PrivacyChoicesScreen userId="user-1" onBack={jest.fn()} onDeleteAccount={jest.fn()} />,
    );

    await waitFor(() => {
      expect(mockResolve).toHaveBeenCalledWith('user-1');
      expect(screen.getByRole('switch', { name: 'Help improve FieldSoli' }).props.value).toBe(false);
    });
  });

  it('grants analytics when the toggle is turned on', async () => {
    const screen = render(
      <PrivacyChoicesScreen userId="user-1" onBack={jest.fn()} onDeleteAccount={jest.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: 'Help improve FieldSoli' })).toBeTruthy();
    });

    fireEvent(screen.getByRole('switch', { name: 'Help improve FieldSoli' }), 'valueChange', true);

    await waitFor(() => {
      expect(mockGrant).toHaveBeenCalledWith('user-1');
    });
  });

  it('withdraws analytics when the toggle is turned off', async () => {
    mockResolve.mockResolvedValueOnce('granted');
    const screen = render(
      <PrivacyChoicesScreen userId="user-1" onBack={jest.fn()} onDeleteAccount={jest.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: 'Help improve FieldSoli' }).props.value).toBe(true);
    });

    fireEvent(screen.getByRole('switch', { name: 'Help improve FieldSoli' }), 'valueChange', false);

    await waitFor(() => {
      expect(mockWithdraw).toHaveBeenCalledWith('user-1');
    });
  });

  it('shows legal document links', async () => {
    const screen = render(
      <PrivacyChoicesScreen userId="user-1" onBack={jest.fn()} onDeleteAccount={jest.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Privacy Policy')).toBeTruthy();
      expect(screen.getByText('Terms')).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: 'Delete Account' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Analytics' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Legal' })).toBeTruthy();
  });

  it('opens device Settings from either permission switch and only changes values after OS refresh', async () => {
    let onAppStateChange!: (state: AppStateStatus) => void;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      onAppStateChange = listener;
      return { remove: jest.fn() };
    });
    const screen = render(<PrivacyChoicesScreen userId="user-1" onBack={jest.fn()} onDeleteAccount={jest.fn()} />);
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Address suggestions' }).props.disabled).toBe(false));
    expect(screen.getByRole('header', { name: 'Device permissions' })).toBeTruthy();
    expect(screen.getAllByRole('switch')).toHaveLength(3);
    expect(screen.queryByText('Off')).toBeNull();

    fireEvent(screen.getByRole('switch', { name: 'Address suggestions' }), 'valueChange', true);
    await waitFor(() => expect(manageDevicePermission).toHaveBeenCalledWith('location'));
    expect(screen.getByRole('switch', { name: 'Address suggestions' }).props.value).toBe(false);

    jest.mocked(readDevicePermissions).mockResolvedValue({ location: 'allowed', contacts: 'limited' });
    act(() => onAppStateChange('active'));
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Address suggestions' }).props.value).toBe(true));
    expect(screen.getByRole('switch', { name: 'Contacts' }).props.value).toBe(true);
    expect(screen.getByRole('switch', { name: 'Contacts' }).props.accessibilityHint).toContain('Limited contacts access');

    fireEvent(screen.getByRole('switch', { name: 'Contacts' }), 'valueChange', false);
    await waitFor(() => expect(manageDevicePermission).toHaveBeenCalledWith('contacts'));
    expect(screen.getByRole('switch', { name: 'Contacts' }).props.value).toBe(true);
    jest.mocked(readDevicePermissions).mockResolvedValue({ location: 'off', contacts: 'off' });
    act(() => onAppStateChange('active'));
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Contacts' }).props.value).toBe(false));
    expect(mockGrant).not.toHaveBeenCalled();
    expect(mockWithdraw).not.toHaveBeenCalled();
  });

  it('keeps the OS state and offers recovery if device Settings cannot open', async () => {
    jest.mocked(manageDevicePermission).mockRejectedValueOnce(new Error('unavailable'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const screen = render(<PrivacyChoicesScreen userId="user-1" onBack={jest.fn()} onDeleteAccount={jest.fn()} />);
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Contacts' }).props.disabled).toBe(false));
    fireEvent(screen.getByRole('switch', { name: 'Contacts' }), 'valueChange', true);
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Could not manage permission', expect.any(String)));
    expect(screen.getByRole('switch', { name: 'Contacts' }).props.value).toBe(false);
  });

  it('returns from Delete Account to Privacy Choices without leaving or changing consent', async () => {
    mockResolve.mockResolvedValueOnce('granted');
    const onBack = jest.fn();
    const onDeleteAccount = jest.fn();
    const screen = render(<PrivacyChoicesScreen userId="user-1" onBack={onBack} onDeleteAccount={onDeleteAccount} />);
    await screen.findByRole('switch', { name: 'Help improve FieldSoli' });
    fireEvent.press(screen.getByRole('button', { name: 'Delete Account' }));
    expect(screen.queryByRole('header', { name: 'Privacy Choices' })).toBeNull();
    expect(screen.getByRole('header', { name: 'Delete Account' })).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Back'));
    await waitFor(() => expect(screen.getByRole('header', { name: 'Privacy Choices' })).toBeTruthy());
    expect(screen.getByRole('switch', { name: 'Help improve FieldSoli' }).props.value).toBe(true);
    expect(onBack).not.toHaveBeenCalled();
    expect(onDeleteAccount).not.toHaveBeenCalled();
    expect(mockGrant).not.toHaveBeenCalled();
    expect(mockWithdraw).not.toHaveBeenCalled();
  });

  it('reverts the toggle when saving fails', async () => {
    mockResolve.mockResolvedValueOnce('withdrawn');
    mockGrant.mockRejectedValueOnce(new Error('Network error'));
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const screen = render(
      <PrivacyChoicesScreen userId="user-1" onBack={jest.fn()} onDeleteAccount={jest.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: 'Help improve FieldSoli' }).props.value).toBe(false);
    });

    fireEvent(screen.getByRole('switch', { name: 'Help improve FieldSoli' }), 'valueChange', true);

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: 'Help improve FieldSoli' }).props.value).toBe(false);
    });
  });
});
