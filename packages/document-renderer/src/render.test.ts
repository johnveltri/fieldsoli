import { describe, expect, it } from 'vitest';

import { escapeHtml, formatDocumentNumber, renderDocument, renderDocumentPreview, type DocumentPayload } from './render';

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
    expect(html).toContain('body { font-family: var(--font-body); font-size: 14px;');
    expect(html).toContain('class="document-summary"');
    expect(html).toContain('Product / Service');
    expect(html).not.toContain('(pending)');
    expect(html).toContain('max-width: 816px');
  });

  it('labels a paid invoice Total without changing the amount', () => {
    const html = renderDocument(1, payload, 'paid');
    expect(html).toContain('>Total<');
    expect(html).toContain('$627.00');
    expect(html).toContain('Paid');
    expect(html).not.toContain('Amount Due');
  });

  it('uses the preview layout and all line details for PDF, with desktop print columns', () => {
    const detailedPayload: DocumentPayload = {
      ...payload,
      lines: [
        { kind: 'materials', label: 'Screen door assembly', amountCents: 29250,
          details: { quantity: 1, unit: 'ea', unitPriceCents: 29250 } },
        { kind: 'other', label: 'Disposal', amountCents: 5000, description: 'Haul-away' },
      ],
    };
    const fonts = { body: 'regular', bodyBold: 'medium', label: 'bold', display: 'serif' };
    const pdf = renderDocument(1, detailedPayload, 'unpaid', fonts, 'pdf');
    const preview = renderDocumentPreview(1, detailedPayload, 'unpaid', fonts);
    const body = (html: string) => html.slice(html.indexOf('<article'));
    expect(body(pdf)).toBe(body(preview).replace('<span class="pending-label"> (pending)</span>', ''));
    expect(pdf).toContain('Screen door assembly');
    expect(pdf).toContain('1 ea @ $292.50');
    expect(pdf).toContain('Haul-away');
    expect(pdf).toContain('data:font/ttf;base64,regular');
    expect(pdf).toContain('@media screen, print');
    expect(pdf).toContain('.page { max-width: none; padding: 0; }');
    expect(pdf).not.toContain('(pending)');
  });

  it('pads document numbers to five digits and escapes independently', () => {
    expect(formatDocumentNumber(12)).toBe('00012');
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });
});

describe("renderDocumentPreview", () => {
  it("keeps client notes escaped and below the services table", () => {
    const html = renderDocumentPreview(1, payload, "unpaid");
    expect(html).toContain("Pat &lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("Line one\nLine two &amp; café");
    expect(html.indexOf("Client notes")).toBeGreaterThan(
      html.indexOf("</table>"),
    );
    expect(html).toContain("Amount Due");
    expect(html).toContain("$627.00");
  });

  it("handles an unnumbered estimate without invoice-only metadata or empty notes", () => {
    const html = renderDocumentPreview(
      1,
      {
        ...payload,
        documentType: "estimate",
        documentNumber: null,
        validUntil: "2026-11-06",
        longDescription: "  ",
      },
      null,
    );
    expect(html).toContain('<h2>Estimate</h2>');
    expect(html).not.toContain('Number assigned on creation');
    expect(html).toContain("Valid until");
    expect(html).not.toContain("Unpaid");
    expect(html).not.toContain("Amount Due");
    expect(html).not.toContain("Client notes");
    expect(html).not.toContain("Due upon receipt");
  });

  it("preserves paid totals and rejects unsupported versions", () => {
    const html = renderDocumentPreview(1, payload, "paid");
    expect(html).toContain("Paid");
    expect(html).not.toContain("Amount Due");
    expect(html).toContain("$627.00");
    expect(() => renderDocumentPreview(2, payload, null)).toThrow(
      "unsupported_renderer_version",
    );
  });
});
