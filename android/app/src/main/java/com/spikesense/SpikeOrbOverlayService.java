package com.spikesense;

import android.app.Service;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.Nullable;

import com.anonymous.Natively.R;

/**
 * Floating nudge card (Spike + message + explanation + CTA). Requires overlay permission.
 */
public class SpikeOrbOverlayService extends Service {

    private static final String LOG_TAG = "NATIVE_OVERLAY";

    public static final String EXTRA_MODE = "mode";
    public static final String EXTRA_MESSAGE = "message";
    public static final String EXTRA_EXPLANATION = "explanation";
    public static final String EXTRA_ACTION_LABEL = "action_label";
    public static final String EXTRA_SEVERITY = "severity";
    public static final String EXTRA_PATTERN = "pattern";
    public static final String EXTRA_TIER = "tier";
    public static final String EXTRA_PAYLOAD_JSON = "payload_json";
    public static final String EXTRA_SPIKE_DRAWABLE = "spike_drawable";

    public static final String MODE_FOCUS_GUARD = "focus_guard";
    public static final String MODE_MINI_ORB = "mini_orb";

    private static final long AUTO_DISMISS_MS = 9000L;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private WindowManager windowManager;
    @Nullable
    private View overlayRoot;
    private final Runnable dismissRunnable = () -> removeOverlayAndStop("timeout");

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
        mainHandler.post(() -> showCardOverlay(intent));
        return START_NOT_STICKY;
    }

    private void showCardOverlay(Intent intent) {
        if (!Settings.canDrawOverlays(this)) {
            stopSelf();
            return;
        }
        removeOverlayInternal();

        String message = intent.getStringExtra(EXTRA_MESSAGE);
        String explanation = intent.getStringExtra(EXTRA_EXPLANATION);
        String actionLabel = intent.getStringExtra(EXTRA_ACTION_LABEL);
        int drawableRes = intent.getIntExtra(EXTRA_SPIKE_DRAWABLE, R.drawable.spike_motivated);
        if (drawableRes == 0) {
            drawableRes = R.drawable.spike_motivated;
        }

        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        if (windowManager == null) {
            stopSelf();
            return;
        }

        DisplayMetrics dm = getResources().getDisplayMetrics();
        int screenW = dm.widthPixels;
        int margin = dpToPx(16);
        int cardWidth = screenW - margin * 2;

        FrameLayout root = new FrameLayout(this);
        root.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT));

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.HORIZONTAL);
        int pad = dpToPx(14);
        card.setPadding(pad, pad, pad, pad);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.argb(235, 32, 35, 54));
        bg.setCornerRadius(dpToPx(16));
        bg.setStroke(dpToPx(1), Color.parseColor("#A78BFA"));
        card.setBackground(bg);
        card.setElevation(dpToPx(12));

        FrameLayout.LayoutParams cardLp = new FrameLayout.LayoutParams(cardWidth, ViewGroup.LayoutParams.WRAP_CONTENT);
        cardLp.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        cardLp.topMargin = dpToPx(80);
        cardLp.leftMargin = margin;
        cardLp.rightMargin = margin;

        ImageView spike = new ImageView(this);
        int spikePx = dpToPx(64);
        LinearLayout.LayoutParams spikeLp = new LinearLayout.LayoutParams(spikePx, spikePx);
        spikeLp.setMargins(0, 0, dpToPx(12), 0);
        spike.setLayoutParams(spikeLp);
        spike.setImageResource(drawableRes);
        spike.setScaleType(ImageView.ScaleType.FIT_CENTER);

        LinearLayout textCol = new LinearLayout(this);
        textCol.setOrientation(LinearLayout.VERTICAL);
        textCol.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));

        TextView title = new TextView(this);
        title.setText(message != null ? message : "");
        title.setTextColor(Color.WHITE);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setMaxLines(4);

        TextView sub = new TextView(this);
        sub.setText(explanation != null ? explanation : "");
        sub.setTextColor(Color.parseColor("#D6D9E6"));
        sub.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        sub.setPadding(0, dpToPx(6), 0, 0);
        sub.setMaxLines(6);

        String ctaText = (actionLabel != null && !actionLabel.trim().isEmpty())
                ? actionLabel.trim()
                : "Return to Focus";
        TextView cta = new TextView(this);
        cta.setText(ctaText);
        cta.setTextColor(Color.parseColor("#E9D5FF"));
        cta.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        cta.setTypeface(Typeface.DEFAULT_BOLD);
        cta.setPadding(0, dpToPx(12), 0, 0);
        cta.setOnClickListener(v -> {
            mainHandler.removeCallbacks(dismissRunnable);
            Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (launch != null) {
                launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                startActivity(launch);
            }
            removeOverlayAndStop("tap_cta");
        });

        textCol.addView(title);
        textCol.addView(sub);
        textCol.addView(cta);

        card.addView(spike);
        card.addView(textCol);

        TextView close = new TextView(this);
        close.setText("✕");
        close.setTextColor(Color.parseColor("#CBD5E1"));
        close.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        close.setPadding(dpToPx(8), dpToPx(4), dpToPx(8), dpToPx(8));
        FrameLayout.LayoutParams closeLp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
        closeLp.gravity = Gravity.END | Gravity.TOP;
        closeLp.topMargin = dpToPx(72);
        closeLp.rightMargin = margin + dpToPx(4);
        close.setOnClickListener(v -> {
            mainHandler.removeCallbacks(dismissRunnable);
            removeOverlayAndStop("tap_close");
        });

        root.addView(card, cardLp);
        root.addView(close, closeLp);

        int overlayType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;

        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                overlayType,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.TOP;

        boolean hasTitle = message != null && !message.trim().isEmpty();
        boolean hasExpl = explanation != null && !explanation.trim().isEmpty();
        boolean hasCta = ctaText.length() > 0;
        Log.i(LOG_TAG, "[NATIVE_OVERLAY][TEXT_BOUND] title=" + hasTitle + " explanation=" + hasExpl + " cta=" + hasCta);
        Log.i(
                LOG_TAG,
                "[NATIVE_OVERLAY][SHOWN] messageLen=" + (message != null ? message.length() : 0)
                        + " explanationLen=" + (explanation != null ? explanation.length() : 0));

        try {
            windowManager.addView(root, params);
            overlayRoot = root;
            mainHandler.postDelayed(dismissRunnable, AUTO_DISMISS_MS);
        } catch (Exception e) {
            Log.w(LOG_TAG, "addView failed", e);
            stopSelf();
        }
    }

    private int dpToPx(int dp) {
        DisplayMetrics m = getResources().getDisplayMetrics();
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, dp, m));
    }

    private void removeOverlayAndStop(String reason) {
        Log.i(LOG_TAG, "[NATIVE_OVERLAY][DISMISSED] reason=" + reason);
        removeOverlayInternal();
        stopSelf();
    }

    private void removeOverlayInternal() {
        mainHandler.removeCallbacks(dismissRunnable);
        if (windowManager != null && overlayRoot != null) {
            try {
                windowManager.removeView(overlayRoot);
            } catch (Exception ignored) {
                /* */
            }
        }
        overlayRoot = null;
    }

    @Override
    public void onDestroy() {
        removeOverlayInternal();
        super.onDestroy();
    }
}
