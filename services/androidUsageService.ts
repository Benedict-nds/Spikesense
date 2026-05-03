import { NativeModules, Platform, Linking } from 'react-native';

type UsageTrackingNative = {
  startTrackingService(userId: number, apiBaseUrl: string): Promise<boolean>;
  stopTrackingService(): Promise<boolean>;
  getTrackingServiceStatus(): Promise<{ running: boolean }>;
};

const UsageStatsModule = NativeModules.UsageStatsModule as
  | { getCurrentAppInfo?: () => Promise<unknown>; getCurrentApp?: () => Promise<string> }
  | undefined;
const UsageTrackingModule = NativeModules.UsageTrackingModule as UsageTrackingNative | undefined;

export type AndroidCategory = 'productivity' | 'social' | 'entertainment' | 'other';

/** Mirrors native UsageStatsModule denylist — JS-side safety net if native omits `ignored`. */
const UNTRACKABLE_PACKAGES_LOWER = new Set(
  [
    'com.anonymous.natively',
    'host.exp.exponent',
    'com.android.launcher',
    'com.android.launcher2',
    'com.android.launcher3',
    'com.google.android.apps.nexuslauncher',
    'com.sec.android.app.launcher',
    'com.miui.home',
    'com.huawei.android.launcher',
    'com.oppo.launcher',
    'com.android.settings',
    'com.google.android.settings.intelligence',
  ].map((p) => p.toLowerCase()),
);

export function isUntrackableAndroidPackage(packageName: string): boolean {
  if (!packageName) {
    return true;
  }
  const p = packageName.toLowerCase();
  if (UNTRACKABLE_PACKAGES_LOWER.has(p)) {
    return true;
  }
  if (p.includes('.launcher') || p.endsWith('.launcher3')) {
    return true;
  }
  return false;
}

export type AndroidTrackedApp = {
  packageName: string;
  appName: string;
  category: AndroidCategory;
  categorySource?: 'metadata' | 'heuristic';
  /** When true, native matched denylist — do not log usage for this package. */
  ignored?: boolean;
};

function coerceCategory(value: unknown): AndroidCategory {
  if (value === 'productivity' || value === 'social' || value === 'entertainment' || value === 'other') {
    return value;
  }
  return 'other';
}

/**
 * Returns structured foreground app info from native UsageStats + PackageManager.
 * Non-Android or failures → null. Ignored packages return an object with ignored: true.
 */
export async function getCurrentAppInfo(): Promise<AndroidTrackedApp | null> {
  if (Platform.OS !== 'android') {
    return null;
  }

  try {
    if (!UsageStatsModule?.getCurrentAppInfo) {
      return null;
    }

    const raw = await UsageStatsModule.getCurrentAppInfo();

    if (raw == null) {
      return null;
    }

    if (typeof raw === 'object' && raw !== null && (raw as { ignored?: boolean }).ignored === true) {
      const pkg = String((raw as { packageName?: string }).packageName ?? '');
      return {
        packageName: pkg,
        appName: pkg,
        category: 'other',
        ignored: true,
      };
    }

    if (typeof raw !== 'object' || raw === null) {
      return null;
    }

    const o = raw as Record<string, unknown>;
    const packageName =
      typeof o.packageName === 'string' ? o.packageName : String(o.packageName ?? '');
    if (!packageName) {
      return null;
    }

    if (isUntrackableAndroidPackage(packageName)) {
      return {
        packageName,
        appName: packageName,
        category: 'other',
        ignored: true,
      };
    }

    const appName =
      typeof o.appName === 'string' && o.appName.length > 0 ? o.appName : packageName;
    const src =
      o.categorySource === 'metadata' || o.categorySource === 'heuristic'
        ? o.categorySource
        : undefined;
    const category = refineCategoryWithJsFallback(
      coerceCategory(o.category),
      packageName,
      appName,
      src,
    );

    return {
      packageName,
      appName,
      category,
      categorySource: src,
    };
  } catch {
    return null;
  }
}

/**
 * JS fallback only when Android metadata did not yield a definitive category
 * (native marks those as categorySource !== 'metadata').
 */
function refineCategoryWithJsFallback(
  nativeCategory: AndroidCategory,
  packageName: string,
  appName: string,
  categorySource: 'metadata' | 'heuristic' | undefined,
): AndroidCategory {
  if (categorySource === 'metadata') {
    return nativeCategory;
  }
  if (nativeCategory !== 'other') {
    return nativeCategory;
  }

  const blob = `${packageName} ${appName}`.toLowerCase();

  if (
    /whatsapp|telegram|signal|instagram|facebook|messenger|twitter|tiktok|snapchat|reddit|discord|social|chat|sms|messaging/.test(
      blob,
    )
  ) {
    return 'social';
  }
  if (
    /youtube|netflix|spotify|\.music|video|stream|game|twitch|hulu|disney|primevideo|\.tv\b/.test(blob)
  ) {
    return 'entertainment';
  }
  if (
    /gmail|outlook|mail|calendar|docs|sheets|drive|notion|office|teams|zoom mozilla|chrome|firefox|browser|work|productivity/.test(
      blob,
    )
  ) {
    return 'productivity';
  }

  return 'other';
}

/** @deprecated Prefer getCurrentAppInfo — kept for backward compatibility. */
export const getCurrentApp = async (): Promise<string> => {
  const info = await getCurrentAppInfo();
  if (!info || info.ignored) {
    return 'Unknown';
  }
  return info.packageName;
};

export const requestUsagePermission = () => {
  if (Platform.OS === 'android') {
    Linking.openSettings();
  }
};

/** Starts the native foreground service (Android only). Persists userId + apiBaseUrl for HTTP emits. */
export async function startNativeTrackingService(userId: number, apiBaseUrl: string): Promise<boolean> {
  if (Platform.OS !== 'android' || !UsageTrackingModule?.startTrackingService) {
    return false;
  }
  try {
    await UsageTrackingModule.startTrackingService(userId, apiBaseUrl);
    return true;
  } catch {
    return false;
  }
}

export async function stopNativeTrackingService(): Promise<boolean> {
  if (Platform.OS !== 'android' || !UsageTrackingModule?.stopTrackingService) {
    return false;
  }
  try {
    await UsageTrackingModule.stopTrackingService();
    return true;
  } catch {
    return false;
  }
}

export async function getNativeTrackingServiceStatus(): Promise<{ running: boolean } | null> {
  if (Platform.OS !== 'android' || !UsageTrackingModule?.getTrackingServiceStatus) {
    return null;
  }
  try {
    return await UsageTrackingModule.getTrackingServiceStatus();
  } catch {
    return null;
  }
}
