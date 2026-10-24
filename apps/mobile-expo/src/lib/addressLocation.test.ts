import { beforeEach, afterEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Linking } from 'react-native';
import * as Location from 'expo-location';
import { resolveBusinessProximity, type FieldSoloSupabaseClient } from '@fieldsolo/api-client';
import {
  deviceAddressProximity, businessAddressProximity, invalidateAddressProximity,
  manageAddressLocationPermission, observeAddressLocationLifecycle, setAddressLocationAccount,
} from './addressLocation';

jest.mock('expo-location', () => ({
  Accuracy: { Low: 2 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));
jest.mock('@fieldsolo/api-client', () => ({ resolveBusinessProximity: jest.fn() }));

const granted = { status: 'granted', granted: true, canAskAgain: true, expires: 'never' } as Location.LocationPermissionResponse;
const undetermined = { ...granted, status: 'undetermined', granted: false } as Location.LocationPermissionResponse;
const denied = { ...undetermined, status: 'denied' } as Location.LocationPermissionResponse;
const point = { latitude: 41.88, longitude: -87.63 };
const client = {} as FieldSoloSupabaseClient;
const signal = () => new AbortController().signal;

describe('address location privacy and lifetime', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    invalidateAddressProximity();
    setAddressLocationAccount('user-a');
    jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue(granted);
    jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue(granted);
    jest.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(true);
    jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
      coords: { latitude: 41.878113, longitude: -87.629798 },
    } as Location.LocationObject);
    jest.mocked(resolveBusinessProximity).mockResolvedValue(point);
  });
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

  it('asks once on first use, stores only an asked flag, and rounds before returning', async () => {
    await AsyncStorage.clear();
    jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue(undetermined);
    expect(await deviceAddressProximity(signal())).toEqual(point);
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('fieldsoli.address-location-asked.v1', '1');
    // Includes expired Allow Once grants: never ask automatically for a second time.
    expect(await deviceAddressProximity(signal())).toBeNull();
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('silently handles denial and blocked permission without reading location', async () => {
    for (const permission of [denied, { ...denied, canAskAgain: false }]) {
      jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue(permission);
      expect(await deviceAddressProximity(signal())).toBeNull();
    }
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('reuses a rounded fix for at most 60 seconds, rechecks permission, and honors revocation', async () => {
    expect(await deviceAddressProximity(signal())).toEqual(point);
    jest.advanceTimersByTime(59_000);
    expect(await deviceAddressProximity(signal())).toEqual(point);
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1_001);
    expect(await deviceAddressProximity(signal())).toEqual(point);
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(2);
    jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue(denied);
    expect(await deviceAddressProximity(signal())).toBeNull();
  });

  it('falls back after three seconds and never caches a late fix', async () => {
    let resolve!: (value: Location.LocationObject) => void;
    jest.mocked(Location.getCurrentPositionAsync).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const pending = deviceAddressProximity(signal());
    await jest.advanceTimersByTimeAsync(3000);
    expect(await pending).toBeNull();
    resolve({ coords: { latitude: 1, longitude: 2 } } as Location.LocationObject);
    await Promise.resolve();
    expect(await deviceAddressProximity(signal())).toEqual(point);
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(2);
  });

  it('falls back with services disabled, errors, or an abandoned interaction', async () => {
    jest.mocked(Location.hasServicesEnabledAsync).mockResolvedValueOnce(false);
    expect(await deviceAddressProximity(signal())).toBeNull();
    jest.mocked(Location.getCurrentPositionAsync).mockRejectedValueOnce(new Error('unavailable'));
    expect(await deviceAddressProximity(signal())).toBeNull();
    const controller = new AbortController(); controller.abort();
    expect(await deviceAddressProximity(controller.signal)).toBeNull();
  });

  it('deduplicates fallback lookup, expires after five minutes, and invalidates on save', async () => {
    const results = await Promise.all([businessAddressProximity(client), businessAddressProximity(client)]);
    expect(results).toEqual([point, point]);
    expect(resolveBusinessProximity).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(299_999);
    await businessAddressProximity(client);
    expect(resolveBusinessProximity).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(2);
    await businessAddressProximity(client);
    expect(resolveBusinessProximity).toHaveBeenCalledTimes(2);
    invalidateAddressProximity();
    await businessAddressProximity(client);
    expect(resolveBusinessProximity).toHaveBeenCalledTimes(3);
  });

  it('clears caches on account switch/sign-out and ignores old-account fallback responses', async () => {
    let resolve!: (value: typeof point) => void;
    jest.mocked(resolveBusinessProximity).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const old = businessAddressProximity(client);
    setAddressLocationAccount('user-b');
    resolve(point);
    expect(await old).toBeNull();
    await businessAddressProximity(client);
    expect(resolveBusinessProximity).toHaveBeenCalledTimes(2);
    setAddressLocationAccount(null);
    expect(await businessAddressProximity(client)).toBeNull();
  });

  it('invalidates through background → inactive → active and cleans up the listener', async () => {
    let listener!: (state: 'active' | 'inactive' | 'background') => void;
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => {
      listener = handler; return { remove };
    });
    const cleanup = observeAddressLocationLifecycle();
    await businessAddressProximity(client);
    await deviceAddressProximity(signal());
    listener('background'); listener('inactive'); listener('active');
    await businessAddressProximity(client);
    await deviceAddressProximity(signal());
    expect(resolveBusinessProximity).toHaveBeenCalledTimes(2);
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(2);
    cleanup(); expect(remove).toHaveBeenCalled();
  });

  it('uses Settings after prior location requests, including expired one-time access', async () => {
    const settings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    for (const current of [undetermined, denied, { ...denied, canAskAgain: false }, granted]) {
      jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue(current);
      await manageAddressLocationPermission();
    }
    expect(settings).toHaveBeenCalledTimes(4);
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

});
