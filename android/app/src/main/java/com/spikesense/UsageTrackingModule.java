package com.spikesense;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;

/**
 * JS bridge to start/stop {@link UsageTrackingService} and persist {@code userId} + API base URL.
 */
public class UsageTrackingModule extends ReactContextBaseJavaModule {

    private static final String TAG = "UsageTrackingModule";

    public UsageTrackingModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "UsageTrackingModule";
    }

    @ReactMethod
    public void startTrackingService(double userId, String apiBaseUrl, Promise promise) {
        try {
            if (Double.isNaN(userId) || userId <= 0) {
                promise.reject("E_INVALID_USER", "userId must be positive");
                return;
            }
            if (apiBaseUrl == null || apiBaseUrl.trim().isEmpty()) {
                promise.reject("E_INVALID_URL", "apiBaseUrl is required");
                return;
            }

            Context ctx = getReactApplicationContext();
            SharedPreferences prefs = ctx.getSharedPreferences(UsageTrackingService.PREF_NAME, Context.MODE_PRIVATE);
            prefs.edit()
                    .putLong(UsageTrackingService.KEY_USER_ID, (long) userId)
                    .putString(UsageTrackingService.KEY_API_BASE_URL, apiBaseUrl.trim())
                    .apply();

            Intent intent = new Intent(ctx, UsageTrackingService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ContextCompat.startForegroundService(ctx, intent);
            } else {
                ctx.startService(intent);
            }

            Log.i(TAG, "startTrackingService userId=" + (long) userId);
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "startTrackingService failed", e);
            promise.reject("E_START_FAILED", e);
        }
    }

    @ReactMethod
    public void stopTrackingService(Promise promise) {
        try {
            Context ctx = getReactApplicationContext();
            Intent intent = new Intent(ctx, UsageTrackingService.class);
            ctx.stopService(intent);
            Log.i(TAG, "stopTrackingService");
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "stopTrackingService failed", e);
            promise.reject("E_STOP_FAILED", e);
        }
    }

    @ReactMethod
    public void getTrackingServiceStatus(Promise promise) {
        try {
            WritableMap map = Arguments.createMap();
            map.putBoolean("running", UsageTrackingService.isRunning());
            promise.resolve(map);
        } catch (Exception e) {
            promise.reject("E_STATUS", e);
        }
    }
}
