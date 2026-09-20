export type CustomerDraft = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerId: string | null;
  serviceAddress: string;
};

export type CustomerSurface = 'job_edit' | 'live_session';
