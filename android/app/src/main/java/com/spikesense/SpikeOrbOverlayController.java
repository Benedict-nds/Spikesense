package com.spikesense;

import android.content.Context;
import android.content.Intent;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.anonymous.Natively.R;

import org.json.JSONObject;

/**
 * Starts {@link SpikeOrbOverlayService} with message card extras.
 */
public final class SpikeOrbOverlayController {

    private static final String LOG_TAG = "NATIVE_OVERLAY";

    private SpikeOrbOverlayController() {
    }

    public static void showFocusGuard(@NonNull Context context, @NonNull JSONObject raw) {
        if (!NativeStabilizationFlags.ENABLE_FOCUS_GUARD_OVERLAY) {
            return;
        }
        JSONObject np = raw.optJSONObject("nudge_payload");
        String message = raw.optString("reason", "");
        if (message.trim().isEmpty() && np != null) {
            message = np.optString("message", "");
        }
        if (message.trim().isEmpty()) {
            message = "Stay on track";
        }
        String explanation = np != null ? np.optString("explanation", "").trim() : "";
        if (explanation.isEmpty()) {
            explanation = "SpikeSense is helping you protect focus. Return to the app when you’re ready.";
        }
        String action = np != null ? np.optString("action_label", "").trim() : "";
        if (action.isEmpty() && np != null) {
            action = np.optString("actionLabel", "").trim();
        }
        if (action.isEmpty()) {
            action = "Return to SpikeSense";
        }
        String severity = np != null ? np.optString("severity", "") : raw.optString("severity", "");
        String pattern = np != null ? np.optString("pattern", "") : raw.optString("pattern", "");
        int drawable = resolveSpikeDrawable(severity, true);
        emitOverlayCard(
                context,
                SpikeOrbOverlayService.MODE_FOCUS_GUARD,
                message,
                explanation,
                action,
                severity,
                pattern,
                SpikeOrbOverlayService.MODE_FOCUS_GUARD,
                drawable,
                raw.toString());
    }

    public static void showNudgeOrb(
            @NonNull Context context,
            @NonNull String message,
            @NonNull String explanation,
            @NonNull String actionLabel,
            @NonNull String severity,
            @NonNull String pattern,
            @NonNull String tier,
            int spikeDrawableResId) {
        if (!NativeStabilizationFlags.ENABLE_NATIVE_POST_EVENT_INTERVENTIONS) {
            return;
        }
        emitOverlayCard(
                context,
                SpikeOrbOverlayService.MODE_MINI_ORB,
                message,
                explanation,
                actionLabel,
                severity,
                pattern,
                tier,
                spikeDrawableResId,
                null);
    }

    private static void emitOverlayCard(
            @NonNull Context context,
            @NonNull String mode,
            @NonNull String message,
            @NonNull String explanation,
            @NonNull String actionLabel,
            @NonNull String severity,
            @NonNull String pattern,
            @NonNull String tier,
            int spikeDrawableResId,
            @Nullable String payloadJson) {
        logRequest(message, explanation);
        Intent intent = baseIntent(context, mode, message, explanation, actionLabel);
        intent.putExtra(SpikeOrbOverlayService.EXTRA_SEVERITY, severity);
        intent.putExtra(SpikeOrbOverlayService.EXTRA_PATTERN, pattern);
        intent.putExtra(SpikeOrbOverlayService.EXTRA_TIER, tier);
        intent.putExtra(SpikeOrbOverlayService.EXTRA_SPIKE_DRAWABLE, spikeDrawableResId);
        if (payloadJson != null) {
            intent.putExtra(SpikeOrbOverlayService.EXTRA_PAYLOAD_JSON, payloadJson);
        }
        context.getApplicationContext().startService(intent);
    }

    private static void logRequest(String message, String explanation) {
        Log.i(
                LOG_TAG,
                "[NATIVE_OVERLAY][REQUEST] messageLen=" + (message != null ? message.length() : 0)
                        + " explanationLen=" + (explanation != null ? explanation.length() : 0));
    }

    private static Intent baseIntent(
            Context context,
            String mode,
            String message,
            String explanation,
            String actionLabel) {
        Intent intent = new Intent(context.getApplicationContext(), SpikeOrbOverlayService.class);
        intent.putExtra(SpikeOrbOverlayService.EXTRA_MODE, mode);
        intent.putExtra(SpikeOrbOverlayService.EXTRA_MESSAGE, message);
        intent.putExtra(SpikeOrbOverlayService.EXTRA_EXPLANATION, explanation);
        intent.putExtra(SpikeOrbOverlayService.EXTRA_ACTION_LABEL, actionLabel);
        return intent;
    }

    public static int resolveSpikeDrawable(@Nullable String severity, boolean focusGuard) {
        if (focusGuard) {
            return R.drawable.spike_focused;
        }
        if (severity == null || severity.trim().isEmpty()) {
            return R.drawable.spike_motivated;
        }
        String s = severity.toLowerCase();
        if (s.contains("sleep")) {
            return R.drawable.spike_sleepy;
        }
        if (s.contains("celebr")) {
            return R.drawable.spike_celebrating;
        }
        if (s.contains("concern") || s.contains("warn") || s.contains("high") || s.contains("severe")) {
            return R.drawable.spike_concerned;
        }
        if (s.contains("focus")) {
            return R.drawable.spike_focused;
        }
        if (s.contains("calm")) {
            return R.drawable.spike_calm;
        }
        return R.drawable.spike_motivated;
    }
}
