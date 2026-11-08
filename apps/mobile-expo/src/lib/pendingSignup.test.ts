import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PENDING_SIGNUP_KEY, clearPendingSignup, readPendingSignup, savePendingSignup } from './pendingSignup';

describe('pending signup navigation', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });
  it('keeps only normalized email and creation time', async () => {
    await savePendingSignup(' Tech@Example.com ');
    await expect(readPendingSignup()).resolves.toBe('tech@example.com');
    expect(Object.keys(JSON.parse((await AsyncStorage.getItem(PENDING_SIGNUP_KEY))!)).sort()).toEqual(['createdAt', 'email']);
  });
  it.each([Date.now() - 24 * 60 * 60 * 1000 - 1, Date.now() + 60_000, 'invalid'])('ignores expired, future or invalid time %s', async createdAt => {
    await AsyncStorage.setItem(PENDING_SIGNUP_KEY, JSON.stringify({ email: 'tech@example.com', createdAt }));
    await expect(readPendingSignup()).resolves.toBeNull();
  });
  it('ignores corrupt storage and works after an unavailable read', async () => {
    await AsyncStorage.setItem(PENDING_SIGNUP_KEY, '{invalid');
    await expect(readPendingSignup()).resolves.toBeNull();
    jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('unavailable'));
    await expect(readPendingSignup()).resolves.toBeNull();
    await savePendingSignup('tech@example.com');
    await expect(readPendingSignup()).resolves.toBe('tech@example.com');
  });
  it('serializes clearing after a signup write', async () => {
    const saving = savePendingSignup('tech@example.com');
    const clearing = clearPendingSignup();
    await Promise.all([saving, clearing]);
    await expect(readPendingSignup()).resolves.toBeNull();
  });
});
