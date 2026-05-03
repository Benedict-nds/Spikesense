import type { NudgeRealtimePayload } from '@/types/nudgeDelivery';

export type MiniOrbEvent = {
  payload: NudgeRealtimePayload;
  userId: number | null;
  at: number;
};

type MiniOrbListener = (event: MiniOrbEvent | null) => void;

const miniOrbListeners = new Set<MiniOrbListener>();

export function subscribeMiniOrbAlert(listener: MiniOrbListener): () => void {
  miniOrbListeners.add(listener);
  return () => {
    miniOrbListeners.delete(listener);
  };
}

export function emitMiniOrbAlert(event: MiniOrbEvent | null): void {
  miniOrbListeners.forEach((fn) => {
    try {
      fn(event);
    } catch {
      /* non-fatal */
    }
  });
}
