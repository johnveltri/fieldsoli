import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Linking } from 'react-native';
import * as Contacts from 'expo-contacts/legacy';
import * as Location from 'expo-location';

import { invalidateAddressProximity, manageAddressLocationPermission } from './addressLocation';
import { manageDevicePermission, readDevicePermissions } from './devicePermissions';

jest.mock('expo-contacts/legacy', () => ({ getPermissionsAsync: jest.fn(), requestPermissionsAsync: jest.fn() }));
jest.mock('expo-location', () => ({ getForegroundPermissionsAsync: jest.fn(), requestForegroundPermissionsAsync: jest.fn() }));
jest.mock('./addressLocation', () => ({ invalidateAddressProximity: jest.fn(), manageAddressLocationPermission: jest.fn() }));

const permission = (granted: boolean) => ({ status: granted ? 'granted' : 'denied', granted, canAskAgain: true, expires: 'never' }) as Location.LocationPermissionResponse;

describe('OS-managed device permissions', () => {
  afterEach(() => { jest.clearAllMocks(); jest.restoreAllMocks(); });

  it('reads both permissions without asking, and treats limited contacts access as enabled', async () => {
    jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue(permission(false));
    jest.mocked(Contacts.getPermissionsAsync).mockResolvedValue({ ...permission(true), accessPrivileges: 'limited' });
    expect(await readDevicePermissions()).toEqual({ location: 'off', contacts: 'limited' });
    expect(Contacts.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('keeps one unavailable permission from masking the other permission', async () => {
    jest.mocked(Location.getForegroundPermissionsAsync).mockRejectedValueOnce(new Error('unavailable'));
    jest.mocked(Contacts.getPermissionsAsync).mockResolvedValueOnce(permission(true));
    expect(await readDevicePermissions()).toEqual({ location: 'unavailable', contacts: 'allowed' });
    jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValueOnce(permission(true));
    jest.mocked(Contacts.getPermissionsAsync).mockRejectedValueOnce(new Error('unavailable'));
    expect(await readDevicePermissions()).toEqual({ location: 'allowed', contacts: 'unavailable' });
  });

  it('opens app-specific Settings for existing Contacts choices without requesting again', async () => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    jest.mocked(Contacts.getPermissionsAsync).mockResolvedValueOnce(permission(false));
    await manageDevicePermission('contacts');
    expect(invalidateAddressProximity).toHaveBeenCalledTimes(1);
    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(Contacts.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('shows the native Contacts prompt on the first request instead of linking to a missing Settings control', async () => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    jest.mocked(Contacts.getPermissionsAsync).mockResolvedValueOnce({ ...permission(false), status: 'undetermined' as Contacts.ContactsPermissionResponse['status'] });
    jest.mocked(Contacts.requestPermissionsAsync).mockResolvedValueOnce(permission(false));
    await manageDevicePermission('contacts');
    expect(Contacts.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(openSettings).not.toHaveBeenCalled();
  });

  it('routes location changes through the shared first-request and cache-lifetime rules', async () => {
    await manageDevicePermission('location');
    expect(manageAddressLocationPermission).toHaveBeenCalledTimes(1);
    expect(Contacts.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});
