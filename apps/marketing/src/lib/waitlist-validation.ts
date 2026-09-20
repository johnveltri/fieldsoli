import {
  jobSourceOptions,
  trackingToolOptions,
  tradeOptions,
} from "./marketing-content";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PRIVACY_POLICY_VERSION = "2026-09-20";
export const TERMS_VERSION = "2026-08-30";

function allowedValues(options: { value: string }[]) {
  return new Set(options.map((option) => option.value));
}

const TRADE_VALUES = allowedValues(tradeOptions);
const TRACKING_TOOL_VALUES = allowedValues(trackingToolOptions);
const JOB_SOURCE_VALUES = allowedValues(jobSourceOptions);

export type WaitlistPayload = {
  firstName: string;
  email: string;
  trades: string[];
  usesSoftware: boolean;
  trackingTools: string[];
  jobSources: string[];
  privacyAccepted: true;
};

function validateStringArray(
  value: unknown,
  allowed: Set<string>,
): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (!value.every((item) => typeof item === "string" && allowed.has(item))) {
    return null;
  }
  if (new Set(value).size !== value.length || value.length > allowed.size) return null;
  return value;
}

export function parseWaitlistPayload(body: unknown): WaitlistPayload | null {
  if (!body || typeof body !== "object") return null;

  const record = body as Record<string, unknown>;
  const firstName = typeof record.firstName === "string" ? record.firstName.trim() : "";
  const email = typeof record.email === "string" ? record.email.trim().toLowerCase() : "";
  const usesSoftware = record.usesSoftware;
  const privacyAccepted = record.privacyAccepted;

  if (!firstName || firstName.length > 100 || email.length > 320 || !EMAIL_RE.test(email)) {
    return null;
  }
  if (typeof usesSoftware !== "boolean") return null;
  if (privacyAccepted !== true) return null;

  const trades = validateStringArray(record.trades, TRADE_VALUES);
  const trackingTools = validateStringArray(
    record.trackingTools,
    TRACKING_TOOL_VALUES,
  );
  const jobSources = validateStringArray(record.jobSources, JOB_SOURCE_VALUES);

  if (!trades || !trackingTools || !jobSources) return null;

  return {
    firstName,
    email,
    trades,
    usesSoftware,
    trackingTools,
    jobSources,
    privacyAccepted: true,
  };
}
