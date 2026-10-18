import type { FieldSoloSupabaseClient } from './client';

export type PaymentTerms = 'due_on_receipt' | 'net_7' | 'net_15' | 'net_30';
export type EstimateExpirationDays = null | 7 | 14 | 30;
export type TaxableCategory = 'labor' | 'materials' | 'billable_other_costs';

export type BusinessSettings = {
  businessName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  license: string | null;
  materialMarkupBps: number;
  taxRateBps: number;
  taxableCategories: TaxableCategory[];
  paymentTerms: PaymentTerms;
  estimateExpirationDays: EstimateExpirationDays;
  settingsRevision: number;
};

export const DEFAULT_BUSINESS_SETTINGS: BusinessSettings = {
  businessName: null,
  address: null,
  phone: null,
  email: null,
  website: null,
  license: null,
  materialMarkupBps: 0,
  taxRateBps: 0,
  taxableCategories: ['labor', 'materials', 'billable_other_costs'],
  paymentTerms: 'due_on_receipt',
  estimateExpirationDays: 30,
  settingsRevision: 0,
};

const CATEGORIES = new Set<TaxableCategory>(['labor', 'materials', 'billable_other_costs']);

function asCategories(value: string[] | null | undefined): TaxableCategory[] {
  return (value ?? []).filter((item): item is TaxableCategory => CATEGORIES.has(item as TaxableCategory));
}

export async function fetchBusinessSettings(
  client: FieldSoloSupabaseClient,
  userId: string,
): Promise<BusinessSettings> {
  const { data, error } = await client
    .from('business_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return DEFAULT_BUSINESS_SETTINGS;
  return {
    businessName: data.business_name,
    address: data.address,
    phone: data.phone,
    email: data.email,
    website: data.website,
    license: data.license,
    materialMarkupBps: data.material_markup_bps,
    taxRateBps: data.tax_rate_bps,
    taxableCategories: asCategories(data.taxable_categories),
    paymentTerms: data.payment_terms as PaymentTerms,
    estimateExpirationDays: data.estimate_expiration_days as EstimateExpirationDays,
    settingsRevision: data.settings_revision,
  };
}

export async function saveBusinessSettings(
  client: FieldSoloSupabaseClient,
  userId: string,
  settings: BusinessSettings,
): Promise<void> {
  const row = {
    user_id: userId,
    business_name: settings.businessName,
    address: settings.address,
    phone: settings.phone,
    email: settings.email,
    website: settings.website,
    license: settings.license,
    material_markup_bps: settings.materialMarkupBps,
    tax_rate_bps: settings.taxRateBps,
    taxable_categories: settings.taxableCategories,
    payment_terms: settings.paymentTerms,
    estimate_expiration_days: settings.estimateExpirationDays,
  };
  const { error } = await client.from('business_settings').upsert(row, { onConflict: 'user_id' });
  if (error) throw error;
}
