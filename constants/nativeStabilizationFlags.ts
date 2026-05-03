/**
 * Mirrors Java {@code NativeStabilizationFlags} for JS intervention routing.
 * Native FGS posts /events and shows system notifications when backgrounded; JS still handles foreground.
 */
export const NativeStabilizationFlags = {
  /** When true, foreground `notification` tier may use expo-notifications; native handles background. */
  ENABLE_NATIVE_POST_EVENT_INTERVENTIONS: true,
  /** Native floating Spike overlay when permitted; in-app FocusEnforcementModal unchanged. */
  ENABLE_FOCUS_GUARD_OVERLAY: true,
} as const;
