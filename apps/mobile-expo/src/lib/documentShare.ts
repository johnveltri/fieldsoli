export function documentNumberLabel(type: 'estimate' | 'invoice', number: number): string {
  const title = type === 'estimate' ? 'Estimate' : 'Invoice';
  return `${title} #${String(number).padStart(5, '0')}`;
}

export function documentLinkText(input: {
  type: 'estimate' | 'invoice';
  number: number;
  businessName: string;
  url: string;
}): string {
  return `${documentNumberLabel(input.type, input.number)} from ${input.businessName}\n${input.url}`;
}

export function gmailSubject(input: {
  type: 'estimate' | 'invoice';
  number: number;
  businessName: string;
}): string {
  return `${documentNumberLabel(input.type, input.number)} from ${input.businessName}`;
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
  const digits = (phone ?? '').replace(/[^\d+]/g, '');
  const address = digits.length >= 8 ? digits : '';
  return `sms:${address}?body=${encodeURIComponent(body)}`;
}

export function pdfFileName(type: 'estimate' | 'invoice', number: number): string {
  const title = type === 'estimate' ? 'Estimate' : 'Invoice';
  return `${title}-${String(number).padStart(5, '0')}.pdf`;
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
