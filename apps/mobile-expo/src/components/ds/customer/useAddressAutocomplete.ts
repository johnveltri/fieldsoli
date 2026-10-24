import { useCallback, useEffect, useRef, useState } from 'react';

import {
  ADDRESS_SUGGESTION_LIMIT,
  fetchAddressSuggestions,
  type AddressSuggestion,
} from '@fieldsolo/api-client';
import type { FieldSoloSupabaseClient } from '@fieldsolo/api-client';
import type { AddressProximity } from '@fieldsolo/api-client';
import { AppState } from 'react-native';
import { businessAddressProximity, deviceAddressProximity, subscribeAddressProximity } from '../../../lib/addressLocation';

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
  focused: boolean = enabled,
) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const requestIdRef = useRef(0);
  const rateLimitedRef = useRef(false);
  const locationControllerRef = useRef<AbortController | null>(null);
  const [proximity, setProximity] = useState<AddressProximity | null>(null);
  const [locationRevision, setLocationRevision] = useState(0);

  useEffect(() => {
    return subscribeAddressProximity(() => {
      locationControllerRef.current?.abort();
      requestIdRef.current += 1;
      setProximity(null);
      setLocationRevision((revision) => revision + 1);
    });
  }, []);

  useEffect(() => {
    if (!enabled) setProximity(null);
    if (!enabled || !focused || AppState.currentState === 'background') return;
    setProximity(null);
    const controller = new AbortController();
    locationControllerRef.current = controller;
    void deviceAddressProximity(controller.signal).then(async (point) => {
      if (controller.signal.aborted) return;
      const resolved = point ?? await businessAddressProximity(client);
      if (!controller.signal.aborted) setProximity(resolved);
    }).catch(() => { /* Ordinary autocomplete remains available. */ });
    return () => {
      controller.abort();
      if (locationControllerRef.current === controller) locationControllerRef.current = null;
    };
  }, [client, enabled, focused, locationRevision]);

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
        ...(proximity ? { proximity } : {}),
      }).catch(() => ({ status: 'error' as const, code: 'unavailable' as const }));
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
    [client, proximity],
  );

  useEffect(() => {
    if (!enabled || AppState.currentState === 'background') {
      requestIdRef.current += 1;
      rateLimitedRef.current = false;
      setSuggestions([]);
      setLoading(false);
      setNoResults(false);
      return;
    }

    // Keep completed suggestions tappable after blur, but end the interaction.
    if (!focused) {
      requestIdRef.current += 1;
      setLoading(false);
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
    setSuggestions([]);
    setLoading(false);
    setNoResults(false);
    const timer = setTimeout(() => {
      void runLookup(query.trim(), requestId);
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      requestIdRef.current += 1;
    };
  }, [enabled, focused, query, runLookup, locationRevision]);

  return {
    suggestions,
    loading,
    noResults,
    showPanel: loading || suggestions.length > 0 || noResults,
    meetsThreshold: meetsAddressThreshold(query),
  };
}
