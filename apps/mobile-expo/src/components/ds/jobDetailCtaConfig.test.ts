import { describe, expect, it } from '@jest/globals';

import { resolveStatusWriteTarget } from './jobDetailCtaConfig';

describe('resolveStatusWriteTarget', () => {
  it('promotes in-progress complete to paid when no revenue is confirmed', () => {
    expect(resolveStatusWriteTarget('completed', true, 'inProgress')).toBe('paid');
  });

  it('keeps completed when marking unpaid from paid', () => {
    expect(resolveStatusWriteTarget('completed', true, 'paid')).toBe('completed');
  });

  it('keeps completed when no revenue is not confirmed', () => {
    expect(resolveStatusWriteTarget('completed', false, 'inProgress')).toBe('completed');
  });
});
