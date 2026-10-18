import { ActionSheetIOS, Alert, Linking, Platform } from 'react-native';
import { buildCustomerContactActions } from '@fieldsolo/api-client';

export function showCustomerContactMenu(
  phone: string | null | undefined,
  email: string | null | undefined,
): void {
  const actions = buildCustomerContactActions(phone, email);
  if (actions.length === 0) return;

  const openAction = (index: number) => {
    const item = actions[index];
    if (!item) return;
    void Linking.openURL(item.url).catch(() => {
      Alert.alert("Couldn't open that app.");
    });
  };

  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Contact customer',
        options: [...actions.map((item) => item.label), 'Cancel'],
        cancelButtonIndex: actions.length,
      },
      openAction,
    );
    return;
  }

  Alert.alert(
    'Contact customer',
    undefined,
    [
      ...actions.map((item, index) => ({
        text: item.label,
        onPress: () => openAction(index),
      })),
      { text: 'Cancel', style: 'cancel' },
    ],
  );
}
