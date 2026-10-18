import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { PrivacyChoicesScreen } from './PrivacyChoicesScreen';

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
  });

  it('loads consent state and renders the analytics toggle off when withdrawn', async () => {
    const screen = render(
      <PrivacyChoicesScreen userId="user-1" onBack={jest.fn()} onDeleteAccount={jest.fn()} />,
    );

    await waitFor(() => {
      expect(mockResolve).toHaveBeenCalledWith('user-1');
      expect(screen.getByRole('switch').props.value).toBe(false);
    });
  });

  it('grants analytics when the toggle is turned on', async () => {
    const screen = render(
      <PrivacyChoicesScreen userId="user-1" onBack={jest.fn()} onDeleteAccount={jest.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByRole('switch')).toBeTruthy();
    });

    fireEvent(screen.getByRole('switch'), 'valueChange', true);

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
      expect(screen.getByRole('switch').props.value).toBe(true);
    });

    fireEvent(screen.getByRole('switch'), 'valueChange', false);

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

  it('returns from Delete Account to Privacy Choices without leaving or changing consent', async () => {
    mockResolve.mockResolvedValueOnce('granted');
    const onBack = jest.fn();
    const onDeleteAccount = jest.fn();
    const screen = render(<PrivacyChoicesScreen userId="user-1" onBack={onBack} onDeleteAccount={onDeleteAccount} />);
    await screen.findByRole('switch');
    fireEvent.press(screen.getByRole('button', { name: 'Delete Account' }));
    expect(screen.queryByRole('header', { name: 'Privacy Choices' })).toBeNull();
    expect(screen.getByRole('header', { name: 'Delete Account' })).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Back'));
    await waitFor(() => expect(screen.getByRole('header', { name: 'Privacy Choices' })).toBeTruthy());
    expect(screen.getByRole('switch').props.value).toBe(true);
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
      expect(screen.getByRole('switch').props.value).toBe(false);
    });

    fireEvent(screen.getByRole('switch'), 'valueChange', true);

    await waitFor(() => {
      expect(screen.getByRole('switch').props.value).toBe(false);
    });
  });
});
