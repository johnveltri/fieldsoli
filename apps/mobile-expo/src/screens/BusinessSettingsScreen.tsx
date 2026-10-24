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
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  IconBuildingStore,
  IconLicense,
  IconMail,
  IconMapPin,
  IconPhone,
  IconPercentage,
  IconWorld,
} from '@tabler/icons-react-native';
import {
  DEFAULT_BUSINESS_SETTINGS,
  fetchBusinessSettings,
  saveBusinessSettings,
  type BusinessSettings,
  type EstimateExpirationDays,
  type PaymentTerms,
  type TaxableCategory,
} from '@fieldsolo/api-client';

import { AddressSuggestionPanel } from '../components/ds/customer/AddressSuggestionPanel';
import { useAddressAutocomplete } from '../components/ds/customer/useAddressAutocomplete';

import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { bg, border, color, fg, radius, space } from '../theme/nativeTokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CanvasTiledBackground } from '../components/CanvasTiledBackground';
import { AccountSingleSelectCard } from '../components/ds/AccountSingleSelectCard';
import { EditConfirmNoneRow, EditFieldInput, EditIconGroup, EditIconRow, EditSheet } from '../components/ds/edit-mode/EditFormRows';
import { FullWidthFab } from '../components/ds/FullWidthFab';
import { JobDetailIconSectionMaterials } from '../components/figma-icons/JobDetailScreenIcons';
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

const BUSINESS_INFO_FIELDS = ['businessName', 'address', 'phone', 'email', 'website', 'license'] as const;
type BusinessInfoField = (typeof BUSINESS_INFO_FIELDS)[number];

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
  const [markupFocused, setMarkupFocused] = useState(false);
  const [taxFocused, setTaxFocused] = useState(false);
  const [markupZeroPlaceholder, setMarkupZeroPlaceholder] = useState(false);
  const [taxZeroPlaceholder, setTaxZeroPlaceholder] = useState(false);
  const [addressFocused, setAddressFocused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSettings, setSavedSettings] = useState<BusinessSettings | null>(null);
  const [failed, setFailed] = useState(false);
  const addressLookup = useAddressAutocomplete(
    supabase, draft.address ?? '', mode === 'business' && addressFocused && !saving,
  );
  const showAddressSuggestions = addressFocused && addressLookup.showPanel;

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
        setSavedSettings(settings);
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

  const dirty = savedSettings !== null && (mode === 'business'
    ? BUSINESS_INFO_FIELDS.some((key) => (draft[key] ?? '') !== (savedSettings[key] ?? ''))
    : percentToBps(markupText) !== savedSettings.materialMarkupBps
      || percentToBps(taxText) !== savedSettings.taxRateBps
      || draft.paymentTerms !== savedSettings.paymentTerms
      || draft.estimateExpirationDays !== savedSettings.estimateExpirationDays
      || TAX_OPTIONS.some(({ value }) => draft.taxableCategories.includes(value)
        !== savedSettings.taxableCategories.includes(value)));

  const save = async () => {
    const userId = session?.user.id;
    if (!userId) return;
    const markup = percentToBps(markupText.trim() || '0');
    const tax = percentToBps(taxText.trim() || '0');
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
      setSavedSettings({ ...draft, materialMarkupBps: markup, taxRateBps: tax });
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

  const updateBusinessField = (key: BusinessInfoField, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const choices = <T,>(
    options: { value: T; label: string }[],
    selected: T,
    onSelect: (value: T) => void,
  ) => (
    <AccountSingleSelectCard
      typography={typography}
      options={options}
      selected={selected}
      onSelect={onSelect}
      disabled={saving}
    />
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
          paddingBottom: insets.bottom + space('Spacing/80') + space('Spacing/20'),
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
                ? 'Business Details'
                : 'Estimates & Invoices'}
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
                  <EditSheet>
                    <EditIconRow icon={<IconBuildingStore color={fg.secondary} size={20} />}>
                      <EditFieldInput
                        typography={typography}
                        placeholder="Business name"
                        accessibilityLabel="Business name"
                        value={draft.businessName ?? ''}
                        onChangeText={(value) => updateBusinessField('businessName', value)}
                        onFocus={() => setAddressFocused(false)}
                        editable={!saving}
                        autoCapitalize="words"
                      />
                    </EditIconRow>
                    <EditIconGroup
                      icon={<IconMapPin color={fg.secondary} size={20} />}
                      iconAlign={showAddressSuggestions ? 'top' : 'center'}
                    >
                      <View style={styles.addressColumn}>
                        <EditFieldInput
                          typography={typography}
                          placeholder="Address"
                          accessibilityLabel="Address"
                          value={draft.address ?? ''}
                          onChangeText={(value) => updateBusinessField('address', value.replace(/[\r\n]+/g, ' '))}
                          onFocus={() => setAddressFocused(true)}
                          returnKeyType="done"
                          onSubmitEditing={() => setAddressFocused(false)}
                          editable={!saving}
                          autoCapitalize="words"
                        />
                        {showAddressSuggestions ? (
                          <AddressSuggestionPanel
                            typography={typography}
                            suggestions={addressLookup.suggestions}
                            loading={addressLookup.loading}
                            noResults={addressLookup.noResults}
                            onSelect={(suggestion) => {
                              updateBusinessField('address', suggestion.displayAddress);
                              setAddressFocused(false);
                              Keyboard.dismiss();
                            }}
                          />
                        ) : null}
                      </View>
                    </EditIconGroup>
                    <EditIconRow
                      icon={<IconPhone color={fg.secondary} size={20} />}
                    >
                      <EditFieldInput
                        typography={typography}
                        placeholder="Phone"
                        accessibilityLabel="Phone"
                        value={draft.phone ?? ''}
                        onChangeText={(value) => updateBusinessField('phone', value)}
                        onFocus={() => setAddressFocused(false)}
                        editable={!saving}
                        keyboardType="phone-pad"
                      />
                    </EditIconRow>
                    <EditIconRow
                      icon={<IconMail color={fg.secondary} size={20} />}
                    >
                      <EditFieldInput
                        typography={typography}
                        placeholder="Email"
                        accessibilityLabel="Email"
                        value={draft.email ?? ''}
                        onChangeText={(value) => updateBusinessField('email', value)}
                        onFocus={() => setAddressFocused(false)}
                        editable={!saving}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </EditIconRow>
                    <EditIconRow
                      icon={<IconWorld color={fg.secondary} size={20} />}
                    >
                      <EditFieldInput
                        typography={typography}
                        placeholder="Website"
                        accessibilityLabel="Website"
                        value={draft.website ?? ''}
                        onChangeText={(value) => updateBusinessField('website', value)}
                        onFocus={() => setAddressFocused(false)}
                        editable={!saving}
                        keyboardType="url"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </EditIconRow>
                    <EditIconRow
                      icon={<IconLicense color={fg.secondary} size={20} />}
                    >
                      <EditFieldInput
                        typography={typography}
                        placeholder="License # (optional)"
                        accessibilityLabel="License # (optional)"
                        value={draft.license ?? ''}
                        onChangeText={(value) => updateBusinessField('license', value)}
                        onFocus={() => setAddressFocused(false)}
                        editable={!saving}
                        autoCapitalize="characters"
                      />
                    </EditIconRow>
                  </EditSheet>
                </>
              ) : (
                <>
                  <Text accessibilityRole="header" style={typography.titleH3}>
                    Material Markup
                  </Text>
                  <EditSheet>
                    <EditIconRow
                      icon={<JobDetailIconSectionMaterials color={fg.secondary} />}
                    >
                      <EditFieldInput
                        typography={typography}
                        accessibilityLabel="Default material markup"
                        placeholder="Material Markup"
                        value={
                          markupFocused || !markupText.trim()
                            ? (markupZeroPlaceholder ? '' : markupText)
                            : `${markupText}% Default Markup`
                        }
                        keyboardType="decimal-pad"
                        inputMode="decimal"
                        editable={!saving}
                        onFocus={() => {
                          setMarkupFocused(true);
                          setMarkupZeroPlaceholder(percentToBps(markupText) === 0);
                        }}
                        onBlur={() => {
                          setMarkupFocused(false);
                          setMarkupZeroPlaceholder(false);
                          if (!markupText.trim()) setMarkupText('0');
                        }}
                        onChangeText={(value) => {
                          setMarkupZeroPlaceholder(false);
                          setMarkupText(value);
                        }}
                      />
                    </EditIconRow>
                  </EditSheet>
                  <Text accessibilityRole="header" style={typography.titleH3}>
                    Taxes
                  </Text>
                  <EditSheet>
                    <EditIconRow
                      icon={<IconPercentage color={fg.secondary} size={20} />}
                    >
                      <EditFieldInput
                        typography={typography}
                        accessibilityLabel="Tax rate"
                        placeholder="Tax Rate"
                        value={
                          taxFocused || !taxText.trim()
                            ? (taxZeroPlaceholder ? '' : taxText)
                            : `${taxText}% Tax Rate`
                        }
                        keyboardType="decimal-pad"
                        inputMode="decimal"
                        editable={!saving}
                        onFocus={() => {
                          setTaxFocused(true);
                          setTaxZeroPlaceholder(percentToBps(taxText) === 0);
                        }}
                        onBlur={() => {
                          setTaxFocused(false);
                          setTaxZeroPlaceholder(false);
                          if (!taxText.trim()) setTaxText('0');
                        }}
                        onChangeText={(value) => {
                          setTaxZeroPlaceholder(false);
                          setTaxText(value);
                        }}
                      />
                    </EditIconRow>
                    {TAX_OPTIONS.map((option, index) => (
                      <EditConfirmNoneRow
                        key={option.value}
                        typography={typography}
                        confirmed={draft.taxableCategories.includes(option.value)}
                        confirmLabel={`Apply to ${option.label}`}
                        confirmedLabel={`Apply to ${option.label}`}
                        disabled={saving}
                        onToggle={() => toggleCategory(option.value)}
                        showTopBorder={index === 0}
                      />
                    ))}
                  </EditSheet>
                  <Text accessibilityRole="header" style={typography.titleH3}>
                    Payment terms
                  </Text>
                  {choices(TERMS, draft.paymentTerms, (value) => {
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
                      setDraft((current) => ({
                        ...current,
                        estimateExpirationDays: value,
                      }));
                    },
                  )}
                </>
              )}
            </View>
          ) : null}
        </View>
      </ScrollView>
      {!loading && !failed ? (
        <View pointerEvents="box-none" style={styles.fabOverlay}>
          <FullWidthFab
            typography={typography}
            label={saving ? 'SAVING…' : 'SAVE CHANGES'}
            onPress={() => void save()}
            disabled={saving}
            includeSafeArea
          />
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.canvasWarm },
  header: {
    flexDirection: 'row', alignItems: 'center',
    gap: space('Spacing/12'),
    paddingBottom: space('Spacing/24'),
  },
  title: { flex: 1, minWidth: 0, color: fg.primary },
  form: { gap: space('Spacing/16') },
  card: {
    backgroundColor: bg.surfaceWhite,
    borderRadius: radius('Radius/16'),
    borderWidth: 1,
    borderColor: border.subtle,
    overflow: 'hidden',
  },
  choice: {
    minHeight: 56,
    padding: space('Spacing/16'),
    flexDirection: 'row',
    alignItems: 'center',
    gap: space('Spacing/12'),
  },
  addressColumn: { flex: 1, minWidth: 0 },
  secondary: { color: fg.secondary },
  accent: { color: color('Brand/Primary') },
  message: { padding: space('Spacing/16') },
  fabOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    elevation: 2,
  },
  pressed: { opacity: 0.75 },
});
