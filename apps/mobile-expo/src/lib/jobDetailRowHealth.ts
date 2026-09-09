import { formatSessionTimeLabel, JOB_DETAIL_EMPTY_LABELS } from '@fieldsolo/api-client';
import type {
  JobDetailMaterialLine,
  JobDetailOtherCostLine,
  JobDetailSession,
} from '@fieldsolo/shared-types';

export function isSessionDateEmpty(session: JobDetailSession): boolean {
  return !session.calendarDateExplicit;
}

export function isSessionDurationEmpty(session: JobDetailSession): boolean {
  return session.durationLabel === JOB_DETAIL_EMPTY_LABELS.sessionDuration;
}

/** Session can count toward financial completeness (date + duration). */
export function isSessionUsableForCompleteness(session: JobDetailSession): boolean {
  return !isSessionDateEmpty(session) && !isSessionDurationEmpty(session);
}

/**
 * View clock line for a session.
 * Start-only is valid (show start, no dangling end). Hide when neither clock is explicit.
 */
export function sessionViewTimeLabel(session: JobDetailSession): string | null {
  const startExplicit = session.clockStartExplicit === true;
  const endExplicit = session.clockEndExplicit === true;

  if (!startExplicit && !endExplicit) {
    const legacy = session.timeRangeLabel.trim();
    return session.clockTimesExplicit && legacy.length > 0 ? legacy : null;
  }

  const start = startExplicit ? formatSessionTimeLabel(session.startedAt) : '';
  const end =
    endExplicit && session.endedAt ? formatSessionTimeLabel(session.endedAt) : '';

  if (start && end && !isSessionDurationEmpty(session)) {
    return `${start} – ${end}`;
  }
  if (start) return start;
  if (end) return end;
  return null;
}

/** Start/end times are optional — show when at least one clock was set explicitly. */
export function shouldShowSessionTimeRange(session: JobDetailSession): boolean {
  return sessionViewTimeLabel(session) != null;
}

export function isMaterialDescriptionEmpty(material: JobDetailMaterialLine): boolean {
  return material.name === JOB_DETAIL_EMPTY_LABELS.materialDescription;
}

export function isMaterialTotalEmpty(material: JobDetailMaterialLine): boolean {
  return material.totalCostCents <= 0;
}

/** Material can count toward financial completeness (description + total). */
export function isMaterialUsableForCompleteness(material: JobDetailMaterialLine): boolean {
  return !isMaterialDescriptionEmpty(material) && !isMaterialTotalEmpty(material);
}

/** Quantity/unit breakdown is optional — hide the `—` placeholder. */
export function shouldShowMaterialQuantity(material: JobDetailMaterialLine): boolean {
  return material.quantityLabel.trim().length > 0 && material.quantityLabel !== '—';
}

export function isOtherCostTypeEmpty(line: JobDetailOtherCostLine): boolean {
  return !line.costTypeExplicit;
}

export function isOtherCostAmountEmpty(line: JobDetailOtherCostLine): boolean {
  return line.costCents <= 0;
}

/** Other cost can count toward financial completeness (type + amount). */
export function isOtherCostUsableForCompleteness(line: JobDetailOtherCostLine): boolean {
  return !isOtherCostTypeEmpty(line) && !isOtherCostAmountEmpty(line);
}

/** @deprecated Prefer coloring critical placeholders in-row instead of a duplicate missing line. */
export function sessionRowMissingLine(session: JobDetailSession): string | null {
  const parts: string[] = [];
  if (isSessionDateEmpty(session)) {
    parts.push(JOB_DETAIL_EMPTY_LABELS.sessionDate);
  }
  if (isSessionDurationEmpty(session)) {
    parts.push(JOB_DETAIL_EMPTY_LABELS.sessionDuration);
  }
  if (parts.length === 0) return null;
  return parts.join(' · ');
}

/** @deprecated Prefer coloring critical placeholders in-row instead of a duplicate missing line. */
export function materialRowMissingLine(material: JobDetailMaterialLine): string | null {
  const parts: string[] = [];
  if (isMaterialDescriptionEmpty(material)) {
    parts.push(JOB_DETAIL_EMPTY_LABELS.materialDescription);
  }
  if (isMaterialTotalEmpty(material)) {
    parts.push('No total');
  }
  if (parts.length === 0) return null;
  return parts.join(' · ');
}

/** @deprecated Prefer coloring critical placeholders in-row instead of a duplicate missing line. */
export function otherCostRowMissingLine(line: JobDetailOtherCostLine): string | null {
  const parts: string[] = [];
  if (isOtherCostTypeEmpty(line)) {
    parts.push(JOB_DETAIL_EMPTY_LABELS.otherCostType);
  }
  if (isOtherCostAmountEmpty(line)) {
    parts.push('No amount');
  }
  if (parts.length === 0) return null;
  return parts.join(' · ');
}
