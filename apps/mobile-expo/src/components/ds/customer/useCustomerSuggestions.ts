import { useCallback, useEffect, useState } from 'react';

import { listCustomerSuggestions, type CustomerSuggestion } from '@fieldsolo/api-client';
import type { FieldSoloSupabaseClient } from '@fieldsolo/api-client';

export function useCustomerSuggestions(client: FieldSoloSupabaseClient) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [suggestions, setSuggestions] = useState<CustomerSuggestion[]>([]);

  const load = useCallback(
    async (query: string) => {
      setLoading(true);
      setError(false);
      try {
        const rows = await listCustomerSuggestions(client, query);
        setSuggestions(rows);
      } catch {
        setError(true);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    },
    [client],
  );

  useEffect(() => {
    void load('');
  }, [load]);

  return { suggestions, loading, error, reload: load };
}
