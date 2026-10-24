import { describe, expect, it } from '@jest/globals';

import {
  defaultDocumentType,
  documentSmsRecipient,
  documentLinkText,
  gapLabels,
  gmailSubject,
  mailtoUrl,
  pdfFileName,
  whatsAppUrl,
} from './documentShare';

describe('documentShare', () => {
  it('builds amount-first link text and keeps document numbers in filenames and subjects', () => {
    expect(
      documentLinkText({
        type: 'estimate',
        totalCents: 123456,
        businessName: 'North & Co',
        url: 'https://fieldsoli.com/share/abc',
      }),
    ).toBe('Estimate for $1,234.56 from North & Co\nhttps://fieldsoli.com/share/abc');
    expect(gmailSubject({ type: 'invoice', number: 12, businessName: 'North' })).toBe(
      'Invoice #00012 from North',
    );
    expect(pdfFileName('invoice', 1, 0)).toBe('Invoice #00001 for $0.00.pdf');
    expect(pdfFileName('invoice', 1, 123456, 'Best Business / LLC')).toBe(
      'Invoice #00001 for $1,234.56 from Best Business LLC.pdf',
    );
    expect(pdfFileName('estimate', 12, 19300, 'Veltri Ventures')).toBe(
      'Estimate #00012 for $193.00 from Veltri Ventures.pdf',
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

it('only supplies a validated snapshot phone to Messages', () => {
  expect(documentSmsRecipient('(419) 708-4470')).toBe('+14197084470');
  expect(documentSmsRecipient('+44 20 7946 0958')).toBe('+442079460958');
  for (const value of [null, '', 'Buddy name', 'Buddy 4197084470', '12', '4197084470 ext 2']) {
    expect(documentSmsRecipient(value)).toBeNull();
  }
});
