import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DEFAULT_BUSINESS_SETTINGS } from '@fieldsolo/api-client';
import { createTextStyles } from '../theme/nativeTokens';
import { BusinessSettingsScreen } from './BusinessSettingsScreen';

const mockFetch =
  jest.fn<(...args: unknown[]) => Promise<typeof DEFAULT_BUSINESS_SETTINGS>>();
const mockAddressFetch = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockSave = jest.fn<(...args: unknown[]) => Promise<void>>();

jest.mock('@fieldsolo/api-client', () => ({
  ...jest.requireActual<object>('@fieldsolo/api-client'),
  fetchAddressSuggestions: (...args: unknown[]) => mockAddressFetch(...args),
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
    mockAddressFetch.mockResolvedValue({ status: 'ok', suggestions: [] });
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
    expect(screen.queryByLabelText('SAVE CHANGES')).toBeNull();
    fireEvent.press(screen.getByText('Retry'));
    await screen.findByLabelText('Business name');
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it.each(['business', 'settings'] as const)('leaves unchanged %s without a discard prompt', async (mode) => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const onBack = jest.fn();
    const screen = render(<BusinessSettingsScreen typography={typography} mode={mode} onBack={onBack} />);
    await screen.findByLabelText('SAVE CHANGES');
    fireEvent.press(screen.getByLabelText('Back'));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(alert).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('compares business fields with the loaded values and treats null like an empty input', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockFetch.mockResolvedValueOnce({ ...DEFAULT_BUSINESS_SETTINGS, businessName: 'Example' });
    const onBack = jest.fn();
    const screen = render(<BusinessSettingsScreen typography={typography} mode="business" onBack={onBack} />);
    await screen.findByLabelText('Business name');
    fireEvent.changeText(screen.getByLabelText('Business name'), 'Changed');
    fireEvent.press(screen.getByLabelText('Back'));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(onBack).not.toHaveBeenCalled();
    alert.mockClear();
    fireEvent.changeText(screen.getByLabelText('Business name'), 'Example');
    fireEvent.changeText(screen.getByLabelText('Phone'), '');
    fireEvent.press(screen.getByLabelText('Back'));
    expect(alert).not.toHaveBeenCalled();
    expect(onBack).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });

  it('does not prompt for equivalent percentages, unchanged choices, or edits that were undone', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockFetch.mockResolvedValueOnce({ ...DEFAULT_BUSINESS_SETTINGS, materialMarkupBps: 1000 });
    const onBack = jest.fn();
    const screen = render(<BusinessSettingsScreen typography={typography} mode="settings" onBack={onBack} />);
    await screen.findByLabelText('Default material markup');
    fireEvent.changeText(screen.getByLabelText('Default material markup'), '10.00');
    fireEvent.changeText(screen.getByLabelText('Tax rate'), '0.00');
    fireEvent.press(screen.getByRole('checkbox', { name: 'Apply to Labor & Services' }));
    fireEvent.press(screen.getByRole('checkbox', { name: 'Apply to Labor & Services' }));
    fireEvent.press(screen.getByRole('radio', { name: 'Net 15' }));
    fireEvent.press(screen.getByRole('radio', { name: 'Due upon receipt' }));
    fireEvent.press(screen.getByRole('radio', { name: '7 days' }));
    fireEvent.press(screen.getByRole('radio', { name: '30 days' }));
    fireEvent.press(screen.getByLabelText('Back'));
    expect(alert).not.toHaveBeenCalled();
    expect(onBack).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });

  it.each(['', 'invalid', '12.5'])('protects an actual markup edit (%s) from being lost', async (text) => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const onBack = jest.fn();
    const screen = render(<BusinessSettingsScreen typography={typography} mode="settings" onBack={onBack} />);
    await screen.findByLabelText('Default material markup');
    fireEvent.changeText(screen.getByLabelText('Default material markup'), text);
    fireEvent.press(screen.getByLabelText('Back'));
    expect(alert).toHaveBeenCalledWith('Discard changes?', undefined, expect.any(Array));
    expect(onBack).not.toHaveBeenCalled();
    alert.mockRestore();
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
    expect(screen.queryByText('All categories')).toBeNull();
    fireEvent.press(screen.getByRole('checkbox', { name: 'Apply to Materials' }));
    expect(screen.getByRole('checkbox', { name: 'Apply to Materials' }).props.accessibilityState.checked).toBe(false);
    fireEvent.press(screen.getByRole('radio', { name: 'Net 15' }));
    fireEvent.press(screen.getByRole('radio', { name: '7 days' }));
    fireEvent.press(screen.getByLabelText('SAVE CHANGES'));
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
  it('looks up a business address without saving until Save Changes', async () => {
    mockAddressFetch.mockResolvedValue({
      status: 'ok', suggestions: [{ token: 'g0', displayAddress: '123 Main St, Chicago, IL' }],
    });
    const screen = render(<BusinessSettingsScreen typography={typography} mode="business" onBack={() => {}} />);
    const address = await screen.findByLabelText('Address');
    jest.useFakeTimers();
    fireEvent(address, 'focus', { nativeEvent: { target: 1 } });
    fireEvent.changeText(address, '123 Main');
    await act(async () => { jest.advanceTimersByTime(300); });
    fireEvent.press(screen.getByRole('button', { name: '123 Main St, Chicago, IL' }));
    expect(screen.getByLabelText('Address').props.value).toBe('123 Main St, Chicago, IL');
    expect(screen.queryByText('Powered by Geoapify · © OpenStreetMap contributors')).toBeNull();
    expect(mockSave).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText('SAVE CHANGES'));
    await act(async () => {});
    expect(mockSave).toHaveBeenCalledWith({}, 'user-1', expect.objectContaining({ address: '123 Main St, Chicago, IL' }));
    jest.useRealTimers();
  });

  it('keeps manual business address entry when lookup fails and cancel discards it', async () => {
    mockAddressFetch.mockResolvedValue({ status: 'error', code: 'unavailable' });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const onBack = jest.fn();
    const screen = render(<BusinessSettingsScreen typography={typography} mode="business" onBack={onBack} />);
    const address = await screen.findByLabelText('Address');
    jest.useFakeTimers();
    fireEvent(address, 'focus', { nativeEvent: { target: 1 } });
    fireEvent.changeText(address, '123 Main');
    await act(async () => { jest.advanceTimersByTime(300); });
    expect(screen.queryByText('Searching…')).toBeNull();
    expect(screen.queryByText('No results')).toBeNull();
    expect(screen.getByLabelText('Address').props.value).toBe('123 Main');
    fireEvent.press(screen.getByLabelText('Back'));
    const buttons = alert.mock.calls[0]?.[2];
    buttons?.find((button) => button.text === 'Discard')?.onPress?.();
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(mockSave).not.toHaveBeenCalled();
    alert.mockRestore();
    jest.useRealTimers();
  });

  it.each(['Default material markup', 'Tax rate'])('shows zero as empty on %s focus without making settings dirty', async (label) => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const onBack = jest.fn();
    const screen = render(<BusinessSettingsScreen typography={typography} mode="settings" onBack={onBack} />);
    const field = await screen.findByLabelText(label);
    fireEvent(field, 'focus', { nativeEvent: { target: 1 } });
    expect(screen.getByLabelText(label).props.value).toBe('');
    fireEvent.press(screen.getByLabelText('Back'));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(alert).not.toHaveBeenCalled();
    fireEvent(field, 'blur', { nativeEvent: { target: 1 } });
    expect(screen.getByLabelText(label).props.value).toMatch(/^0%/);
    alert.mockRestore();
  });

  it('accepts decimals after zero focus, preserves nonzero focus, and restores cleared percentages to zero', async () => {
    mockFetch.mockResolvedValueOnce({ ...DEFAULT_BUSINESS_SETTINGS, materialMarkupBps: 1250 });
    const screen = render(<BusinessSettingsScreen typography={typography} mode="settings" onBack={() => {}} />);
    const markup = await screen.findByLabelText('Default material markup');
    fireEvent(markup, 'focus', { nativeEvent: { target: 1 } });
    expect(screen.getByLabelText('Default material markup').props.value).toBe('12.5');
    fireEvent.changeText(markup, '');
    fireEvent(markup, 'blur', { nativeEvent: { target: 1 } });
    expect(screen.getByLabelText('Default material markup').props.value).toBe('0% Default Markup');
    const tax = screen.getByLabelText('Tax rate');
    fireEvent(tax, 'focus', { nativeEvent: { target: 1 } });
    fireEvent.changeText(tax, '8.25');
    fireEvent(tax, 'blur', { nativeEvent: { target: 1 } });
    fireEvent.press(screen.getByLabelText('SAVE CHANGES'));
    await waitFor(() => expect(mockSave).toHaveBeenCalledWith({}, 'user-1', expect.objectContaining({ materialMarkupBps: 0, taxRateBps: 825 })));
  });

  it('saves an empty focused percentage as zero and keeps a typed fractional zero', async () => {
    mockFetch.mockResolvedValueOnce({ ...DEFAULT_BUSINESS_SETTINGS, materialMarkupBps: 1250 });
    const screen = render(<BusinessSettingsScreen typography={typography} mode="settings" onBack={() => {}} />);
    const markup = await screen.findByLabelText('Default material markup');
    fireEvent(markup, 'focus', { nativeEvent: { target: 1 } });
    fireEvent.changeText(markup, '');
    const tax = screen.getByLabelText('Tax rate');
    fireEvent(tax, 'focus', { nativeEvent: { target: 2 } });
    fireEvent.changeText(tax, '0');
    expect(screen.getByLabelText('Tax rate').props.value).toBe('0');
    fireEvent.changeText(tax, '0.25');
    fireEvent.press(screen.getByLabelText('SAVE CHANGES'));
    await waitFor(() => expect(mockSave).toHaveBeenCalledWith({}, 'user-1', expect.objectContaining({ materialMarkupBps: 0, taxRateBps: 25 })));
  });

});
