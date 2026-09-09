/**
 * Duration-first session draft helpers for Job Detail Edit.
 * Synthesizes storage timestamps when clock times are omitted.
 */

const DEFAULT_SYNTHESIS_HOUR = 9;
const DEFAULT_DURATION_HOURS = 1;

export type SessionDurationDraft = {
  /** Local calendar date as YYYY-MM-DD. */
  date: string;
  /** Duration in hours (primary input). */
  durationHours: number;
  /** When set, user chose explicit clock times. */
  clockTimesExplicit: boolean;
  /** ISO start when explicit or synthesized. */
  startedAt: string;
  /** ISO end when explicit or synthesized. */
  endedAt: string;
  /** IANA timezone used for synthesis. */
  startedTz: string;
};

/** Returns the device IANA timezone or UTC fallback. */
export function deviceIanaTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Today's local date as YYYY-MM-DD. */
export function todayLocalDateString(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Builds local Date for hour:minute on a calendar date in the given IANA zone.
 * Uses the Intl API to find the UTC instant matching local wall time.
 */
export function localDateTimeToIso(
  date: string,
  hour: number,
  minute: number,
  timeZone: string,
): string {
  const [y, mo, d] = date.split('-').map(Number);
  const guess = new Date(Date.UTC(y, mo - 1, d, hour, minute, 0, 0));
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(guess).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]),
  );
  const gotH = Number(parts.hour);
  const gotM = Number(parts.minute);
  const targetMinutes = hour * 60 + minute;
  const gotMinutes = gotH * 60 + gotM;
  const deltaMs = (targetMinutes - gotMinutes) * 60_000;
  return new Date(guess.getTime() + deltaMs).toISOString();
}

/** Synthesizes 09:00 local start + duration for duration-only sessions. */
export function synthesizeSessionTimes(
  date: string,
  durationHours: number,
  timeZone: string,
): { startedAt: string; endedAt: string } {
  const startedAt = localDateTimeToIso(date, DEFAULT_SYNTHESIS_HOUR, 0, timeZone);
  const endMs = new Date(startedAt).getTime() + durationHours * 3_600_000;
  return { startedAt, endedAt: new Date(endMs).toISOString() };
}

export function durationHoursBetween(startedAt: string, endedAt: string): number {
  const a = new Date(startedAt).getTime();
  const b = new Date(endedAt).getTime();
  return Math.max(0, (b - a) / 3_600_000);
}

/** Default draft for a new session row on Edit. */
export function createDefaultSessionDraft(now = new Date()): SessionDurationDraft {
  const date = todayLocalDateString(now);
  const startedTz = deviceIanaTimeZone();
  const { startedAt, endedAt } = synthesizeSessionTimes(date, DEFAULT_DURATION_HOURS, startedTz);
  return {
    date,
    durationHours: DEFAULT_DURATION_HOURS,
    clockTimesExplicit: false,
    startedAt,
    endedAt,
    startedTz,
  };
}

/** Guards against drafts that accidentally store a calendar date in startedTz. */
export function normalizeSessionStartedTz(startedTz: string | undefined): string {
  const trimmed = startedTz?.trim() ?? '';
  if (!trimmed || /^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return deviceIanaTimeZone();
  }
  return trimmed;
}

/** Recompute storage timestamps from draft fields. */
export function resolveSessionDraftTimes(draft: SessionDurationDraft): {
  startedAt: string;
  endedAt: string;
} {
  if (draft.clockTimesExplicit) {
    return { startedAt: draft.startedAt, endedAt: draft.endedAt };
  }
  return synthesizeSessionTimes(
    draft.date,
    draft.durationHours,
    normalizeSessionStartedTz(draft.startedTz),
  );
}

const CLOCK_INFER_TOLERANCE_MS = 60_000;

/**
 * Infers which session clocks the user set when legacy rows lack explicit flags.
 */
export function inferSessionClockExplicitFlags(input: {
  date: string;
  durationHours: number;
  startedAt: string;
  endedAt: string;
  startedTz?: string;
}): { explicitStartClock: boolean; explicitEndClock: boolean } {
  const tz = normalizeSessionStartedTz(input.startedTz);
  const synth = synthesizeSessionTimes(input.date, input.durationHours, tz);
  const startMs = new Date(input.startedAt).getTime();
  const endMs = new Date(input.endedAt).getTime();
  const synthStartMs = new Date(synth.startedAt).getTime();
  const synthEndMs = new Date(synth.endedAt).getTime();
  const startDiffers = Math.abs(startMs - synthStartMs) > CLOCK_INFER_TOLERANCE_MS;
  const endDiffers = Math.abs(endMs - synthEndMs) > CLOCK_INFER_TOLERANCE_MS;
  const endMatchesStartPlusDuration =
    Math.abs(endMs - (startMs + input.durationHours * 3_600_000)) <= CLOCK_INFER_TOLERANCE_MS;
  return {
    explicitStartClock: startDiffers,
    explicitEndClock: endDiffers && !endMatchesStartPlusDuration,
  };
}

export const DURATION_CHIP_HOURS = [0.5, 1, 2, 4, 8] as const;

export function formatDurationChipLabel(hours: number): string {
  if (hours < 1) return `${hours * 60}m`;
  if (Number.isInteger(hours)) return `${hours}h`;
  return `${hours}h`;
}

/** View-consistent session date from local YYYY-MM-DD (e.g. `Mar 25, 2026`). */
export function formatLocalDateLabel(date: string): string {
  const [y, mo, d] = date.split('-').map(Number);
  if (!y || !mo || !d) return date;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(y, mo - 1, d));
}

/** View-consistent duration label (e.g. `1.4h` or `<0.1h` for short positive sessions). */
export function formatSessionDurationLabel(hours: number): string {
  if (hours > 0 && hours < 0.05) return '<0.1h';
  return `${hours.toFixed(1)}h`;
}

/** View-consistent clock label from ISO (e.g. `9:00 AM`). */
export function formatSessionTimeLabel(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}
