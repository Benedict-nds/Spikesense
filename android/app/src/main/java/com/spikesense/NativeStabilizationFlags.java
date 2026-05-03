package com.spikesense;

/**
 * Native feature flags for post-/events interventions (kept in sync with
 * {@code constants/nativeStabilizationFlags.ts} conceptually).
 */
public final class NativeStabilizationFlags {

    private NativeStabilizationFlags() {
    }

    /** When true, native code may post notifications / overlay after FGS event responses. */
    public static final boolean ENABLE_NATIVE_POST_EVENT_INTERVENTIONS = true;

    /** When true, native floating Spike overlay may be used (requires overlay permission). */
    public static final boolean ENABLE_FOCUS_GUARD_OVERLAY = true;
}
