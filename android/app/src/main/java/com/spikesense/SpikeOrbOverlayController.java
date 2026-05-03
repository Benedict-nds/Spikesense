package com.spikesense;

import android.content.Context;
import android.content.Intent;

import androidx.annotation.NonNull;

import org.json.JSONObject;

/**
 * Starts {@link SpikeOrbOverlayService} for focus-guard and mini-orb style overlays.
 */
public final class SpikeOrbOverlayController {

    private SpikeOrbOverlayController() {
    }

    public static void showFocusGuard(@NonNull Context context, @NonNull JSONObject raw) {
        if (!NativeStabilizationFlags.ENABLE_FOCUS_GUARD_OVERLAY) {
            return;
        }
        Intent intent = new Intent(context.getApplicationContext(), SpikeOrbOverlayService.class);
        intent.putExtra(SpikeOrbOverlayService.EXTRA_MODE, SpikeOrbOverlayService.MODE_FOCUS_GUARD);
        intent.putExtra(SpikeOrbOverlayService.EXTRA_MESSAGE, raw.optString("reason", "Focus"));
        intent.putExtra(SpikeOrbOverlayService.EXTRA_PAYLOAD_JSON, raw.toString());
        context.getApplicationContext().startService(intent);
    }

    public static void showNudgeOrb(
            @NonNull Context context,
            @NonNull JSONObject payload,
            @NonNull String tier) {
        if (!NativeStabilizationFlags.ENABLE_NATIVE_POST_EVENT_INTERVENTIONS) {
            return;
        }
        Intent intent = new Intent(context.getApplicationContext(), SpikeOrbOverlayService.class);
        intent.putExtra(SpikeOrbOverlayService.EXTRA_MODE, SpikeOrbOverlayService.MODE_MINI_ORB);
        intent.putExtra(SpikeOrbOverlayService.EXTRA_TIER, tier);
        intent.putExtra(SpikeOrbOverlayService.EXTRA_MESSAGE, payload.optString("message", ""));
        intent.putExtra(SpikeOrbOverlayService.EXTRA_SEVERITY, payload.optString("severity", ""));
        intent.putExtra(SpikeOrbOverlayService.EXTRA_PAYLOAD_JSON, payload.toString());
        context.getApplicationContext().startService(intent);
    }
}
