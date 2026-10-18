import React from 'react';
import { Linking } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { HelpScreen } from './HelpScreen';
import { SUPPORT_MAILTO } from '../lib/legal-versions';

jest.mock('expo-font', () => ({
  useFonts: () => [true],
}));

jest.mock('../components/CanvasTiledBackground', () => ({
  CanvasTiledBackground: () => null,
}));

describe('HelpScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows help instructions and opens a mailto link', async () => {
    const openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    const screen = render(<HelpScreen onBack={jest.fn()} />);

    expect(screen.getByText('Help & Support')).toBeTruthy();
    expect(
      screen.getByText(/request a copy of your data/i),
    ).toBeTruthy();
    expect(screen.getByText('support@fieldsoli.com')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByText('support@fieldsoli.com'));
    });

    expect(openUrl).toHaveBeenCalledWith(SUPPORT_MAILTO);
    openUrl.mockRestore();
  });
});
