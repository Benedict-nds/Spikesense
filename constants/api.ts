/**
 * API configuration for SpikeSense backend.
 * Single source of truth for the API base URL.
 * 
 * Priority:
 * 1. EXPO_PUBLIC_API_URL if defined (explicit override)
 * 2. Hardcoded fallback to known LAN IP (172.20.10.2:5000/api)
 * 3. localhost only for web platform
 * 
 * Does NOT auto-detect IPs to avoid VPN/tunnel/virtual interface issues.
 */

import { Platform } from 'react-native';

const DEFAULT_DEV_PORT = 5000;
/** Hardcoded fallback LAN IP - backend runs on this address */
const FALLBACK_LAN_IP = '172.20.10.2';

/**
 * Get the base URL for the backend API (ends with /api, no trailing slash).
 * 
 * For physical devices / Expo Go:
 * - Uses EXPO_PUBLIC_API_URL if defined
 * - Otherwise uses hardcoded fallback (172.20.10.2:5000/api)
 * - Does NOT auto-detect IPs to avoid VPN/tunnel interfaces
 * 
 * For web platform:
 * - Uses localhost:5000/api
 */
export function getApiBaseUrl(): string {
  const envUrl =
    typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL != null
      ? process.env.EXPO_PUBLIC_API_URL
      : null;

  if (envUrl && envUrl.length > 0) {
    return envUrl.replace(/\/$/, '');
  }

  if (__DEV__) {
    if (Platform.OS === 'web') {
      return `http://localhost:${DEFAULT_DEV_PORT}/api`;
    }
    // For physical devices: use hardcoded fallback (no auto-detection)
    return `http://${FALLBACK_LAN_IP}:${DEFAULT_DEV_PORT}/api`;
  }

  return 'https://your-production-api.com/api';
}

export const API_BASE_URL = getApiBaseUrl();
