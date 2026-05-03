package com.spikesense;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Foreground service: polls foreground app and POSTs one usage row per completed foreground
 * session to {@code /api/users/{id}/events}. Optional native nudge handling is controlled by
 * {@link NativeStabilizationFlags} (see {@link SpikeSenseNudgeResponseHandler}).
 */
public class UsageTrackingService extends Service {

    private static final String TAG = "SESSION";
    private static final String TAG_NET = "NATIVE_NUDGE";

    public static final String PREF_NAME = "spikesense_usage_tracking";
    public static final String KEY_USER_ID = "user_id";
    public static final String KEY_API_BASE_URL = "api_base_url";

    private static final int FGS_NOTIFICATION_ID = 42;
    private static final String FGS_CHANNEL_ID = "spikesense_usage_tracking_fgs";
    private static final long POLL_MS = 3000L;
    /** One stable poll keeps switch detection responsive while still filtering single-frame noise. */
    private static final int STABLE_POLLS_REQUIRED = 1;
    private static final long EMIT_DEDUPE_MS = 3000L;
    /** Sessions shorter than this are not POSTed; {@code >=} this value is sent. */
    private static final int MIN_SESSION_SECONDS = 5;

    private static volatile boolean sRunning = false;

    private final Object sessionLock = new Object();

    public static boolean isRunning() {
        return sRunning;
    }

    private HandlerThread workerThread;
    private Handler worker;
    private Runnable pollRunnable;

    @Nullable
    private String lastTrackedPackage;
    @Nullable
    private String lastAppName;
    @NonNull
    private String lastCategory = "other";
    private long lastSwitchTime;
    @Nullable
    private String stableCandidatePackage;
    private int stableCandidateHits;
    /** When &gt; 0, user is in launcher/settings; session wall clock is paused (not counted). */
    private long ignoredSinceMs;
    private long lastStillActiveLogAt;
    @Nullable
    private String lastEmittedAppName;
    @Nullable
    private String lastEmittedPackage;
    private int lastEmittedDuration = -1;
    private long lastEmittedAt;

    @Override
    public void onCreate() {
        super.onCreate();
        sRunning = true;
        startForegroundWithNotification();
        workerThread = new HandlerThread("UsageTrackingWorker");
        workerThread.start();
        Looper looper = workerThread.getLooper();
        worker = new Handler(looper);
        pollRunnable = this::onPollTick;
        worker.post(pollRunnable);
        Log.i("UsageTrackingService", "onCreate");
    }

    @Override
    public int onStartCommand(@Nullable Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Nullable
    @Override
    public IBinder onBind(@Nullable Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        sRunning = false;
        if (worker != null && pollRunnable != null) {
            worker.removeCallbacks(pollRunnable);
        }
        synchronized (sessionLock) {
            flushOpenSessionOnStopLocked("onDestroy");
        }
        if (workerThread != null) {
            try {
                workerThread.quitSafely();
            } catch (Exception ignored) {
                /* */
            }
        }
        try {
            stopForeground(true);
        } catch (Exception ignored) {
            /* */
        }
        super.onDestroy();
        Log.i("UsageTrackingService", "onDestroy");
    }

    private void startForegroundWithNotification() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null && nm.getNotificationChannel(FGS_CHANNEL_ID) == null) {
                NotificationChannel ch = new NotificationChannel(
                        FGS_CHANNEL_ID,
                        "SpikeSense usage tracking",
                        NotificationManager.IMPORTANCE_LOW
                );
                ch.setDescription("Session tracking for focus and insights");
                nm.createNotificationChannel(ch);
            }
        }
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launch == null) {
            launch = new Intent();
        }
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT
                | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent pi = PendingIntent.getActivity(this, 0, launch, flags);
        int icon = getApplicationInfo().icon;
        if (icon == 0) {
            icon = android.R.drawable.ic_menu_info_details;
        }
        Notification n = new NotificationCompat.Builder(this, FGS_CHANNEL_ID)
                .setContentTitle("SpikeSense")
                .setContentText("Tracking app usage in the background")
                .setSmallIcon(icon)
                .setContentIntent(pi)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOnlyAlertOnce(true)
                .build();
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(
                    FGS_NOTIFICATION_ID,
                    n,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
            );
        } else {
            startForeground(FGS_NOTIFICATION_ID, n);
        }
    }

    private void onPollTick() {
        if (!sRunning) {
            return;
        }
        try {
            synchronized (sessionLock) {
                tickOnceLocked();
            }
        } catch (Exception e) {
            Log.w("UsageTrackingService", "poll tick", e);
        } finally {
            if (sRunning && worker != null && pollRunnable != null) {
                worker.postDelayed(pollRunnable, POLL_MS);
            }
        }
    }

    private void tickOnceLocked() {
        SharedPreferences prefs = getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        long userId = prefs.getLong(KEY_USER_ID, 0L);
        String baseUrl = prefs.getString(KEY_API_BASE_URL, "");
        if (userId <= 0 || baseUrl == null || baseUrl.trim().isEmpty()) {
            return;
        }
        String apiBase = baseUrl.trim().replaceAll("/+$", "");

        UsageStatsResolver.ForegroundApp app = UsageStatsResolver.resolveForegroundApp(this);
        if (app == null) {
            return;
        }

        long now = System.currentTimeMillis();

        if (app.ignored) {
            stableCandidatePackage = null;
            stableCandidateHits = 0;
            if (lastTrackedPackage != null && ignoredSinceMs == 0L) {
                ignoredSinceMs = now;
                Log.i(TAG, "[SESSION_IGNORED_PAUSE] ignoredPkg=" + app.packageName + " sessionPkg=" + lastTrackedPackage);
            }
            return;
        }

        if (ignoredSinceMs > 0L) {
            long pauseMs = now - ignoredSinceMs;
            lastSwitchTime += pauseMs;
            Log.i(TAG, "[SESSION_RESUME_FROM_IGNORED] pauseMs=" + pauseMs + " sessionPkg=" + lastTrackedPackage);
            ignoredSinceMs = 0L;
        }

        String packageName = app.packageName;
        String appName = app.appName;
        String category = app.category;

        if (stableCandidatePackage == null || !stableCandidatePackage.equals(packageName)) {
            stableCandidatePackage = packageName;
            stableCandidateHits = 1;
        } else {
            stableCandidateHits += 1;
        }
        boolean stable = stableCandidateHits >= STABLE_POLLS_REQUIRED;
        if (!stable) {
            return;
        }

        if (lastTrackedPackage != null && lastTrackedPackage.equals(packageName)) {
            if (now - lastStillActiveLogAt >= 60_000L) {
                lastStillActiveLogAt = now;
                Log.i(TAG, "[SESSION_STILL_ACTIVE] pkg=" + packageName + " app=" + appName);
            }
            return;
        }

        if (lastTrackedPackage == null) {
            lastTrackedPackage = packageName;
            lastAppName = appName;
            lastCategory = category;
            lastSwitchTime = now;
            lastStillActiveLogAt = now;
            Log.i(TAG, "[SESSION_START] pkg=" + packageName + " app=" + appName);
            return;
        }

        String prevPkg = lastTrackedPackage;
        String prevName = lastAppName != null ? lastAppName : prevPkg;
        String prevCat = lastCategory;
        int durationSec = (int) ((now - lastSwitchTime) / 1000L);

        Log.i(TAG, "[SESSION_SWITCH] fromPkg=" + prevPkg + " toPkg=" + packageName);
        Log.i(TAG, "[SESSION_DURATION] seconds=" + durationSec + " pkg=" + prevPkg);

        if (durationSec < MIN_SESSION_SECONDS) {
            Log.i(TAG, "[SESSION_SKIP] reason=duration_lt_min durationSec=" + durationSec + " minSec=" + MIN_SESSION_SECONDS);
        } else {
            postUsageEvent(userId, apiBase, prevName, prevCat, durationSec, prevPkg);
        }
        Log.i(TAG, "[SESSION_END] pkg=" + prevPkg + " durationSec=" + durationSec);

        lastTrackedPackage = packageName;
        lastAppName = appName;
        lastCategory = category;
        lastSwitchTime = now;
        lastStillActiveLogAt = now;
        Log.i(TAG, "[SESSION_START] pkg=" + packageName + " app=" + appName);
    }

    /**
     * Emit the open session when the service stops, using wall time only up to launcher pause if any.
     */
    private void flushOpenSessionOnStopLocked(@NonNull String reason) {
        SharedPreferences prefs = getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        long userId = prefs.getLong(KEY_USER_ID, 0L);
        String baseUrl = prefs.getString(KEY_API_BASE_URL, "");
        if (userId <= 0 || baseUrl == null || baseUrl.trim().isEmpty()) {
            lastTrackedPackage = null;
            lastAppName = null;
            lastCategory = "other";
            ignoredSinceMs = 0L;
            stableCandidatePackage = null;
            stableCandidateHits = 0;
            return;
        }
        String apiBase = baseUrl.trim().replaceAll("/+$", "");
        if (lastTrackedPackage == null) {
            ignoredSinceMs = 0L;
            return;
        }
        long now = System.currentTimeMillis();
        long endWall = ignoredSinceMs > 0L ? ignoredSinceMs : now;
        int durationSec = (int) ((endWall - lastSwitchTime) / 1000L);
        String prevPkg = lastTrackedPackage;
        String prevName = lastAppName != null ? lastAppName : prevPkg;
        String prevCat = lastCategory;
        Log.i(TAG, "[SESSION_END] reason=" + reason + " pkg=" + prevPkg + " durationSec=" + durationSec);
        Log.i(TAG, "[SESSION_DURATION] seconds=" + durationSec + " pkg=" + prevPkg + " (flush)");
        if (durationSec < MIN_SESSION_SECONDS) {
            Log.i(TAG, "[SESSION_SKIP] reason=flush_duration_lt_min durationSec=" + durationSec);
        } else {
            postUsageEvent(userId, apiBase, prevName, prevCat, durationSec, prevPkg);
        }
        lastTrackedPackage = null;
        lastAppName = null;
        lastCategory = "other";
        ignoredSinceMs = 0L;
        stableCandidatePackage = null;
        stableCandidateHits = 0;
    }

    private void postUsageEvent(
            long userId,
            @NonNull String apiBase,
            @NonNull String appName,
            @NonNull String category,
            int durationSeconds,
            @NonNull String packageName) {
        if (packageName.trim().isEmpty()) {
            return;
        }
        if (durationSeconds < MIN_SESSION_SECONDS) {
            Log.i(TAG, "[SESSION_SKIP] reason=post_guard durationSec=" + durationSeconds);
            return;
        }
        String pkg = packageName.trim();
        if (UsageStatsResolver.isIgnoredPackage(pkg)) {
            Log.i(TAG, "[SESSION_SKIP] reason=ignored_package pkg=" + pkg);
            return;
        }

        long now = System.currentTimeMillis();
        if (appName != null
                && appName.equals(lastEmittedAppName)
                && pkg.equals(lastEmittedPackage)
                && durationSeconds == lastEmittedDuration
                && (now - lastEmittedAt) < EMIT_DEDUPE_MS) {
            Log.i(TAG_NET, "[SESSION_SKIP] reason=dedupe_same_emit");
            return;
        }

        String url = buildEventsUrl(apiBase, userId);
        Log.i(TAG_NET, "[NATIVE_TRACK][EVENT_URL] url=" + url);
        HttpURLConnection conn = null;
        try {
            URL u = new URL(url);
            conn = (HttpURLConnection) u.openConnection();
            conn.setConnectTimeout(20000);
            conn.setReadTimeout(20000);
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            conn.setRequestProperty("Accept", "application/json");
            conn.setDoOutput(true);

            JSONObject body = new JSONObject();
            body.put("app_name", appName);
            body.put("category", category);
            body.put("duration", durationSeconds);
            body.put("package_name", pkg);
            byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(bytes);
            }

            int code = conn.getResponseCode();
            Log.i(TAG_NET, "[NATIVE_NUDGE][EVENT_POST_HTTP] code=" + code);

            String responseBody = "";
            if (code >= 200 && code < 300) {
                try (InputStream in = new BufferedInputStream(conn.getInputStream())) {
                    responseBody = readAllAsString(in);
                }
            } else {
                String errPreview = "";
                try {
                    InputStream errRaw = conn.getErrorStream();
                    if (errRaw != null) {
                        try (InputStream err = new BufferedInputStream(errRaw)) {
                            String ebody = readAllAsString(err);
                            errPreview = ebody.length() > 400 ? ebody.substring(0, 400) + "…" : ebody;
                        }
                    }
                } catch (Exception e) {
                    Log.w(TAG_NET, "[NATIVE_NUDGE][EVENT_POST_NON_2XX] read_error_stream code=" + code, e);
                }
                Log.w(
                    TAG_NET,
                    "[NATIVE_NUDGE][EVENT_POST_NON_2XX] code=" + code + " bodyPreview=" + errPreview.replace('\n', ' '));
                return;
            }

            Log.i(TAG, "[SESSION_EMIT] pkg=" + pkg + " durationSec=" + durationSeconds + " http=" + code);
            if (responseBody == null) {
                responseBody = "";
            }

            Log.i(TAG_NET, "[NATIVE_NUDGE][EVENT_POST_SUCCESS] code=" + code);
            String preview =
                responseBody.length() > 400 ? responseBody.substring(0, 400) + "…" : responseBody;
            Log.i(
                TAG_NET,
                "[NATIVE_NUDGE][EVENT_RESPONSE_BODY] length=" + responseBody.length()
                    + " bodyPreview=" + preview.replace('\n', ' '));

            boolean interventionsEnabled = NativeStabilizationFlags.ENABLE_NATIVE_POST_EVENT_INTERVENTIONS;
            Log.i(TAG_NET, "[NATIVE_NUDGE][INTERVENTION_FLAG] enabled=" + interventionsEnabled);
            Log.i(TAG_NET, "[NATIVE_NUDGE][HANDLER_CALLED] bodyLen=" + responseBody.length());
            SpikeSenseNudgeResponseHandler.handleEventsApiResponse(getApplicationContext(), responseBody);

            lastEmittedAppName = appName;
            lastEmittedPackage = pkg;
            lastEmittedDuration = durationSeconds;
            lastEmittedAt = now;
        } catch (Exception e) {
            Log.e(TAG_NET, "[NATIVE_NUDGE][EVENT_POST_ERROR]", e);
        } finally {
            if (conn != null) {
                try {
                    conn.disconnect();
                } catch (Exception ignored) {
                    /* */
                }
            }
        }
    }

    @NonNull
    private static String readAllAsString(@NonNull InputStream in) throws Exception {
        byte[] buf = new byte[4096];
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        int n;
        while ((n = in.read(buf)) > 0) {
            bos.write(buf, 0, n);
        }
        return new String(bos.toByteArray(), StandardCharsets.UTF_8);
    }

    @NonNull
    private static String buildEventsUrl(@NonNull String apiBaseRaw, long userId) {
        String base = apiBaseRaw.trim().replaceAll("/+$", "");
        String lower = base.toLowerCase();
        String path = lower.endsWith("/api")
                ? "/users/" + userId + "/events"
                : "/api/users/" + userId + "/events";
        return base + path;
    }
}
