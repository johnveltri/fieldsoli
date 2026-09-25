import { analytics } from '../../../lib/analytics';

export type CustomerPickerSource = 'recent' | 'search' | 'device_contact' | 'manual';
export type CustomerPickerOutcome =
  | 'selected'
  | 'cancelled'
  | 'no_result'
  | 'permission_denied'
  | 'provider_unavailable'
  | 'saved';

export function trackCustomerPickerEvent(
  surface: 'job_edit' | 'live_session',
  source: CustomerPickerSource,
  outcome: CustomerPickerOutcome,
  extras?: { queryLengthBucket?: string; latencyBucket?: string },
): void {
  analytics.capture('customer_picker_event', {
    surface,
    source,
    outcome,
    query_length_bucket: extras?.queryLengthBucket ?? null,
    latency_bucket: extras?.latencyBucket ?? null,
  });
}
