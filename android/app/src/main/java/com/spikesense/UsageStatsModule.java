package com.spikesense;

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
