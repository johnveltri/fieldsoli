export const JOB_EXPORT_HEADERS = [
  'job_id', 'job_description', 'long_description', 'customer_name', 'customer_phone', 'customer_email', 'service_address', 'work_status', 'payment_status',
  'created_date', 'last_worked_date', 'completed_date', 'paid_date', 'revenue', 'material_cost',
  'helper_labor_cost', 'equipment_rental_cost', 'permit_cost', 'disposal_cost', 'travel_parking_cost',
  'other_cost', 'total_costs', 'net_earnings',
] as const;

export type JobExportRow = {
  job_id: string;
  job_description: string;
  long_description: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  service_address: string | null;
  work_status: string;
  payment_status: string | null;
  created_at: string;
  last_worked_at: string | null;
  completed_at: string;
  paid_at: string | null;
  revenue_cents: number | null;
  material_cost: number;
  helper_labor_cost: number;
  equipment_rental_cost: number;
  permit_cost: number;
  disposal_cost: number;
  travel_parking_cost: number;
  other_cost: number;
};

export type JobExportPageCursor = {
  beforeCompletedAt: string | null;
  beforeCreatedAt: string | null;
  beforeId: string | null;
  limit: number;
};

export function csvText(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = String(value).replace(/\r\n|\r|\n/g, '\r\n');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function money(cents: number | string | null | undefined): string {
  if (cents === null || cents === undefined) return '';
  return (Number(cents) / 100).toFixed(2);
}

export function dateInZone(value: string | null | undefined, timeZone: string): string {
  if (!value) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function expirationInZone(value: string, timeZone: string): string {
  const date = new Date(value);
  const datePart = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
  const timeParts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).formatToParts(date);
  const time = timeParts
    .filter((part) => ['hour', 'literal', 'minute', 'dayPeriod', 'timeZoneName'].includes(part.type))
    .map((part) => part.value)
    .join('')
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/\s+(?=[A-Z]{2,5}$)/, ' ');
  return `${datePart} at ${time} (${timeZone})`;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function jobExportRowToCsv(row: JobExportRow, timeZone: string): string {
  const costs = [
    row.material_cost,
    row.helper_labor_cost,
    row.equipment_rental_cost,
    row.permit_cost,
    row.disposal_cost,
    row.travel_parking_cost,
    row.other_cost,
  ].map(Number);
  const total = costs.reduce((sum, value) => sum + value, 0);
  const paidDate = row.payment_status === 'paid' ? dateInZone(row.paid_at, timeZone) : '';
  const cells = [
    row.job_id,
    row.job_description,
    row.long_description,
    row.customer_name,
    row.customer_phone,
    row.customer_email,
    row.service_address,
    row.work_status,
    row.payment_status,
    dateInZone(row.created_at, timeZone),
    dateInZone(row.last_worked_at, timeZone),
    dateInZone(row.completed_at, timeZone),
    paidDate,
    row.revenue_cents === null ? '' : money(row.revenue_cents),
    ...costs.map(money),
    money(total),
    row.revenue_cents === null ? '' : money(Number(row.revenue_cents) - total),
  ];

  return cells.map((cell, index) => {
    // Only free-form, user-supplied fields need spreadsheet-formula protection.
    if ([1, 2, 3, 4, 5, 6].includes(index)) return csvText(cell);
    const text = String(cell ?? '');
    return `"${text.replaceAll('"', '""')}"`;
  }).join(',');
}

export async function buildJobExportCsv(
  timeZone: string,
  fetchPage: (cursor: JobExportPageCursor) => Promise<JobExportRow[]>,
  pageSize = 500,
): Promise<Uint8Array> {
  let beforeCompletedAt: string | null = null;
  let beforeCreatedAt: string | null = null;
  let beforeId: string | null = null;
  let csv = `\ufeff${JOB_EXPORT_HEADERS.join(',')}\r\n`;

  while (true) {
    const rows = await fetchPage({
      beforeCompletedAt,
      beforeCreatedAt,
      beforeId,
      limit: pageSize,
    });
    for (const row of rows) csv += `${jobExportRowToCsv(row, timeZone)}\r\n`;
    if (rows.length < pageSize) break;
    const last = rows.at(-1)!;
    beforeCompletedAt = last.completed_at;
    beforeCreatedAt = last.created_at;
    beforeId = last.job_id;
  }

  return new TextEncoder().encode(csv);
}

export function buildJobExportEmail(input: {
  reportingYear: number;
  reportingTimeZone: string;
  downloadUrl: string;
  expiresAt: string;
}) {
  const year = String(input.reportingYear);
  const safeUrl = escapeHtml(input.downloadUrl);
  const expiration = expirationInZone(input.expiresAt, input.reportingTimeZone);
  const text = [
    'FieldSoli', '',
    'Your job export is ready', '',
    `Your ${year} FieldSoli job summary CSV is ready to download.`, '',
    `Download CSV: ${input.downloadUrl}`, '',
    `This link expires on ${expiration}.`, '',
    'Anyone with this link can download the CSV until it expires. Do not forward or share it.',
    'The file may contain customer names, phone numbers, email addresses, service addresses, job descriptions, and financial information. Store it securely.', '',
    'If the button does not work, copy and paste this link into your browser:', input.downloadUrl, '',
    'If you did not request this export, do not download it. Contact support@fieldsoli.com.', '',
    'FieldSoli · support@fieldsoli.com',
  ].join('\n');
  const preview = `Download your ${year} job summary CSV before the secure link expires.`;
  const html = `<!doctype html><html><body style="margin:0;background:#f6f7f8;font-family:Arial,sans-serif;color:#18212b"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preview)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border-radius:12px"><tr><td style="padding:32px"><p style="margin:0 0 24px;font-weight:700;font-size:20px">FieldSoli</p><h1 style="margin:0 0 16px;font-size:26px">Your job export is ready</h1><p style="line-height:1.5">Your ${year} FieldSoli job summary CSV is ready to download.</p><p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;background:#18212b;color:#fff;padding:13px 20px;border-radius:7px;text-decoration:none;font-weight:700">Download CSV</a></p><p style="line-height:1.5">This link expires on ${escapeHtml(expiration)}.</p><p style="line-height:1.5">Anyone with this link can download the CSV until it expires. Do not forward or share it.</p><p style="line-height:1.5">The file may contain customer names, phone numbers, email addresses, service addresses, job descriptions, and financial information. Store it securely.</p><p style="line-height:1.5">If the button does not work, copy and paste this link into your browser:</p><p style="word-break:break-all;line-height:1.5"><a href="${safeUrl}">${safeUrl}</a></p><p style="line-height:1.5">If you did not request this export, do not download it. Contact <a href="mailto:support@fieldsoli.com">support@fieldsoli.com</a>.</p><p style="margin:28px 0 0;color:#667085;font-size:13px">FieldSoli · support@fieldsoli.com</p></td></tr></table></td></tr></table></body></html>`;
  return { html, text };
}
