package com.spikesense;

import android.app.AppOpsManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Process;
import android.provider.Settings;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;

/**
 * JS bridge: delegates foreground resolution to {@link UsageStatsResolver}.
 */
public class UsageStatsModule extends ReactContextBaseJavaModule {

    private static final String TAG = "UsageStatsModule";

    public UsageStatsModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "UsageStatsModule";
    }

    /**
     * Whether PACKAGE_USAGE_STATS is allowed for this app (Usage Access).
     */
    @ReactMethod
    public void hasUsageAccessPermission(Promise promise) {
        try {
            Context ctx = getReactApplicationContext();
            AppOpsManager appOps = (AppOpsManager) ctx.getSystemService(Context.APP_OPS_SERVICE);
            if (appOps == null) {
                promise.resolve(false);
                return;
            }
            int mode;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                mode = appOps.unsafeCheckOpNoThrow(
                        AppOpsManager.OPSTR_GET_USAGE_STATS,
                        Process.myUid(),
                        ctx.getPackageName());
            } else {
                @SuppressWarnings("deprecation")
                int legacy = appOps.checkOp(
                        AppOpsManager.OPSTR_GET_USAGE_STATS,
                        Process.myUid(),
                        ctx.getPackageName());
                mode = legacy;
            }
            promise.resolve(mode == AppOpsManager.MODE_ALLOWED);
        } catch (Exception e) {
            Log.e(TAG, "hasUsageAccessPermission failed", e);
            promise.reject("ERROR", e);
        }
    }

    /**
     * Opens the system Usage Access screen (explicit user action).
     */
    @ReactMethod
    public void openUsageAccessSettings(Promise promise) {
        Context ctx = getReactApplicationContext();
        try {
            Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
            promise.resolve(true);
        } catch (Exception e) {
            Log.w(TAG, "openUsageAccessSettings primary failed", e);
            try {
                Intent fallback = new Intent(Settings.ACTION_SETTINGS);
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(fallback);
                promise.resolve(true);
            } catch (Exception e2) {
                Log.e(TAG, "openUsageAccessSettings fallback failed", e2);
                promise.reject("OPEN_FAILED", e2);
            }
        }
    }

    @ReactMethod
    public void getCurrentApp(Promise promise) {
        try {
            String pkg = UsageStatsResolver.resolveForegroundPackage(getReactApplicationContext());
            promise.resolve(pkg != null ? pkg : "Unknown");
        } catch (Exception e) {
            Log.e(TAG, "getCurrentApp failed", e);
            promise.reject("ERROR", e);
        }
    }

    @ReactMethod
    public void getCurrentAppInfo(Promise promise) {
        try {
            UsageStatsResolver.ForegroundApp fa =
                    UsageStatsResolver.resolveForegroundApp(getReactApplicationContext());
            if (fa == null) {
                promise.resolve(null);
                return;
            }

            if (fa.ignored) {
                WritableMap ignored = Arguments.createMap();
                ignored.putBoolean("ignored", true);
                ignored.putString("packageName", fa.packageName);
                promise.resolve(ignored);
                return;
            }

            WritableMap out = Arguments.createMap();
            out.putString("packageName", fa.packageName);
            out.putString("appName", fa.appName);
            out.putString("category", fa.category);
            out.putString("categorySource", "heuristic");
            promise.resolve(out);
        } catch (Exception e) {
            Log.e(TAG, "getCurrentAppInfo failed", e);
            promise.reject("ERROR", e);
        }
    }
}
