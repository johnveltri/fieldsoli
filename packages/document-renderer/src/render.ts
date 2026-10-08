import { OTHER_COST_LABELS, type OtherCostCategory } from './pricing';

export const RENDERER_VERSION = 1;

export type DocumentType = 'estimate' | 'invoice';
export type PaymentTerms = 'due_on_receipt' | 'net_7' | 'net_15' | 'net_30';

export type DocumentLine = {
  kind: 'labor' | 'materials' | 'other';
  label: string;
  amountCents: number;
  category?: OtherCostCategory;
};

export type DocumentPayload = {
  schemaVersion: 1;
  documentType: DocumentType;
  documentNumber: number | null;
  businessName: string;
  businessAddress: string | null;
  businessPhone: string | null;
  businessEmail: string | null;
  businessWebsite: string | null;
  businessLicense: string | null;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  serviceAddress: string | null;
  shortDescription: string;
  longDescription: string | null;
  lines: DocumentLine[];
  subtotalCents: number;
  taxRateBps: number;
  taxCents: number;
  totalCents: number;
  currency: 'USD';
  issueDate: string;
  validUntil: string | null;
  dueDate: string | null;
  paymentTerms: PaymentTerms | null;
};

export type PaymentProjection = 'paid' | 'unpaid' | null;
export type PreviewFontData = { body: string; bodyBold: string };

const PAYMENT_TERMS_LABEL: Record<PaymentTerms, string> = {
  due_on_receipt: 'Due upon receipt',
  net_7: 'Net 7',
  net_15: 'Net 15',
  net_30: 'Net 30',
};

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function formatUsd(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  return `${sign}$${dollars.toLocaleString('en-US')}.${String(remainder).padStart(2, '0')}`;
}

export function formatDocumentNumber(value: number | null): string {
  if (value == null) return 'Number assigned on creation';
  return String(value).padStart(5, '0');
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map((part) => Number(part));
  if (!year || !month || !day) return isoDate;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function textBlock(label: string, value: string | null | undefined): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return '';
  return `<p class="meta"><span>${escapeHtml(label)}</span> ${escapeHtml(trimmed)}</p>`;
}

const CSS = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: #000; }
body { font-family: Georgia, "Times New Roman", serif; font-size: 16px; line-height: 1.45; }
.page { max-width: 816px; margin: 0 auto; padding: 24px 20px 48px; }
h1, h2, p { margin: 0; }
h1 { font-size: 28px; line-height: 1.2; font-weight: 700; }
h2 { font-size: 20px; line-height: 1.3; margin-top: 28px; }
.kicker { letter-spacing: 0.04em; text-transform: uppercase; font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
.identity, .customer, .summary { margin-top: 20px; }
.meta { margin-top: 4px; }
.meta span { font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
.summary p { white-space: pre-wrap; margin-top: 8px; }
table { width: 100%; border-collapse: collapse; margin-top: 20px; }
th, td { text-align: left; vertical-align: top; padding: 8px 0; border-bottom: 1px solid #000; }
th { font-family: ui-monospace, Menlo, monospace; font-size: 12px; font-weight: 600; }
td.amount, th.amount { text-align: right; white-space: nowrap; }
.totals { margin-top: 12px; }
.totals div { display: flex; justify-content: space-between; gap: 16px; padding: 6px 0; }
.totals .final { border-top: 2px solid #000; font-weight: 700; margin-top: 4px; padding-top: 10px; }
.badge { display: inline-block; border: 1px solid #000; padding: 2px 8px; font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
@media print {
  .page { max-width: none; padding: 0; }
  thead { display: table-header-group; }
  tr, .totals .final { break-inside: avoid; }
  @page { size: letter; margin: 0.5in; }
}
`.trim();

export function renderDocument(
  version: number,
  payload: DocumentPayload,
  paymentProjection: PaymentProjection,
): string {
  if (version !== RENDERER_VERSION) {
    throw new Error('unsupported_renderer_version');
  }
  const typeLabel = payload.documentType === 'estimate' ? 'Estimate' : 'Invoice';
  const numberLabel = `${typeLabel} #${formatDocumentNumber(payload.documentNumber)}`;
  const paid = payload.documentType === 'invoice' && paymentProjection === 'paid';
  const finalLabel =
    payload.documentType === 'estimate' ? 'Total' : paid ? 'Total' : 'Amount Due';
  const status =
    payload.documentType === 'invoice'
      ? `<p class="badge">${paid ? 'Paid' : 'Unpaid'}</p>`
      : '';
  const lines = payload.lines
    .map(
      (line) =>
        `<tr><td>${escapeHtml(line.label)}</td><td class="amount">${escapeHtml(formatUsd(line.amountCents))}</td></tr>`,
    )
    .join('');
  const identity = [
    textBlock('Address', payload.businessAddress),
    textBlock('Phone', payload.businessPhone),
    textBlock('Email', payload.businessEmail),
    textBlock('Website', payload.businessWebsite),
    textBlock('License', payload.businessLicense),
  ].join('');
  const customer = [
    payload.customerName.trim()
      ? `<p>${escapeHtml(payload.customerName.trim())}</p>`
      : '',
    textBlock('Phone', payload.customerPhone),
    textBlock('Email', payload.customerEmail),
    textBlock('Service address', payload.serviceAddress),
  ].join('');
  const longDescription = payload.longDescription?.trim()
    ? `<p>${escapeHtml(payload.longDescription)}</p>`
    : '';
  const dateRow =
    payload.documentType === 'estimate'
      ? `<div><span>Estimate date</span><span>${escapeHtml(formatDate(payload.issueDate))}</span></div>${
          payload.validUntil
            ? `<div><span>Valid until</span><span>${escapeHtml(formatDate(payload.validUntil))}</span></div>`
            : ''
        }`
      : `<div><span>Invoice date</span><span>${escapeHtml(formatDate(payload.issueDate))}</span></div>${
          payload.dueDate
            ? `<div><span>Due date</span><span>${escapeHtml(formatDate(payload.dueDate))}</span></div>`
            : ''
        }${
          payload.paymentTerms
            ? `<div><span>Payment terms</span><span>${escapeHtml(PAYMENT_TERMS_LABEL[payload.paymentTerms])}</span></div>`
            : ''
        }`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(numberLabel)}</title>
<style>${CSS}</style>
</head>
<body>
<article class="page">
<p class="kicker">${escapeHtml(typeLabel)}</p>
<h1>${escapeHtml(payload.documentNumber == null ? typeLabel : numberLabel)}</h1>
${status}
<section class="identity">
<h2>${escapeHtml(payload.businessName.trim() || 'Business')}</h2>
${identity}
</section>
<section class="customer">
<h2>Customer</h2>
${customer}
</section>
<section class="summary">
<h2>${escapeHtml(payload.shortDescription)}</h2>
${longDescription}
</section>
<table>
<thead><tr><th>Description</th><th class="amount">Amount</th></tr></thead>
<tbody>${lines}</tbody>
</table>
<section class="totals">
${dateRow}
<div><span>Subtotal</span><span>${escapeHtml(formatUsd(payload.subtotalCents))}</span></div>
<div><span>Tax</span><span>${escapeHtml(formatUsd(payload.taxCents))}</span></div>
<div class="final"><span>${escapeHtml(finalLabel)}</span><span>${escapeHtml(formatUsd(payload.totalCents))}</span></div>
</section>
</article>
</body>
</html>`;
}

/** Presentation used only by the in-app WebView; saved document rendering stays versioned. */
export function renderDocumentPreview(
  version: number,
  payload: DocumentPayload,
  paymentProjection: PaymentProjection,
  fonts?: PreviewFontData,
): string {
  if (version !== RENDERER_VERSION)
    throw new Error("unsupported_renderer_version");
  const estimate = payload.documentType === "estimate";
  const paid = !estimate && paymentProjection === "paid";
  const title = `${estimate ? "Estimate" : "Invoice"}${payload.documentNumber == null ? "" : ` #${formatDocumentNumber(payload.documentNumber)}`}`;
  const finalLabel = estimate || paid ? "Total" : "Amount Due";
  const detail = (value: string | null) =>
    value?.trim() ? `<p>${escapeHtml(value.trim())}</p>` : "";
  const row = (label: string, value: string) =>
    `<div class="summary-row"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`;
  const notes = payload.longDescription?.trim()
    ? `<section class="notes"><h2>Client notes</h2><p>${escapeHtml(payload.longDescription)}</p></section>`
    : "";
  const fontFaces = fonts
    ? `@font-face { font-family: FieldSoliUbuntu; src: url(data:font/ttf;base64,${fonts.body}) format("truetype"); }\n@font-face { font-family: FieldSoliUbuntuMedium; src: url(data:font/ttf;base64,${fonts.bodyBold}) format("truetype"); }`
    : "";
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title><style>
${fontFaces}
:root {
  color-scheme: light;
  --table-header-background: #333;
  --font-body: ${fonts ? "FieldSoliUbuntu" : '"Ubuntu_400Regular", sans-serif'};
  --font-bold: ${fonts ? "FieldSoliUbuntuMedium" : '"Ubuntu_500Medium", sans-serif'};
}
* { box-sizing: border-box; }
html, body { margin: 0; background: #fff; color: #111; }
body { font-family: var(--font-body); font-size: 14px; line-height: 1.4; }
.page { max-width: 816px; margin: auto; padding: 28px 20px 36px; }
h1, h2, p { margin: 0; }
h1, h2, th { font-weight: normal; }
p { overflow-wrap: anywhere; }
.header { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 24px; align-items: start; }
.business h1 { font-family: var(--font-bold); font-size: 18px; font-weight: normal; line-height: 1.4; margin-bottom: 10px; }
.business p, .recipient p { margin-top: 2px; white-space: pre-wrap; }
.recipient { margin-top: 24px; }
h2 { font-family: var(--font-body); font-size: 14px; font-weight: normal; line-height: 1.4; margin-bottom: 7px; }
.recipient .name { font-family: var(--font-bold); font-size: 18px; line-height: 1.4; margin-bottom: 4px; }
.document-summary { background: #f3f3f3; }
.document-title { background: var(--table-header-background); color: #fff; padding: 10px 12px; }
.document-title h2 { font-family: var(--font-bold); font-size: 18px; font-weight: normal; line-height: 1.4; margin: 0; overflow-wrap: anywhere; }
.document-title p { font-size: 14px; line-height: 1.4; margin-top: 3px; }
.summary-row { display: flex; justify-content: space-between; gap: 16px; padding: 7px 12px; }
.summary-row span:last-child { text-align: right; overflow-wrap: anywhere; min-width: 0; }
.document-summary .summary-row { font-size: 14px; line-height: 1.4; }
.document-summary .summary-row span:first-child { flex-shrink: 0; }
.summary-total { background: var(--table-header-background); color: #fff; font-family: var(--font-bold); font-size: 18px; line-height: 1.4; }
.services { margin-top: 30px; }
.services h2 { font-family: var(--font-bold); font-size: 18px; font-weight: normal; line-height: 1.4; margin-bottom: 12px; overflow-wrap: anywhere; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th { background: var(--table-header-background); color: #fff; font-family: var(--font-body); font-size: 14px; font-weight: normal; line-height: 1.4; }
th, td { padding: 11px 10px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
td { border-bottom: 1px solid #ddd; }
.amount { width: 36%; text-align: right; font-variant-numeric: tabular-nums; }
.footer { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 24px; margin-top: 24px; align-items: start; }
.notes { padding-top: 8px; }
.notes p { white-space: pre-wrap; }
.totals { grid-column: 2; }
.totals .summary-row { padding: 8px 0; border-bottom: 1px solid #e5e5e5; }
.totals .final { font-family: var(--font-bold); font-size: 18px; line-height: 1.4; border-top: 2px solid #333; border-bottom: 0; margin-top: 3px; padding-top: 12px; }
@media (max-width: 540px) {
  .page { padding: 22px 18px 30px; }
  .header { grid-template-columns: minmax(0, 1fr); gap: 22px; }
  .recipient { margin-top: 18px; }
  .document-summary { width: 100%; }
  .footer { display: flex; flex-direction: column-reverse; gap: 24px; }
  .totals { width: 100%; }
  .notes { width: 100%; }
}
</style></head><body><article class="page">
<header class="header"><div>
<section class="business"><h1>${escapeHtml(payload.businessName.trim() || "Business")}</h1>
${detail(payload.businessAddress)}${detail(payload.businessPhone)}${detail(payload.businessEmail)}${detail(payload.businessWebsite)}${payload.businessLicense?.trim() ? detail(`License # ${payload.businessLicense.trim()}`) : ""}
</section>
<section class="recipient"><h2>Recipient</h2>${payload.customerName.trim() ? `<p class="name">${escapeHtml(payload.customerName.trim())}</p>` : ""}
${detail(payload.serviceAddress)}${detail(payload.customerPhone)}${detail(payload.customerEmail)}</section>
</div><section class="document-summary" aria-label="Document summary">
<div class="document-title"><h2>${escapeHtml(title)}</h2>${payload.documentNumber == null ? "<p>Number assigned on creation</p>" : ""}${!estimate ? `<p>${paid ? "Paid" : "Unpaid"}</p>` : ""}</div>
${row("Issued", formatDate(payload.issueDate))}
${estimate ? (payload.validUntil ? row("Valid until", formatDate(payload.validUntil)) : "") : payload.dueDate ? row("Due", formatDate(payload.dueDate)) : ""}
${!estimate && payload.paymentTerms ? row("Terms", PAYMENT_TERMS_LABEL[payload.paymentTerms]) : ""}
<div class="summary-row summary-total"><span>${finalLabel}</span><span>${formatUsd(payload.totalCents)}</span></div>
</section></header>
<section class="services"><h2>${escapeHtml(payload.shortDescription)}</h2>
<table aria-label="Services and charges"><thead><tr><th scope="col">Product / Service</th><th scope="col" class="amount">Total</th></tr></thead><tbody>
${payload.lines.map((line) => `<tr><td>${escapeHtml(line.label)}</td><td class="amount">${formatUsd(line.amountCents)}</td></tr>`).join("")}
</tbody></table></section>
<div class="footer">${notes}<section class="totals" aria-label="Totals">
${row("Subtotal", formatUsd(payload.subtotalCents))}${row("Tax", formatUsd(payload.taxCents))}
<div class="summary-row final"><span>${finalLabel}</span><span>${formatUsd(payload.totalCents)}</span></div>
</section></div>
</article></body></html>`;
}

export function unsupportedRendererHtml(): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><title>Update required</title></head><body><article class="page"><h1>Update required</h1><p>This document was saved with a newer FieldSoli version. Update the app to view it.</p></article></body></html>`;
}

export function documentLineLabels(): typeof OTHER_COST_LABELS {
  return OTHER_COST_LABELS;
}
