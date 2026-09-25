import { useEffect, useState } from 'react';
import {
  Keyboard,
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
import {
  ProfileCheckIcon,
  ProfilePersonalInfoIcon,
} from '../figma-icons/ProfileScreenIcons';
import { SessionSheetBackIcon } from '../figma-icons/JobDetailScreenIcons';
import { BottomSheetShell } from './BottomSheetShell';
import { BottomSheetScrollView } from './bottomSheetScrollContext';
import { screenHeaderA11y } from '../../lib/accessibility';
import type { TradePreset } from '../../lib/trades';

type TradeMultiSelectBottomSheetProps = {
  typography: TextStyles;
  visible: boolean;
  /** Preset options the user can toggle on/off. */
  presets: ReadonlyArray<TradePreset>;
  /** Currently-selected trades. Custom values not in `presets` are preserved on submit. */
  selected: string[];
  onClose?: () => void;
  onClosed?: () => void;
  onBack?: () => void;
  /** Returns the full trade array (preset values + any custom entries). */
  onSubmit: (trades: string[]) => void;
  /** @default true — set false when this sheet replaces another (e.g. live session) without stacking. */
  registerInGlobalStack?: boolean;
};

const CUSTOM_MAX_LENGTH = 32;

/**
 * Multi-select trade picker (Figma `1904:3874` family — same row chrome as the
 * unit picker `1882:1781`, but each row toggles instead of selecting +
 * dismissing immediately, and there's a sticky DONE button at the bottom).
 *
 * Selection state lives locally so toggles are instantaneous; the parent
 * only sees the final array via `onSubmit(...)`. Custom values (entered via
 * the bottom Custom + APPLY input) are appended to the same array.
 *
 * On open, local state is reseeded from `selected` so re-opening always
 * reflects the canonical parent value.
 */
export function TradeMultiSelectBottomSheet({
  typography,
  visible,
  presets,
  selected,
  onClose,
  onClosed,
  onBack,
  onSubmit,
  registerInGlobalStack = true,
}: TradeMultiSelectBottomSheetProps) {
  const [localSelected, setLocalSelected] = useState<string[]>(selected);
  const [customText, setCustomText] = useState('');

  useEffect(() => {
    if (!visible) return;
    setLocalSelected(selected);
    setCustomText('');
  // Only reseed on open — otherwise toggling a row while open would fight the parent.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const accent = color('Brand/Primary');
  const applyBg = color('Semantic/Status/Error/Text');
  const applyFg = color('Foundation/Surface/Default');

  // Lower-case map for case-insensitive membership checks.
  const isSelected = (value: string): boolean =>
    localSelected.some((v) => v.toLowerCase() === value.toLowerCase());

  const togglePreset = (value: string) => {
    setLocalSelected((cur) => {
      if (cur.some((v) => v.toLowerCase() === value.toLowerCase())) {
        return cur.filter((v) => v.toLowerCase() !== value.toLowerCase());
      }
      return [...cur, value];
    });
  };

  const addCustom = () => {
    const trimmed = customText.trim();
    if (!trimmed) return;
    if (isSelected(trimmed)) {
      setCustomText('');
      return;
    }
    setLocalSelected((cur) => [...cur, trimmed]);
    setCustomText('');
  };

  // Match DropdownBottomSheet sizing logic so the picker fits without
  // forcing the inner ScrollView to scroll on normal phones.
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const sheetChrome = insets.top + insets.bottom + 16 + 22 + 12 + 24;
  const bodyMaxHeight = Math.min(
    windowHeight * 0.55,
    Math.max(320, windowHeight - sheetChrome),
  );

  return (
    <BottomSheetShell
      visible={visible}
      onClose={onClose}
      onClosed={onClosed}
      registerInGlobalStack={registerInGlobalStack}
    >
      <View style={[styles.body, { maxHeight: bodyMaxHeight }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack ?? onClose}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <SessionSheetBackIcon color={fg.secondary} />
          <Text style={[typography.bodyBold, { color: fg.secondary }]}>Back</Text>
        </Pressable>

        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <ProfilePersonalInfoIcon color={color('Brand/Accent')} />
          </View>
          <Text {...screenHeaderA11y()}
            style={[typography.titleH3, styles.headerTitle, { color: fg.primary }]}
          >
            Trades
          </Text>
        </View>

        <BottomSheetScrollView
          testID="trade-list"
          style={styles.listScroll}
          contentContainerStyle={styles.listScrollContent}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
          {presets.map((opt, i) => {
            const sel = isSelected(opt.value);
            return (
              <Pressable
                key={opt.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: sel }}
                accessibilityLabel={opt.label}
                onPress={() => togglePreset(opt.value)}
                style={({ pressed }) => [
                  styles.row,
                  i > 0 && styles.rowBorderTop,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    typography.body,
                    { color: fg.primary, flex: 1, minWidth: 0 },
                  ]}
                >
                  {opt.label}
                </Text>
                {sel ? <ProfileCheckIcon color={color('Brand/Accent')} /> : null}
              </Pressable>
            );
          })}

          {/* Custom + APPLY row, always shown. */}
          <View style={styles.customRowWrap}>
            <View style={styles.customShell}>
              <DsTextInput
                value={customText}
                onChangeText={setCustomText}
                placeholder="Custom"
                placeholderTextColor={fg.secondary}
                maxLength={CUSTOM_MAX_LENGTH}
                returnKeyType="done"
                onSubmitEditing={addCustom}
                style={[typography.body, styles.customInput]}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add custom trade"
              onPress={addCustom}
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

          {/* Selected chips strip — gives quick visibility of what's in the array
              (incl. custom entries) and lets the user remove them. */}
          {localSelected.length > 0 ? (
            <View style={styles.selectedChipsWrap}>
              {localSelected.map((t, i) => (
                <Pressable
                  key={`sel-${i}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${t}`}
                  onPress={() => togglePreset(t)}
                  style={({ pressed }) => [
                    styles.chip,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[typography.bodySmall, { color: fg.primary }]}>
                    {t}
                  </Text>
                  <Text style={[typography.bodySmall, { color: fg.secondary }]}>×</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </BottomSheetScrollView>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="DONE"
          onPress={() => {
            Keyboard.dismiss();
            onSubmit(localSelected);
          }}
          style={({ pressed }) => [
            styles.primary,
            { backgroundColor: accent, shadowColor: accent },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[typography.ctaPrimaryLabel, styles.primaryLabel]}>DONE</Text>
        </Pressable>
      </View>
    </BottomSheetShell>
  );
}

const styles = StyleSheet.create({
  body: {
    width: '100%',
    gap: space('Spacing/12'),
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space('Spacing/4'),
    alignSelf: 'flex-start',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space('Spacing/12'),
  },
  headerIcon: {
    width: space('Spacing/16'),
    height: space('Spacing/16'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
  },
  listScroll: {
    width: '100%',
    flexGrow: 0,
    flexShrink: 1,
  },
  listScrollContent: {
    width: '100%',
  },
  row: {
    minHeight: space('Spacing/50'),
    paddingHorizontal: space('Spacing/4'),
    paddingVertical: space('Spacing/16'),
    flexDirection: 'row',
    alignItems: 'center',
    gap: space('Spacing/12'),
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
    marginTop: space('Spacing/4'),
  },
  customShell: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    borderWidth: 1,
    borderColor: border.subtle,
    borderRadius: radius('Radius/8'),
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
  selectedChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space('Spacing/8'),
    paddingTop: space('Spacing/12'),
    paddingBottom: space('Spacing/4'),
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space('Spacing/4'),
    paddingHorizontal: space('Spacing/12'),
    paddingVertical: space('Spacing/4'),
    borderRadius: radius('Radius/Full'),
    backgroundColor: bg.surfaceWhite,
    borderWidth: 1,
    borderColor: border.subtle,
  },
  primary: {
    minHeight: space('Spacing/50'),
    borderRadius: radius('Radius/12'),
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadowRn,
  },
  primaryLabel: {
    color: color('Foundation/Surface/White'),
  },
  pressed: {
    opacity: 0.8,
  },
});
