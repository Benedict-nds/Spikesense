/**
 * Lightweight process-wide flag: active focus session (drives enforcement UI gating).
 * Set from useAppUsageTracking when focus session state changes.
 */
let focusSessionActive = false;

export function setFocusSessionRuntimeActive(active: boolean): void {
  focusSessionActive = active;
}

export function isFocusSessionRuntimeActive(): boolean {
  return focusSessionActive;
}
