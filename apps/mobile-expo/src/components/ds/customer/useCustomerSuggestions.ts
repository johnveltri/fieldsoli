import { useCallback, useEffect, useRef, useState } from 'react';

import { listCustomerSuggestions, type CustomerSuggestion } from '@fieldsolo/api-client';
import type { FieldSoloSupabaseClient } from '@fieldsolo/api-client';

/** If `exhaustedQuery` returned no rows, longer substrings cannot match either. */
export function shouldSkipCustomerSuggestionSearch(
  query: string,
  exhaustedQuery: string | null,
): boolean {
  const trimmed = query.trim();
  return Boolean(
    exhaustedQuery && trimmed.length > 0 && trimmed.startsWith(exhaustedQuery),
  );
}

export function clearsExhaustedCustomerSearch(
  query: string,
  exhaustedQuery: string | null,
): boolean {
  const trimmed = query.trim();
  if (trimmed.length === 0) return true;
  return exhaustedQuery != null && trimmed.length < exhaustedQuery.length;
}

/** Only show cached rows when they belong to the current recents/search query. */
export function visibleCustomerSuggestions(
  suggestions: CustomerSuggestion[],
  suggestionsQuery: string | null,
  query: string,
  loading: boolean,
): CustomerSuggestion[] {
  if (suggestionsQuery == null) return [];
  const trimmed = query.trim();
  if (suggestionsQuery === trimmed) return suggestions;
  if (
    loading &&
    trimmed.length > 0 &&
    suggestionsQuery.length > 0 &&
    trimmed.startsWith(suggestionsQuery)
  ) {
    return suggestions;
  }
  return [];
}

export function useCustomerSuggestions(client: FieldSoloSupabaseClient) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [suggestions, setSuggestions] = useState<CustomerSuggestion[]>([]);
  const [suggestionsQuery, setSuggestionsQuery] = useState<string | null>(null);
  const exhaustedQueryRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);
  const suggestionsQueryRef = useRef<string | null>(null);

  const load = useCallback(
    async (query: string) => {
      const trimmed = query.trim();

      if (clearsExhaustedCustomerSearch(trimmed, exhaustedQueryRef.current)) {
        exhaustedQueryRef.current = null;
      }

      if (shouldSkipCustomerSuggestionSearch(trimmed, exhaustedQueryRef.current)) {
        setSuggestions([]);
        suggestionsQueryRef.current = trimmed;
        setSuggestionsQuery(trimmed);
        setError(false);
        return;
      }

      const requestId = ++requestIdRef.current;
      const priorQuery = suggestionsQueryRef.current ?? '';
      if ((priorQuery === '') !== (trimmed === '')) {
        setSuggestions([]);
        suggestionsQueryRef.current = null;
        setSuggestionsQuery(null);
      }
      setLoading(true);
      setError(false);
      try {
        const rows = await listCustomerSuggestions(client, trimmed);
        if (requestId !== requestIdRef.current) return;
        setSuggestions(rows);
        suggestionsQueryRef.current = trimmed;
        setSuggestionsQuery(trimmed);
        if (trimmed.length > 0 && rows.length === 0) {
          exhaustedQueryRef.current = trimmed;
        } else if (rows.length > 0) {
          exhaustedQueryRef.current = null;
        }
      } catch {
        if (requestId !== requestIdRef.current) return;
        setError(true);
        setSuggestions([]);
        suggestionsQueryRef.current = null;
        setSuggestionsQuery(null);
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [client],
  );

  useEffect(() => {
    void load('');
  }, [load]);

  return { suggestions, suggestionsQuery, loading, error, reload: load };
}
