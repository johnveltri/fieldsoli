export type CustomerDraft = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerId: string | null;
  serviceAddress: string;
};

export type CustomerSurface = 'job_edit' | 'live_session';

export function emptyCustomerDraft(): CustomerDraft {
  return {
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    customerId: null,
    serviceAddress: '',
  };
}

function field(value: string | null | undefined): string {
  return (value ?? '').trim();
}

export function hasCustomerContactData(draft: CustomerDraft): boolean {
  return (
    field(draft.customerName).length > 0 ||
    field(draft.customerPhone).length > 0 ||
    field(draft.customerEmail).length > 0 ||
    field(draft.serviceAddress).length > 0
  );
}

/** Avoid remounting the customer input mid-search when only the name draft is non-empty. */
export function isCustomerContactSwipeable(
  draft: CustomerDraft,
  customerFocused: boolean,
): boolean {
  if (draft.customerId != null) return true;
  if (field(draft.customerPhone).length > 0) return true;
  if (field(draft.customerEmail).length > 0) return true;
  if (field(draft.serviceAddress).length > 0) return true;
  return field(draft.customerName).length > 0 && !customerFocused;
}
