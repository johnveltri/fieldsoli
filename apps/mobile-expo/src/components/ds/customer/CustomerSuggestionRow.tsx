import { Pressable, StyleSheet, Text, View } from 'react-native';
import { space } from '@fieldsolo/design-system/lib/tokens';
import type { CustomerSuggestion } from '@fieldsolo/api-client';

import { fg } from '../../../theme/nativeTokens';
import type { TextStyles } from '../../../theme/nativeTokens';

function buildMetadataLine(suggestion: CustomerSuggestion): string {
  const parts = [suggestion.phone, suggestion.email, suggestion.serviceAddress].filter(
    (value) => (value ?? '').trim().length > 0,
  ) as string[];
  return parts.join(' · ');
}

export function CustomerSuggestionRow({
  typography,
  suggestion,
  onPress,
}: {
  typography: TextStyles;
  suggestion: CustomerSuggestion;
  onPress: () => void;
}) {
  const metadata = buildMetadataLine(suggestion);
  const accessibilityLabel = metadata
    ? `${suggestion.displayName}. ${metadata}`
    : suggestion.displayName;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={[typography.bodyBold, { color: fg.primary }]}>{suggestion.displayName}</Text>
      {metadata ? (
        <Text style={[typography.bodySmall, styles.metadata, { color: fg.secondary }]} numberOfLines={2}>
          {metadata}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: space('Spacing/12'),
    gap: space('Spacing/4'),
  },
  metadata: {
    flexWrap: 'wrap',
  },
  pressed: {
    opacity: 0.7,
  },
});
