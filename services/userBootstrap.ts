import { apiService } from '@/services/api';
import {
  getOrCreateDeviceId,
  getStoredDisplayName,
  getStoredUserId,
  setStoredUserId,
} from '@/services/userProfile';

/**
 * Ensures a backend user exists and returns numeric user id (persists to AsyncStorage).
 */
export async function bootstrapUser(options?: { displayName?: string }): Promise<number> {
  const existing = await getStoredUserId();
  if (existing != null) {
    if (__DEV__) {
      console.log('[FRONTEND][USER_BOOTSTRAP_ALREADY_STORED]', { userId: existing });
    }
    return existing;
  }

  const deviceId = await getOrCreateDeviceId();
  const fromOpts = options?.displayName?.trim();
  const fromStorage = (await getStoredDisplayName())?.trim();
  const name = (fromOpts && fromOpts.length > 0 ? fromOpts : fromStorage && fromStorage.length > 0 ? fromStorage : null) ?? 'friend';

  const res = await apiService.bootstrapUser({
    device_id: deviceId,
    name,
    mode_preference: 'adaptive',
  });

  if (!res.success || res.userId == null) {
    const msg = res.error ?? 'User bootstrap failed';
    throw new Error(msg);
  }

  await setStoredUserId(res.userId);
  if (__DEV__) {
    console.log('[FRONTEND][USER_BOOTSTRAP_CREATED]', { userId: res.userId, deviceId });
  }
  return res.userId;
}
