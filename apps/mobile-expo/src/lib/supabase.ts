import { createFieldSoloClient } from '@fieldsolo/api-client';
import { Platform } from 'react-native';

import { authStorage } from './authStorage';
import { resolveSupabaseUrlForPlatform } from './resolveSupabaseUrl';
import { FIELD_SOLO_AUTH_STORAGE_KEY } from './storageKeys';

type FieldSoloClient = ReturnType<typeof createFieldSoloClient>;

const url = resolveSupabaseUrlForPlatform(
  (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim(),
  Platform.OS,
);
const anon = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

const configured = url.length > 0 && anon.length > 0;

function createMissingSupabaseClient(): FieldSoloClient {
  return new Proxy(
    {},
    {
      get() {
        throw new Error(
          'Missing Supabase env vars. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
        );
      },
    },
  ) as FieldSoloClient;
}

/** Shared Supabase client for the Expo app. Requires EXPO_PUBLIC_* env vars. */
export const supabase = configured
  ? createFieldSoloClient(url, anon, {
      auth: {
        storage: authStorage,
        storageKey: FIELD_SOLO_AUTH_STORAGE_KEY,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : createMissingSupabaseClient();

export function isSupabaseConfigured(): boolean {
  return configured;
}
