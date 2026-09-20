import { Alert, Linking } from 'react-native';
import { buildCustomerContactActions } from '@fieldsolo/api-client';

export function showCustomerContactMenu(
  phone: string | null | undefined,
  email: string | null | undefined,
): void {
  const actions = buildCustomerContactActions(phone, email);
  if (actions.length === 0) return;

  Alert.alert(
    'Contact customer',
    undefined,
    [
      ...actions.map((item) => ({
        text: item.label,
        onPress: () => {
          void Linking.openURL(item.url).catch(() => {
            Alert.alert("Couldn't open that app.");
          });
        },
      })),
      { text: 'Cancel', style: 'cancel' },
    ],
  );
}
