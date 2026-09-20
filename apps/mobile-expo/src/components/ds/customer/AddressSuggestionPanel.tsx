import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { space } from '@fieldsolo/design-system/lib/tokens';
import type { AddressSuggestion } from '@fieldsolo/api-client';

import { fg } from '../../../theme/nativeTokens';
import type { TextStyles } from '../../../theme/nativeTokens';

const ATTRIBUTION = 'Powered by Geoapify · © OpenStreetMap contributors';

type AddressSuggestionPanelProps = {
  typography: TextStyles;
  suggestions: AddressSuggestion[];
  loading: boolean;
  unavailable: boolean;
  noMatches: boolean;
  meetsThreshold: boolean;
  onSelect: (suggestion: AddressSuggestion) => void;
};

export function AddressSuggestionPanel({
  typography,
  suggestions,
  loading,
  unavailable,
  noMatches,
  meetsThreshold,
  onSelect,
}: AddressSuggestionPanelProps) {
  if (!meetsThreshold) return null;

  return (
    <View style={styles.wrap}>
      {loading ? (
        <Text style={[typography.bodySmall, { color: fg.secondary }]}>Searching…</Text>
      ) : null}
      {!loading && noMatches ? (
        <Text style={[typography.bodySmall, { color: fg.secondary }]}>
          No matching addresses. Keep typing or use this address.
        </Text>
      ) : null}
      {!loading && unavailable ? (
        <Text style={[typography.bodySmall, { color: fg.secondary }]}>
          Address suggestions are unavailable. You can keep typing and save this address.
        </Text>
      ) : null}
      {!loading && !unavailable && suggestions.length > 0 ? (
        <>
          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestion.token}
              accessibilityRole="button"
              accessibilityLabel={suggestion.displayAddress}
              onPress={() => onSelect(suggestion)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Text style={[typography.body, { color: fg.primary }]}>{suggestion.displayAddress}</Text>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="link"
            onPress={() => {
              void Linking.openURL('https://www.geoapify.com/');
            }}
          >
            <Text style={[typography.bodySmall, styles.attribution, { color: fg.secondary }]}>
              {ATTRIBUTION}
            </Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: space('Spacing/8'),
    gap: space('Spacing/8'),
  },
  row: {
    paddingVertical: space('Spacing/8'),
  },
  attribution: {
    marginTop: space('Spacing/4'),
  },
  pressed: {
    opacity: 0.7,
  },
});
