import { useCallback, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import type { CustomerSuggestion } from '@fieldsolo/api-client';
import type { FieldSoloSupabaseClient } from '@fieldsolo/api-client';

import type { TextStyles } from '../../../theme/nativeTokens';
import { EditSwipeableRow } from '../edit-mode/EditSwipeableRow';
import {
  EditAddRow,
  EditFieldInput,
  EditIconGroup,
  EditIconRow,
  EditSheet,
} from '../edit-mode/EditFormRows';
import {
  EditIconContactBook,
  EditIconEmail,
  EditIconLocation,
  EditIconPerson,
  EditIconPhone,
} from '../edit-mode/EditModeIcons';
import { AddressSuggestionPanel } from './AddressSuggestionPanel';
import { CustomerSuggestionPanel } from './CustomerSuggestionPanel';
import { confirmCustomerReplacement, customerFieldsWouldReplace } from './confirmCustomerReplacement';
import { trackCustomerPickerEvent } from './customerAnalytics';
import { importDeviceContact } from './importDeviceContact';
import { useAddressAutocomplete } from './useAddressAutocomplete';
import {
  useCustomerSuggestions,
  visibleCustomerSuggestions,
} from './useCustomerSuggestions';
import {
  emptyCustomerDraft,
  isCustomerContactSwipeable,
  type CustomerDraft,
  type CustomerSurface,
} from './types';

type CustomerFieldsBlockProps = {
  typography: TextStyles;
  iconColor: string;
  draft: CustomerDraft;
  onChange: (patch: Partial<CustomerDraft>) => void;
  surface: CustomerSurface;
  supabase: FieldSoloSupabaseClient;
  onCustomerFieldBlur?: () => void;
  onCustomerCommit?: (draft: CustomerDraft) => void;
  onFocusChange?: (focused: boolean) => void;
};

function suggestionToDraft(suggestion: CustomerSuggestion): CustomerDraft {
  return {
    customerId: suggestion.customerId,
    customerName: suggestion.displayName,
    customerPhone: suggestion.phone ?? '',
    customerEmail: suggestion.email ?? '',
    serviceAddress: suggestion.serviceAddress ?? '',
  };
}

export function CustomerFieldsBlock({
  typography,
  iconColor,
  draft,
  onChange,
  surface,
  supabase,
  onCustomerFieldBlur,
  onCustomerCommit,
  onFocusChange,
}: CustomerFieldsBlockProps) {
  const [customerFocused, setCustomerFocused] = useState(false);
  const [addressFocused, setAddressFocused] = useState(false);
  const { suggestions, suggestionsQuery, loading, error, reload } =
    useCustomerSuggestions(supabase);
  const addressLookup = useAddressAutocomplete(supabase, draft.serviceAddress, addressFocused);

  const applyDraft = useCallback(
    (next: CustomerDraft, source: 'recent' | 'search' | 'device_contact' | 'manual') => {
      onChange(next);
      trackCustomerPickerEvent(surface, source, 'selected');
      onCustomerCommit?.(next);
    },
    [onChange, onCustomerCommit, surface],
  );

  const releaseInlineFocus = useCallback(() => {
    setCustomerFocused(false);
    setAddressFocused(false);
    onFocusChange?.(false);
    Keyboard.dismiss();
  }, [onFocusChange]);

  const maybeReplaceDraft = useCallback(
    (next: CustomerDraft, source: 'recent' | 'search' | 'device_contact') => {
      if (!customerFieldsWouldReplace(draft, next)) {
        applyDraft(next, source);
        return;
      }
      confirmCustomerReplacement(() => applyDraft(next, source));
    },
    [applyDraft, draft],
  );

  const handleSuggestionSelect = useCallback(
    (suggestion: CustomerSuggestion) => {
      const next = suggestionToDraft(suggestion);
      releaseInlineFocus();
      maybeReplaceDraft(next, draft.customerName.trim() ? 'search' : 'recent');
    },
    [draft.customerName, maybeReplaceDraft, releaseInlineFocus],
  );

  const handleContactsImport = useCallback(async () => {
    const result = await importDeviceContact();
    if (result.status === 'error') {
      trackCustomerPickerEvent(
        surface,
        'device_contact',
        result.code === 'permission_denied' ? 'permission_denied' : 'cancelled',
      );
      return;
    }
    const next: CustomerDraft = {
      ...draft,
      customerName: result.values.customerName,
      customerPhone: result.values.customerPhone,
      customerEmail: result.values.customerEmail,
      serviceAddress: result.values.serviceAddress,
      customerId: null,
    };
    maybeReplaceDraft(next, 'device_contact');
  }, [draft, maybeReplaceDraft, surface]);

  const hasCustomerName = draft.customerName.trim().length > 0;
  const contactSwipeable = isCustomerContactSwipeable(draft, customerFocused);
  const trimmedCustomerQuery = draft.customerName.trim();
  const visibleSuggestions = visibleCustomerSuggestions(
    suggestions,
    suggestionsQuery,
    draft.customerName,
    loading,
  );
  const showSuggestionPanel =
    customerFocused &&
    (error ||
      trimmedCustomerQuery.length === 0 ||
      loading ||
      visibleSuggestions.length > 0);
  const showContactDetailFields = hasCustomerName && !customerFocused;
  const showAddressSuggestionPanel = addressFocused && addressLookup.meetsThreshold;

  const handleDeleteContact = useCallback(() => {
    releaseInlineFocus();
    const cleared = emptyCustomerDraft();
    onChange(cleared);
    onCustomerCommit?.(cleared);
  }, [onChange, onCustomerCommit, releaseInlineFocus]);

  const customerIcon = <EditIconPerson color={iconColor} />;
  const customerInput = (
    <EditFieldInput
      typography={typography}
      placeholder="Customer"
      accessibilityLabel="Customer"
      value={draft.customerName}
      onFocus={() => {
        setCustomerFocused(true);
        void reload(draft.customerName.trim());
        onFocusChange?.(true);
      }}
      onChangeText={(text) => {
        onChange({ customerName: text });
        void reload(text.trim());
      }}
      onBlur={() => {
        setCustomerFocused(false);
        onCustomerFieldBlur?.();
        onFocusChange?.(false);
      }}
    />
  );

  const contactFields = (
    <>
      <EditIconGroup icon={customerIcon} iconAlign={showSuggestionPanel ? 'top' : 'center'}>
        <View style={styles.customerColumn}>
          {customerInput}
          {showSuggestionPanel ? (
            <CustomerSuggestionPanel
              typography={typography}
              suggestions={visibleSuggestions}
              loading={loading}
              error={error}
              query={draft.customerName}
              onRetry={() => void reload(trimmedCustomerQuery)}
              onSelect={handleSuggestionSelect}
            />
          ) : null}
        </View>
      </EditIconGroup>
      {showContactDetailFields ? (
        <>
          <EditIconRow icon={<EditIconPhone color={iconColor} />}>
            <EditFieldInput
              typography={typography}
              placeholder="Phone"
              accessibilityLabel="Phone"
              value={draft.customerPhone}
              keyboardType="phone-pad"
              onChangeText={(text) => onChange({ customerPhone: text })}
              onBlur={() => {
                onCustomerFieldBlur?.();
                onFocusChange?.(false);
              }}
              onFocus={() => onFocusChange?.(true)}
            />
          </EditIconRow>
          <EditIconRow icon={<EditIconEmail color={iconColor} />}>
            <EditFieldInput
              typography={typography}
              placeholder="Email"
              accessibilityLabel="Email"
              value={draft.customerEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={(text) => onChange({ customerEmail: text })}
              onBlur={() => {
                onCustomerFieldBlur?.();
                onFocusChange?.(false);
              }}
              onFocus={() => onFocusChange?.(true)}
            />
          </EditIconRow>
          <EditIconGroup
            icon={<EditIconLocation color={iconColor} />}
            iconAlign={showAddressSuggestionPanel ? 'top' : 'center'}
          >
            <View style={styles.addressColumn}>
              <EditFieldInput
                typography={typography}
                placeholder="Address"
                accessibilityLabel="Address"
                value={draft.serviceAddress}
                onChangeText={(text) =>
                  onChange({ serviceAddress: text.replace(/[\r\n]+/g, ' ') })
                }
                onFocus={() => {
                  setAddressFocused(true);
                  onFocusChange?.(true);
                }}
                onBlur={() => {
                  setAddressFocused(false);
                  onCustomerFieldBlur?.();
                  onFocusChange?.(false);
                }}
                returnKeyType="done"
                blurOnSubmit
              />
              <AddressSuggestionPanel
                typography={typography}
                suggestions={addressLookup.suggestions}
                loading={addressLookup.loading}
                unavailable={addressLookup.unavailable}
                noMatches={addressLookup.noMatches}
                meetsThreshold={showAddressSuggestionPanel}
                onSelect={(suggestion) => {
                  onChange({ serviceAddress: suggestion.displayAddress });
                  onCustomerCommit?.({ ...draft, serviceAddress: suggestion.displayAddress });
                }}
              />
            </View>
          </EditIconGroup>
        </>
      ) : null}
    </>
  );

  return (
    <EditSheet>
      <EditSwipeableRow
        typography={typography}
        accessibilityLabel="Customer"
        enabled={contactSwipeable}
        onDelete={handleDeleteContact}
      >
        {contactFields}
      </EditSwipeableRow>
      <EditAddRow
        typography={typography}
        label="Add from Contacts"
        icon={<EditIconContactBook color={iconColor} />}
        onPress={() => void handleContactsImport()}
        showTopBorder
      />
    </EditSheet>
  );
}

const styles = StyleSheet.create({
  customerColumn: {
    flex: 1,
  },
  addressColumn: {
    flex: 1,
  },
});
