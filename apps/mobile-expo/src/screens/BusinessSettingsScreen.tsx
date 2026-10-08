import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  DEFAULT_BUSINESS_SETTINGS,
  fetchBusinessSettings,
  saveBusinessSettings,
  type BusinessSettings,
  type EstimateExpirationDays,
  type PaymentTerms,
  type TaxableCategory,
} from '@fieldsolo/api-client';

import { DsTextInput } from '../components/ds/DsTextInput';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { bg, border, color, fg, radius, space } from '../theme/nativeTokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CanvasTiledBackground } from '../components/CanvasTiledBackground';
import { ProfileRowsCard } from '../components/ds/ProfileRowsCard';
import { ProfileCheckIcon } from '../components/figma-icons/ProfileScreenIcons';
import { TopHeaderBackIcon } from '../components/figma-icons/TopHeaderIcons';
import { PlatformHeaderAction } from '../components/platform/PlatformHeaderAction';
import { useContentColumn } from '../theme/useContentColumn';
import type { TextStyles } from '../theme/nativeTokens';

type Props = {
  typography: TextStyles;
  mode: 'business' | 'settings';
  onBack: () => void;
};

const TERMS: { value: PaymentTerms; label: string }[] = [
  { value: 'due_on_receipt', label: 'Due upon receipt' },
  { value: 'net_7', label: 'Net 7' },
  { value: 'net_15', label: 'Net 15' },
  { value: 'net_30', label: 'Net 30' },
];

const EXPIRATIONS: { value: EstimateExpirationDays; label: string }[] = [
  { value: null, label: 'Off' },
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
];

const TAX_OPTIONS: { value: TaxableCategory; label: string }[] = [
  { value: 'labor', label: 'Labor & Services' },
  { value: 'materials', label: 'Materials' },
  { value: 'billable_other_costs', label: 'Billable Other Costs' },
];

function percentToBps(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

export type BusinessSettingsScreenHandle = { requestBack: () => void };

export const BusinessSettingsScreen = forwardRef<
  BusinessSettingsScreenHandle,
  Props
>(function BusinessSettingsScreen({ typography, mode, onBack }: Props, ref) {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const { columnStyle } = useContentColumn();
  const [scrollY] = useState(() => new Animated.Value(0));
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [draft, setDraft] = useState<BusinessSettings>(
    DEFAULT_BUSINESS_SETTINGS,
  );
  const [markupText, setMarkupText] = useState('0');
  const [taxText, setTaxText] = useState('0');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    void fetchBusinessSettings(supabase, userId)
      .then((settings) => {
        if (cancelled) return;
        setDraft(settings);
        setMarkupText((settings.materialMarkupBps / 100).toString());
        setTaxText((settings.taxRateBps / 100).toString());
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user.id, loadAttempt]);

  const save = async () => {
    const userId = session?.user.id;
    if (!userId) return;
    const markup = percentToBps(markupText);
    const tax = percentToBps(taxText);
    if (markup == null || markup > 100000 || tax == null || tax > 10000) {
      Alert.alert('Could not save settings. Try again.');
      return;
    }
    setSaving(true);
    try {
      await saveBusinessSettings(supabase, userId, {
        ...draft,
        materialMarkupBps: markup,
        taxRateBps: tax,
      });
      setDirty(false);
      onBack();
    } catch {
      Alert.alert('Could not save settings. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const back = useCallback(() => {
    if (saving) return;
    if (!dirty) {
      onBack();
      return;
    }
    Alert.alert('Discard changes?', undefined, [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onBack },
    ]);
  }, [dirty, onBack, saving]);

  useImperativeHandle(ref, () => ({ requestBack: back }), [back]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        back();
        return true;
      },
    );
    return () => subscription.remove();
  }, [back]);

  const toggleCategory = (category: TaxableCategory) => {
    setDirty(true);
    setDraft((current) => {
      const selected = new Set(current.taxableCategories);
      if (selected.has(category)) selected.delete(category);
      else selected.add(category);
      return {
        ...current,
        taxableCategories: TAX_OPTIONS.map((option) => option.value).filter(
          (value) => selected.has(value),
        ),
      };
    });
  };

  const allSelected = TAX_OPTIONS.every((option) =>
    draft.taxableCategories.includes(option.value),
  );

  const field = (
    label: string,
    value: string,
    onChangeText: (value: string) => void,
    numeric = false,
    key?: string,
  ) => (
    <View key={key ?? label} style={styles.field}>
      <Text style={[typography.bodySmall, styles.secondary]}>{label}</Text>
      <View style={styles.inputRow}>
        <DsTextInput
          accessibilityLabel={label}
          style={[typography.body, styles.input]}
          value={value}
          placeholder={
            numeric
              ? '0'
              : `Enter ${label.toLowerCase().replace(' (optional)', '')}`
          }
          placeholderTextColor={fg.secondary}
          editable={!saving}
          keyboardType={
            numeric
              ? 'decimal-pad'
              : key === 'phone'
                ? 'phone-pad'
                : key === 'email'
                  ? 'email-address'
                  : key === 'website'
                    ? 'url'
                    : 'default'
          }
          autoCapitalize={
            key === 'email' || key === 'website' ? 'none' : 'sentences'
          }
          onChangeText={onChangeText}
        />
        {numeric ? (
          <Text style={[typography.body, styles.secondary]}>%</Text>
        ) : null}
      </View>
    </View>
  );

  const choices = <T,>(
    options: { value: T; label: string }[],
    selected: T,
    onSelect: (value: T) => void,
  ) => (
    <View style={styles.card} accessibilityRole="radiogroup">
      {options.map((option, index) => (
        <Pressable
          key={option.label}
          accessibilityRole="radio"
          accessibilityLabel={option.label}
          accessibilityState={{
            checked: selected === option.value,
            disabled: saving,
          }}
          disabled={saving}
          onPress={() => onSelect(option.value)}
          style={({ pressed }) => [
            styles.choice,
            index > 0 && styles.separator,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[typography.body, styles.choiceLabel]}>
            {option.label}
          </Text>
          {selected === option.value ? (
            <ProfileCheckIcon color={color('Brand/Primary')} size={20} />
          ) : null}
        </Pressable>
      ))}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <CanvasTiledBackground scrollY={scrollY} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{
          paddingTop: insets.top + space('Spacing/20'),
          paddingBottom: insets.bottom + space('Spacing/32'),
        }}
      >
        <View style={columnStyle}>
          <View style={styles.header}>
            <PlatformHeaderAction accessibilityLabel="Back" onPress={back}>
              <TopHeaderBackIcon size={28} color={fg.primary} />
            </PlatformHeaderAction>
            <Text
              accessibilityRole="header"
              style={[typography.headingH2, styles.title]}
            >
              {mode === 'business'
                ? 'Business Info'
                : 'Estimate & Invoice Settings'}
            </Text>
          </View>
          {loading ? (
            <ActivityIndicator
              accessibilityLabel="Loading settings"
              color={fg.primary}
            />
          ) : null}
          {failed ? (
            <View style={[styles.card, styles.message]}>
              <Text style={typography.body}>Could not load settings.</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setLoadAttempt((value) => value + 1)}
                style={styles.choice}
              >
                <Text style={[typography.bodyBold, styles.accent]}>Retry</Text>
              </Pressable>
            </View>
          ) : null}
          {!loading && !failed ? (
            <View style={styles.form}>
              {mode === 'business' ? (
                <>
                  <Text style={[typography.bodySmall, styles.secondary]}>
                    These details appear on your estimates and invoices.
                  </Text>
                  <View style={styles.card}>
                    {(
                      [
                        ['Business name', 'businessName'],
                        ['Address', 'address'],
                        ['Phone', 'phone'],
                        ['Email', 'email'],
                        ['Website', 'website'],
                        ['License # (optional)', 'license'],
                      ] as const
                    ).map(([label, key]) =>
                      field(
                        label,
                        draft[key] ?? '',
                        (value) => {
                          setDirty(true);
                          setDraft((current) => ({ ...current, [key]: value }));
                        },
                        false,
                        key,
                      ),
                    )}
                  </View>
                </>
              ) : (
                <>
                  <Text accessibilityRole="header" style={typography.titleH3}>
                    Pricing defaults
                  </Text>
                  <View style={styles.card}>
                    {field(
                      'Default material markup',
                      markupText,
                      (value) => {
                        setDirty(true);
                        setMarkupText(value);
                      },
                      true,
                    )}
                    <Text style={[typography.bodySmall, styles.hint]}>
                      Applies to new materials added.
                    </Text>
                    {field(
                      'Tax rate',
                      taxText,
                      (value) => {
                        setDirty(true);
                        setTaxText(value);
                      },
                      true,
                    )}
                  </View>
                  <Text accessibilityRole="header" style={typography.titleH3}>
                    Apply tax to
                  </Text>
                  <ProfileRowsCard
                    typography={typography}
                    rows={[
                      {
                        kind: 'toggle',
                        label: 'All categories',
                        sublabel:
                          !allSelected && draft.taxableCategories.length > 0
                            ? `${draft.taxableCategories.length} of 3 selected`
                            : undefined,
                        value: allSelected,
                        disabled: saving,
                        onValueChange: () => {
                          setDirty(true);
                          setDraft((current) => ({
                            ...current,
                            taxableCategories: allSelected
                              ? []
                              : TAX_OPTIONS.map((option) => option.value),
                          }));
                        },
                      },
                      ...TAX_OPTIONS.map((option) => ({
                        kind: 'toggle' as const,
                        label: option.label,
                        value: draft.taxableCategories.includes(option.value),
                        disabled: saving,
                        onValueChange: () => toggleCategory(option.value),
                      })),
                    ]}
                  />
                  <Text accessibilityRole="header" style={typography.titleH3}>
                    Payment terms
                  </Text>
                  {choices(TERMS, draft.paymentTerms, (value) => {
                    setDirty(true);
                    setDraft((current) => ({
                      ...current,
                      paymentTerms: value,
                    }));
                  })}
                  <Text accessibilityRole="header" style={typography.titleH3}>
                    Estimate expiration
                  </Text>
                  {choices(
                    EXPIRATIONS,
                    draft.estimateExpirationDays,
                    (value) => {
                      setDirty(true);
                      setDraft((current) => ({
                        ...current,
                        estimateExpirationDays: value,
                      }));
                    },
                  )}
                </>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save changes"
                accessibilityState={{ disabled: saving, busy: saving }}
                disabled={saving}
                onPress={() => void save()}
                style={({ pressed }) => [
                  styles.save,
                  (saving || pressed) && styles.pressed,
                ]}
              >
                <Text style={[typography.ctaPrimaryLabel, styles.saveLabel]}>
                  {saving ? 'Saving…' : 'Save changes'}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.canvasWarm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space('Spacing/12'),
    paddingBottom: space('Spacing/24'),
  },
  title: { flex: 1, minWidth: 0 },
  form: { gap: space('Spacing/16') },
  card: {
    backgroundColor: bg.surfaceWhite,
    borderRadius: radius('Radius/16'),
    borderWidth: 1,
    borderColor: border.subtle,
    overflow: 'hidden',
  },
  field: {
    padding: space('Spacing/16'),
    gap: space('Spacing/8'),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: border.subtle,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space('Spacing/8'),
  },
  input: { flex: 1, minHeight: 32, padding: 0 },
  choice: {
    minHeight: 56,
    padding: space('Spacing/16'),
    flexDirection: 'row',
    alignItems: 'center',
    gap: space('Spacing/12'),
  },
  choiceLabel: { flex: 1 },
  separator: { borderTopWidth: 1, borderTopColor: border.subtle },
  secondary: { color: fg.secondary },
  hint: {
    color: fg.secondary,
    paddingHorizontal: space('Spacing/16'),
    paddingVertical: space('Spacing/12'),
  },
  accent: { color: color('Brand/Primary') },
  message: { padding: space('Spacing/16') },
  save: {
    minHeight: 52,
    backgroundColor: color('Brand/Primary'),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius('Radius/12'),
    padding: space('Spacing/16'),
  },
  saveLabel: { color: bg.surfaceWhite },
  pressed: { opacity: 0.75 },
});
