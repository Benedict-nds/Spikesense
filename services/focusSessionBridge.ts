/** Notify React layer when a focus session ends outside the hook (e.g. enforcement modal pause). */

type VoidFn = () => void;
const listeners = new Set<VoidFn>();

export function subscribeFocusSessionEnded(listener: VoidFn): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitFocusSessionEnded(): void {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* non-fatal */
    }
  });
}
