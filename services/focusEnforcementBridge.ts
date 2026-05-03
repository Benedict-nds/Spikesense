/**
 * Cross-cutting focus enforcement signals (native tracker → UI overlay).
 * Avoids coupling the tracker to React; root host + hook can subscribe.
 */

export type FocusEnforcementPayload = {
  category: string;
  timestamp: number;
  violationsCount: number;
} | null;

type Listener = (payload: FocusEnforcementPayload) => void;

const listeners = new Set<Listener>();

export function subscribeFocusEnforcement(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitFocusEnforcement(payload: FocusEnforcementPayload): void {
  listeners.forEach((fn) => {
    try {
      fn(payload);
    } catch {
      /* non-fatal */
    }
  });
}
