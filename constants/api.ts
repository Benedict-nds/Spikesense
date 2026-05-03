/**
 * API configuration for SpikeSense backend.
 * Single source of truth for the API base URL.
 *
 * Priority:
 * 1. EXPO_PUBLIC_API_URL when set (trimmed, must start with http/https)
 * 2. Dev-only: localhost (web) or LAN fallback when env is missing
 * 3. Release without env: production placeholder
 */

import { Platform } from 'react-native';

const DEFAULT_DEV_PORT = 5000;
/** Dev fallback only when EXPO_PUBLIC_API_URL is unset */
const FALLBACK_LAN_IP = '172.20.10.2';

const explicitUrl =
  typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL != null
    ? String(process.env.EXPO_PUBLIC_API_URL).trim()
    : '';

type ApiUrlSource = 'env' | 'fallback';

function resolveApiBaseUrl(): { url: string; source: ApiUrlSource } {
  if (explicitUrl.length > 0 && /^https?:\/\//i.test(explicitUrl)) {
    return { url: explicitUrl.replace(/\/+$/, ''), source: 'env' };
  }

  if (__DEV__) {
    if (Platform.OS === 'web') {
      return { url: `http://localhost:${DEFAULT_DEV_PORT}/api`, source: 'fallback' };
    }
    return { url: `http://${FALLBACK_LAN_IP}:${DEFAULT_DEV_PORT}/api`, source: 'fallback' };
  }

  return { url: 'https://your-production-api.com/api', source: 'fallback' };
}

const _resolved = resolveApiBaseUrl();

export const API_BASE_URL = _resolved.url;
export const API_BASE_URL_SOURCE: ApiUrlSource = _resolved.source;

if (__DEV__) {
  console.log('[API_CONFIG]', {
    expoPublicApiUrl: process.env.EXPO_PUBLIC_API_URL,
    resolvedApiBaseUrl: API_BASE_URL,
    source: API_BASE_URL_SOURCE,
  });
  console.log('API base URL:', API_BASE_URL);
}

/** Returns {@link API_BASE_URL} (e.g. for native bridge). */
export function getApiBaseUrl(): string {
  return API_BASE_URL;
}
