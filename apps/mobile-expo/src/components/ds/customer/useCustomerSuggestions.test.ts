import { describe, expect, it } from '@jest/globals';

import {
  clearsExhaustedCustomerSearch,
  shouldSkipCustomerSuggestionSearch,
  visibleCustomerSuggestions,
} from './useCustomerSuggestions';
import { isCustomerContactSwipeable } from './types';

describe('useCustomerSuggestions search gating', () => {
  it('skips longer queries after an empty result', () => {
    expect(shouldSkipCustomerSuggestionSearch('Dfd', 'Df')).toBe(true);
    expect(shouldSkipCustomerSuggestionSearch('Df', 'Df')).toBe(true);
    expect(shouldSkipCustomerSuggestionSearch('D', 'Df')).toBe(false);
  });

  it('clears exhaustion when the query shortens or resets', () => {
    expect(clearsExhaustedCustomerSearch('', 'Df')).toBe(true);
    expect(clearsExhaustedCustomerSearch('D', 'Df')).toBe(true);
    expect(clearsExhaustedCustomerSearch('Dfd', 'Df')).toBe(false);
  });

  it('hides stale recents while a typed search is loading', () => {
    const rows = [
      {
        customerId: '1',
        displayName: 'Ada Lovelace',
        phone: null,
        email: null,
        serviceAddress: null,
      },
    ];
    expect(
      visibleCustomerSuggestions(rows, '', 'Ada', true),
    ).toEqual([]);
    expect(
      visibleCustomerSuggestions(rows, 'Ada', 'Ada', false),
    ).toEqual(rows);
  });

  it('does not enable swipe-delete while the customer name is being searched', () => {
    expect(
      isCustomerContactSwipeable(
        {
          customerName: 'App',
          customerPhone: '',
          customerEmail: '',
          customerId: null,
          serviceAddress: '',
        },
        true,
      ),
    ).toBe(false);
  });
});
