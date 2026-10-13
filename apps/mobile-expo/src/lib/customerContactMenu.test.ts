import { ActionSheetIOS, Alert, Linking } from 'react-native';
import { describe, expect, it, jest, beforeEach } from '@jest/globals';

import { showCustomerContactMenu } from './customerContactMenu';

describe('showCustomerContactMenu', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(() => undefined);
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  });

  it('opens Call/Text/Email in order when phone and email are valid', () => {
    showCustomerContactMenu('+13125550198', 'jordan@example.com');

    expect(ActionSheetIOS.showActionSheetWithOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Contact customer',
        options: ['Call', 'Text', 'Email', 'Cancel'],
        cancelButtonIndex: 3,
      }),
      expect.any(Function),
    );
  });

  it('does nothing when no valid contact actions exist', () => {
    showCustomerContactMenu('', '');
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(ActionSheetIOS.showActionSheetWithOptions).not.toHaveBeenCalled();
  });
});
