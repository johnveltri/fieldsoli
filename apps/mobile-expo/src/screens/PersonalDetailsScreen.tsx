import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Animated, BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { IconBriefcase, IconMail, IconUser } from '@tabler/icons-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditConfirmNoneRow, EditFieldInput, EditIconRow, EditSheet } from '../components/ds/edit-mode/EditFormRows';
import { CanvasTiledBackground } from '../components/CanvasTiledBackground';
import { FullWidthFab } from '../components/ds/FullWidthFab';
import type { UpdateProfileValues } from '../components/ds/UpdateProfileBottomSheet';
import { PlatformHeaderAction } from '../components/platform/PlatformHeaderAction';
import { TopHeaderBackIcon } from '../components/figma-icons/TopHeaderIcons';
import { TRADE_PRESETS } from '../lib/trades';
import { bg, color, fg, space, type TextStyles } from '../theme/nativeTokens';
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
  const [customTrades, setCustomTrades] = useState(() => values.trades.filter(
    (trade) => !TRADE_PRESETS.some((preset) => preset.value.toLowerCase() === trade.toLowerCase()),
  ));
  const dirty = JSON.stringify(draft) !== JSON.stringify(values) || customText.trim().length > 0;
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

  const trades = useMemo(() => [...TRADE_PRESETS.map((preset) => preset.value), ...customTrades], [customTrades]);
  const selected = (trade: string) => draft.trades.some((value) => value.toLowerCase() === trade.toLowerCase());
  const toggle = (trade: string) => setDraft((current) => ({
    ...current,
    trades: current.trades.some((value) => value.toLowerCase() === trade.toLowerCase())
      ? current.trades.filter((value) => value.toLowerCase() !== trade.toLowerCase())
      : [...current.trades, trade],
  }));
  const addCustom = () => {
    const trade = customText.trim();
    if (!trade || saving) return;
    const existing = trades.find((value) => value.toLowerCase() === trade.toLowerCase());
    if (!existing) setCustomTrades((current) => [...current, trade]);
    if (!selected(existing ?? trade)) toggle(existing ?? trade);
    setCustomText('');
  };

  const save = () => {
    const pendingTrade = customText.trim();
    onSave({
      ...draft,
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      trades: pendingTrade && !selected(pendingTrade) ? [...draft.trades, pendingTrade] : draft.trades,
    });
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <CanvasTiledBackground scrollY={scrollY} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
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
            <EditIconRow icon={<IconUser color={fg.secondary} size={20} />}>
              <EditFieldInput
                typography={typography}
                accessibilityLabel="First name"
                placeholder="First name"
                value={draft.firstName}
                editable={!saving}
                autoCapitalize="words"
                onChangeText={(firstName) => setDraft((current) => ({ ...current, firstName }))}
              />
            </EditIconRow>
            <EditIconRow icon={<IconUser color={fg.secondary} size={20} />} showTopBorder>
              <EditFieldInput
                typography={typography}
                accessibilityLabel="Last name"
                placeholder="Last name"
                value={draft.lastName}
                editable={!saving}
                autoCapitalize="words"
                onChangeText={(lastName) => setDraft((current) => ({ ...current, lastName }))}
              />
            </EditIconRow>
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
            {trades.map((trade, index) => (
              <EditConfirmNoneRow
                key={trade}
                typography={typography}
                confirmed={selected(trade)}
                confirmLabel={trade}
                confirmedLabel={trade}
                onToggle={() => toggle(trade)}
                disabled={saving}
                showTopBorder={index > 0}
              />
            ))}
            <EditIconRow icon={<IconBriefcase color={fg.secondary} size={20} />} showTopBorder>
              <View style={styles.customRow}>
                <EditFieldInput
                  typography={typography}
                  accessibilityLabel="Custom trade"
                  placeholder="Custom trade"
                  value={customText}
                  editable={!saving}
                  maxLength={32}
                  onChangeText={setCustomText}
                  returnKeyType="done"
                  onSubmitEditing={addCustom}
                  style={styles.customInput}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add custom trade"
                  disabled={saving || !customText.trim()}
                  onPress={addCustom}
                  style={styles.addButton}
                >
                  <Text style={[typography.ctaPrimaryLabel, { color: customText.trim() && !saving ? color('Brand/Primary') : fg.secondary }]}>ADD</Text>
                </Pressable>
              </View>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: space('Spacing/12'), paddingBottom: space('Spacing/24') },
  title: { flex: 1, minWidth: 0 },
  tradesTitle: { marginTop: space('Spacing/24') },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: space('Spacing/12') },
  customInput: { flex: 1, minWidth: 0 },
  addButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  fabOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 2, elevation: 2 },
});
