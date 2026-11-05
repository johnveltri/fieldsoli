import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  fetchAnalyticsConsentStatus,
  upsertAnalyticsConsentStatus,
  type AnalyticsConsentStatus,
} from '@fieldsolo/api-client';

import { supabase } from '../supabase';
import { analytics } from './client';
import {
  clearAnalyticsConsentCache,
  readAnalyticsConsentCache,
  writeAnalyticsConsentCache,
} from './consentStorage';

let resolutionGeneration = 0;

export async function syncAnalyticsConsentForUser(userId: string): Promise<void> {
  await resolveAnalyticsConsentForUser(userId);
}

export type AnalyticsConsentResolution = 'granted' | 'withdrawn' | 'missing' | 'unavailable';

/**
 * Hydrates analytics consent from cache and server. Returns `missing` when the
 * user has never recorded a choice (first auth). Returns `unavailable` when the
 * server read fails and there is no local cache — analytics stays off without
 * prompting so offline launches are not blocked.
 */
export async function resolveAnalyticsConsentForUser(
  userId: string,
): Promise<AnalyticsConsentResolution> {
  const generation = ++resolutionGeneration;
  const cached = await readAnalyticsConsentCache();
  if (generation !== resolutionGeneration) return 'unavailable';
  if (cached?.userId === userId) {
    await analytics.applyConsent(cached.status, userId);
  } else {
    await analytics.applyConsent(null);
  }

  try {
    const status = await fetchAnalyticsConsentStatus(supabase);
    if (generation !== resolutionGeneration) return 'unavailable';
    if (cached?.userId === userId && cached.status === 'withdrawn' && status !== 'withdrawn') {
      // A stale server grant must not undo an offline withdrawal.
      await upsertAnalyticsConsentStatus(supabase, 'withdrawn');
      return 'withdrawn';
    }
    if (status) {
      await writeAnalyticsConsentCache(userId, status);
      if (generation !== resolutionGeneration) return 'unavailable';
      await analytics.applyConsent(status, userId);
      return status;
    }
    await clearAnalyticsConsentCache();
    await analytics.applyConsent(null);
    return 'missing';
  } catch {
    if (generation !== resolutionGeneration) return 'unavailable';
    if (cached?.userId === userId) {
      await analytics.applyConsent(cached.status, userId);
      return cached.status;
    }
    await analytics.applyConsent(null);
    return 'unavailable';
  }
}

export async function grantAnalyticsConsent(userId: string): Promise<void> {
  ++resolutionGeneration;
  // An explicit new grant starts a fresh observation period, never an old queue.
  await analytics.withdrawConsent();
  try {
    await upsertAnalyticsConsentStatus(supabase, 'granted');
  } catch {
    // Best-effort server sync; local consent still applies when offline.
  }
  await writeAnalyticsConsentCache(userId, 'granted');
  await analytics.grantConsent(userId);
  analytics.identify(userId);
}

export async function withdrawAnalyticsConsent(userId: string): Promise<void> {
  ++resolutionGeneration;
  // Apply the user's choice locally before waiting for any network request.
  await Promise.all([
    analytics.withdrawConsent(),
    writeAnalyticsConsentCache(userId, 'withdrawn'),
  ]);
  try {
    await upsertAnalyticsConsentStatus(supabase, 'withdrawn');
  } catch {
    // Resolution retries this withdrawal; a stale grant cannot override it.
  }
}

export type { AnalyticsConsentStatus };
