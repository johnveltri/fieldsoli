import { useCallback, useEffect, useRef, useState } from 'react';

import {
  fetchAddressSuggestions,
  type AddressSuggestion,
} from '@fieldsolo/api-client';
import type { FieldSoloSupabaseClient } from '@fieldsolo/api-client';

const DEBOUNCE_MS = 300;

function meetsAddressThreshold(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 5) return false;
  const letters = trimmed.match(/[A-Za-z]/g);
  return (letters?.length ?? 0) >= 2;
}

export function useAddressAutocomplete(
  client: FieldSoloSupabaseClient,
  query: string,
  enabled: boolean,
) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [noMatches, setNoMatches] = useState(false);
  const requestIdRef = useRef(0);

  const runLookup = useCallback(
    async (text: string, requestId: number) => {
      setLoading(true);
      setUnavailable(false);
      setNoMatches(false);
      const result = await fetchAddressSuggestions(client, text, { countryCode: 'us', limit: 5 });
      if (requestId !== requestIdRef.current) return;
      setLoading(false);
      if (result.status === 'error') {
        setSuggestions([]);
        setUnavailable(true);
        return;
      }
      setSuggestions(result.suggestions);
      setNoMatches(result.suggestions.length === 0);
    },
    [client],
  );

  useEffect(() => {
    if (!enabled || !meetsAddressThreshold(query)) {
      setSuggestions([]);
      setLoading(false);
      setUnavailable(false);
      setNoMatches(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    const timer = setTimeout(() => {
      void runLookup(query.trim(), requestId);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [enabled, query, runLookup]);

  return { suggestions, loading, unavailable, noMatches, meetsThreshold: meetsAddressThreshold(query) };
}
