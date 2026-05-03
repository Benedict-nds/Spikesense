package com.spikesense;

import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.AdaptiveIconDrawable;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.util.Base64;
import android.util.Log;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.io.ByteArrayOutputStream;

/**
 * Exposes app launcher icons as data URIs for React Native {@code Image}.
 */
public class AppIconModule extends ReactContextBaseJavaModule {

    private static final String TAG = "NATIVE_ICON";
    private static final int ICON_PX = 96;

    public AppIconModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "AppIconModule";
    }

    @ReactMethod
    public void getAppIconBase64(String packageName, Promise promise) {
        if (packageName == null || packageName.trim().isEmpty()) {
            promise.resolve(null);
            return;
        }
        final String pkg = packageName.trim();
        Log.i(TAG, "[NATIVE_ICON][REQUEST] package=" + pkg);
        try {
            PackageManager pm = getReactApplicationContext().getPackageManager();
            Drawable drawable;
            try {
                drawable = pm.getApplicationIcon(pkg);
            } catch (PackageManager.NameNotFoundException e) {
                Log.w(TAG, "[NATIVE_ICON][FAIL] package=" + pkg + " reason=name_not_found");
                promise.resolve(null);
                return;
            }

            Bitmap bmp = drawableToBitmap(drawable, ICON_PX, ICON_PX);
            if (bmp == null) {
                Log.w(TAG, "[NATIVE_ICON][FAIL] package=" + pkg + " reason=bitmap_null");
                promise.resolve(null);
                return;
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            bmp.compress(Bitmap.CompressFormat.PNG, 100, baos);
            String b64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);
            String dataUri = "data:image/png;base64," + b64;
            Log.i(TAG, "[NATIVE_ICON][SUCCESS] package=" + pkg);
            promise.resolve(dataUri);
        } catch (Exception e) {
            Log.e(TAG, "[NATIVE_ICON][FAIL] package=" + pkg + " reason=exception", e);
            promise.resolve(null);
        }
    }

    private static Bitmap drawableToBitmap(Drawable drawable, int w, int h) {
        if (drawable instanceof BitmapDrawable) {
            Bitmap bm = ((BitmapDrawable) drawable).getBitmap();
            if (bm != null && !bm.isRecycled()) {
                return Bitmap.createScaledBitmap(bm, w, h, true);
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && drawable instanceof AdaptiveIconDrawable) {
            Bitmap bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);
            drawable.setBounds(0, 0, w, h);
            drawable.draw(canvas);
            return bitmap;
        }
        Bitmap bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        drawable.setBounds(0, 0, w, h);
        drawable.draw(canvas);
        return bitmap;
    }
}
