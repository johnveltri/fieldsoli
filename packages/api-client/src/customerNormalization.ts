import { parsePhoneNumberFromString } from 'libphonenumber-js/min';

export function normalizeCustomerName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function normalizePhoneE164(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  const parsed = parsePhoneNumberFromString(trimmed, 'US');
  if (!parsed?.isValid()) return null;
  return parsed.number;
}

/** US-first display format for picker metadata, e.g. `(419) 708-4470`. */
export function formatCustomerPhoneDisplay(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;

  const parsed = parsePhoneNumberFromString(trimmed, 'US');
  if (parsed?.isValid()) {
    return parsed.formatNational();
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    const local = digits.slice(1);
    return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  }

  return trimmed;
}

export function isValidCustomerPhone(value: string | null | undefined): boolean {
  return normalizePhoneE164(value) != null;
}

export function normalizeCustomerEmail(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/i;
  if (!emailPattern.test(trimmed)) return null;
  return trimmed.toLocaleLowerCase();
}

export function isValidCustomerEmail(value: string | null | undefined): boolean {
  return normalizeCustomerEmail(value) != null;
}

export function isMeaningfulServiceAddress(value: string | null | undefined): boolean {
  const trimmed = (value ?? '').trim();
  if (trimmed.length < 5) return false;
  const letters = trimmed.match(/[A-Za-z\u00C0-\u024F]/g);
  return (letters?.length ?? 0) >= 2;
}

export function isCustomerEligible(
  name: string,
  phone: string | null | undefined,
  email: string | null | undefined,
  address: string | null | undefined,
): boolean {
  return (
    name.trim().length > 0 &&
    (isValidCustomerPhone(phone) ||
      isValidCustomerEmail(email) ||
      isMeaningfulServiceAddress(address))
  );
}
