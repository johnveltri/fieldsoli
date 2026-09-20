import { isValidCustomerEmail, isValidCustomerPhone } from './customerNormalization';

export type CustomerContactAction = 'call' | 'text' | 'email';

export type CustomerContactActionItem = {
  action: CustomerContactAction;
  label: string;
  url: string;
};

function encodeTel(value: string): string {
  const digits = value.replace(/[^\d+]/g, '');
  return `tel:${encodeURIComponent(digits)}`;
}

function encodeSms(value: string): string {
  const digits = value.replace(/[^\d+]/g, '');
  return `sms:${encodeURIComponent(digits)}`;
}

function encodeMailto(value: string): string {
  return `mailto:${encodeURIComponent(value.trim())}`;
}

/** Builds Call/Text/Email deep links from a job snapshot (TEST-12). */
export function buildCustomerContactActions(
  phone: string | null | undefined,
  email: string | null | undefined,
): CustomerContactActionItem[] {
  const actions: CustomerContactActionItem[] = [];
  const phoneValue = (phone ?? '').trim();
  const emailValue = (email ?? '').trim();

  if (phoneValue && isValidCustomerPhone(phoneValue)) {
    actions.push({ action: 'call', label: 'Call', url: encodeTel(phoneValue) });
    actions.push({ action: 'text', label: 'Text', url: encodeSms(phoneValue) });
  }
  if (emailValue && isValidCustomerEmail(emailValue)) {
    actions.push({ action: 'email', label: 'Email', url: encodeMailto(emailValue) });
  }
  return actions;
}
