import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ProfileCheckIcon } from '../figma-icons/ProfileScreenIcons';
import { bg, border, color, fg, radius, space, type TextStyles } from '../../theme/nativeTokens';

/** Shared radio-card treatment for Account defaults and export year selection. */
export function AccountSingleSelectCard<T>({ typography, options, selected, onSelect, disabled = false }: {
  typography: TextStyles;
  options: readonly { value: T; label: string }[];
  selected: T;
  onSelect: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.card} accessibilityRole="radiogroup">
      {options.map((option, index) => (
        <Pressable
          key={option.label}
          accessibilityRole="radio"
          accessibilityLabel={option.label}
          accessibilityState={{ checked: selected === option.value, disabled }}
          disabled={disabled}
          onPress={() => onSelect(option.value)}
          style={({ pressed }) => [styles.row, index > 0 && styles.separator, pressed && styles.pressed]}
        >
          <Text style={[typography.body, styles.label]}>{option.label}</Text>
          {selected === option.value ? <ProfileCheckIcon color={color('Brand/Primary')} size={20} /> : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: bg.surfaceWhite, borderRadius: radius('Radius/16'), borderWidth: 1, borderColor: border.subtle, overflow: 'hidden' },
  row: { minHeight: 56, padding: space('Spacing/16'), flexDirection: 'row', alignItems: 'center', gap: space('Spacing/12') },
  label: { flex: 1, color: fg.primary },
  separator: { borderTopWidth: 1, borderTopColor: border.subtle },
  pressed: { opacity: 0.75 },
});
