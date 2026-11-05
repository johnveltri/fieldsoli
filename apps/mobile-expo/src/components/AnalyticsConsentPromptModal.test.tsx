import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { AnalyticsConsentPromptModal } from './AnalyticsConsentPromptModal';
import { analyticsConfig } from '../lib/analytics/config';

const mockGrant = jest.fn<(userId: string) => Promise<void>>(async () => undefined);
const mockWithdraw = jest.fn<(userId: string) => Promise<void>>(async () => undefined);

jest.mock('../lib/analytics/consentSync', () => ({
  grantAnalyticsConsent: (userId: string) => mockGrant(userId),
  withdrawAnalyticsConsent: (userId: string) => mockWithdraw(userId),
}));

describe('AnalyticsConsentPromptModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('discloses acquisition only when enabled for iOS', () => {
    const original = analyticsConfig.appleAdsAttributionEnabled;
    const platform = analyticsConfig.platform;
    try {
      analyticsConfig.appleAdsAttributionEnabled = true;
      analyticsConfig.platform = 'ios';
      const screen = render(<AnalyticsConsentPromptModal visible userId="user-1" onResolved={jest.fn()} />);
      expect(screen.getByText(/Apple Ads campaign information/)).toBeTruthy();
      analyticsConfig.appleAdsAttributionEnabled = false;
      screen.rerender(<AnalyticsConsentPromptModal visible userId="user-1" onResolved={jest.fn()} />);
      expect(screen.queryByText(/Apple Ads campaign information/)).toBeNull();
    } finally {
      analyticsConfig.appleAdsAttributionEnabled = original;
      analyticsConfig.platform = platform;
    }
  });

  it('grants consent and resolves when Allow analytics is pressed', async () => {
    const onResolved = jest.fn();
    const screen = render(
      <AnalyticsConsentPromptModal
        visible
        userId="user-1"
        onResolved={onResolved}
      />,
    );

    fireEvent.press(screen.getByText('Allow analytics'));

    await waitFor(() => {
      expect(mockGrant).toHaveBeenCalledWith('user-1');
      expect(onResolved).toHaveBeenCalled();
    });
  });

  it('records withdrawal and resolves when No thanks is pressed', async () => {
    const onResolved = jest.fn();
    const screen = render(
      <AnalyticsConsentPromptModal
        visible
        userId="user-1"
        onResolved={onResolved}
      />,
    );

    fireEvent.press(screen.getByText('No thanks'));

    await waitFor(() => {
      expect(mockWithdraw).toHaveBeenCalledWith('user-1');
      expect(onResolved).toHaveBeenCalled();
    });
    expect(mockGrant).not.toHaveBeenCalled();
  });
});
