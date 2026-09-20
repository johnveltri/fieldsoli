import { Alert } from 'react-native';

import type { CustomerDraft } from './types';

export function customerFieldsWouldReplace(
  current: CustomerDraft,
  next: CustomerDraft,
): boolean {
  const fields = [
    current.customerName !== next.customerName,
    current.customerPhone !== next.customerPhone,
    current.customerEmail !== next.customerEmail,
    current.serviceAddress !== next.serviceAddress,
  ];
  const anyNonEmpty =
    current.customerName.trim().length > 0 ||
    current.customerPhone.trim().length > 0 ||
    current.customerEmail.trim().length > 0 ||
    current.serviceAddress.trim().length > 0;
  return anyNonEmpty && fields.some(Boolean);
}

export function confirmCustomerReplacement(
  onReplace: () => void,
  onCancel?: () => void,
): void {
  Alert.alert(
    'Replace customer details?',
    'This will replace the name, phone, email, and service address for this Job.',
    [
      { text: 'Cancel', style: 'cancel', onPress: onCancel },
      { text: 'Replace', style: 'destructive', onPress: onReplace },
    ],
  );
}
