import React, { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import MiniSpikeOrbAlert from '@/components/MiniSpikeOrbAlert';
import { initNudgeNotificationHandler } from '@/services/nudgeNotifications';
import { emitMiniOrbAlert, subscribeMiniOrbAlert, type MiniOrbEvent } from '@/services/nudgeInterventionBridge';
import { setInterventionSnapshot } from '@/services/nudgeInterventionState';
import type { NudgeRealtimePayload } from '@/types/nudgeDelivery';

const DEFAULT_OPEN = '/(tabs)/(home)';

/**
 * Renders the mini orb layer and wires local notification open actions.
 * Focus Guard remains in FocusEnforcementHost.
 */
export default function NudgeInterventionHost() {
  const router = useRouter();
  const [active, setActive] = useState<{
    payload: NudgeRealtimePayload;
    at: number;
  } | null>(null);

  const clear = useCallback(() => {
    setActive(null);
    setInterventionSnapshot({ currentIntervention: 'none' });
  }, []);

  useEffect(() => {
    return subscribeMiniOrbAlert((e: MiniOrbEvent | null) => {
      if (e && e.payload) {
        setActive({ payload: e.payload, at: e.at });
      }
    });
  }, []);

  useEffect(() => {
    void initNudgeNotificationHandler();
  }, []);

  const openApp = useCallback(() => {
    try {
      router.push(DEFAULT_OPEN as never);
    } catch {
      try {
        void Linking.openURL(Linking.createURL(DEFAULT_OPEN));
      } catch {
        /* */
      }
    }
    clear();
  }, [router, clear]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let cancelled = false;
    let sub: { remove: () => void } | undefined;
    (async () => {
      const n = await import('expo-notifications');
      if (cancelled) return;
      sub = n.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as
          | { path?: string; nudgeId?: number; userId?: number }
          | undefined;
        const p = data?.path;
        if (__DEV__) {
          console.log('[FRONTEND][NUDGE_DELIVERY]', { from: 'notif_tap', path: p, nudgeId: data?.nudgeId });
        }
        if (typeof p === 'string' && p.length > 0) {
          try {
            router.push(p as never);
            return;
          } catch {
            /* */
          }
        }
        try {
          router.push(DEFAULT_OPEN as never);
        } catch {
          void Linking.openURL(Linking.createURL(DEFAULT_OPEN));
        }
      });
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [router]);

  return (
    <MiniSpikeOrbAlert
      visible={!!active}
      payload={active?.payload ?? null}
      onDismiss={clear}
      onOpenPress={openApp}
    />
  );
}

/** Test-only: show a sample mini orb (dev menu / QA). */
export function debugEmitMiniSpikeOrb(payload: NudgeRealtimePayload) {
  emitMiniOrbAlert({ payload, userId: null, at: Date.now() });
}
