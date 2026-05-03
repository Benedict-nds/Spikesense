import { NativeModules, Platform } from 'react-native';

type AppIconNative = {
  getAppIconBase64?: (packageName: string) => Promise<string | null>;
};

const cache = new Map<string, string | null>();

function normalizeDisplayKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Exact and normalized display-name → Android package (when backend omits package_name). */
const DISPLAY_NAME_TO_PACKAGE: Record<string, string> = {
  instagram: 'com.instagram.android',
  whatsapp: 'com.whatsapp',
  snapchat: 'com.snapchat.android',
  telegram: 'org.telegram.messenger',
  gmail: 'com.google.android.gm',
  youtube: 'com.google.android.youtube',
  spotify: 'com.spotify.music',
  tiktok: 'com.zhiliaoapp.musically',
  facebook: 'com.facebook.katana',
  x: 'com.twitter.android',
  twitter: 'com.twitter.android',
  chrome: 'com.android.chrome',
  'samsung internet': 'com.sec.android.app.sbrowser',
  premierleague: 'com.pl.premierleague',
  'premier league': 'com.pl.premierleague',
};

/**
 * Prefer explicit package from backend; otherwise infer from common app display names.
 */
export function resolvePackageForIconLookup(
  appName: string | undefined,
  packageName: string | undefined
): string {
  const pkg = (packageName ?? '').trim();
  if (pkg) return pkg;
  const key = normalizeDisplayKey(appName ?? '');
  if (!key) return '';
  if (DISPLAY_NAME_TO_PACKAGE[key]) {
    return DISPLAY_NAME_TO_PACKAGE[key];
  }
  if (key.includes('youtube')) return 'com.google.android.youtube';
  if (key.includes('tiktok') || key.includes('musically')) return 'com.zhiliaoapp.musically';
  if (key.includes('whatsapp')) return 'com.whatsapp';
  if (key.includes('instagram')) return 'com.instagram.android';
  if (key.includes('snapchat')) return 'com.snapchat.android';
  if (key.includes('telegram')) return 'org.telegram.messenger';
  if (key.includes('gmail') || key === 'google mail') return 'com.google.android.gm';
  if (key.includes('spotify')) return 'com.spotify.music';
  if (key.includes('facebook')) return 'com.facebook.katana';
  if (key === 'x' || key.includes('twitter')) return 'com.twitter.android';
  if (key.includes('chrome')) return 'com.android.chrome';
  if (key.includes('samsung') && key.includes('internet')) return 'com.sec.android.app.sbrowser';
  if (key.includes('premier') && key.includes('league')) return 'com.pl.premierleague';
  return '';
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
