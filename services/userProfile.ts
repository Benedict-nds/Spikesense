import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_ONBOARDING = '@spikesense/onboarding_completed';
const KEY_DISPLAY_NAME = '@spikesense/display_name';

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

/** Vocative for greetings: stored name or a neutral fallback (never empty). */
export function callName(displayName: string | null | undefined): string {
  const t = (displayName ?? '').trim();
  return t.length > 0 ? t : 'friend';
}

/** Dev / QA: clear onboarding flags so the flow shows again. */
export async function resetOnboardingForTesting(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([KEY_ONBOARDING, KEY_DISPLAY_NAME]);
  } catch {
    /* non-fatal */
  }
}
