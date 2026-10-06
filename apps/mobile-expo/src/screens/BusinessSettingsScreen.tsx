import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { fg, space } from '../theme/nativeTokens';
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

export function BusinessSettingsScreen({ typography, mode, onBack }: Props) {
  const { session } = useAuth();
  const [draft, setDraft] = useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);
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
  }, [session?.user.id]);

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

  const back = () => {
    if (!dirty) {
      onBack();
      return;
    }
    Alert.alert('Discard changes?', undefined, [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onBack },
    ]);
  };

  const toggleCategory = (category: TaxableCategory) => {
    setDirty(true);
    setDraft((current) => {
      const selected = new Set(current.taxableCategories);
      if (selected.has(category)) selected.delete(category);
      else selected.add(category);
      return { ...current, taxableCategories: TAX_OPTIONS.map((option) => option.value).filter((value) => selected.has(value)) };
    });
  };

  const allSelected = TAX_OPTIONS.every((option) => draft.taxableCategories.includes(option.value));

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back}>
          <Text style={typography.body}>Back</Text>
        </Pressable>
        <Text style={typography.headingH2}>{mode === 'business' ? 'Business info' : 'Estimate & Invoice Settings'}</Text>
      </View>
      {loading ? <ActivityIndicator accessibilityLabel="Loading settings" /> : null}
      {failed ? (
        <View>
          <Text style={typography.body}>Could not load settings.</Text>
          <Pressable accessibilityRole="button" onPress={() => setFailed(false)}>
            <Text style={typography.body}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
      {!loading && !failed ? (
        <ScrollView contentContainerStyle={styles.form}>
          {mode === 'business' ? (
            <>
              {(
                [
                  ['Business name', 'businessName'],
                  ['Address', 'address'],
                  ['Phone', 'phone'],
                  ['Email', 'email'],
                  ['Website', 'website'],
                  ['License # (optional)', 'license'],
                ] as const
              ).map(([label, key]) => (
                <View key={key}>
                  <Text style={typography.bodySmall}>{label}</Text>
                  <DsTextInput
                    accessibilityLabel={label}
                    value={draft[key] ?? ''}
                    onChangeText={(value) => {
                      setDirty(true);
                      setDraft((current) => ({ ...current, [key]: value }));
                    }}
                  />
                </View>
              ))}
            </>
          ) : (
            <>
              <Text style={typography.bodySmall}>Default material markup</Text>
              <DsTextInput
                accessibilityLabel="Default material markup"
                value={markupText}
                keyboardType="decimal-pad"
                onChangeText={(value) => {
                  setDirty(true);
                  setMarkupText(value);
                }}
              />
              <Text style={typography.bodySmall}>Applies to new materials added.</Text>
              <Text style={typography.bodySmall}>Tax rate</Text>
              <DsTextInput
                accessibilityLabel="Tax rate"
                value={taxText}
                keyboardType="decimal-pad"
                onChangeText={(value) => {
                  setDirty(true);
                  setTaxText(value);
                }}
              />
              <Text style={typography.body}>Apply tax to</Text>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: allSelected }}
                onPress={() => {
                  setDirty(true);
                  setDraft((current) => ({
                    ...current,
                    taxableCategories: allSelected ? [] : TAX_OPTIONS.map((option) => option.value),
                  }));
                }}
              >
                <Text style={typography.body}>{allSelected ? '☑' : '☐'} All</Text>
              </Pressable>
              {TAX_OPTIONS.map((option) => {
                const checked = draft.taxableCategories.includes(option.value);
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    onPress={() => toggleCategory(option.value)}
                  >
                    <Text style={typography.body}>
                      {checked ? '☑' : '☐'} {option.label}
                    </Text>
                  </Pressable>
                );
              })}
              <Text style={typography.body}>Payment terms</Text>
              {TERMS.map((option) => (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  onPress={() => {
                    setDirty(true);
                    setDraft((current) => ({ ...current, paymentTerms: option.value }));
                  }}
                >
                  <Text style={typography.body}>
                    {draft.paymentTerms === option.value ? '● ' : '○ '}
                    {option.label}
                  </Text>
                </Pressable>
              ))}
              <Text style={typography.body}>Estimate expiration</Text>
              {EXPIRATIONS.map((option) => (
                <Pressable
                  key={option.label}
                  accessibilityRole="button"
                  onPress={() => {
                    setDirty(true);
                    setDraft((current) => ({ ...current, estimateExpirationDays: option.value }));
                  }}
                >
                  <Text style={typography.body}>
                    {draft.estimateExpirationDays === option.value ? '● ' : '○ '}
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </>
          )}
          <Pressable accessibilityRole="button" disabled={saving || loading} onPress={() => void save()} style={styles.save}>
            <Text style={[typography.body, styles.saveLabel]}>{saving ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  header: {
    paddingTop: 56,
    paddingHorizontal: space('Spacing/16'),
    gap: space('Spacing/8'),
  },
  form: { padding: space('Spacing/16'), gap: space('Spacing/12') },
  save: {
    minHeight: 48,
    backgroundColor: fg.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  saveLabel: { color: '#fff' },
});
