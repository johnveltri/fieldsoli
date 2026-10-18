import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Animated, BackHandler, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { IconBriefcase, IconMail, IconUser } from '@tabler/icons-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditConfirmNoneRow, EditFieldInput, EditIconGroup, EditIconRow, EditSheet } from '../components/ds/edit-mode/EditFormRows';
import { CanvasTiledBackground } from '../components/CanvasTiledBackground';
import { FullWidthFab } from '../components/ds/FullWidthFab';
import type { UpdateProfileValues } from '../components/ds/UpdateProfileBottomSheet';
import { PlatformHeaderAction } from '../components/platform/PlatformHeaderAction';
import { TopHeaderBackIcon } from '../components/figma-icons/TopHeaderIcons';
import { TRADE_PRESETS } from '../lib/trades';
import { bg, fg, space, type TextStyles } from '../theme/nativeTokens';
import { useContentColumn } from '../theme/useContentColumn';

type Props = {
  typography: TextStyles;
  values: UpdateProfileValues;
  email: string | null;
  saving: boolean;
  onBack: () => void;
  onSave: (values: UpdateProfileValues) => void;
};

export function PersonalDetailsScreen({ typography, values, email, saving, onBack, onSave }: Props) {
  const insets = useSafeAreaInsets();
  const [scrollY] = useState(() => new Animated.Value(0));
  const { columnStyle } = useContentColumn();
  const [draft, setDraft] = useState(values);
  const [customText, setCustomText] = useState('');
  const pendingTrade = customText.trim();
  const nextValues = {
    ...draft,
    firstName: draft.firstName.trim(),
    lastName: draft.lastName.trim(),
    trades: pendingTrade && !draft.trades.some((trade) => trade.trim().toLowerCase() === pendingTrade.toLowerCase())
      ? [...draft.trades, pendingTrade]
      : draft.trades,
  };
  const tradeSet = (trades: string[]) => JSON.stringify(
    [...new Set(trades.map((trade) => trade.trim().toLowerCase()).filter(Boolean))].sort(),
  );
  const dirty = nextValues.firstName !== values.firstName.trim()
    || nextValues.lastName !== values.lastName.trim()
    || tradeSet(nextValues.trades) !== tradeSet(values.trades);
  const back = useCallback(() => {
    if (saving) return;
    if (!dirty) return onBack();
    Alert.alert('Discard changes?', undefined, [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onBack },
    ]);
  }, [dirty, onBack, saving]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => subscription.remove();
  }, [back]);

  const trades = useMemo(() => [
    ...TRADE_PRESETS.map((preset) => preset.value),
    ...values.trades.filter((trade) => !TRADE_PRESETS.some(
      (preset) => preset.value.toLowerCase() === trade.toLowerCase(),
    )),
  ], [values.trades]);
  const selected = (trade: string) => draft.trades.some((value) => value.toLowerCase() === trade.toLowerCase());
  const toggle = (trade: string) => setDraft((current) => ({
    ...current,
    trades: current.trades.some((value) => value.toLowerCase() === trade.toLowerCase())
      ? current.trades.filter((value) => value.toLowerCase() !== trade.toLowerCase())
      : [...current.trades, trade],
  }));
  const save = () => onSave(nextValues);

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <CanvasTiledBackground scrollY={scrollY} />
      <ScrollView
        keyboardShouldPersistTaps="never"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingTop: insets.top + space('Spacing/20'), paddingBottom: insets.bottom + space('Spacing/80') + space('Spacing/20') }}
      >
        <View style={columnStyle}>
          <View style={styles.header}>
            <PlatformHeaderAction accessibilityLabel="Back" onPress={back}>
              <TopHeaderBackIcon size={28} color={fg.primary} />
            </PlatformHeaderAction>
            <Text accessibilityRole="header" style={[typography.headingH2, styles.title]}>Personal Details</Text>
          </View>
          <EditSheet>
            <EditIconGroup icon={<IconUser color={fg.secondary} size={20} />}>
              <EditFieldInput
                typography={typography}
                accessibilityLabel="First name"
                placeholder="First name"
                value={draft.firstName}
                editable={!saving}
                autoCapitalize="words"
                onChangeText={(firstName) => setDraft((current) => ({ ...current, firstName }))}
              />
              <EditFieldInput
                typography={typography}
                accessibilityLabel="Last name"
                placeholder="Last name"
                value={draft.lastName}
                editable={!saving}
                autoCapitalize="words"
                onChangeText={(lastName) => setDraft((current) => ({ ...current, lastName }))}
              />
            </EditIconGroup>
            <EditIconRow icon={<IconMail color={fg.secondary} size={20} />} showTopBorder>
              <EditFieldInput
                typography={typography}
                accessibilityLabel="Sign-in email (read-only)"
                placeholder="Sign-in email"
                value={email ?? ''}
                editable={false}
                style={{ color: fg.secondary }}
              />
            </EditIconRow>
          </EditSheet>
          <Text accessibilityRole="header" style={[typography.titleH3, styles.tradesTitle]}>Trades</Text>
          <EditSheet>
            {trades.map((trade) => (
              <EditConfirmNoneRow
                key={trade}
                typography={typography}
                confirmed={selected(trade)}
                confirmLabel={trade}
                confirmedLabel={trade}
                onToggle={() => toggle(trade)}
                disabled={saving}
                showTopBorder={false}
              />
            ))}
            <EditIconRow icon={<IconBriefcase color={fg.secondary} size={20} />}>
              <EditFieldInput
                typography={typography}
                accessibilityLabel="Custom trade"
                placeholder="Custom trade"
                value={customText}
                editable={!saving}
                maxLength={32}
                onChangeText={setCustomText}
                returnKeyType="done"
              />
            </EditIconRow>
          </EditSheet>
        </View>
      </ScrollView>
      <View pointerEvents="box-none" style={styles.fabOverlay}>
        <FullWidthFab
          typography={typography}
          label={saving ? 'SAVING…' : 'SAVE CHANGES'}
          disabled={saving}
          includeSafeArea
          onPress={save}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.canvasWarm },
  header: { alignItems: 'flex-start', gap: space('Spacing/16'), paddingBottom: space('Spacing/24') },
  title: { alignSelf: 'stretch', color: fg.primary },
  tradesTitle: { marginTop: space('Spacing/24') },
  fabOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 2, elevation: 2 },
});
