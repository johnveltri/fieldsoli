import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { space } from '@fieldsolo/design-system/lib/tokens';
import type { CustomerSuggestion } from '@fieldsolo/api-client';
import type { FieldSoloSupabaseClient } from '@fieldsolo/api-client';

import { fg } from '../../../theme/nativeTokens';
import type { TextStyles } from '../../../theme/nativeTokens';
import {
  EditFieldInput,
  EditIconRow,
  EditSheet,
} from '../edit-mode/EditFormRows';
import { EditIconLocation, EditIconPerson } from '../edit-mode/EditModeIcons';
import { AddressSuggestionPanel } from './AddressSuggestionPanel';
import { CustomerPickerBottomSheet } from './CustomerPickerBottomSheet';
import { confirmCustomerReplacement, customerFieldsWouldReplace } from './confirmCustomerReplacement';
import { trackCustomerPickerEvent } from './customerAnalytics';
import { importDeviceContact } from './importDeviceContact';
import { useAddressAutocomplete } from './useAddressAutocomplete';
import { useCustomerSuggestions } from './useCustomerSuggestions';
import type { CustomerDraft, CustomerSurface } from './types';

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
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerQuery, setPickerQuery] = useState(draft.customerName);
  const [addressFocused, setAddressFocused] = useState(false);
  const { suggestions, loading, error, reload } = useCustomerSuggestions(supabase);
  const addressLookup = useAddressAutocomplete(supabase, draft.serviceAddress, addressFocused);

  const applyDraft = useCallback(
    (next: CustomerDraft, source: 'recent' | 'search' | 'device_contact' | 'manual') => {
      onChange(next);
      trackCustomerPickerEvent(surface, source, 'selected');
      onCustomerCommit?.(next);
    },
    [onChange, onCustomerCommit, surface],
  );

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

  const openPicker = useCallback(() => {
    setPickerQuery(draft.customerName);
    setPickerVisible(true);
    void reload(draft.customerName.trim());
    onFocusChange?.(true);
  }, [draft.customerName, onFocusChange, reload]);

  const closePicker = useCallback(() => {
    setPickerVisible(false);
    onFocusChange?.(false);
  }, [onFocusChange]);

  const handlePickerQueryChange = useCallback(
    (query: string) => {
      setPickerQuery(query);
      onChange({ customerName: query });
      void reload(query.trim());
    },
    [onChange, reload],
  );

  const handleSuggestionSelect = useCallback(
    (suggestion: CustomerSuggestion) => {
      const next = suggestionToDraft(suggestion);
      closePicker();
      maybeReplaceDraft(next, pickerQuery.trim() ? 'search' : 'recent');
    },
    [closePicker, maybeReplaceDraft, pickerQuery],
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

  return (
    <>
      <EditSheet>
        <EditIconRow icon={<EditIconPerson color={iconColor} />}>
          <EditFieldInput
            typography={typography}
            placeholder="Customer"
            accessibilityLabel="Customer"
            value={draft.customerName}
            opticalNudgeY={-3}
            onFocus={openPicker}
            onChangeText={(text) => onChange({ customerName: text })}
            onBlur={() => {
              onCustomerFieldBlur?.();
              onFocusChange?.(false);
            }}
          />
        </EditIconRow>
        <EditIconRow icon={<EditIconPerson color={iconColor} />}>
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
        <EditIconRow icon={<EditIconPerson color={iconColor} />}>
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
        <EditIconRow icon={<EditIconLocation color={iconColor} />}>
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
              meetsThreshold={addressLookup.meetsThreshold && addressFocused}
              onSelect={(suggestion) => {
                onChange({ serviceAddress: suggestion.displayAddress });
                onCustomerCommit?.({ ...draft, serviceAddress: suggestion.displayAddress });
              }}
            />
          </View>
        </EditIconRow>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add from Contacts"
          onPress={() => void handleContactsImport()}
          style={({ pressed }) => [styles.contactsRow, pressed && styles.pressed]}
        >
          <Text style={[typography.bodyBold, { color: fg.primary }]}>Add from Contacts</Text>
        </Pressable>
      </EditSheet>

      <CustomerPickerBottomSheet
        typography={typography}
        visible={pickerVisible}
        query={pickerQuery}
        suggestions={suggestions}
        loading={loading}
        error={error}
        onQueryChange={handlePickerQueryChange}
        onRetry={() => void reload(pickerQuery.trim())}
        onSelect={handleSuggestionSelect}
        onClose={closePicker}
      />
    </>
  );
}

const styles = StyleSheet.create({
  addressColumn: {
    flex: 1,
  },
  contactsRow: {
    paddingVertical: space('Spacing/12'),
    paddingHorizontal: space('Spacing/16'),
  },
  pressed: {
    opacity: 0.7,
  },
});
