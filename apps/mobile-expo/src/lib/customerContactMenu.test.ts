import { Alert, Linking } from 'react-native';
import { describe, expect, it, jest, beforeEach } from '@jest/globals';

import { showCustomerContactMenu } from './customerContactMenu';

describe('showCustomerContactMenu', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  });

  it('opens Call/Text/Email in order when phone and email are valid', () => {
    showCustomerContactMenu('+13125550198', 'jordan@example.com');

    expect(Alert.alert).toHaveBeenCalledWith(
      'Contact customer',
      undefined,
      expect.arrayContaining([
        expect.objectContaining({ text: 'Call' }),
        expect.objectContaining({ text: 'Text' }),
        expect.objectContaining({ text: 'Email' }),
        expect.objectContaining({ text: 'Cancel' }),
      ]),
    );
  });

  it('does nothing when no valid contact actions exist', () => {
    showCustomerContactMenu('', '');
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});
