import { describe, expect, it } from '@jest/globals';

import {
  defaultDocumentType,
  documentLinkText,
  gapLabels,
  gmailSubject,
  mailtoUrl,
  pdfFileName,
  whatsAppUrl,
} from './documentShare';

describe('documentShare', () => {
  it('builds link text and filenames from the saved number', () => {
    expect(
      documentLinkText({
        type: 'estimate',
        number: 1,
        businessName: 'North & Co',
        url: 'https://fieldsoli.com/share/abc',
      }),
    ).toBe('Estimate #00001 from North & Co\nhttps://fieldsoli.com/share/abc');
    expect(gmailSubject({ type: 'invoice', number: 12, businessName: 'North' })).toBe(
      'Invoice #00012 from North',
    );
    expect(pdfFileName('invoice', 1)).toBe('Invoice-00001.pdf');
    expect(pdfFileName('invoice', 1, 'Best Business / LLC')).toBe(
      'Best Business LLC - Invoice 00001.pdf',
    );
    expect(mailtoUrl({
      email: 'blake@example.com',
      subject: 'Invoice #00001',
      body: 'Here is your invoice',
    })).toBe('mailto:blake@example.com?subject=Invoice%20%2300001&body=Here%20is%20your%20invoice');
    expect(mailtoUrl({
      email: null,
      subject: 'Estimate #00002',
      body: 'Review this estimate',
    })).toBe('mailto:?subject=Estimate%20%2300002&body=Review%20this%20estimate');
  });

  it('defaults completed work to Invoice and leaves a WhatsApp link without a short phone', () => {
    expect(defaultDocumentType('completed')).toBe('invoice');
    expect(defaultDocumentType('paid')).toBe('invoice');
    expect(defaultDocumentType('in_progress')).toBe('estimate');
    expect(whatsAppUrl('12', 'hello')).toBe('https://wa.me/?text=hello');
  });

  it('names readiness gaps', () => {
    expect(gapLabels(['business_name', 'labor'])).toEqual(['Business name', 'Labor & Services']);
  });
});
