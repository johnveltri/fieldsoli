import { describe, expect, it } from '@jest/globals';

import {
  defaultDocumentType,
  documentLinkText,
  gapLabels,
  gmailSubject,
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
