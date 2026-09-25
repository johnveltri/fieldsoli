import { color } from '@fieldsolo/design-system/lib/tokens';
import type { JobDetailWorkStatus } from '@fieldsolo/shared-types';

export type JobCtaResolved = {
  label: string;
  backgroundColor: string;
  labelColor: string;
  shadowColor: string;
  shadowOpacity: number;
  borderWidth?: number;
  borderColor?: string;
};

const infoBlue = color('Semantic/Status/Info/Text');
const warningOrange = color('Semantic/Status/Warning/Text');
const successGreen = color('Semantic/Status/Success/Text');

/**
 * Primary job action — tones follow design-system primary-secondary-buttons
 * (Info / Warning / Success / Outline / Neutral); flat shadow (`shadowOpacity` 0).
 */
export function jobDetailCtaConfig(status: JobDetailWorkStatus): JobCtaResolved {
  const surfaceWhite = color('Foundation/Surface/White');
  const textPrimary = color('Foundation/Text/Primary');
  const canvasWarm = color('Foundation/Background/CanvasWarm');

  switch (status) {
    case 'notStarted':
      return {
        label: 'MARK IN PROGRESS',
        backgroundColor: infoBlue,
        labelColor: surfaceWhite,
        shadowColor: infoBlue,
        shadowOpacity: 0,
      };
    case 'onHold':
      return {
        label: 'RESUME JOB',
        backgroundColor: infoBlue,
        labelColor: surfaceWhite,
        shadowColor: infoBlue,
        shadowOpacity: 0,
      };
    case 'inProgress':
      return {
        label: 'MARK COMPLETED',
        backgroundColor: warningOrange,
        labelColor: surfaceWhite,
        shadowColor: warningOrange,
        shadowOpacity: 0,
      };
    case 'completed':
      return {
        label: 'MARK PAID',
        backgroundColor: successGreen,
        labelColor: surfaceWhite,
        shadowColor: successGreen,
        shadowOpacity: 0,
      };
    case 'paid':
      return {
        label: 'MARK UNPAID',
        backgroundColor: surfaceWhite,
        labelColor: textPrimary,
        shadowColor: color('Foundation/Shadow/Ambient'),
        shadowOpacity: 0,
        borderWidth: 1,
        borderColor: color('Foundation/Border/Subtle'),
      };
    case 'cancelled':
      return {
        label: 'REOPEN JOB',
        backgroundColor: textPrimary,
        labelColor: canvasWarm,
        shadowColor: textPrimary,
        shadowOpacity: 0,
      };
  }
}

/**
 * When finishing work on a confirmed no-revenue job (in progress → completed),
 * write `paid` so the job does not stall in an unset payment state.
 * Does not apply when the user explicitly marks unpaid (paid → completed) or
 * picks Completed from the status sheet.
 */
export function resolveStatusWriteTarget(
  intended: JobDetailWorkStatus,
  noRevenueConfirmed: boolean,
  current: JobDetailWorkStatus,
): JobDetailWorkStatus {
  if (intended === 'completed' && noRevenueConfirmed && current === 'inProgress') {
    return 'paid';
  }
  return intended;
}

/** Next `JobDetailWorkStatus` when the user taps the primary CTA. */
export function nextStatusAfterPrimaryAction(
  current: JobDetailWorkStatus,
): JobDetailWorkStatus {
  switch (current) {
    case 'notStarted':
      return 'inProgress';
    case 'inProgress':
      return 'completed';
    case 'completed':
      return 'paid';
    case 'paid':
      return 'completed';
    case 'onHold':
      return 'inProgress';
    case 'cancelled':
      return 'notStarted';
  }
}
