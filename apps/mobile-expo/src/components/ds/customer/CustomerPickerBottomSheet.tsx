import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, space } from '@fieldsolo/design-system/lib/tokens';
import type { CustomerSuggestion } from '@fieldsolo/api-client';

import { bg, border, fg } from '../../../theme/nativeTokens';
import type { TextStyles } from '../../../theme/nativeTokens';
import { SessionSheetBackIcon } from '../../figma-icons/JobDetailScreenIcons';
import { BottomSheetShell } from '../BottomSheetShell';
import { BottomSheetScrollView } from '../bottomSheetScrollContext';
import { CustomerSuggestionRow } from './CustomerSuggestionRow';

type CustomerPickerBottomSheetProps = {
  typography: TextStyles;
  visible: boolean;
  query: string;
  suggestions: CustomerSuggestion[];
  loading: boolean;
  error: boolean;
  onQueryChange: (query: string) => void;
  onRetry: () => void;
  onSelect: (suggestion: CustomerSuggestion) => void;
  onClose: () => void;
};

export function CustomerPickerBottomSheet({
  typography,
  visible,
  query,
  suggestions,
  loading,
  error,
  onQueryChange,
  onRetry,
  onSelect,
  onClose,
}: CustomerPickerBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const [localQuery, setLocalQuery] = useState(query);

  useEffect(() => {
    if (visible) setLocalQuery(query);
  }, [query, visible]);

  const trimmed = localQuery.trim();
  const emptyCopy =
    trimmed.length === 0 ? 'No saved customers yet.' : 'No matching customers.';
  const errorCopy = "Couldn't load customers. Try again.";

  return (
    <BottomSheetShell visible={visible} onClose={onClose} contentExtendsToBottomEdge>
      <View style={[styles.body, { paddingBottom: insets.bottom + space('Spacing/16') }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onClose}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <SessionSheetBackIcon color={fg.secondary} />
          <Text style={[typography.bodyBold, { color: fg.secondary }]}>Back</Text>
        </Pressable>

        <TextInput
          accessibilityLabel="Customer"
          placeholder="Customer"
          value={localQuery}
          onChangeText={(text) => {
            setLocalQuery(text);
            onQueryChange(text);
          }}
          style={[typography.body, styles.search, { color: fg.primary, borderColor: border.subtle }]}
          autoCorrect={false}
        />

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={color('Brand/Primary')} />
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={[typography.body, { color: fg.secondary, textAlign: 'center' }]}>{errorCopy}</Text>
            <Pressable accessibilityRole="button" onPress={onRetry}>
              <Text style={[typography.bodyBold, { color: color('Brand/Primary') }]}>Try again</Text>
            </Pressable>
          </View>
        ) : suggestions.length === 0 ? (
          <View style={styles.centered}>
            <Text style={[typography.body, { color: fg.secondary, textAlign: 'center' }]}>{emptyCopy}</Text>
          </View>
        ) : (
          <BottomSheetScrollView keyboardShouldPersistTaps="handled">
            {suggestions.map((suggestion) => (
              <CustomerSuggestionRow
                key={suggestion.customerId}
                typography={typography}
                suggestion={suggestion}
                onPress={() => onSelect(suggestion)}
              />
            ))}
          </BottomSheetScrollView>
        )}
      </View>
    </BottomSheetShell>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: space('Spacing/16'),
    gap: space('Spacing/12'),
    maxHeight: 460,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space('Spacing/8'),
    alignSelf: 'flex-start',
  },
  search: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: space('Spacing/12'),
    paddingVertical: space('Spacing/8'),
    backgroundColor: bg.surface,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space('Spacing/24'),
    gap: space('Spacing/12'),
  },
  pressed: {
    opacity: 0.7,
  },
});
