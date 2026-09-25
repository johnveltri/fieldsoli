import { describe, expect, it } from '@jest/globals';

import {
  buildCustomerSubtitleLabel,
  buildCustomerSubtitleSegments,
  toNonBreakingSegmentText,
} from './JobDetailJobHeader';

const baseInput = {
  customerName: 'John Appleseed',
  customerPhone: '8885555512',
  customerEmail: 'John-Appleseed@mac.com',
  serviceAddress: '1234 Laurel Street, Atlanta, GA, 30303',
  lastWorkedLabel: 'Last worked Sep 20, 2026',
};

describe('JobDetailJobHeader customer subtitle', () => {
  it('builds bullet-separated segments in display order', () => {
    expect(buildCustomerSubtitleSegments(baseInput)).toEqual([
      { text: 'John Appleseed', keepWhole: false },
      { text: '(888) 555-5512', keepWhole: true },
      { text: 'John-Appleseed@mac.com', keepWhole: true },
      { text: '1234 Laurel Street, Atlanta, GA, 30303', keepWhole: false },
      { text: 'Last worked Sep 20, 2026', keepWhole: false },
    ]);
  });

  it('omits blank address and keeps accessibility label bullet-separated', () => {
    const input = {
      ...baseInput,
      serviceAddress: '',
    };
    expect(buildCustomerSubtitleLabel(input)).toBe(
      'John Appleseed · (888) 555-5512 · John-Appleseed@mac.com · Last worked Sep 20, 2026',
    );
  });

  it('uses non-breaking spaces and hyphens for whole-line phone and email segments', () => {
    expect(toNonBreakingSegmentText('(888) 555-5512')).toBe(
      '(888)\u00A0555\u20115512',
    );
    expect(toNonBreakingSegmentText('John-Appleseed@mac.com')).toBe(
      'John\u2011Appleseed@mac.com',
    );
  });
});
