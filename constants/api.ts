/**
 * API configuration for SpikeSense backend.
 * Single source of truth for the API base URL.
 *
 * Priority:
 * 1. EXPO_PUBLIC_API_URL when set (trimmed, must start with http:// or https://)
 * 2. __DEV__: LAN dev server
 * 3. Release without valid env: Render production API
 */

const RENDER_API_URL = 'https://spikesense-backend.onrender.com/api';

const DEFAULT_DEV_API = 'http://172.20.10.2:5000/api';

const explicitUrlRaw =
  typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL != null
    ? String(process.env.EXPO_PUBLIC_API_URL).trim()
    : '';

type ApiUrlSource = 'env' | 'dev_fallback' | 'render_fallback';

function resolveApiBaseUrl(): { url: string; source: ApiUrlSource } {
  if (explicitUrlRaw.length > 0 && /^https?:\/\//i.test(explicitUrlRaw)) {
    return { url: explicitUrlRaw.replace(/\/+$/, ''), source: 'env' };
  }

  if (__DEV__) {
    return { url: DEFAULT_DEV_API.replace(/\/+$/, ''), source: 'dev_fallback' };
  }

  return { url: RENDER_API_URL.replace(/\/+$/, ''), source: 'render_fallback' };
}

const _resolved = resolveApiBaseUrl();

export const API_BASE_URL = _resolved.url;
export const API_BASE_URL_SOURCE: ApiUrlSource = _resolved.source;

console.log('[API_CONFIG]', {
  expoPublicApiUrl: process.env.EXPO_PUBLIC_API_URL,
  resolvedApiBaseUrl: API_BASE_URL,
  source: API_BASE_URL_SOURCE,
});

/** Returns {@link API_BASE_URL} (e.g. for native bridge). */
export function getApiBaseUrl(): string {
  return API_BASE_URL;
}
