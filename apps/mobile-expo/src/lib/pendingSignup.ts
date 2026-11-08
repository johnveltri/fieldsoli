import AsyncStorage from '@react-native-async-storage/async-storage';

export const PENDING_SIGNUP_KEY = 'fieldsolo.auth.pendingSignup';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
// Order reads/writes/clears so a slow signup write cannot undo a session clear.
let operations: Promise<unknown> = Promise.resolve();
function ordered<T>(operation: () => Promise<T>): Promise<T> {
  const result = operations.then(operation);
  operations = result.catch(() => undefined);
  return result;
}

/** Navigation hint only: never stores a password, code, token or legal acceptance. */
export function savePendingSignup(email: string): Promise<void> {
  return ordered(async () => {
    try {
      await AsyncStorage.setItem(PENDING_SIGNUP_KEY, JSON.stringify({ email: email.trim().toLowerCase(), createdAt: Date.now() }));
    } catch { /* Code entry remains usable when device storage is unavailable. */ }
  });
}

export function clearPendingSignup(): Promise<void> {
  return ordered(async () => {
    try { await AsyncStorage.removeItem(PENDING_SIGNUP_KEY); } catch { /* best effort */ }
  });
}

export function readPendingSignup(): Promise<string | null> {
  return ordered(async () => {
    try {
      const raw = await AsyncStorage.getItem(PENDING_SIGNUP_KEY);
      if (!raw) return null;
      const value = JSON.parse(raw);
      const age = Date.now() - value.createdAt;
      if (typeof value.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)
        && typeof value.createdAt === 'number' && age >= 0 && age < MAX_AGE_MS) return value.email;
      await AsyncStorage.removeItem(PENDING_SIGNUP_KEY);
    } catch { /* Malformed or unavailable storage never blocks auth. */ }
    return null;
  });
}
