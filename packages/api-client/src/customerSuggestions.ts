import type { FieldSoloSupabaseClient } from './client';

export type CustomerSuggestion = {
  customerId: string;
  displayName: string;
  phone: string | null;
  email: string | null;
  serviceAddress: string | null;
};

function mapSuggestion(raw: Record<string, unknown>): CustomerSuggestion {
  return {
    customerId: String(raw.customerId ?? ''),
    displayName: String(raw.displayName ?? ''),
    phone: raw.phone == null ? null : String(raw.phone),
    email: raw.email == null ? null : String(raw.email),
    serviceAddress: raw.serviceAddress == null ? null : String(raw.serviceAddress),
  };
}

export async function listCustomerSuggestions(
  client: FieldSoloSupabaseClient,
  query = '',
): Promise<CustomerSuggestion[]> {
  const { data, error } = await client.rpc('list_customer_suggestions', {
    p_query: query,
  });
  if (error) throw error;
  if (!Array.isArray(data)) return [];
  return data.map((row) => mapSuggestion(row as Record<string, unknown>));
}
