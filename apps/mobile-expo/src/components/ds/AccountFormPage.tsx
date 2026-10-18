import { useEffect, type ReactNode } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlatformHeaderAction } from '../platform/PlatformHeaderAction';
import { TopHeaderBackIcon } from '../figma-icons/TopHeaderIcons';
import { bg, fg, space, type TextStyles } from '../../theme/nativeTokens';
import { useContentColumn } from '../../theme/useContentColumn';

/** Full-page presentation for the existing Account security forms. */
export function AccountFormPage({ title, typography, onBack, children }: {
  title: string;
  typography: TextStyles;
  onBack?: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { columnStyle } = useContentColumn();
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack?.();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);
  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="never"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingTop: insets.top + space('Spacing/20'), paddingBottom: insets.bottom + space('Spacing/32') }}
      >
        <View style={columnStyle}>
          <View style={styles.header}>
            <PlatformHeaderAction accessibilityLabel="Back" onPress={() => onBack?.()}>
              <TopHeaderBackIcon size={28} color={fg.primary} />
            </PlatformHeaderAction>
            <Text accessibilityRole="header" style={[typography.headingH2, styles.title]}>{title}</Text>
          </View>
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: bg.canvasWarm },
  header: { flexDirection: 'row', alignItems: 'center', gap: space('Spacing/12'), paddingBottom: space('Spacing/24') },
  title: { flex: 1, minWidth: 0, color: fg.primary },
});
