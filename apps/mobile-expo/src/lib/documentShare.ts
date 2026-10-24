import { normalizePhoneE164 } from '@fieldsolo/api-client';
import { formatUsdCombined } from './formatUsd';

export function documentNumberLabel(type: 'estimate' | 'invoice', number: number): string {
  const title = type === 'estimate' ? 'Estimate' : 'Invoice';
  return `${title} #${String(number).padStart(5, '0')}`;
}

export function documentLinkText(input: {
  type: 'estimate' | 'invoice';
  totalCents: number;
  businessName: string;
  url: string;
}): string {
  const title = input.type === 'estimate' ? 'Estimate' : 'Invoice';
  return `${title} for ${formatUsdCombined(input.totalCents)} from ${input.businessName}\n${input.url}`;
}

export function gmailSubject(input: {
  type: 'estimate' | 'invoice';
  number: number;
  businessName: string;
}): string {
  return `${documentNumberLabel(input.type, input.number)} from ${input.businessName}`;
}

export function mailtoUrl(input: {
  email: string | null;
  subject: string;
  body: string;
}): string {
  const recipient = input.email?.trim()
    ? encodeURIComponent(input.email.trim()).replace(/%40/gi, '@')
    : '';
  const params = new URLSearchParams({ subject: input.subject, body: input.body })
    .toString()
    .replace(/\+/g, '%20');
  return `mailto:${recipient}?${params}`;
}

export function whatsAppUrl(phone: string | null, text: string): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  const query = `text=${encodeURIComponent(text)}`;
  if (digits.length < 8) return `https://wa.me/?${query}`;
  return `https://wa.me/${digits}?${query}`;
}

export function gmailUrl(input: { email: string | null; subject: string; body: string }): string {
  const params = new URLSearchParams({ subject: input.subject, body: input.body });
  if (input.email && input.email.includes('@')) params.set('to', input.email);
  return `googlegmail://co?${params.toString()}`;
}

export function smsUrl(phone: string | null, body: string): string {
  const address = documentSmsRecipient(phone) ?? '';
  return `sms:${address}?body=${encodeURIComponent(body)}`;
}

export function pdfFileName(
  type: 'estimate' | 'invoice',
  number: number,
  businessName?: string | null,
): string {
  const title = type === 'estimate' ? 'Estimate' : 'Invoice';
  const base = String(number).padStart(5, '0');
  const safeBusinessName = businessName
    ?.trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .slice(0, 80);
  return safeBusinessName
    ? `${safeBusinessName} - ${title} ${base}.pdf`
    : `${title}-${base}.pdf`;
}

export function defaultDocumentType(workStatus: string): 'estimate' | 'invoice' {
  return workStatus === 'completed' || workStatus === 'paid' ? 'invoice' : 'estimate';
}

const GAP_LABELS: Record<string, string> = {
  business_name: 'Business name',
  customer_name: 'Customer name',
  short_description: 'Job summary',
  labor: 'Labor & Services',
  material_amount: 'Material amount',
  billable_other: 'Billable other cost',
  job: 'Job',
};

export function gapLabels(gaps: string[]): string[] {
  return gaps.map((gap) => GAP_LABELS[gap] ?? gap);
}

/** Names or malformed snapshot values must never become Messages recipients. */
export function documentSmsRecipient(phone: string | null): string | null {
  if (!phone || !/^\+?[\d\s().-]+$/.test(phone.trim())) return null;
  return normalizePhoneE164(phone);
}
