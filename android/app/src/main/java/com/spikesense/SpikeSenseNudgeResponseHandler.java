package com.spikesense;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

/**
 * Parses POST /users/:id/events JSON and triggers native nudge UI (notifications + optional overlay).
 */
public final class SpikeSenseNudgeResponseHandler {

    private static final String TAG = "NATIVE_NUDGE_HANDLER";
    private static final String CHANNEL_ID = "spikesense_nudge_delivery";
    private static final int NOTIF_BASE_ID = 91000;

    private SpikeSenseNudgeResponseHandler() {
    }

    public static void handleEventsApiResponse(
            @NonNull Context context,
            @Nullable String responseBody) {
        if (responseBody == null || responseBody.trim().isEmpty()) {
            return;
        }
        Context app = context.getApplicationContext();
        new Handler(Looper.getMainLooper()).post(() -> handleOnMainThread(app, responseBody));
    }

    private static void handleOnMainThread(@NonNull Context ctx, @NonNull String responseBody) {
        try {
            JSONObject json = new JSONObject(responseBody);

            if (json.optBoolean("enforcement", false) && NativeStabilizationFlags.ENABLE_FOCUS_GUARD_OVERLAY) {
                SpikeOrbOverlayController.showFocusGuard(ctx, json);
                return;
            }

            if (!NativeStabilizationFlags.ENABLE_NATIVE_POST_EVENT_INTERVENTIONS) {
                return;
            }

            if (!json.has("nudge_delivery")) {
                return;
            }
            String tier = json.optString("nudge_delivery", "");
            JSONObject payload = json.optJSONObject("nudge_payload");
            if (payload == null) {
                return;
            }

            if ("notification".equals(tier)) {
                postNudgeNotification(ctx, payload);
            } else if ("mini_orb".equals(tier) || "focus_guard".equals(tier)) {
                deliverMiniOrbOverlay(ctx, payload, tier);
            }
        } catch (Exception e) {
            Log.w(TAG, "handleEventsApiResponse", e);
        }
    }

    private static void deliverMiniOrbOverlay(
            @NonNull Context ctx,
            @NonNull JSONObject payload,
            @NonNull String tier) {
        String message = payload.optString("message", "").trim();
        String explanation = payload.optString("explanation", "").trim();
        String action = payload.optString("action_label", "").trim();
        if (action.isEmpty()) {
            action = payload.optString("actionLabel", "").trim();
        }

        if (message.isEmpty()) {
            message =
                    "Spike noticed rapid app switching. A short reset could help you settle back in.";
        }
        if (explanation.isEmpty()) {
            explanation =
                    "SpikeSense saw several app changes in a short period, which can make it harder to stay focused.";
        }
        if (action.isEmpty()) {
            action = "Return to Focus";
        }

        String severity = payload.optString("severity", "");
        String pattern = payload.optString("pattern", "");

        Log.i(
                TAG,
                "[NATIVE_NUDGE][OVERLAY_PAYLOAD] messageLen="
                        + message.length()
                        + " explanationLen="
                        + explanation.length()
                        + " actionLabel="
                        + action
                        + " delivery="
                        + tier
                        + " severity="
                        + severity
                        + " pattern="
                        + pattern);

        int drawable = SpikeOrbOverlayController.resolveSpikeDrawable(severity, false);
        SpikeOrbOverlayController.showNudgeOrb(
                ctx, message, explanation, action, severity, pattern, tier, drawable);
    }

    private static void postNudgeNotification(@NonNull Context ctx, @NonNull JSONObject payload) {
        String message = payload.optString("message", "SpikeSense");
        String title = "SpikeSense";

        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) {
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = nm.getNotificationChannel(CHANNEL_ID);
            if (ch == null) {
                ch = new NotificationChannel(
                        CHANNEL_ID,
                        "SpikeSense nudges",
                        NotificationManager.IMPORTANCE_DEFAULT
                );
                ch.setDescription("Real-time nudge messages from SpikeSense");
                nm.createNotificationChannel(ch);
            }
        }

        Intent launch = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (launch == null) {
            launch = new Intent();
        }
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT
                | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent content = PendingIntent.getActivity(ctx, 0, launch, piFlags);

        int smallIcon = ctx.getApplicationInfo().icon;
        if (smallIcon == 0) {
            smallIcon = android.R.drawable.ic_dialog_info;
        }

        int notifId = NOTIF_BASE_ID + (Math.abs(payload.optString("message", "x").hashCode()) % 8000);

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(message))
                .setSmallIcon(smallIcon)
                .setContentIntent(content)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT);

        nm.notify(notifId, b.build());
    }
}
