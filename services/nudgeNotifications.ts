import { AppState, Platform } from 'react-native';
import type { NudgeRealtimePayload } from '@/types/nudgeDelivery';

const NOTIF_DEDUPE_MS = 120_000;
export const NUDGE_CHANNEL_ID = 'nudge_mild';

let lastByHash: Map<string, number> = new Map();

function hashForPayload(p: NudgeRealtimePayload): string {
  const id = p.id != null && Number.isFinite(p.id) ? String(p.id) : '';
  return `${id}|${(p.message || '').slice(0, 120)}`;
}

let notificationsModule: typeof import('expo-notifications') | null = null;

async function loadNotifications(): Promise<typeof import('expo-notifications') | null> {
  if (Platform.OS === 'web') return null;
  if (notificationsModule) return notificationsModule;
  try {
    notificationsModule = await import('expo-notifications');
    return notificationsModule;
  } catch {
    return null;
  }
}

/**
 * Optional Android POST_NOTIFICATIONS prompt. Does not block callers if denied.
 */
export async function requestNotificationPermissionIfAndroidOptional(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const n = await loadNotifications();
  if (!n) {
    if (__DEV__) {
      console.log('[FRONTEND][NOTIFICATION_PERMISSION]', { granted: false, status: 'module_unavailable' });
    }
    return;
  }
  try {
    let status = (await n.getPermissionsAsync()).status;
    if (status !== 'granted') {
      const req = await n.requestPermissionsAsync();
      status = req.status;
    }
    if (__DEV__) {
      console.log('[FRONTEND][NOTIFICATION_PERMISSION]', { granted: status === 'granted', status });
    }
  } catch (e) {
    if (__DEV__) {
      console.log('[FRONTEND][NOTIFICATION_PERMISSION]', { granted: false, status: 'error', error: String(e) });
    }
  }
}

export async function initNudgeNotificationHandler(): Promise<void> {
  if (Platform.OS === 'web') return;
  const n = await loadNotifications();
  if (!n) return;
  n.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    try {
      await n.setNotificationChannelAsync(NUDGE_CHANNEL_ID, {
        name: 'SpikeSense insights',
        importance: n.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 120, 80, 120],
        lockscreenVisibility: n.AndroidNotificationVisibility.PUBLIC,
      });
    } catch {
      /* non-fatal */
    }
  }
}

function isNotificationThrottled(hash: string, now: number): boolean {
  const prev = lastByHash.get(hash);
  if (prev != null && now - prev < NOTIF_DEDUPE_MS) {
    return true;
  }
  for (const [h, t] of lastByHash) {
    if (now - t > NOTIF_DEDUPE_MS * 2) {
      lastByHash.delete(h);
    }
  }
  return false;
}

function recordNotificationSent(hash: string, now: number) {
  lastByHash.set(hash, now);
}

export type ScheduleNudgeResult =
  | { ok: true }
  | { ok: false; reason: 'web' | 'unavailable' | 'permission' | 'throttled' | 'unknown'; canFallbackToMini: boolean };

/**
 * Show a local notification for a mild nudge. Throttles repeated identical content.
 */
export async function scheduleMildNudgeNotification(
  payload: NudgeRealtimePayload,
  userId: number | null
): Promise<ScheduleNudgeResult> {
  if (Platform.OS === 'web') {
    if (__DEV__) {
      console.log('[FRONTEND][NUDGE_DELIVERY]', { userId, tier: 'notification', reason: 'skip_web' });
    }
    return { ok: false, reason: 'web', canFallbackToMini: false };
  }

  const n = await loadNotifications();
  if (!n) {
    return { ok: false, reason: 'unavailable', canFallbackToMini: AppState.currentState === 'active' };
  }

  const h = hashForPayload(payload);
  const now = Date.now();
  if (isNotificationThrottled(h, now)) {
    if (__DEV__) {
      console.log('[FRONTEND][INTERVENTION_SUPPRESSED]', { reason: 'notif_throttle', hash: h, userId });
    }
    return { ok: false, reason: 'throttled', canFallbackToMini: false };
  }

  try {
    const perm = await n.getPermissionsAsync();
    let status = perm.status;
    if (status !== 'granted') {
      const req = await n.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') {
      if (__DEV__) {
        console.log('[FRONTEND][INTERVENTION_SUPPRESSED]', { reason: 'notif_permission', userId });
      }
      return { ok: false, reason: 'permission', canFallbackToMini: AppState.currentState === 'active' };
    }

    const body = (payload.message || '').trim() || 'A quick insight for you';
    const extra =
      (payload.explanation && String(payload.explanation).trim()) != ''
        ? ` — ${String(payload.explanation).replace(/\n/g, ' ').slice(0, 200)}`
        : '';

    const content: Record<string, unknown> = {
      title: 'SpikeSense',
      body: (body + extra).slice(0, 500),
      data: {
        nudgeId: payload.id,
        userId: userId ?? 0,
        kind: 'nudge_mild',
        path: '/(tabs)/(home)',
      },
    };
    if (Platform.OS === 'android') {
      content.android = { channelId: NUDGE_CHANNEL_ID };
    }

    await n.scheduleNotificationAsync({
      content: content as never,
      trigger: null,
    });
    recordNotificationSent(h, now);

    if (__DEV__) {
      const nid = payload.id;
      const sev = payload.severity;
      const pat = payload.pattern;
      console.log('[FRONTEND][NUDGE_NOTIFICATION_SENT]', { userId, nudgeId: nid, severity: sev, pattern: pat });
    }

    return { ok: true };
  } catch (e) {
    if (__DEV__) {
      console.warn('[FRONTEND][NUDGE_NOTIFICATION_SENT] failed', e);
    }
    return { ok: false, reason: 'unknown', canFallbackToMini: AppState.currentState === 'active' };
  }
}

export function resetNudgeNotificationDedupeTestOnly(): void {
  lastByHash = new Map();
}
