import { Linking, NativeModules, Platform } from 'react-native';

type UsageStatsNative = {
  hasUsageAccessPermission?: () => Promise<boolean>;
  openUsageAccessSettings?: () => Promise<boolean>;
};

const usageStatsNative = NativeModules.UsageStatsModule as UsageStatsNative | undefined;

/**
 * Android Usage Access (PACKAGE_USAGE_STATS) via AppOps. On iOS returns true (not applicable).
 */
export async function checkUsageAccessPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }
  if (!usageStatsNative?.hasUsageAccessPermission) {
    if (__DEV__) {
      console.log('[PERMISSIONS][MISSING_USAGE_ACCESS_NO_AUTO_OPEN]', { reason: 'no_native_method' });
    }
    return false;
  }
  try {
    const granted = Boolean(await usageStatsNative.hasUsageAccessPermission());
    if (__DEV__) {
      if (granted) {
        console.log('[PERMISSIONS][USAGE_ACCESS_GRANTED]');
      } else {
        console.log('[PERMISSIONS][USAGE_ACCESS_DENIED]');
      }
    }
    return granted;
  } catch {
    if (__DEV__) {
      console.log('[PERMISSIONS][USAGE_ACCESS_DENIED]', { reason: 'native_error' });
    }
    return false;
  }
}

/**
 * Opens the system Usage Access screen. Call only from an explicit user tap (onboarding / profile).
 * Resolves true when an activity was started (including generic Settings fallback).
 */
export async function openUsageAccessSettingsFromOnboarding(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }
  if (!usageStatsNative?.openUsageAccessSettings) {
    if (__DEV__) {
      console.log('[PERMISSIONS][MISSING_USAGE_ACCESS_NO_AUTO_OPEN]', { reason: 'no_open_method' });
    }
    try {
      await Linking.openSettings();
      return true;
    } catch {
      if (__DEV__) {
        console.log('[PERMISSIONS][USAGE_ACCESS_OPEN_FAILED]', { reason: 'linking_open_settings' });
      }
      return false;
    }
  }
  try {
    if (__DEV__) {
      console.log('[PERMISSIONS][OPEN_USAGE_ACCESS_NATIVE]');
    }
    await usageStatsNative.openUsageAccessSettings();
    return true;
  } catch (e) {
    if (__DEV__) {
      console.log('[PERMISSIONS][USAGE_ACCESS_OPEN_FAILED]', {
        reason: 'native_reject',
        message: e instanceof Error ? e.message : String(e),
      });
    }
    try {
      await Linking.openSettings();
      return true;
    } catch {
      return false;
    }
  }
}
