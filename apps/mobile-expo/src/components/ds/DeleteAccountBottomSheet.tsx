import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { color, radius, space } from '@fieldsolo/design-system/lib/tokens';

import { DsTextInput } from './DsTextInput';
import { bg, border, cardShadowRn, fg } from '../../theme/nativeTokens';
import type { TextStyles } from '../../theme/nativeTokens';
import { SessionSheetBackIcon } from '../figma-icons/JobDetailScreenIcons';
import { ProfileTrashIcon } from '../figma-icons/ProfileScreenIcons';
import { BottomSheetShell } from './BottomSheetShell';
import { screenHeaderA11y } from '../../lib/accessibility';

export const DELETE_ACCOUNT_CONFIRMATION_PHRASE = 'delete account';

type DeleteAccountBottomSheetProps = {
  typography: TextStyles;
  visible: boolean;
  onClose?: () => void;
  onClosed?: () => void;
  onBack?: () => void;
  /** Fired after the user types the confirmation phrase and taps DELETE ACCOUNT. */
  onSubmit: () => void;
  registerInGlobalStack?: boolean;
};

/**
 * Delete Account confirmation sheet — mirrors Change Password layout.
 *
 * The CTA stays disabled until the user types `{DELETE_ACCOUNT_CONFIRMATION_PHRASE}`
 * exactly. The parent shows the system delete confirmation after `onSubmit`.
 */
export function DeleteAccountBottomSheet({
  typography,
  visible,
  onClose,
  onClosed,
  onBack,
  onSubmit,
  registerInGlobalStack = true,
}: DeleteAccountBottomSheetProps) {
  const [confirmation, setConfirmation] = useState('');

  useEffect(() => {
    if (!visible) return;
    setConfirmation('');
  }, [visible]);

  const canSubmit = confirmation === DELETE_ACCOUNT_CONFIRMATION_PHRASE;
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
            <ProfileTrashIcon color={errorText} />
          </View>
          <Text {...screenHeaderA11y()}
            style={[typography.titleH3, styles.headerTitle, { color: fg.primary }]}
          >
            Delete Account
          </Text>
        </View>

        <View style={styles.copy}>
          <Text style={[typography.bodySmall, styles.instruction, { color: fg.secondary }]}>
            Type{' '}
            <Text style={styles.emphasis}>&quot;{DELETE_ACCOUNT_CONFIRMATION_PHRASE}&quot;</Text>
            {' '}below to continue.
          </Text>
          <Text style={[typography.bodySmall, styles.instruction, { color: fg.secondary }]}>
            Deleting your account permanently deletes all associated jobs, sessions, notes,
            materials, and other provided job information. There will be no way to recover
            this information for taxes or other recordkeeping purposes.
          </Text>
        </View>

        <View style={styles.fields}>
          <View style={styles.inputShell}>
            <DsTextInput
              value={confirmation}
              onChangeText={setConfirmation}
              placeholder={DELETE_ACCOUNT_CONFIRMATION_PHRASE}
              placeholderTextColor={fg.secondary}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              style={[typography.body, styles.inputText]}
            />
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="DELETE ACCOUNT"
          accessibilityState={{ disabled: !canSubmit }}
          onPress={canSubmit ? onSubmit : undefined}
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.primary,
            { backgroundColor: errorText, shadowColor: errorText },
            !canSubmit && styles.primaryDisabled,
            pressed && canSubmit && styles.pressed,
          ]}
        >
          <Text style={[typography.ctaPrimaryLabel, styles.primaryLabel]}>
            DELETE ACCOUNT
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
  instruction: {
    lineHeight: 22,
  },
  copy: {
    gap: space('Spacing/12'),
  },
  emphasis: {
    fontWeight: '600',
    color: fg.secondary,
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
