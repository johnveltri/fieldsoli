import { forwardRef, useMemo } from 'react';
import {
  StyleSheet,
  TextInput,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
} from 'react-native';

import { withTextInputMetrics } from '../../theme/nativeTokens';

export type DsTextInputProps = TextInputProps;

/**
 * Design-system `TextInput` with typography metrics that prevent descender clipping
 * (e.g. `g`, `p`, `q`) on iOS and Android. Use everywhere instead of raw `TextInput`.
 */
export const DsTextInput = forwardRef<TextInput, DsTextInputProps>(function DsTextInput(
  { style, multiline, ...props },
  ref,
) {
  const resolvedStyle = useMemo((): StyleProp<TextStyle> => {
    const flat = StyleSheet.flatten(style) as TextStyle | undefined;
    if (multiline) {
      return { ...flat, includeFontPadding: false };
    }
    // Flatten first, then apply metrics so token `lineHeight` is not reintroduced by a
    // later style array entry (undefined does not unset keys in RN style flattening).
    return withTextInputMetrics(flat ?? {});
  }, [style, multiline]);

  return <TextInput ref={ref} style={resolvedStyle} multiline={multiline} {...props} />;
});
