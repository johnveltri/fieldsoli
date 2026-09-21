import { useCallback, useEffect, useRef, useState } from 'react';

import {
  ADDRESS_SUGGESTION_LIMIT,
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
  const [noResults, setNoResults] = useState(false);
  const requestIdRef = useRef(0);
  const rateLimitedRef = useRef(false);

  const runLookup = useCallback(
    async (text: string, requestId: number) => {
      // Always enter Searching before the request resolves so empty lookups
      // never jump straight to "No results".
      setLoading(true);
      setNoResults(false);
      setSuggestions([]);
      const lookup = await fetchAddressSuggestions(client, text, {
        countryCode: 'us',
        limit: ADDRESS_SUGGESTION_LIMIT,
      });
      if (requestId !== requestIdRef.current) return;

      setLoading(false);
      if (lookup.status === 'error') {
        if (lookup.code === 'rate_limited') rateLimitedRef.current = true;
        setSuggestions([]);
        setNoResults(false);
        return;
      }
      setSuggestions(lookup.suggestions);
      setNoResults(lookup.suggestions.length === 0);
    },
    [client],
  );

  useEffect(() => {
    if (!enabled) {
      requestIdRef.current += 1;
      rateLimitedRef.current = false;
      setSuggestions([]);
      setLoading(false);
      setNoResults(false);
      return;
    }

    if (!meetsAddressThreshold(query) || rateLimitedRef.current) {
      requestIdRef.current += 1;
      setSuggestions([]);
      setLoading(false);
      setNoResults(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    const timer = setTimeout(() => {
      void runLookup(query.trim(), requestId);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [enabled, query, runLookup]);

  return {
    suggestions,
    loading,
    noResults,
    showPanel: loading || suggestions.length > 0 || noResults,
    meetsThreshold: meetsAddressThreshold(query),
  };
}
