import { describe, expect, it } from '@jest/globals';

import { sanitizeDecimalInput, sanitizeSingleLineText } from './moneyInput';

describe('moneyInput', () => {
  it('allows a single decimal point and two fractional digits', () => {
    expect(sanitizeDecimalInput('12.34')).toBe('12.34');
    expect(sanitizeDecimalInput('12.345')).toBe('12.34');
  });

  it('rejects a second decimal point while typing', () => {
    expect(sanitizeDecimalInput('12.3.4')).toBe('12.34');
    expect(sanitizeDecimalInput('1..2')).toBe('1.2');
  });

  it('strips line breaks from single-line address input', () => {
    expect(sanitizeSingleLineText('123 Main\nApt 2')).toBe('123 Main Apt 2');
  });
});
