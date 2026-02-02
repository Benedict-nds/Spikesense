/**
 * Permissions Handler for SpikeSense
 * Handles Android and iOS permissions for app usage tracking
 */

import { Platform, Linking, Alert, PermissionsAndroid } from 'react-native';
import * as Device from 'expo-device';

export interface PermissionStatus {
  granted: boolean;
  canRequest: boolean;
  message?: string;
}

/**
 * Request app usage statistics permission on Android
 * 
 * Note: This requires the user to manually enable "Usage Access" 
 * in Android Settings. We can only guide them there.
 */
export async function requestAndroidUsagePermission(): Promise<PermissionStatus> {
  if (Platform.OS !== 'android') {
    return {
      granted: false,
      canRequest: false,
      message: 'This permission is only available on Android',
    };
  }

  try {
    // Check if we can query usage stats
    // Note: This requires PACKAGE_USAGE_STATS permission
    // which can only be granted through Settings
    
    // For Android 10+, we need to check if permission is granted
    const hasPermission = await checkUsageStatsPermission();
    
    if (hasPermission) {
      return {
        granted: true,
        canRequest: false,
      };
    }

    // Guide user to settings
    Alert.alert(
      'Usage Access Required',
      'SpikeSense needs access to app usage statistics to track your digital wellness. Please enable "Usage Access" in Settings.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Open Settings',
          onPress: () => openUsageAccessSettings(),
        },
      ]
    );

    return {
      granted: false,
      canRequest: true,
      message: 'Please enable Usage Access in Settings',
    };
  } catch (error) {
    console.error('Error requesting usage permission:', error);
    return {
      granted: false,
      canRequest: false,
      message: 'Failed to request permission',
    };
  }
}

/**
 * Check if usage stats permission is granted
 */
async function checkUsageStatsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }

  try {
    // This would require a native module to check
    // For now, we'll assume it needs to be checked manually
    // In production, use react-native-app-usage or similar
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Open Android Settings for Usage Access
 */
function openUsageAccessSettings(): void {
  if (Platform.OS !== 'android') {
    return;
  }

  try {
    // Open Usage Access settings
    Linking.openSettings();
  } catch (error) {
    console.error('Failed to open settings:', error);
    Alert.alert('Error', 'Could not open Settings. Please navigate to Settings > Apps > Special access > Usage access manually.');
  }
}

/**
 * Request iOS Screen Time permission
 * 
 * Note: iOS Screen Time API requires special entitlements
 * and can only be used in specific contexts (Screen Time extensions)
 */
export async function requestIOSScreenTimePermission(): Promise<PermissionStatus> {
  if (Platform.OS !== 'ios') {
    return {
      granted: false,
      canRequest: false,
      message: 'This permission is only available on iOS',
    };
  }

  // iOS Screen Time API requires:
  // 1. Screen Time Extension entitlement
  // 2. Parental Controls framework
  // 3. User must have Screen Time enabled
  
  Alert.alert(
    'iOS Limitations',
    'iOS has strict limitations on app usage tracking. SpikeSense uses AppState monitoring as a fallback. For full tracking, consider using Screen Time API with proper entitlements.',
    [{ text: 'OK' }]
  );

  return {
    granted: false,
    canRequest: false,
    message: 'iOS Screen Time API requires special entitlements',
  };
}

/**
 * Request all necessary permissions for the app
 */
export async function requestAllPermissions(): Promise<{
  android: PermissionStatus;
  ios: PermissionStatus;
}> {
  const android = await requestAndroidUsagePermission();
  const ios = await requestIOSScreenTimePermission();

  return { android, ios };
}

/**
 * Show permission setup guide
 */
export function showPermissionGuide(): void {
  if (Platform.OS === 'android') {
    Alert.alert(
      'Enable Usage Access',
      'To track your app usage:\n\n1. Open Settings\n2. Go to Apps > Special access\n3. Select Usage access\n4. Find SpikeSense\n5. Enable "Permit usage access"',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]
    );
  } else {
    Alert.alert(
      'iOS Tracking',
      'iOS has limitations on app usage tracking. SpikeSense will use AppState monitoring to track app switches. For full tracking, the app would need Screen Time API entitlements.',
      [{ text: 'OK' }]
    );
  }
}



