import { Alert } from 'react-native';
import { describe, expect, it, jest } from '@jest/globals';

import {
  confirmCustomerReplacement,
  customerFieldsWouldReplace,
} from './confirmCustomerReplacement';

describe('customerFieldsWouldReplace', () => {
  it('returns false when all affected fields are blank', () => {
    expect(
      customerFieldsWouldReplace(
        {
          customerName: '',
          customerPhone: '',
          customerEmail: '',
          customerId: null,
          serviceAddress: '',
        },
        {
          customerName: 'Jordan',
          customerPhone: '312',
          customerEmail: 'j@example.com',
          customerId: 'c1',
          serviceAddress: '123 Main',
        },
      ),
    ).toBe(false);
  });

  it('returns true when any affected field is non-empty', () => {
    expect(
      customerFieldsWouldReplace(
        {
          customerName: 'Ada',
          customerPhone: '',
          customerEmail: '',
          customerId: null,
          serviceAddress: '',
        },
        {
          customerName: 'Jordan',
          customerPhone: '',
          customerEmail: '',
          customerId: null,
          serviceAddress: '',
        },
      ),
    ).toBe(true);
  });
});

describe('confirmCustomerReplacement', () => {
  it('shows UX-04 copy and applies on Replace', () => {
    const onConfirm = jest.fn();
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const replace = buttons?.find((button) => button.text === 'Replace');
      replace?.onPress?.();
    });

    confirmCustomerReplacement(onConfirm);

    expect(Alert.alert).toHaveBeenCalledWith(
      'Replace customer details?',
      'This will replace the name, phone, email, and service address for this Job.',
      expect.any(Array),
    );
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
