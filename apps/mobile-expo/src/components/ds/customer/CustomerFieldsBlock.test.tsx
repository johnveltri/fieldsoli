import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import { createTextStyles } from '../../../theme/nativeTokens';
import { CustomerFieldsBlock } from './CustomerFieldsBlock';
import { emptyCustomerDraft, type CustomerDraft } from './types';

const mockCustomerSuggestionsState = {
  suggestions: [] as Array<{
    customerId: string;
    displayName: string;
    phone: string | null;
    email: string | null;
    serviceAddress: string | null;
  }>,
  suggestionsQuery: '' as string | null,
  loading: false,
  error: false,
  reload: jest.fn(),
};

const mockAddressLookupState = {
  suggestions: [] as Array<{ token: string; displayAddress: string }>,
  loading: false,
  noResults: false,
  showPanel: false,
  meetsThreshold: false,
};

jest.mock('./useCustomerSuggestions', () => ({
  ...jest.requireActual('./useCustomerSuggestions'),
  useCustomerSuggestions: () => mockCustomerSuggestionsState,
}));

jest.mock('./useAddressAutocomplete', () => ({
  useAddressAutocomplete: () => mockAddressLookupState,
}));

jest.mock('../edit-mode/EditSwipeableRow', () => {
  const { View } = require('react-native');
  return {
    EditSwipeableRow: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
  };
});

jest.mock('../edit-mode/EditModeIcons', () => ({
  EditIconContactBook: () => null,
  EditIconEmail: () => null,
  EditIconLocation: () => null,
  EditIconPerson: () => null,
  EditIconPhone: () => null,
}));

const typography = createTextStyles({
  serifBold: 'System',
  sans: 'System',
  sansSemi: 'System',
  sansBold: 'System',
});
const supabase = {} as never;

function renderFields(draft: CustomerDraft, onChange = jest.fn()) {
  return render(
    <CustomerFieldsBlock
      typography={typography}
      iconColor="#000"
      draft={draft}
      onChange={onChange}
      surface="live_session"
      supabase={supabase}
    />,
  );
}

describe('CustomerFieldsBlock optional fields and focus', () => {
  it('keeps phone, email, and address available with a blank Customer name', () => {
    mockAddressLookupState.suggestions = [];
    const view = renderFields(emptyCustomerDraft());

    expect(screen.getByLabelText('Customer')).toBeTruthy();
    expect(screen.getByLabelText('Phone')).toBeTruthy();
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Address')).toBeTruthy();

    fireEvent(screen.getByLabelText('Customer'), 'focus', { nativeEvent: { target: 1 } });
    expect(screen.getByLabelText('Phone')).toBeTruthy();
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Address')).toBeTruthy();
    view.unmount();
  });

  it('keeps existing optional values visible when the name is cleared', () => {
    const draft = {
      ...emptyCustomerDraft(),
      customerName: 'Acme Services',
      customerPhone: '312-555-0100',
      customerEmail: 'dispatch@example.com',
      serviceAddress: '10 Main St',
    };
    const onChange = jest.fn();
    const view = renderFields(draft, onChange);

    fireEvent.changeText(screen.getByLabelText('Customer'), '');
    expect(onChange).toHaveBeenCalledWith({ customerName: '' });

    view.rerender(
      <CustomerFieldsBlock
        typography={typography}
        iconColor="#000"
        draft={{ ...draft, customerName: '' }}
        onChange={onChange}
        surface="live_session"
        supabase={supabase}
      />,
    );
    expect(screen.getByDisplayValue('312-555-0100')).toBeTruthy();
    expect(screen.getByDisplayValue('dispatch@example.com')).toBeTruthy();
    expect(screen.getByDisplayValue('10 Main St')).toBeTruthy();
  });

  it('keeps address suggestions selectable after the input blurs', () => {
    mockAddressLookupState.suggestions = [
      { token: 'address-1', displayAddress: '45 Oak Ave, Chicago, IL' },
    ];
    mockAddressLookupState.showPanel = true;
    mockAddressLookupState.meetsThreshold = true;
    const onChange = jest.fn();
    const onCustomerCommit = jest.fn();
    const onFocusChange = jest.fn();
    const draft = { ...emptyCustomerDraft(), serviceAddress: '45 Oak' };
    const view = render(
      <CustomerFieldsBlock
        typography={typography}
        iconColor="#000"
        draft={draft}
        onChange={onChange}
        onCustomerCommit={onCustomerCommit}
        onFocusChange={onFocusChange}
        surface="live_session"
        supabase={supabase}
      />,
    );

    const address = screen.getByLabelText('Address');
    fireEvent(address, 'focus', { nativeEvent: { target: 1 } });
    fireEvent(address, 'blur');
    expect(onFocusChange).toHaveBeenLastCalledWith(false);
    fireEvent.press(screen.getByLabelText('45 Oak Ave, Chicago, IL'));

    expect(onChange).toHaveBeenCalledWith({ serviceAddress: '45 Oak Ave, Chicago, IL' });
    expect(onCustomerCommit).toHaveBeenCalledWith({
      ...draft,
      serviceAddress: '45 Oak Ave, Chicago, IL',
    });
    view.unmount();
    mockAddressLookupState.suggestions = [];
    mockAddressLookupState.showPanel = false;
    mockAddressLookupState.meetsThreshold = false;
  });
});
