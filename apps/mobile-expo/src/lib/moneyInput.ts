/**
 * Sanitize free-form decimal money input: at most one period and two fractional digits.
 */
export function sanitizeDecimalInput(text: string): string {
  const cleaned = text.replace(/[^0-9.]/g, '');
  if (!cleaned) return '';
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  const whole = cleaned.slice(0, firstDot);
  const fractional = cleaned.slice(firstDot + 1).replace(/\./g, '').slice(0, 2);
  if (fractional.length === 0 && cleaned.endsWith('.')) {
    return `${whole}.`;
  }
  return fractional.length > 0 ? `${whole}.${fractional}` : whole;
}

/** Collapse pasted/typed line breaks for single-line address fields. */
export function sanitizeSingleLineText(text: string): string {
  return text.replace(/[\r\n]+/g, ' ');
}
