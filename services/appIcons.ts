import { NativeModules, Platform } from 'react-native';

type AppIconNative = {
  getAppIconBase64?: (packageName: string) => Promise<string | null>;
};

const cache = new Map<string, string | null>();

/** Normalize display name → Android package for PackageManager lookup only (no bundled assets). */
const DISPLAY_NAME_TO_PACKAGE: Record<string, string> = {
  instagram: 'com.instagram.android',
  whatsapp: 'com.whatsapp',
  telegram: 'org.telegram.messenger',
  gmail: 'com.google.android.gm',
  snapchat: 'com.snapchat.android',
  spotify: 'com.spotify.music',
  chrome: 'com.android.chrome',
  'samsung internet': 'com.sec.android.app.sbrowser',
};

/**
 * Prefer explicit package_name from backend; otherwise infer from common app display names.
 */
export function resolvePackageForIconLookup(
  appName: string | undefined,
  packageName: string | undefined
): string {
  const pkg = (packageName ?? '').trim();
  if (pkg) return pkg;
  const key = (appName ?? '').trim().toLowerCase();
  if (!key) return '';
  return DISPLAY_NAME_TO_PACKAGE[key] ?? '';
}

/**
 * Returns a data URI suitable for `<Image source={{ uri }} />`, or null.
 * Android only; iOS returns null (use category fallback).
 */
export async function getAppIcon(packageName: string | null | undefined): Promise<string | null> {
  const pkg = (packageName ?? '').trim();
  if (!pkg || Platform.OS !== 'android') {
    return null;
  }
  if (cache.has(pkg)) {
    return cache.get(pkg) ?? null;
  }
  try {
    const mod = NativeModules.AppIconModule as AppIconNative | undefined;
    if (!mod?.getAppIconBase64) {
      cache.set(pkg, null);
      return null;
    }
    const uri = await mod.getAppIconBase64(pkg);
    const out = uri && typeof uri === 'string' && uri.length > 0 ? uri : null;
    cache.set(pkg, out);
    return out;
  } catch {
    cache.set(pkg, null);
    return null;
  }
}

export function clearAppIconCache(): void {
  cache.clear();
}
