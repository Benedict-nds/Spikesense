import type { ClientInterventionKind } from '@/types/nudgeDelivery';

let currentIntervention: ClientInterventionKind = 'none';
let lastNudgeIdShown: number | null = null;
let lastNotificationHash: string | null = null;
let lastMiniOrbShownAt = 0;

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* non-fatal */
    }
  });
}

export function getCurrentInterventionKind(): ClientInterventionKind {
  return currentIntervention;
}

export function getLastNudgeIdShown(): number | null {
  return lastNudgeIdShown;
}

export function getLastNotificationHash(): string | null {
  return lastNotificationHash;
}

export function getLastMiniOrbShownAt(): number {
  return lastMiniOrbShownAt;
}

export function setInterventionSnapshot(updates: {
  currentIntervention?: ClientInterventionKind;
  lastNudgeIdShown?: number | null;
  lastNotificationHash?: string | null;
  lastMiniOrbShownAt?: number;
}): void {
  if (updates.currentIntervention != null) currentIntervention = updates.currentIntervention;
  if (updates.lastNudgeIdShown !== undefined) lastNudgeIdShown = updates.lastNudgeIdShown;
  if (updates.lastNotificationHash !== undefined) lastNotificationHash = updates.lastNotificationHash;
  if (updates.lastMiniOrbShownAt !== undefined) lastMiniOrbShownAt = updates.lastMiniOrbShownAt;
  notify();
}

export function subscribeInterventionState(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
