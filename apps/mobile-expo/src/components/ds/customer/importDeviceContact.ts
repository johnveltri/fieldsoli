import {
  Fields,
  getContactByIdAsync,
  getPermissionsAsync,
  presentContactPickerAsync,
  requestPermissionsAsync,
  type Address,
  type Email,
  type ExistingContact,
  type PhoneNumber,
} from 'expo-contacts/legacy';
import { Alert, Linking, Platform } from 'react-native';

import type { CustomerDraft } from './types';

export type DeviceContactImportResult = Pick<
  CustomerDraft,
  'customerName' | 'customerPhone' | 'customerEmail' | 'serviceAddress'
>;

export type DeviceContactImportError = 'permission_denied' | 'cancelled' | 'unavailable';

export type DeviceContactImportOutcome =
  | { status: 'selected'; values: DeviceContactImportResult }
  | { status: 'error'; code: DeviceContactImportError };

type ChooserOption<T> = {
  label: string;
  value: T;
};

function formatContactName(contact: ExistingContact): string {
  const composed = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();
  return composed || contact.name?.trim() || '';
}

function formatPostalAddress(address: Address): string {
  const parts = [address.street, address.city, address.region, address.postalCode]
    .map((part) => (part ?? '').trim())
    .filter((part) => part.length > 0);
  return parts.join(', ');
}

function phoneLabel(entry: PhoneNumber): string {
  const label = entry.label?.trim();
  const number = entry.number?.trim() ?? '';
  if (!label) return number;
  return `${label} · ${number}`;
}

function emailLabel(entry: Email): string {
  const label = entry.label?.trim();
  const email = entry.email?.trim() ?? '';
  if (!label) return email;
  return `${label} · ${email}`;
}

function addressLabel(entry: Address): string {
  const label = entry.label?.trim();
  const formatted = formatPostalAddress(entry);
  if (!label) return formatted;
  return `${label} · ${formatted}`;
}

function chooseOption<T>(title: string, options: ChooserOption<T>[]): Promise<T | null> {
  return new Promise((resolve) => {
    if (options.length === 0) {
      resolve(null);
      return;
    }
    if (options.length === 1) {
      resolve(options[0]!.value);
      return;
    }
    Alert.alert(
      title,
      undefined,
      [
        ...options.map((option) => ({
          text: option.label,
          onPress: () => resolve(option.value),
        })),
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}

function showContactsSettingsRecovery(): void {
  Alert.alert(
    'Contacts access is off. You can enter customer details manually or enable access in Settings.',
    undefined,
    [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Open Settings',
        onPress: () => {
          void Linking.openSettings();
        },
      },
    ],
  );
}

async function ensureContactsPermission(): Promise<'granted' | 'denied' | 'blocked'> {
  const current = await getPermissionsAsync();
  if (current.granted) return 'granted';
  if (current.status === 'denied' && !current.canAskAgain) return 'blocked';

  const requested = await requestPermissionsAsync();
  if (requested.granted) return 'granted';
  if (!requested.canAskAgain) return 'blocked';
  return 'denied';
}

async function loadPickedContact(): Promise<ExistingContact | null> {
  const picked = await presentContactPickerAsync();
  if (!picked?.id) return null;
  const detailed = await getContactByIdAsync(picked.id, [
    Fields.Name,
    Fields.PhoneNumbers,
    Fields.Emails,
    Fields.Addresses,
  ]);
  return detailed ?? picked;
}

async function resolvePhone(contact: ExistingContact): Promise<string> {
  const phones = (contact.phoneNumbers ?? [])
    .map((entry) => ({
      label: phoneLabel(entry),
      value: entry.number?.trim() ?? '',
    }))
    .filter((entry) => entry.value.length > 0);
  const chosen = await chooseOption('Choose phone', phones);
  return chosen ?? '';
}

async function resolveEmail(contact: ExistingContact): Promise<string> {
  const emails = (contact.emails ?? [])
    .map((entry) => ({
      label: emailLabel(entry),
      value: entry.email?.trim() ?? '',
    }))
    .filter((entry) => entry.value.length > 0);
  const chosen = await chooseOption('Choose email', emails);
  return chosen ?? '';
}

async function resolveAddress(contact: ExistingContact): Promise<string> {
  const addresses = (contact.addresses ?? [])
    .map((entry) => ({
      label: addressLabel(entry),
      value: formatPostalAddress(entry),
    }))
    .filter((entry) => entry.value.length > 0);
  const chosen = await chooseOption('Choose address', addresses);
  return chosen ?? '';
}

/** Imports one device contact into the Job customer draft (UX-07/08). */
export async function importDeviceContact(): Promise<DeviceContactImportOutcome> {
  if (Platform.OS === 'web') {
    return { status: 'error', code: 'unavailable' };
  }

  const permission = await ensureContactsPermission();
  if (permission === 'blocked') {
    showContactsSettingsRecovery();
    return { status: 'error', code: 'permission_denied' };
  }
  if (permission === 'denied') {
    return { status: 'error', code: 'permission_denied' };
  }

  const contact = await loadPickedContact();
  if (!contact) {
    return { status: 'error', code: 'cancelled' };
  }

  const customerName = formatContactName(contact);
  const customerPhone = await resolvePhone(contact);
  const customerEmail = await resolveEmail(contact);
  const serviceAddress = await resolveAddress(contact);

  return {
    status: 'selected',
    values: {
      customerName,
      customerPhone,
      customerEmail,
      serviceAddress,
    },
  };
}
