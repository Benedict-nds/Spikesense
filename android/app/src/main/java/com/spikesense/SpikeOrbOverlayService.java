package com.spikesense;

import android.app.Service;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageView;

import androidx.annotation.Nullable;

import com.anonymous.Natively.R;

/**
 * Short-lived overlay window (mini Spike orb / focus guard hint). Requires
 * {@link Settings#canDrawOverlays} to be true.
 */
public class SpikeOrbOverlayService extends Service {

    public static final String EXTRA_MODE = "mode";
    public static final String EXTRA_MESSAGE = "message";
    public static final String EXTRA_SEVERITY = "severity";
    public static final String EXTRA_TIER = "tier";
    public static final String EXTRA_PAYLOAD_JSON = "payload_json";

    public static final String MODE_FOCUS_GUARD = "focus_guard";
    public static final String MODE_MINI_ORB = "mini_orb";

    private static final long AUTO_DISMISS_MS = 8000L;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private WindowManager windowManager;
    @Nullable
    private View overlayView;
    private final Runnable dismissRunnable = this::removeOverlayAndStop;

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(@Nullable Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }
        mainHandler.post(() -> showOverlay(intent));
        return START_NOT_STICKY;
    }

    private void showOverlay(Intent intent) {
        if (!Settings.canDrawOverlays(this)) {
            stopSelf();
            return;
        }
        removeOverlayInternal();

        String mode = intent.getStringExtra(EXTRA_MODE);
        String severity = intent.getStringExtra(EXTRA_SEVERITY);
        int drawableRes = drawableForSeverity(severity, MODE_FOCUS_GUARD.equals(mode));

        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        if (windowManager == null) {
            stopSelf();
            return;
        }

        int sizePx = dpToPx(112);
        ImageView imageView = new ImageView(this);
        imageView.setImageResource(drawableRes);
        imageView.setScaleType(ImageView.ScaleType.FIT_CENTER);
        imageView.setOnTouchListener((v, e) -> {
            if (e.getAction() == MotionEvent.ACTION_UP) {
                mainHandler.removeCallbacks(dismissRunnable);
                removeOverlayAndStop();
                return true;
            }
            return false;
        });

        int overlayType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;

        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                sizePx,
                sizePx,
                overlayType,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.TOP | Gravity.END;
        params.x = dpToPx(12);
        params.y = dpToPx(72);

        try {
            windowManager.addView(imageView, params);
            overlayView = imageView;
            mainHandler.postDelayed(dismissRunnable, AUTO_DISMISS_MS);
        } catch (Exception e) {
            stopSelf();
        }
    }

    private int dpToPx(int dp) {
        DisplayMetrics m = getResources().getDisplayMetrics();
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, dp, m));
    }

    private int drawableForSeverity(@Nullable String severity, boolean focusGuard) {
        if (focusGuard) {
            return R.drawable.spike_focused;
        }
        if (severity == null) {
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

    private void removeOverlayAndStop() {
        removeOverlayInternal();
        stopSelf();
    }

    private void removeOverlayInternal() {
        mainHandler.removeCallbacks(dismissRunnable);
        if (windowManager != null && overlayView != null) {
            try {
                windowManager.removeView(overlayView);
            } catch (Exception ignored) {
                /* */
            }
        }
        overlayView = null;
    }

    @Override
    public void onDestroy() {
        removeOverlayInternal();
        super.onDestroy();
    }
}
