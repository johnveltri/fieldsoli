import type { AnalyticsProperties } from './types';

type ErrorLike = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
  hint?: unknown;
};

// Persist only reviewed scalar metadata. Content and nested objects never enter
// the durable queue, including in development builds.
const SAFE_KEYS = new Set(`user_id anonymous_id session_id app_session_id visit_id
job_id job_ref mutation_ref material_id note_id document_ref source operation workflow field basis action window
app_version build_number platform environment is_testflight analytics_schema_version
current_screen debug_rich_enabled screen auth_state auth_provider main_tab from_tab to_tab
job_detail_open inbox_open profile_open has_live_session placeholder composer opened_in_edit
has_work_description record_kinds changed_fields completeness_before completeness_after status from_status
to_status entry_source parent_type mode count record_count job_count item_count total_count
page page_size has_more tab from_tab to_tab query_length_bucket text_length_bucket latency_bucket
duration_bucket duration_minutes quantity_bucket cost_bucket revenue_bucket money_bucket
error_category error_code reason outcome surface document_type recovered request_key
acquisition_status acquisition_source acquisition_reason apple_ads_org_id apple_ads_campaign_id
apple_ads_ad_group_id apple_ads_keyword_id apple_ads_ad_id apple_ads_conversion_type
apple_ads_claim_type apple_ads_placement has_customer has_address has_notes has_materials
has_sessions session_count material_count note_count result_count selected_window window_kind
has_jobs is_empty feedback_source milestone completed_job_count destination query_length
search_length_bucket source_tab target_tab elapsed_bucket`.split(/\s+/));

export function sanitizeProperties(
  properties: AnalyticsProperties,
  _debugRichEnabled: boolean,
): AnalyticsProperties {
  const sanitized: AnalyticsProperties = {};
  for (const [key, value] of Object.entries(properties)) {
    if (!SAFE_KEYS.has(key) || value === undefined) continue;
    if (value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) {
      sanitized[key] = value;
    } else if (typeof value === 'string' && value.length <= 128) {
      sanitized[key] = value;
    } else if ((key === 'changed_fields' || key === 'record_kinds') && Array.isArray(value)) {
      sanitized[key] = value.filter((item): item is string => typeof item === 'string' && /^[a-zA-Z_]{1,64}$/.test(item)).slice(0, 30);
    }
  }
  return sanitized;
}

export function errorProperties(error: unknown): AnalyticsProperties {
  const errorObj = (error ?? {}) as ErrorLike;
  const message =
    typeof errorObj.message === 'string'
      ? errorObj.message
      : error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Unknown error';
  return {
    error_code: typeof errorObj.code === 'string' && /^(?:[0-9A-Z_]{2,32}|network|timeout|stale|incomplete|conflict|unauthorized)$/.test(errorObj.code) ? errorObj.code : null,
    error_message: message,
    error_details: typeof errorObj.details === 'string' ? errorObj.details : null,
    error_hint: typeof errorObj.hint === 'string' ? errorObj.hint : null,
    error_category: /timeout|timed out/i.test(message) ? 'timeout'
      : /network|offline|failed to fetch/i.test(message) ? 'network'
      : /unauthorized|jwt|auth session/i.test(message) ? 'authentication'
      : /permission|forbidden/i.test(message) ? 'authorization'
      : /rate.limit|too many requests/i.test(message) ? 'rate_limit'
      : /stale|conflict/i.test(message) ? 'conflict'
      : /incomplete|validation|invalid/i.test(message) ? 'validation'
      : 'application',
  };
}

export function emailProperties(email: string | null | undefined): AnalyticsProperties {
  const trimmed = (email ?? '').trim().toLowerCase();
  const domain = trimmed.includes('@') ? trimmed.split('@').pop() || null : null;
  return {
    email_domain: domain,
    debug_email: trimmed || null,
  };
}

export function textLengthBucket(text: string | null | undefined): string {
  const length = (text ?? '').trim().length;
  if (length === 0) return 'empty';
  if (length <= 25) return '1_25';
  if (length <= 100) return '26_100';
  if (length <= 500) return '101_500';
  return '501_plus';
}

export function moneyBucket(cents: number | null | undefined): string {
  if (cents == null) return 'unknown';
  if (cents === 0) return 'zero';
  const dollars = Math.abs(cents / 100);
  if (dollars < 25) return 'under_25';
  if (dollars < 100) return '25_99';
  if (dollars < 500) return '100_499';
  if (dollars < 1000) return '500_999';
  return '1000_plus';
}

export function quantityBucket(quantity: number | null | undefined): string {
  if (quantity == null) return 'unknown';
  if (quantity === 0) return 'zero';
  if (quantity <= 1) return 'one';
  if (quantity <= 5) return '2_5';
  if (quantity <= 20) return '6_20';
  return '21_plus';
}

export function durationMinutesBetween(startedAt: string, endedAt: string): number {
  const started = Date.parse(startedAt);
  const ended = Date.parse(endedAt);
  if (!Number.isFinite(started) || !Number.isFinite(ended)) return 0;
  return Math.max(0, Math.round((ended - started) / 60000));
}

export function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): string[] {
  return Object.keys(after).filter((key) => before[key] !== after[key]);
}
