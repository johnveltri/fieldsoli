import { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space } from '@fieldsolo/design-system/lib/tokens';

import { DsTextInput } from './DsTextInput';
import { bg, border, cardShadowRn, fg } from '../../theme/nativeTokens';
import type { TextStyles } from '../../theme/nativeTokens';
import { SessionSheetBackIcon } from '../figma-icons/JobDetailScreenIcons';
import { BottomSheetShell } from './BottomSheetShell';
import { screenHeaderA11y } from '../../lib/accessibility';

export type DropdownBottomSheetOption = {
  /** Unique id — for preset rows this is typically the same as the value. */
  id: string;
  /** Primary row label (what is visible to the user). */
  label: string;
  /** Value returned via `onSelect` when the row is tapped. */
  value: string;
};

type DropdownBottomSheetProps = {
  typography: TextStyles;
  visible: boolean;
  /**
   * Optional sheet title. Rendered above the list when provided; the Figma
   * unit picker (`1882:1781`) omits a visible title and relies on context —
   * in that case pass `undefined`.
   */
  title?: string;
  options: DropdownBottomSheetOption[];
  /** Currently-selected value; used to prefill the Custom input if the value doesn't match any preset. */
  currentValue?: string | null;
  /** When true, renders a text input below the list for custom free-text values. */
  allowCustom?: boolean;
  /** Placeholder text for the Custom input (ignored when `allowCustom` is false). */
  customPlaceholder?: string;
  /**
   * Max length for the custom input. The unit picker caps at ~8 chars so the
   * pressable in the Edit Material sheet doesn't overflow.
   */
  customMaxLength?: number;
  /** Keyboard type for the custom input (e.g. `decimal-pad` for duration). */
  customKeyboardType?: 'default' | 'decimal-pad' | 'number-pad';
  /** Input mode for the custom field (e.g. `decimal` for duration). */
  customInputMode?: 'decimal' | 'text';
  onClose?: () => void;
  onClosed?: () => void;
  onBack?: () => void;
  /** When set, replaces the leading Back control with Clear. */
  onClear?: () => void;
  /** Called when the user selects a preset row or submits the Custom input. */
  onSelect: (value: string) => void;
  /** @default true — set false when this sheet replaces another (e.g. live session) without stacking. */
  registerInGlobalStack?: boolean;
};

/**
 * Generic "pick one from a list" bottom sheet with an optional custom
 * free-text input (Figma `1882:1781` unit picker).
 *
 * Designed to be entity-agnostic so future pickers (unit, status, job
 * type, etc.) can reuse it without branching. Preset rows render as
 * horizontal-rule separated text labels; the Custom input is a standard
 * `TextInput` that commits via submit or blur.
 */
export function DropdownBottomSheet({
  typography,
  visible,
  title,
  options,
  currentValue,
  allowCustom = false,
  customPlaceholder,
  customMaxLength = 8,
  customKeyboardType,
  customInputMode,
  onClose,
  onClosed,
  onBack,
  onClear,
  onSelect,
  registerInGlobalStack = true,
}: DropdownBottomSheetProps) {
  const optionValues = options.map((o) => o.value);
  const presetMatch =
    currentValue != null && optionValues.includes(currentValue);
  const initialCustom =
    allowCustom && currentValue != null && !presetMatch ? currentValue : '';
  const [customText, setCustomText] = useState<string>(initialCustom);

  useEffect(() => {
    if (!visible) return;
    setCustomText(initialCustom);
    // Only reset on open — `initialCustom` is recomputed from stable props.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const commitCustom = () => {
    const trimmed = customText.trim();
    if (!trimmed) return;
    onSelect(trimmed);
  };

  const handleDismiss = () => {
    if (allowCustom && customText.trim()) {
      commitCustom();
      return;
    }
    onClose?.();
  };

  // Figma `1882:1862` uses the error-text brand color for the APPLY pill
  // (#C44B2B on white text) — same palette as the +SESSION pill so both
  // row-level actions feel visually related.
  const applyBg = color('Semantic/Status/Error/Text');
  const applyFg = color('Foundation/Surface/Default');

  // Dynamic body cap: fit content naturally on normal phones so the
  // Custom/APPLY row is always visible without scrolling, and only
  // engage the inner ScrollView on tiny/landscape viewports where the
  // full list truly can't fit above the safe area + sheet chrome.
  // Subtracts the approximate sheet chrome: top inset, sheet pad-top
  // (16), handle + margin (~22), content pad-bottom (insets.bottom +
  // 12), plus a small breathing-room gap (24) so the sheet doesn't
  // crowd the status bar.
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const sheetChrome = insets.top + insets.bottom + 16 + 22 + 12 + 24;
  const bodyMaxHeight = Math.max(320, windowHeight - sheetChrome);
  const hasHeaderBar = !!(onClear || onBack);
  const hasHeaderSection = hasHeaderBar || !!title;

  return (
    <BottomSheetShell
      visible={visible}
      onClose={handleDismiss}
      onClosed={onClosed}
      registerInGlobalStack={registerInGlobalStack}
    >
      <View style={[styles.body, { maxHeight: bodyMaxHeight }]}>
        {hasHeaderSection ? (
          <View style={styles.headerWrap}>
            {hasHeaderBar ? (
              <View style={styles.bar}>
                {onClear ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Clear"
                    onPress={() => {
                      onClear();
                      onClose?.();
                    }}
                    style={({ pressed }) => [styles.barAction, pressed && styles.pressed]}
                  >
                    <Text style={[typography.bodyBold, { color: fg.secondary }]}>Clear</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                    onPress={onBack ?? onClose}
                    style={({ pressed }) => [styles.barAction, pressed && styles.pressed]}
                  >
                    <SessionSheetBackIcon color={fg.secondary} />
                    <Text style={[typography.bodyBold, { color: fg.secondary }]}>Back</Text>
                  </Pressable>
                )}
                <View style={styles.barSpacer} />
              </View>
            ) : null}

            {title ? (
              <Text {...screenHeaderA11y()}
                style={[typography.titleH3, styles.title, { color: fg.primary }]}
              >
                {title}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={[styles.listScroll, hasHeaderSection && styles.listScrollWithHeader]}>
          {options.map((opt, i) => (
            <Pressable
              key={opt.id}
              accessibilityRole="button"
              accessibilityLabel={opt.label}
              onPress={() => onSelect(opt.value)}
              style={({ pressed }) => [
                styles.row,
                i > 0 && styles.rowBorderTop,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[typography.body, { color: fg.primary }]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}

          {allowCustom ? (
            // Full-width wrap with a top stroke so the Custom input reads as
            // the next "row" in the list (Figma `1882:1862`). The wrap is a
            // horizontal row: [ rounded text input ][ APPLY pill ], with a
            // 12px gap between them. Commit happens on APPLY press or
            // return-key submit — no auto-commit on blur so tapping a
            // preset row after typing doesn't send the wrong value.
            <View style={styles.customRowWrap}>
              <View style={styles.customShell}>
                <DsTextInput
                  value={customText}
                  onChangeText={setCustomText}
                  placeholder={customPlaceholder ?? 'Custom'}
                  placeholderTextColor={fg.secondary}
                  maxLength={customMaxLength}
                  keyboardType={customKeyboardType}
                  inputMode={customInputMode}
                  returnKeyType="done"
                  onSubmitEditing={commitCustom}
                  style={[typography.body, styles.customInput]}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Apply custom value"
                onPress={commitCustom}
                disabled={customText.trim().length === 0}
                style={({ pressed }) => [
                  styles.applyBtn,
                  { backgroundColor: applyBg },
                  customText.trim().length === 0 && styles.applyBtnDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[typography.bodySmall, { color: applyFg }]}>APPLY</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </BottomSheetShell>
  );
}

const styles = StyleSheet.create({
  body: {
    width: '100%',
    // `maxHeight` is applied inline from a window-height-derived value so
    // the sheet fits its content without forcing the inner ScrollView to
    // scroll on normal viewports. See `bodyMaxHeight` in the component.
  },
  headerWrap: {
    width: '100%',
    gap: space('Spacing/8'),
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  barAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space('Spacing/4'),
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    paddingRight: space('Spacing/12'),
  },
  barSpacer: {
    width: 72,
  },
  title: {
    textAlign: 'center',
  },
  listScroll: {
    width: '100%',
  },
  listScrollWithHeader: {
    marginTop: space('Spacing/8'),
  },
  row: {
    minHeight: space('Spacing/50'),
    paddingHorizontal: space('Spacing/4'),
    paddingVertical: space('Spacing/16'),
    justifyContent: 'center',
  },
  rowBorderTop: {
    borderTopWidth: 1,
    borderTopColor: border.subtle,
  },
  customRowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space('Spacing/12'),
    borderTopWidth: 1,
    borderTopColor: border.subtle,
    paddingTop: space('Spacing/12'),
  },
  customShell: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    borderWidth: 1,
    borderColor: border.subtle,
    borderRadius: 8,
    backgroundColor: bg.surfaceWhite,
    paddingHorizontal: 13,
    paddingVertical: 9,
    justifyContent: 'center',
    shadowColor: color('Foundation/Text/Primary'),
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  customInput: {
    color: fg.primary,
    padding: 0,
    width: '100%',
  },
  applyBtn: {
    ...cardShadowRn,
    width: 70,
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: space('Spacing/12'),
    paddingVertical: space('Spacing/8'),
    borderRadius: radius('Radius/Full'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnDisabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.8,
  },
});
