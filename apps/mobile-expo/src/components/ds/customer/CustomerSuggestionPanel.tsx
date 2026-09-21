import { Pressable, StyleSheet, Text, View } from 'react-native';
import { color, space } from '@fieldsolo/design-system/lib/tokens';
import type { CustomerSuggestion } from '@fieldsolo/api-client';

import { fg } from '../../../theme/nativeTokens';
import type { TextStyles } from '../../../theme/nativeTokens';
import { CustomerSuggestionRow } from './CustomerSuggestionRow';

type CustomerSuggestionPanelProps = {
  typography: TextStyles;
  suggestions: CustomerSuggestion[];
  loading: boolean;
  error: boolean;
  query: string;
  onRetry: () => void;
  onSelect: (suggestion: CustomerSuggestion) => void;
};

export function CustomerSuggestionPanel({
  typography,
  suggestions,
  loading,
  error,
  query,
  onRetry,
  onSelect,
}: CustomerSuggestionPanelProps) {
  const trimmed = query.trim();
  const errorCopy = "Couldn't load customers. Try again.";
  const showBlankQueryEmpty = !loading && !error && suggestions.length === 0 && trimmed.length === 0;
  const showSuggestions = !error && suggestions.length > 0;
  const showSearching = loading && !error && suggestions.length === 0 && trimmed.length > 0;

  if (!error && !showBlankQueryEmpty && !showSuggestions && !showSearching) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      {showSearching ? (
        <Text style={[typography.bodySmall, { color: fg.secondary }]}>Searching…</Text>
      ) : null}
      {!loading && error ? (
        <View style={styles.messageBlock}>
          <Text style={[typography.bodySmall, { color: fg.secondary }]}>{errorCopy}</Text>
          <Pressable accessibilityRole="button" onPress={onRetry}>
            <Text style={[typography.bodyBold, { color: color('Brand/Primary') }]}>Try again</Text>
          </Pressable>
        </View>
      ) : null}
      {showBlankQueryEmpty ? (
        <Text style={[typography.bodySmall, { color: fg.secondary }]}>No saved customers yet.</Text>
      ) : null}
      {showSuggestions ? (
        <>
          {suggestions.map((suggestion) => (
            <CustomerSuggestionRow
              key={suggestion.customerId}
              typography={typography}
              suggestion={suggestion}
              onPress={() => onSelect(suggestion)}
            />
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space('Spacing/4'),
  },
  messageBlock: {
    gap: space('Spacing/8'),
  },
});
