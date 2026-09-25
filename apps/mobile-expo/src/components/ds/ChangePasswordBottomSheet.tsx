import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { color, radius, space } from '@fieldsolo/design-system/lib/tokens';

import { DsTextInput } from './DsTextInput';
import { bg, border, cardShadowRn, fg } from '../../theme/nativeTokens';
import type { TextStyles } from '../../theme/nativeTokens';
import { SessionSheetBackIcon } from '../figma-icons/JobDetailScreenIcons';
import { ProfileAccountIcon } from '../figma-icons/ProfileScreenIcons';
import { BottomSheetShell } from './BottomSheetShell';
import { screenHeaderA11y } from '../../lib/accessibility';
import {
  NEW_PASSWORD_REQUIREMENT,
  newPasswordMeetsPolicy,
} from '../../lib/passwordPolicy';

type ChangePasswordBottomSheetProps = {
  typography: TextStyles;
  visible: boolean;
  /** Disables the CTA + inputs while the auth call is in flight. */
  saving?: boolean;
  onClose?: () => void;
  onClosed?: () => void;
  onBack?: () => void;
  /** Receives the validated, confirmed new password. Caller awaits / handles errors. */
  onSubmit: (newPassword: string) => void;
  /** @default true — set false when this sheet replaces another (e.g. live session) without stacking. */
  registerInGlobalStack?: boolean;
};

/**
 * Change Password sheet (Figma `1924:2083`).
 *
 * Layout (top → bottom):
 *   Back
 *   [cog]  Change Password
 *   [ New Password ]
 *   [ Repeat Password ]
 *   "Password does not match"   (only when both fields filled and unequal)
 *   [ SAVE NEW PASSWORD              ]
 *
 * The CTA is disabled until the new password satisfies the shared policy AND
 * both fields are exactly equal. The mismatch hint never shows on initial render —
 * only after both fields are non-empty.
 *
 * Local field state resets on the visible→true edge so re-opening the sheet
 * doesn't surface stale typed values. Stays mounted during the slide-down so
 * `Alert.alert('Password updated')` can fire from the parent before the
 * sheet's `onClosed` cleanup hook runs.
 */
export function ChangePasswordBottomSheet({
  typography,
  visible,
  saving = false,
  onClose,
  onClosed,
  onBack,
  onSubmit,
  registerInGlobalStack = true,
}: ChangePasswordBottomSheetProps) {
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  useEffect(() => {
    if (!visible) return;
    setNext('');
    setConfirm('');
  }, [visible]);

  const bothFilled = next.length > 0 && confirm.length > 0;
  const matches = next === confirm;
  const meetsPolicy = newPasswordMeetsPolicy(next);
  const showMismatch = bothFilled && !matches;
  const canSubmit = meetsPolicy && bothFilled && matches && !saving;

  const accent = color('Brand/Primary');
  const errorText = color('Semantic/Status/Error/Text');

  return (
    <BottomSheetShell
      visible={visible}
      onClose={onClose}
      onClosed={onClosed}
      registerInGlobalStack={registerInGlobalStack}
      bottomPaddingExtra={space('Spacing/4')}
    >
      <View style={styles.body}>
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
            <ProfileAccountIcon color={color('Brand/Accent')} />
          </View>
          <Text {...screenHeaderA11y()}
            style={[typography.titleH3, styles.headerTitle, { color: fg.primary }]}
          >
            Change Password
          </Text>
        </View>

        <View style={styles.fields}>
          <View style={styles.inputShell}>
            <DsTextInput
              value={next}
              onChangeText={setNext}
              placeholder="New Password"
              placeholderTextColor={fg.secondary}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!saving}
              style={[typography.body, styles.inputText]}
            />
          </View>
          <Text style={[typography.bodySmall, styles.requirement, { color: fg.secondary }]}>
            {NEW_PASSWORD_REQUIREMENT}
          </Text>
          <View style={styles.inputShell}>
            <DsTextInput
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Repeat Password"
              placeholderTextColor={fg.secondary}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!saving}
              style={[typography.body, styles.inputText]}
            />
          </View>
          {showMismatch ? (
            <Text style={[typography.bodySmall, styles.error, { color: errorText }]}>
              Password does not match
            </Text>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="SAVE NEW PASSWORD"
          accessibilityState={{ disabled: !canSubmit }}
          onPress={canSubmit ? () => onSubmit(next) : undefined}
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.primary,
            { backgroundColor: accent, shadowColor: accent },
            !canSubmit && styles.primaryDisabled,
            pressed && canSubmit && styles.pressed,
          ]}
        >
          <Text style={[typography.ctaPrimaryLabel, styles.primaryLabel]}>
            SAVE NEW PASSWORD
          </Text>
        </Pressable>
      </View>
    </BottomSheetShell>
  );
}

const styles = StyleSheet.create({
  body: {
    width: '100%',
    gap: space('Spacing/16'),
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
  fields: {
    gap: space('Spacing/8'),
  },
  inputShell: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: border.subtle,
    borderRadius: radius('Radius/8'),
    backgroundColor: bg.surfaceWhite,
    paddingHorizontal: 13,
    paddingVertical: 9,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  inputText: {
    color: fg.primary,
    padding: 0,
    width: '100%',
  },
  error: {
    textAlign: 'center',
  },
  requirement: {
    paddingHorizontal: space('Spacing/4'),
  },
  primary: {
    minHeight: space('Spacing/50'),
    borderRadius: radius('Radius/12'),
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadowRn,
  },
  primaryDisabled: {
    opacity: 0.45,
  },
  primaryLabel: {
    color: color('Foundation/Surface/White'),
  },
  pressed: {
    opacity: 0.8,
  },
});
