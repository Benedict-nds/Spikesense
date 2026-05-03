package com.spikesense;

import android.app.AppOpsManager;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Process;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.SortedMap;
import java.util.TreeMap;

/**
 * Shared UsageStats + PackageManager resolution for JS module and {@link UsageTrackingService}.
 */
public final class UsageStatsResolver {

    private static final String TAG = "UsageStatsResolver";

    private static final String CAT_PRODUCTIVITY = "productivity";
    private static final String CAT_SOCIAL = "social";
    private static final String CAT_ENTERTAINMENT = "entertainment";
    private static final String CAT_OTHER = "other";

    private static final Set<String> IGNORED_PACKAGES = new HashSet<>(Arrays.asList(
            "com.anonymous.Natively",
            "host.exp.exponent",
            "com.android.launcher",
            "com.android.launcher2",
            "com.android.launcher3",
            "com.google.android.apps.nexuslauncher",
            "com.sec.android.app.launcher",
            "com.miui.home",
            "com.huawei.android.launcher",
            "com.oppo.launcher",
            "com.android.settings",
            "com.google.android.settings.intelligence"
    ));

    private UsageStatsResolver() {
    }

    public static boolean isIgnoredPackage(@Nullable String packageName) {
        if (packageName == null) return true;
        String p = packageName.toLowerCase(Locale.US);
        for (String ign : IGNORED_PACKAGES) {
            if (ign != null && ign.toLowerCase(Locale.US).equals(p)) {
                return true;
            }
        }
        return p.contains(".launcher") || p.endsWith(".launcher3");
    }

    /**
     * Whether PACKAGE_USAGE_STATS / Usage Access is allowed for this app (AppOps).
     */
    public static boolean isUsageAccessGranted(@NonNull Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) {
            return true;
        }
        try {
            AppOpsManager appOps = (AppOpsManager) context.getSystemService(Context.APP_OPS_SERVICE);
            if (appOps == null) {
                return false;
            }
            int mode = appOps.checkOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    Process.myUid(),
                    context.getPackageName());
            return mode == AppOpsManager.MODE_ALLOWED;
        } catch (Exception e) {
            Log.d(TAG, "isUsageAccessGranted: false", e);
            return false;
        }
    }

    @Nullable
    public static String resolveForegroundPackage(Context context) {
        UsageStatsManager usm = (UsageStatsManager)
                context.getSystemService(Context.USAGE_STATS_SERVICE);
        if (usm == null) {
            return null;
        }

        long time = System.currentTimeMillis();
        List<UsageStats> stats = usm.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY,
                time - 1000 * 60,
                time
        );

        if (stats == null || stats.isEmpty()) {
            return null;
        }

        SortedMap<Long, UsageStats> sortedMap = new TreeMap<>();
        for (UsageStats usageStats : stats) {
            sortedMap.put(usageStats.getLastTimeUsed(), usageStats);
        }

        if (sortedMap.isEmpty()) {
            return null;
        }

        return sortedMap.get(sortedMap.lastKey()).getPackageName();
    }

    /**
     * Snapshot of foreground app for tracking. {@code ignored} is true for launcher/self/settings.
     */
    public static class ForegroundApp {
        public final String packageName;
        public final String appName;
        public final String category;
        public final boolean ignored;

        public ForegroundApp(String packageName, String appName, String category, boolean ignored) {
            this.packageName = packageName;
            this.appName = appName;
            this.category = category;
            this.ignored = ignored;
        }
    }

    @Nullable
    public static ForegroundApp resolveForegroundApp(Context context) {
        String packageName = resolveForegroundPackage(context);
        if (packageName == null || packageName.isEmpty() || "Unknown".equals(packageName)) {
            return null;
        }

        if (isIgnoredPackage(packageName)) {
            Log.d(TAG, "[NATIVE_TRACK][IGNORED_PACKAGE] " + packageName);
            return new ForegroundApp(packageName, packageName, CAT_OTHER, true);
        }

        PackageManager pm = context.getPackageManager();
        ApplicationInfo appInfo;
        try {
            appInfo = pm.getApplicationInfo(packageName, 0);
        } catch (PackageManager.NameNotFoundException e) {
            return new ForegroundApp(
                    packageName,
                    getBestAppDisplayName(packageName, packageName),
                    nativeCategoryFromHeuristic(packageName, getBestAppDisplayName(packageName, packageName), true),
                    false
            );
        }

        CharSequence label = pm.getApplicationLabel(appInfo);
        String rawLabel = label != null ? label.toString().trim() : "";
        String appName = getBestAppDisplayName(packageName, rawLabel);

        String category;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            int androidCat = appInfo.category;
            category = mapAndroidCategory(androidCat);
            if (androidCat == ApplicationInfo.CATEGORY_UNDEFINED || CAT_OTHER.equals(category)) {
                Log.d(TAG, "[NATIVE_TRACK][CATEGORY_FALLBACK] " + packageName + " appName=" + appName);
                category = nativeCategoryFromHeuristic(packageName, appName, false);
            }
        } else {
            Log.d(TAG, "[NATIVE_TRACK][CATEGORY_FALLBACK] " + packageName + " appName=" + appName);
            category = nativeCategoryFromHeuristic(packageName, appName, false);
        }

        return new ForegroundApp(packageName, appName, category, false);
    }

    private static String mapAndroidCategory(int androidCategory) {
        if (androidCategory == ApplicationInfo.CATEGORY_UNDEFINED) {
            return CAT_OTHER;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (androidCategory == ApplicationInfo.CATEGORY_PRODUCTIVITY) {
                return CAT_PRODUCTIVITY;
            }
            if (androidCategory == ApplicationInfo.CATEGORY_SOCIAL) {
                return CAT_SOCIAL;
            }
            if (androidCategory == ApplicationInfo.CATEGORY_GAME
                    || androidCategory == ApplicationInfo.CATEGORY_AUDIO
                    || androidCategory == ApplicationInfo.CATEGORY_VIDEO
                    || androidCategory == ApplicationInfo.CATEGORY_IMAGE) {
                return CAT_ENTERTAINMENT;
            }
        }
        return CAT_OTHER;
    }

    /**
     * Lightweight fallback classification into SpikeSense buckets.
     * Kept intentionally generic; native ApplicationInfo.category is primary.
     */
    private static String nativeCategoryFromHeuristic(String packageName, String appName, boolean fromMissingMetadata) {
        String p = packageName != null ? packageName : "";
        String a = appName != null ? appName : "";
        String blob = (p + " " + a).toLowerCase(Locale.US);

        if (matchesSocial(blob)) {
            return CAT_SOCIAL;
        }
        if (matchesEntertainment(blob)) {
            return CAT_ENTERTAINMENT;
        }
        if (matchesProductivity(blob)) {
            return CAT_PRODUCTIVITY;
        }
        return CAT_OTHER;
    }

    private static boolean matchesSocial(String blob) {
        return blob.contains("whatsapp") || blob.contains("telegram") || blob.contains("org.telegram")
                || blob.contains("signal")
                || blob.contains("instagram") || blob.contains("facebook") || blob.contains("messenger")
                || blob.contains("twitter") || blob.contains("tiktok") || blob.contains("snapchat")
                || blob.contains("reddit") || blob.contains("discord")
                || blob.contains("linkedin")
                || blob.contains("social") || blob.contains("chat") || blob.contains("sms")
                || blob.contains("messaging");
    }

    private static boolean matchesEntertainment(String blob) {
        return blob.contains("youtube") || blob.contains("netflix") || blob.contains("spotify")
                || blob.contains("music") || blob.contains("video") || blob.contains("stream")
                || blob.contains("game") || blob.contains("play.games") || blob.contains("twitch")
                || blob.contains("hulu") || blob.contains("disney") || blob.contains("primevideo")
                || blob.contains("konami") || blob.contains("pesam") || blob.contains("efootball");
    }

    private static boolean matchesProductivity(String blob) {
        return blob.contains("gmail") || blob.contains("google.android.gm") || blob.contains("outlook") || blob.contains("mail")
                || blob.contains("calendar") || blob.contains("docs") || blob.contains("sheets")
                || blob.contains("drive") || blob.contains("notion") || blob.contains("office")
                || blob.contains("teams") || blob.contains("zoom") || blob.contains("chrome")
                || blob.contains("android.chrome")
                || blob.contains("sbrowser") || blob.contains("samsung internet")
                || blob.contains("apps.messaging") || blob.contains("google messages")
                || blob.contains("openai") || blob.contains("chatgpt")
                || blob.contains("slack")
                || blob.contains("browser") || blob.contains("firefox") || blob.contains("work")
                || blob.contains("productivity");
    }

    /**
     * Pick the best display name for the foreground package.
     * Uses PackageManager label when it's high-quality, otherwise applies a focused set of fallbacks
     * and finally derives a readable name from the package tokens.
     */
    private static String getBestAppDisplayName(String packageName, String rawLabel) {
        if (rawLabel != null) {
            String cleaned = rawLabel.trim();
            if (!isBadLabel(cleaned, packageName)) {
                Log.d(TAG, "[NATIVE_TRACK][LABEL_FALLBACK] package=" + packageName + " label='" + rawLabel + "' -> '" + cleaned + "' (pm_label_ok)");
                return cleaned;
            }
        }

        String fallback = getNameFromPackageFallback(packageName);
        if (fallback != null && fallback.trim().length() > 0) {
            Log.d(TAG, "[NATIVE_TRACK][LABEL_FALLBACK] package=" + packageName + " rawLabel='" + rawLabel + "' -> '" + fallback + "' (package_map)");
            return fallback;
        }

        String derived = deriveReadableNameFromPackage(packageName);
        Log.d(TAG, "[NATIVE_TRACK][LABEL_FALLBACK] package=" + packageName + " rawLabel='" + rawLabel + "' -> '" + derived + "' (derived_token)");
        return derived;
    }

    /**
     * Labels that look like Android package ids should not be shown as display names.
     */
    private static boolean looksLikePackageNameLabel(String label) {
        if (label == null) return false;
        String l = label.trim();
        if (l.isEmpty()) return false;
        String lower = l.toLowerCase(Locale.US);
        if (lower.startsWith("com.")
                || lower.startsWith("org.")
                || lower.startsWith("net.")
                || lower.startsWith("io.")
                || lower.startsWith("jp.")) {
            return true;
        }
        // Reverse-domain style: segments with dots, no spaces (e.g. com.whatsapp)
        return l.contains(".") && !l.contains(" ");
    }

    private static boolean isBadLabel(String label, String packageName) {
        if (label == null) return true;
        String l = label.trim();
        if (l.isEmpty()) return true;

        // Too short labels are often system tokens (e.g. "PL")
        if (l.length() <= 2) return true;

        // All-caps noise (e.g. "PL", "SMS", "A1")
        if (l.matches("^[A-Z0-9][A-Z0-9\\-]{0,5}$")) return true;

        // Raw package string or package-shaped label from PackageManager
        if (packageName != null && l.equalsIgnoreCase(packageName.trim())) {
            return true;
        }
        if (looksLikePackageNameLabel(l)) {
            return true;
        }

        // If label mirrors the last package token (common when label is unhelpful)
        String lastToken = getLastPackageToken(packageName);
        if (!lastToken.isEmpty() && l.equalsIgnoreCase(lastToken) && isGenericPackageToken(lastToken)) {
            return true;
        }

        // If label is very short single-word and looks like a token, treat as bad
        if (l.length() <= 4 && !l.contains(" ")) {
            return true;
        }

        return false;
    }

    private static boolean isGenericPackageToken(String token) {
        if (token == null) return false;
        String t = token.trim().toLowerCase(Locale.US);
        return t.equals("android")
                || t.equals("app")
                || t.equals("apps")
                || t.equals("mobile")
                || t.equals("client")
                || t.equals("mediaclient")
                || t.equals("system")
                || t.equals("service");
    }

    private static String getNameFromPackageFallback(String packageName) {
        if (packageName == null) return null;
        String pl = packageName.trim().toLowerCase(Locale.US);

        // Focused high-value mappings (exact package keys, lowercase)
        if ("com.whatsapp".equals(pl)) return "WhatsApp";
        if ("com.google.android.gm".equals(pl)) return "Gmail";
        if ("com.google.android.apps.messaging".equals(pl)) return "Google Messages";
        if ("com.google.android.youtube".equals(pl)) return "YouTube";
        if ("com.instagram.android".equals(pl)) return "Instagram";
        if ("com.snapchat.android".equals(pl)) return "Snapchat";
        if ("org.telegram.messenger".equals(pl)) return "Telegram";
        if ("com.facebook.katana".equals(pl) || "com.facebook.android".equals(pl)) return "Facebook";
        if ("com.facebook.orca".equals(pl) || "com.facebook.messenger".equals(pl)) return "Messenger";
        if ("com.twitter.android".equals(pl)) return "X";
        if ("com.zhiliaoapp.musically".equals(pl)) return "TikTok";
        if ("com.spotify.music".equals(pl)) return "Spotify";
        if ("com.netflix.mediaclient".equals(pl)) return "Netflix";
        if ("com.reddit.frontpage".equals(pl)) return "Reddit";
        if ("com.discord".equals(pl)) return "Discord";
        if ("com.linkedin.android".equals(pl)) return "LinkedIn";
        if ("com.openai.chatgpt".equals(pl)) return "ChatGPT";
        if ("com.slack".equals(pl)) return "Slack";
        if ("com.sec.android.app.sbrowser".equals(pl)) return "Samsung Internet";
        if ("com.android.chrome".equals(pl)) return "Chrome";
        if ("jp.konami.pesam".equals(pl) || pl.contains("pesam")) return "eFootball";

        return null;
    }

    private static String deriveReadableNameFromPackage(String packageName) {
        if (packageName == null || packageName.isEmpty()) return "Unknown";

        String[] parts = packageName.split("\\.");
        if (parts.length == 0) return packageName;

        // Tokens that are typically not user-facing app names
        Set<String> junk = new HashSet<>(Arrays.asList(
                "android", "app", "apps", "mobile", "media", "client", "clientlib", "system", "service"
        ));

        // Pick the best token from the right side (usually last or second-last).
        for (int i = parts.length - 1; i >= 0; i--) {
            String token = parts[i];
            if (token == null) continue;
            String t = token.trim().toLowerCase(Locale.US);
            if (t.isEmpty() || junk.contains(t)) continue;
            if (t.length() <= 2) continue; // avoid "pl"-style fragments

            String cleaned = token.replace('_', ' ').replace('-', ' ').trim();
            if (cleaned.isEmpty()) continue;
            return titleCase(cleaned);
        }

        return titleCase(parts[parts.length - 1].replace('_', ' ').replace('-', ' ').trim());
    }

    private static String titleCase(String s) {
        if (s == null) return "Unknown";
        String trimmed = s.trim();
        if (trimmed.isEmpty()) return "Unknown";
        String[] words = trimmed.split("\\s+");
        StringBuilder out = new StringBuilder();
        for (String w : words) {
            if (w.isEmpty()) continue;
            String lower = w.toLowerCase(Locale.US);
            out.append(Character.toUpperCase(lower.charAt(0))).append(lower.substring(1));
            out.append(' ');
        }
        return out.toString().trim();
    }

    private static String getLastPackageToken(String packageName) {
        if (packageName == null) return "";
        String[] parts = packageName.split("\\.");
        if (parts.length == 0) return "";
        return parts[parts.length - 1].trim();
    }
}
