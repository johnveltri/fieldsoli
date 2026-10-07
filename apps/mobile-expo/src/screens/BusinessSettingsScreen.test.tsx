import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DEFAULT_BUSINESS_SETTINGS } from '@fieldsolo/api-client';
import { createTextStyles } from '../theme/nativeTokens';
import { BusinessSettingsScreen } from './BusinessSettingsScreen';

const mockFetch =
  jest.fn<(...args: unknown[]) => Promise<typeof DEFAULT_BUSINESS_SETTINGS>>();
const mockSave = jest.fn<(...args: unknown[]) => Promise<void>>();

jest.mock('@fieldsolo/api-client', () => ({
  ...jest.requireActual<object>('@fieldsolo/api-client'),
  fetchBusinessSettings: (...args: unknown[]) => mockFetch(...args),
  saveBusinessSettings: (...args: unknown[]) => mockSave(...args),
}));
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ session: { user: { id: 'user-1' } } }),
}));
jest.mock('../lib/supabase', () => ({ supabase: {} }));
jest.mock('../components/CanvasTiledBackground', () => ({
  CanvasTiledBackground: () => null,
}));

const typography = createTextStyles({
  serifBold: 'serif',
  sans: 'sans',
  sansSemi: 'semi',
  sansBold: 'bold',
});

describe('BusinessSettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue(DEFAULT_BUSINESS_SETTINGS);
    mockSave.mockResolvedValue(undefined);
  });

  it('retries the read after a failure instead of opening an unsaved default form', async () => {
    mockFetch.mockRejectedValueOnce(new Error('offline'));
    const screen = render(
      <BusinessSettingsScreen
        typography={typography}
        mode="business"
        onBack={() => {}}
      />,
    );
    await screen.findByText('Could not load settings.');
    expect(screen.queryByLabelText('Save changes')).toBeNull();
    fireEvent.press(screen.getByText('Retry'));
    await screen.findByLabelText('Business name');
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('saves percentages, tax categories, and selected terms from the grouped controls', async () => {
    const onBack = jest.fn();
    const screen = render(
      <BusinessSettingsScreen
        typography={typography}
        mode="settings"
        onBack={onBack}
      />,
    );
    await screen.findByLabelText('Default material markup');
    fireEvent.changeText(
      screen.getByLabelText('Default material markup'),
      '12.5',
    );
    fireEvent.changeText(screen.getByLabelText('Tax rate'), '8.25');
    fireEvent(
      screen.getByRole('switch', { name: 'Materials' }),
      'valueChange',
      false,
    );
    expect(
      screen.getByRole('switch', { name: 'All categories' }).props.value,
    ).toBe(false);
    fireEvent.press(screen.getByRole('radio', { name: 'Net 15' }));
    fireEvent.press(screen.getByRole('radio', { name: '7 days' }));
    fireEvent.press(screen.getByLabelText('Save changes'));
    await waitFor(() =>
      expect(mockSave).toHaveBeenCalledWith(
        {},
        'user-1',
        expect.objectContaining({
          materialMarkupBps: 1250,
          taxRateBps: 825,
          taxableCategories: ['labor', 'billable_other_costs'],
          paymentTerms: 'net_15',
          estimateExpirationDays: 7,
        }),
      ),
    );
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
