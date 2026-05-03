import { Platform } from 'react-native';
import { NativeStabilizationFlags } from '@/constants/nativeStabilizationFlags';
import type { UsageEventResponse } from '@/services/api';
import { emitFocusEnforcement, type FocusEnforcementPayload } from '@/services/focusEnforcementBridge';
import { isFocusSessionRuntimeActive } from '@/services/focusSessionRuntime';
import { emitMiniOrbAlert, type MiniOrbEvent } from '@/services/nudgeInterventionBridge';
import { setInterventionSnapshot } from '@/services/nudgeInterventionState';
import { scheduleMildNudgeNotification } from '@/services/nudgeNotifications';
import type { NudgeDeliveryTier, NudgeRealtimePayload } from '@/types/nudgeDelivery';

const MINI_ORB_ID_DEDUPE_MS = 3500;
const MINI_ORB_GLOBAL_DEDUPE_MS = 2500;

let lastMiniGlobAt = 0;
const lastMiniByNudgeId = new Map<string, number>();

function dedupeKeyForMini(payload: NudgeRealtimePayload): string {
  if (payload.id != null && Number.isFinite(payload.id)) return `id:${payload.id}`;
  return `h:${(payload.message || '').slice(0, 64)}|${(payload.pattern || '')}`;
}

function isMiniOrbThrottled(payload: NudgeRealtimePayload, now: number): boolean {
  if (now - lastMiniGlobAt < MINI_ORB_GLOBAL_DEDUPE_MS) {
    if (__DEV__) {
      console.log('[FRONTEND][INTERVENTION_SUPPRESSED]', { reason: 'mini_orb_global', at: now });
    }
    return true;
  }
  const k = dedupeKeyForMini(payload);
  const prev = lastMiniByNudgeId.get(k);
  if (prev != null && now - prev < MINI_ORB_ID_DEDUPE_MS) {
    if (__DEV__) {
      console.log('[FRONTEND][INTERVENTION_SUPPRESSED]', { reason: 'mini_orb_dedup', k });
    }
    return true;
  }
  return false;
}

function recordMiniOrb(payload: NudgeRealtimePayload, now: number) {
  lastMiniGlobAt = now;
  lastMiniByNudgeId.set(dedupeKeyForMini(payload), now);
  for (const [key, t] of lastMiniByNudgeId) {
    if (now - t > 60_000) lastMiniByNudgeId.delete(key);
  }
}

function showMiniOrb(
  nudgePayload: NudgeRealtimePayload,
  userId: number | null,
  now: number,
  reason: string
) {
  const event: MiniOrbEvent = { payload: nudgePayload, userId, at: now };
  emitMiniOrbAlert(event);
  setInterventionSnapshot({
    currentIntervention: 'mini_orb',
    lastNudgeIdShown: nudgePayload.id ?? null,
    lastMiniOrbShownAt: now,
  });
  if (__DEV__) {
    console.log('[FRONTEND][MINI_SPIKE_ORB_SHOW]', {
      userId,
      nudgeId: nudgePayload.id,
      severity: nudgePayload.severity,
      pattern: nudgePayload.pattern,
      reason,
    });
  }
}

/**
 * Process real-time options from POST /users/:id/events. Does not replace fetch nudges.
 * Priority: Focus Guard > (suppress if focus session) > mini_orb / notification
 */
export async function processUsageEventIntervention(
  raw: UsageEventResponse | null | undefined,
  userId: number | null
): Promise<void> {
  try {
    await processUsageEventInterventionInner(raw, userId);
  } catch (e) {
    if (__DEV__) {
      console.warn('[FRONTEND][INTERVENTION_ISOLATED]', e);
    }
  }
}

async function processUsageEventInterventionInner(
  raw: UsageEventResponse | null | undefined,
  userId: number | null
): Promise<void> {
  if (!raw || (raw as { success?: boolean }).success === false) return;

  if (raw.enforcement === true) {
    if (__DEV__) {
      const np = (raw as { nudge_payload?: NudgeRealtimePayload }).nudge_payload;
      console.log('[FRONTEND][NUDGE_DELIVERY]', {
        userId,
        tier: 'focus_guard' as NudgeDeliveryTier,
        nudgeId: np?.id,
        severity: np?.severity,
        pattern: np?.pattern,
      });
    }
    setInterventionSnapshot({ currentIntervention: 'focus_guard' });
    const p: FocusEnforcementPayload = {
      category: String(raw.category ?? 'unknown'),
      timestamp: Date.now(),
      violationsCount:
        typeof raw.violations_count === 'number' ? raw.violations_count : 0,
    };
    emitFocusEnforcement(p);
    return;
  }

  const tier = (raw as { nudge_delivery?: NudgeDeliveryTier }).nudge_delivery;
  const nudgePayload = (raw as { nudge_payload?: NudgeRealtimePayload }).nudge_payload;

  if (isFocusSessionRuntimeActive() && (tier === 'notification' || tier === 'mini_orb')) {
    if (__DEV__) {
      console.log('[FRONTEND][INTERVENTION_SUPPRESSED]', {
        userId,
        reason: 'focus_session_active',
        wouldHave: tier,
        nudgeId: nudgePayload?.id,
        severity: nudgePayload?.severity,
        pattern: nudgePayload?.pattern,
      });
    }
    return;
  }

  if (!tier || !nudgePayload) {
    return;
  }

  if (tier === 'focus_guard') {
    return;
  }

  if (tier === 'notification') {
    if (Platform.OS === 'web') {
      if (__DEV__) {
        console.log('[FRONTEND][NUDGE_DELIVERY]', { userId, tier, fallback: 'mini_orb_web' });
      }
      const now = Date.now();
      if (isMiniOrbThrottled(nudgePayload, now)) return;
      recordMiniOrb(nudgePayload, now);
      showMiniOrb(nudgePayload, userId, now, 'web_no_notif');
      return;
    }

    if (__DEV__) {
      console.log('[FRONTEND][NUDGE_DELIVERY]', {
        userId,
        tier: 'notification',
        nudgeId: nudgePayload.id,
        severity: nudgePayload.severity,
        pattern: nudgePayload.pattern,
      });
    }

    if (!NativeStabilizationFlags.ENABLE_NATIVE_POST_EVENT_INTERVENTIONS) {
      const now = Date.now();
      if (isMiniOrbThrottled(nudgePayload, now)) return;
      recordMiniOrb(nudgePayload, now);
      if (__DEV__) {
        console.log('[FRONTEND][NUDGE_DELIVERY]', {
          userId,
          tier: 'notification',
          fallback: 'mini_orb_native_flag_off',
        });
      }
      showMiniOrb(nudgePayload, userId, now, 'native_notif_disabled');
      return;
    }

    const res = await scheduleMildNudgeNotification(nudgePayload, userId);
    if (res.ok) {
      setInterventionSnapshot({
        currentIntervention: 'notification',
        lastNudgeIdShown: nudgePayload.id ?? null,
        lastNotificationHash: hashMessage(nudgePayload),
      });
      return;
    }
    if (res.canFallbackToMini) {
      const now = Date.now();
      if (isMiniOrbThrottled(nudgePayload, now)) {
        if (__DEV__) {
          console.log('[FRONTEND][INTERVENTION_SUPPRESSED]', { reason: 'notif_to_mini_throttled' });
        }
        return;
      }
      recordMiniOrb(nudgePayload, now);
      if (__DEV__) {
        console.log('[FRONTEND][NUDGE_DELIVERY]', { userId, tier, fallback: 'notif_to_mini' });
      }
      showMiniOrb(nudgePayload, userId, now, 'notif_permission_fallback');
    } else {
      if (__DEV__) {
        console.log('[FRONTEND][INTERVENTION_SUPPRESSED]', { reason: res.reason, userId, tier: 'notification' });
      }
    }
    return;
  }

  if (tier === 'mini_orb') {
    if (__DEV__) {
      console.log('[FRONTEND][NUDGE_DELIVERY]', {
        userId,
        tier: 'mini_orb',
        nudgeId: nudgePayload.id,
        severity: nudgePayload.severity,
        pattern: nudgePayload.pattern,
      });
    }
    const now = Date.now();
    if (isMiniOrbThrottled(nudgePayload, now)) {
      return;
    }
    recordMiniOrb(nudgePayload, now);
    showMiniOrb(nudgePayload, userId, now, 'tier');
  }
}

function hashMessage(p: NudgeRealtimePayload): string {
  return `${p.id ?? 0}|${(p.message || '').slice(0, 100)}`;
}
