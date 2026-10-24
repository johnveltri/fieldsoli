import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Linking } from 'react-native';
import * as Location from 'expo-location';
import { resolveBusinessProximity, type AddressProximity, type FieldSoloSupabaseClient } from '@fieldsolo/api-client';

const ASKED_KEY = 'fieldsoli.address-location-asked.v1';
let account: string | null = null;
let generation = 0;
let device: { point: AddressProximity; expires: number } | null = null;
let business: { point: AddressProximity | null; expires: number } | null = null;
let businessPending: Promise<AddressProximity | null> | null = null;
let permissionPending: Promise<Location.LocationPermissionResponse | null> | null = null;
let askedInMemory = false;
const listeners = new Set<() => void>();

export function subscribeAddressProximity(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function invalidateAddressProximity(): void {
  generation += 1;
  device = null;
  business = null;
  businessPending = null;
  listeners.forEach((listener) => listener());
}

export function setAddressLocationAccount(userId: string | null): void {
  if (account === userId) return;
  account = userId;
  invalidateAddressProximity();
}

export function observeAddressLocationLifecycle(): () => void {
  let wasBackground = AppState.currentState === 'background';
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'background') {
      wasBackground = true;
      invalidateAddressProximity();
    } else if (state === 'active' && wasBackground) {
      wasBackground = false;
      invalidateAddressProximity();
    }
  });
  return () => subscription.remove();
}

async function requestPermission(): Promise<Location.LocationPermissionResponse | null> {
  if (permissionPending) return permissionPending;
  const pending = (async () => {
    try {
      const current = await Location.getForegroundPermissionsAsync();
      if (current.granted) return current;
      device = null;
      if (!current.canAskAgain) return current;
      // Ask only once per installation, whether initiated by address entry or Privacy Choices.
      if (current.status === 'denied' || askedInMemory || await AsyncStorage.getItem(ASKED_KEY)) {
        return current;
      }
      askedInMemory = true;
      // Persist before showing the OS dialog so interruption cannot create repeated asks.
      await AsyncStorage.setItem(ASKED_KEY, '1');
      return await Location.requestForegroundPermissionsAsync();
    } catch {
      return null;
    }
  })();
  permissionPending = pending;
  try { return await pending; } finally {
    if (permissionPending === pending) permissionPending = null;
  }
}

export async function manageAddressLocationPermission(): Promise<void> {
  invalidateAddressProximity();
  const current = await Location.getForegroundPermissionsAsync();
  if (current.status === 'undetermined' && current.canAskAgain
    && !askedInMemory && !await AsyncStorage.getItem(ASKED_KEY)) {
    await requestPermission();
  } else {
    await Linking.openSettings();
  }
}

export async function deviceAddressProximity(signal: AbortSignal): Promise<AddressProximity | null> {
  const epoch = generation;
  if (AppState.currentState === 'background') return null;
  const permission = await requestPermission();
  if (signal.aborted || epoch !== generation || !permission?.granted) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const fix = await Promise.race([
      (async () => {
        if (!await Location.hasServicesEnabledAsync()) return null;
        if (signal.aborted || epoch !== generation) return null;
        if (device && device.expires > Date.now()) return device;
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Low, mayShowUserSettingsDialog: false,
        });
        const { latitude, longitude } = position.coords;
        if (!Number.isFinite(latitude) || Math.abs(latitude) > 90
          || !Number.isFinite(longitude) || Math.abs(longitude) > 180) return null;
        return {
          point: { latitude: Math.round(latitude * 100) / 100, longitude: Math.round(longitude * 100) / 100 },
          expires: Date.now() + 60_000,
        };
      })(),
      new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), 3000); }),
    ]);
    if (!fix || signal.aborted || epoch !== generation) return null;
    device = fix;
    return fix.point;
  } catch { return null; } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function businessAddressProximity(client: FieldSoloSupabaseClient): Promise<AddressProximity | null> {
  if (!account) return null;
  if (business && business.expires > Date.now()) return business.point;
  if (businessPending) return businessPending;
  const epoch = generation;
  const pending = resolveBusinessProximity(client).catch(() => null).then((point) => {
    if (epoch !== generation) return null;
    business = { point, expires: Date.now() + 300_000 };
    return point;
  });
  businessPending = pending;
  try { return await pending; } finally {
    if (businessPending === pending) businessPending = null;
  }
}
