import { analyticsConfig } from '../analytics/config';

function boolFromEnv(value: string | undefined): boolean {
  if (value == null || value.trim() === '') return false;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

/** Local-only bypass for PostHog when `EXPO_PUBLIC_JOB_DETAIL_FULLSCREEN_EDIT=true`. */
export function isJobDetailFullscreenEditDevOverrideEnabled(
  options: {
    dev?: boolean;
    environment?: string;
    envValue?: string | undefined;
  } = {},
): boolean {
  const dev = options.dev ?? __DEV__;
  if (!dev) return false;

  const environment = options.environment ?? analyticsConfig.environment;
  if (environment !== 'development') return false;

  const envValue =
    options.envValue ?? process.env.EXPO_PUBLIC_JOB_DETAIL_FULLSCREEN_EDIT;
  return boolFromEnv(envValue);
}

/** Local-only bypass for PostHog when `EXPO_PUBLIC_INVOICING=true`. */
export function isInvoicingDevOverrideEnabled(
  options: {
    dev?: boolean;
    environment?: string;
    envValue?: string | undefined;
  } = {},
): boolean {
  const dev = options.dev ?? __DEV__;
  if (!dev) return false;

  const environment = options.environment ?? analyticsConfig.environment;
  if (environment !== 'development') return false;

  const envValue = options.envValue ?? process.env.EXPO_PUBLIC_INVOICING;
  return boolFromEnv(envValue);
}
