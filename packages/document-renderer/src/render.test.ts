import { describe, expect, it } from 'vitest';

import { escapeHtml, formatDocumentNumber, renderDocument, type DocumentPayload } from './render';

const payload: DocumentPayload = {
  schemaVersion: 1,
  documentType: 'invoice',
  documentNumber: 1,
  businessName: 'North & Co',
  businessAddress: null,
  businessPhone: null,
  businessEmail: null,
  businessWebsite: null,
  businessLicense: null,
  customerName: 'Pat <script>',
  customerPhone: null,
  customerEmail: null,
  serviceAddress: '1 Main St',
  shortDescription: 'Replace the valve',
  longDescription: 'Line one\nLine two & café',
  lines: [
    { kind: 'labor', label: 'Labor & Services', amountCents: 40000 },
    { kind: 'materials', label: 'Materials', amountCents: 12000 },
    { kind: 'other', label: 'Disposal', amountCents: 5000, category: 'disposal' },
  ],
  subtotalCents: 57000,
  taxRateBps: 1000,
  taxCents: 5700,
  totalCents: 62700,
  currency: 'USD',
  issueDate: '2026-10-06',
  validUntil: null,
  dueDate: '2026-10-06',
  paymentTerms: 'due_on_receipt',
};

describe('renderDocument', () => {
  it('escapes text and uses one HTML document for unpaid invoices', () => {
    const html = renderDocument(1, payload, 'unpaid');
    expect(html).toContain('Invoice #00001');
    expect(html).toContain('Amount Due');
    expect(html).toContain('Unpaid');
    expect(html).toContain('Pat &lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('Line one\nLine two &amp; café');
    expect(html).toContain('@page { size: letter; margin: 0.5in; }');
    expect(html).toContain('max-width: 816px');
  });

  it('labels a paid invoice Total without changing the amount', () => {
    const html = renderDocument(1, payload, 'paid');
    expect(html).toContain('>Total<');
    expect(html).toContain('$627.00');
    expect(html).toContain('Paid');
    expect(html).not.toContain('Amount Due');
  });

  it('pads document numbers to five digits and escapes independently', () => {
    expect(formatDocumentNumber(12)).toBe('00012');
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });
});
