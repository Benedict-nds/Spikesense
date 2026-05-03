import { Linking, NativeModules, Platform } from 'react-native';

type UsageStatsNative = {
  hasUsageAccessPermission?: () => Promise<boolean>;
  openUsageAccessSettings?: () => void;
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
    return Boolean(await usageStatsNative.hasUsageAccessPermission());
  } catch {
    return false;
  }
}

/**
 * Opens the system Usage Access screen. Call only from an explicit user tap (onboarding / profile).
 */
export function openUsageAccessSettingsFromOnboarding(): void {
  if (Platform.OS !== 'android') {
    return;
  }
  if (usageStatsNative?.openUsageAccessSettings) {
    usageStatsNative.openUsageAccessSettings();
    return;
  }
  if (__DEV__) {
    console.log('[PERMISSIONS][MISSING_USAGE_ACCESS_NO_AUTO_OPEN]', { reason: 'no_open_method' });
  }
  void Linking.openSettings();
}
