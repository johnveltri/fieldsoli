import { describe, expect, it } from 'vitest';

import {
  isCustomerEligible,
  isMeaningfulServiceAddress,
  isValidCustomerEmail,
  isValidCustomerPhone,
  formatCustomerPhoneDisplay,
  normalizeCustomerEmail,
  normalizeCustomerName,
  normalizePhoneE164,
} from './customerNormalization';

describe('customerNormalization', () => {
  it('normalizes names for matching', () => {
    expect(normalizeCustomerName('  Jordan   Lee ')).toBe('jordan lee');
  });

  it('accepts US and explicit international phones', () => {
    expect(normalizePhoneE164('(312) 555-0198')).toBe('+13125550198');
    expect(normalizePhoneE164('+44 20 7946 0958')).toBe('+442079460958');
    expect(isValidCustomerPhone('bad')).toBe(false);
  });

  it('formats customer phone display for picker metadata', () => {
    expect(formatCustomerPhoneDisplay('4197084470')).toBe('(419) 708-4470');
    expect(formatCustomerPhoneDisplay('(312) 555-0198')).toBe('(312) 555-0198');
    expect(formatCustomerPhoneDisplay('+13125550198')).toBe('(312) 555-0198');
    expect(formatCustomerPhoneDisplay('')).toBeNull();
  });

  it('normalizes valid emails case-insensitively', () => {
    expect(normalizeCustomerEmail('  Jordan@Example.COM ')).toBe('jordan@example.com');
    expect(isValidCustomerEmail('nope')).toBe(false);
  });

  it('evaluates meaningful address threshold', () => {
    expect(isMeaningfulServiceAddress('1234')).toBe(false);
    expect(isMeaningfulServiceAddress('123 Main')).toBe(true);
    expect(isMeaningfulServiceAddress('ab')).toBe(false);
  });

  it('evaluates customer eligibility matrix', () => {
    expect(isCustomerEligible('Pat', '(312) 555-0198', null, null)).toBe(true);
    expect(isCustomerEligible('Pat', null, 'pat@example.com', null)).toBe(true);
    expect(isCustomerEligible('Pat', null, null, '123 Main St')).toBe(true);
    expect(isCustomerEligible('Pat', 'bad', 'bad', '12')).toBe(false);
    expect(isCustomerEligible('', '(312) 555-0198', null, null)).toBe(false);
  });
});
