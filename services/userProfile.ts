import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_ONBOARDING = '@spikesense/onboarding_completed';
const KEY_DISPLAY_NAME = '@spikesense/display_name';
const KEY_USER_ID = '@spikesense/user_id';
const KEY_DEVICE_ID = '@spikesense/device_id';

/** Legacy keys (migrate once into @spikesense/*). */
const LEGACY_USER_ID = 'userId';
const LEGACY_DEVICE_ID = 'deviceId';

export async function getOnboardingCompleted(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(KEY_ONBOARDING);
    return v === '1' || v === 'true';
  } catch {
    return false;
  }
}

export async function setOnboardingCompleted(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_ONBOARDING, value ? '1' : '0');
  } catch {
    /* non-fatal */
  }
}

export async function getDisplayName(): Promise<string | null> {
  try {
    const v = await AsyncStorage.getItem(KEY_DISPLAY_NAME);
    const t = (v ?? '').trim();
    return t.length > 0 ? t : null;
  } catch {
    return null;
  }
}

export async function setDisplayName(name: string): Promise<void> {
  try {
    const t = name.trim();
    if (t.length === 0) {
      await AsyncStorage.removeItem(KEY_DISPLAY_NAME);
    } else {
      await AsyncStorage.setItem(KEY_DISPLAY_NAME, t.slice(0, 80));
    }
  } catch {
    /* non-fatal */
  }
}

/** Alias for onboarding / bootstrap code paths. */
export const getStoredDisplayName = getDisplayName;
export const setStoredDisplayName = setDisplayName;

export async function getStoredUserId(): Promise<number | null> {
  try {
    let raw = await AsyncStorage.getItem(KEY_USER_ID);
    if (raw == null || raw.trim() === '') {
      raw = await AsyncStorage.getItem(LEGACY_USER_ID);
      if (raw != null && raw.trim() !== '') {
        const id = parseInt(raw.trim(), 10);
        if (Number.isFinite(id) && id > 0) {
          await AsyncStorage.setItem(KEY_USER_ID, String(id));
        }
      }
    }
    if (raw == null || raw.trim() === '') return null;
    const id = parseInt(raw.trim(), 10);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export async function setStoredUserId(userId: number): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_USER_ID, String(userId));
    await AsyncStorage.setItem(LEGACY_USER_ID, String(userId));
  } catch {
    /* non-fatal */
  }
}

export async function clearStoredUserId(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([KEY_USER_ID, LEGACY_USER_ID]);
  } catch {
    /* non-fatal */
  }
}

/**
 * Stable per-install device id for POST /api/users (not regenerated each launch).
 */
export async function getOrCreateDeviceId(): Promise<string> {
  try {
    let id = await AsyncStorage.getItem(KEY_DEVICE_ID);
    if (id != null && id.trim() !== '') {
      return id.trim();
    }
    const legacy = await AsyncStorage.getItem(LEGACY_DEVICE_ID);
    if (legacy != null && legacy.trim() !== '') {
      await AsyncStorage.setItem(KEY_DEVICE_ID, legacy.trim());
      return legacy.trim();
    }
    const created = `spikesense-android-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await AsyncStorage.setItem(KEY_DEVICE_ID, created);
    await AsyncStorage.setItem(LEGACY_DEVICE_ID, created);
    return created;
  } catch {
    return `spikesense-android-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/** Vocative for greetings: stored name or a neutral fallback (never empty). */
export function callName(displayName: string | null | undefined): string {
  const t = (displayName ?? '').trim();
  return t.length > 0 ? t : 'friend';
}

/** Dev / QA: clear onboarding flags so the flow shows again. */
export async function resetOnboardingForTesting(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      KEY_ONBOARDING,
      KEY_DISPLAY_NAME,
      KEY_USER_ID,
      KEY_DEVICE_ID,
      LEGACY_USER_ID,
      LEGACY_DEVICE_ID,
    ]);
  } catch {
    /* non-fatal */
  }
}
