import React, { useCallback, useEffect, useRef, useState } from 'react';
import FocusEnforcementModal from '@/components/FocusEnforcementModal';
import { apiService } from '@/services/api';
import { appUsageTracker } from '@/services/appUsageTracker';
import {
  emitFocusEnforcement,
  subscribeFocusEnforcement,
  type FocusEnforcementPayload,
} from '@/services/focusEnforcementBridge';
import { isFocusSessionRuntimeActive } from '@/services/focusSessionRuntime';
import { setInterventionSnapshot } from '@/services/nudgeInterventionState';
import { emitFocusSessionEnded } from '@/services/focusSessionBridge';
import { violationsCountToOrbState, type SpikeOrbState } from '@/utils/focusEnforcementEscalation';

const DEDUPE_MS = 1800;

/**
 * App-wide listener for focus enforcement from usage event responses.
 * Deduplicates rapid repeats; only shows when a focus session is active (runtime flag).
 */
export default function FocusEnforcementHost() {
  const [trigger, setTrigger] = useState<FocusEnforcementPayload>(null);
  const lastRef = useRef<{ key: string; t: number } | null>(null);

  useEffect(() => {
    return subscribeFocusEnforcement((p) => {
      if (p == null) {
        setTrigger(null);
        return;
      }

      if (!isFocusSessionRuntimeActive()) {
        if (__DEV__) {
          console.log('[FRONTEND][FOCUS_ENFORCEMENT_MODAL]', { skipped: 'no_active_focus', category: p.category, violations: p.violationsCount });
        }
        return;
      }

      const key = `${p.category}|${p.violationsCount}`;
      const t = Date.now();
      if (lastRef.current && lastRef.current.key === key && t - lastRef.current.t < DEDUPE_MS) {
        if (__DEV__) {
          const orb = ((): SpikeOrbState => {
            const m = violationsCountToOrbState(p.violationsCount);
            return m === 'calm' ? 'warning' : m;
          })();
          console.log('[FRONTEND][FOCUS_ENFORCEMENT_ESCALATION]', { action: 'deduped', key, orbState: orb });
        }
        return;
      }
      lastRef.current = { key, t };

      if (__DEV__) {
        const orb = ((): SpikeOrbState => {
          const m = violationsCountToOrbState(p.violationsCount);
          return m === 'calm' ? 'warning' : m;
        })();
        console.log('[FRONTEND][FOCUS_ENFORCEMENT_ESCALATION]', { action: 'show', key, violations: p.violationsCount, orbState: orb });
      }

      setTrigger(p);
    });
  }, []);

  const close = useCallback(() => {
    setInterventionSnapshot({ currentIntervention: 'none' });
    emitFocusEnforcement(null);
  }, []);

  const onContinueFocus = useCallback(() => {
    if (__DEV__) {
      const m = trigger ? violationsCountToOrbState(trigger.violationsCount) : 'calm';
      const orb: SpikeOrbState = m === 'calm' ? 'warning' : m;
      console.log('[FRONTEND][FOCUS_ENFORCEMENT_ESCALATION]', { action: 'continue_focus', resetTier: true, previousOrb: orb });
    }
    close();
  }, [close, trigger]);

  const onPauseSession = useCallback(async () => {
    const uid = appUsageTracker.getUserId();
    if (uid) {
      try {
        await apiService.stopFocusSession(uid);
      } catch {
        /* non-fatal */
      }
    }
    emitFocusSessionEnded();
    close();
  }, [close]);

  const onIgnore = useCallback(async () => {
    const uid = appUsageTracker.getUserId();
    if (uid) {
      try {
        await apiService.postFocusViolation(uid);
      } catch {
        /* non-fatal */
      }
    }
    close();
  }, [close]);

  if (!trigger) {
    return null;
  }

  const tier = violationsCountToOrbState(trigger.violationsCount);
  const orb: SpikeOrbState = tier === 'calm' ? 'warning' : tier;

  return (
    <FocusEnforcementModal
      visible
      category={trigger.category}
      violationsCount={trigger.violationsCount}
      orbState={orb}
      onContinueFocus={onContinueFocus}
      onPauseSession={onPauseSession}
      onIgnore={onIgnore}
    />
  );
}
