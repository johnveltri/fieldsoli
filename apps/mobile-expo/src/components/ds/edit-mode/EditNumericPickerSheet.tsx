import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radius, space } from '@fieldsolo/design-system/lib/tokens';

import { BottomSheetShell } from '../BottomSheetShell';
import { EditPickerSheetHeader } from './EditPickerSheetHeader';
import { DsTextInput } from '../DsTextInput';
import { bg, border, fg } from '../../../theme/nativeTokens';
import type { TextStyles } from '../../../theme/nativeTokens';

type EditNumericPickerSheetProps = {
  typography: TextStyles;
  visible: boolean;
  title: string;
  mode: 'currency' | 'quantity';
  valueCents?: number;
  valueQuantity?: number;
  allowClear?: boolean;
  /** Overrides the in-field placeholder; pass `''` for no placeholder when empty. */
  inputPlaceholder?: string;
  onClose?: () => void;
  onClosed?: () => void;
  /** `cents` / `quantity` omitted when the field was cleared to empty. */
  onSave: (value: { cents?: number; quantity?: number }) => void;
  onClear?: () => void;
};

function centsToText(cents: number): string {
  if (cents <= 0) return '';
  return (cents / 100).toFixed(2);
}

function quantityToText(quantity: number): string {
  if (quantity <= 0) return '';
  return String(quantity);
}

function parseCurrencyText(text: string): number | undefined {
  const cleaned = text.trim().replace(/[$,\s]/g, '');
  if (cleaned.length === 0) return undefined;
  const dollars = Number(cleaned);
  if (!Number.isFinite(dollars) || dollars < 0) return undefined;
  return Math.round(dollars * 100);
}

function parseQuantityText(text: string): number | undefined {
  const cleaned = text.trim().replace(/[^0-9.]/g, '');
  if (cleaned.length === 0 || cleaned === '.') return undefined;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

export function EditNumericPickerSheet({
  typography,
  visible,
  title,
  mode,
  valueCents = 0,
  valueQuantity = 0,
  allowClear = false,
  inputPlaceholder,
  onClose,
  onClosed,
  onSave,
  onClear,
}: EditNumericPickerSheetProps) {
  const [text, setText] = useState('');

  useEffect(() => {
    if (!visible) return;
    setText(mode === 'currency' ? centsToText(valueCents) : quantityToText(valueQuantity));
  }, [mode, valueCents, valueQuantity, visible]);

  const handleDone = () => {
    if (mode === 'currency') {
      onSave({ cents: parseCurrencyText(text) });
    } else {
      onSave({ quantity: parseQuantityText(text) });
    }
  };

  return (
    <BottomSheetShell visible={visible} onClose={handleDone} onClosed={onClosed}>
      <View style={styles.body}>
        <EditPickerSheetHeader
          typography={typography}
          title={title}
          onClear={allowClear ? onClear : undefined}
          onClose={onClose}
          onDone={handleDone}
        />
        <View style={styles.fieldRow}>
          {mode === 'currency' ? (
            <Text style={[typography.body, { color: fg.secondary }]}>$</Text>
          ) : null}
          <DsTextInput
            autoFocus
            keyboardType="decimal-pad"
            inputMode="decimal"
            placeholder={
              inputPlaceholder !== undefined
                ? inputPlaceholder
                : mode === 'currency'
                  ? '0.00'
                  : '0'
            }
            placeholderTextColor={fg.secondary}
            style={[typography.body, styles.input, { color: fg.primary }]}
            value={text}
            onChangeText={setText}
            onSubmitEditing={handleDone}
          />
        </View>
      </View>
    </BottomSheetShell>
  );
}

const styles = StyleSheet.create({
  body: {
    width: '100%',
    gap: space('Spacing/8'),
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space('Spacing/4'),
    minHeight: 48,
    borderWidth: 1,
    borderColor: border.subtle,
    borderRadius: radius('Radius/12'),
    backgroundColor: bg.surfaceWhite,
    paddingHorizontal: space('Spacing/16'),
    paddingVertical: space('Spacing/12'),
  },
  input: {
    flex: 1,
    padding: 0,
    minHeight: 24,
  },
});
