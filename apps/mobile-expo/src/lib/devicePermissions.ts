import { Linking } from 'react-native';
import { getPermissionsAsync, requestPermissionsAsync } from 'expo-contacts/legacy';
import { getForegroundPermissionsAsync } from 'expo-location';

import { invalidateAddressProximity, manageAddressLocationPermission } from './addressLocation';

export type DevicePermissionStatus = 'allowed' | 'limited' | 'off' | 'unavailable';
export type DevicePermissions = {
  location: DevicePermissionStatus;
  contacts: DevicePermissionStatus;
};

/** Reads permission metadata only; never prompts, reads contacts, or obtains a location. */
export async function readDevicePermissions(): Promise<DevicePermissions> {
  const [location, contacts] = await Promise.all([
    getForegroundPermissionsAsync()
      .then((permission): DevicePermissionStatus => permission.granted ? 'allowed' : 'off')
      .catch((): DevicePermissionStatus => 'unavailable'),
    getPermissionsAsync()
      .then((permission): DevicePermissionStatus => {
        if (permission.accessPrivileges === 'limited') return 'limited';
        return permission.granted ? 'allowed' : 'off';
      })
      .catch((): DevicePermissionStatus => 'unavailable'),
  ]);
  return { location, contacts };
}

/** First use shows the OS prompt; existing permission choices change in app-specific Settings. */
export async function manageDevicePermission(permission: keyof DevicePermissions): Promise<void> {
  if (permission === 'location') {
    await manageAddressLocationPermission();
    return;
  }
  invalidateAddressProximity();
  const current = await getPermissionsAsync();
  if (current.status === 'undetermined' && current.canAskAgain) {
    await requestPermissionsAsync();
  } else {
    await Linking.openSettings();
  }
}
