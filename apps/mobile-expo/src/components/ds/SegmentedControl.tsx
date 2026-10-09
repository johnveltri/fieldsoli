import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { bg, cardShadowRn, fg, radius, space } from '../../theme/nativeTokens';

export type SegmentedControlOption<Value extends string> = {
  value: Value;
  label: string;
};

type Props<Value extends string> = {
  value: Value;
  options: readonly SegmentedControlOption<Value>[];
  onValueChange: (value: Value) => void;
  labelStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  disabled?: boolean;
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function SegmentedControl<Value extends string>({
  value,
  options,
  onValueChange,
  labelStyle,
  accessibilityLabel,
  disabled = false,
  fill = true,
  style,
}: Props<Value>) {
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, fill ? styles.fill : null, style]}
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onValueChange(option.value)}
            style={({ pressed }) => [
              styles.segment,
              selected && styles.selectedSegment,
              pressed && !disabled && styles.pressed,
            ]}
          >
            <Text
              style={[
                labelStyle,
                styles.label,
                { color: selected ? fg.primary : fg.secondary },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: bg.subtle,
    borderRadius: radius('Radius/Full'),
    padding: space('Spacing/4'),
  },
  fill: { width: '100%' },
  segment: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius('Radius/Full'),
  },
  selectedSegment: {
    backgroundColor: bg.surfaceWhite,
    ...cardShadowRn,
  },
  label: { textTransform: 'uppercase' },
  pressed: { opacity: 0.75 },
});
