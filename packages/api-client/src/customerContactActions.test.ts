import { describe, expect, it } from 'vitest';

import { buildCustomerContactActions } from './customerContactActions';

describe('buildCustomerContactActions', () => {
  it('builds call, text, and email URLs for valid snapshot values', () => {
    const actions = buildCustomerContactActions('(312) 555-0198', 'jordan@example.com');
    expect(actions.map((a) => a.action)).toEqual(['call', 'text', 'email']);
    expect(actions[0]?.url).toContain('tel:');
    expect(actions[1]?.url).toContain('sms:');
    expect(actions[2]?.url).toBe('mailto:jordan%40example.com');
  });

  it('omits invalid values', () => {
    expect(buildCustomerContactActions('bad', 'bad')).toEqual([]);
    expect(buildCustomerContactActions(null, 'jordan@example.com')).toHaveLength(1);
  });
});
