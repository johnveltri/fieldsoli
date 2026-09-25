import { describe, expect, it, vi } from 'vitest';

import {
  buildJobExportCsv,
  buildJobExportEmail,
  JOB_EXPORT_HEADERS,
  type JobExportRow,
} from './job-export-content';

function row(overrides: Partial<JobExportRow> = {}): JobExportRow {
  return {
    job_id: '00000000-0000-4000-8000-000000000001',
    job_description: 'Repair sink',
    long_description: null,
    customer_name: 'José',
    customer_phone: '+13125550198',
    customer_email: 'jose@example.com',
    service_address: '1 Main St',
    work_status: 'completed',
    payment_status: 'paid',
    created_at: '2026-01-01T01:00:00.000Z',
    last_worked_at: '2026-06-01T01:00:00.000Z',
    completed_at: '2026-06-02T01:00:00.000Z',
    paid_at: '2026-06-03T01:00:00.000Z',
    revenue_cents: 1000,
    material_cost: 100,
    helper_labor_cost: 200,
    equipment_rental_cost: 300,
    permit_cost: 400,
    disposal_cost: 500,
    travel_parking_cost: 0,
    other_cost: 0,
    ...overrides,
  };
}

describe('Job Summary CSV contract', () => {
  it('emits the exact 23 columns, BOM, CRLF, nulls, costs, and formula protection', async () => {
    const fetchPage = vi.fn().mockResolvedValueOnce([row({
      job_description: '=SUM(1,1)\n"quoted"',
      long_description: '@cmd injection',
      service_address: '+1 Main St',
      paid_at: null,
    })]);

    const bytes = await buildJobExportCsv('America/Chicago', fetchPage);
    const text = new TextDecoder().decode(bytes);
    expect(JOB_EXPORT_HEADERS).toEqual([
      'job_id', 'job_description', 'long_description', 'customer_name', 'customer_phone', 'customer_email',
      'service_address', 'work_status', 'payment_status', 'created_date', 'last_worked_date', 'completed_date',
      'paid_date', 'revenue', 'material_cost', 'helper_labor_cost', 'equipment_rental_cost', 'permit_cost',
      'disposal_cost', 'travel_parking_cost', 'other_cost', 'total_costs', 'net_earnings',
    ]);
    expect(text).toContain('"\'+13125550198"');
    expect(text).toContain('"jose@example.com"');
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(text.startsWith(`${JOB_EXPORT_HEADERS.join(',')}\r\n`)).toBe(true);
    expect(text.replaceAll('\r\n', '')).not.toContain('\n');
    expect(text).toContain('"\'=SUM(1,1)\r\n""quoted"""');
    expect(text).toContain('"\'@cmd injection"');
    expect(text).toContain('"\'+1 Main St"');
    expect(text).toContain('"José"');
    expect(text).toContain('"15.00","-5.00"');
    expect(text).toContain('"paid","2025-12-31","2026-05-31","2026-06-01",""');
  });

  it('paginates beyond 1,000 rows with the prior page cursor', async () => {
    const rows = Array.from({ length: 1001 }, (_, index) => row({
      job_id: String(index + 1).padStart(36, '0'),
      created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
      completed_at: new Date(Date.UTC(2026, 6, 1, 0, 0, index)).toISOString(),
    }));
    const fetchPage = vi.fn()
      .mockResolvedValueOnce(rows.slice(0, 500))
      .mockResolvedValueOnce(rows.slice(500, 1000))
      .mockResolvedValueOnce(rows.slice(1000));

    const text = new TextDecoder().decode(await buildJobExportCsv('UTC', fetchPage));
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage.mock.calls[1][0]).toMatchObject({
      beforeId: rows[499].job_id,
      beforeCompletedAt: rows[499].completed_at,
      beforeCreatedAt: rows[499].created_at,
      limit: 500,
    });
    expect(text.split('\r\n')).toHaveLength(1003);
  });
});

describe('Job Summary email contract', () => {
  it('keeps the HTML and text versions aligned and starts text with the brand', () => {
    const email = buildJobExportEmail({
      reportingYear: 2026,
      reportingTimeZone: 'America/Chicago',
      downloadUrl: 'https://fieldsoli.com/exports/download#token=v1.example',
      expiresAt: '2026-08-30T18:30:00.000Z',
    });

    expect(email.text.startsWith('FieldSoli\n\nYour job export is ready')).toBe(true);
    for (const phrase of [
      'Your 2026 FieldSoli job summary CSV is ready to download.',
      'Anyone with this link can download the CSV until it expires.',
      'The file may contain customer names, phone numbers, email addresses, service addresses, job descriptions, and financial information.',
      'If you did not request this export, do not download it.',
      'support@fieldsoli.com',
      'August 30, 2026 at 1:30 PM CDT (America/Chicago)',
    ]) {
      expect(email.text).toContain(phrase);
      expect(email.html).toContain(phrase);
    }
  });
});
