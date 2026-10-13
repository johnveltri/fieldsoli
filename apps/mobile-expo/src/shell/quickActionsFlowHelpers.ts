import type { DropdownBottomSheetOption } from '../components/ds';

export type CaptureStep =
  | 'idle'
  | 'noteEdit'
  | 'materialEdit'
  | 'materialUnit';

export const CAPTURE_UNIT_OPTIONS: DropdownBottomSheetOption[] = (
  ['ea', 'ft', 'pcs', 'kit', 'lb', 'gal', 'lot'] as const
).map((u) => ({ id: u, label: u, value: u }));

export function formatCaptureError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (
    typeof e === 'object' &&
    e !== null &&
    'message' in e &&
    typeof (e as { message: unknown }).message === 'string'
  ) {
    return (e as { message: string }).message;
  }
  return String(e);
}

export function formatLiveSessionJobTitle(now: Date): string {
  const monthDay = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(now);
  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(now);
  return `Live Visit ${monthDay} at ${time}`;
}
