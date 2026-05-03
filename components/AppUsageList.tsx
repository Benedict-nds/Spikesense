import React, { useEffect, useState, useMemo, memo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image, Platform } from 'react-native';
import Animated, { FadeIn, Easing } from 'react-native-reanimated';
import { IconSymbol } from './IconSymbol';
import { colors } from '@/styles/commonStyles';
import { AppUsageData, AppCategory } from '@/types/appUsage';
import { getAppIcon, resolvePackageForIconLookup } from '@/services/appIcons';

const SOFT_EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
const ITEM_DELAY = 50;
const ITEM_DURATION = 200;

interface AppUsageListProps {
  apps: AppUsageData[];
  loading?: boolean;
  /** Day has usage but top-apps list is empty (e.g. still syncing). */
  usagePresentButNoTopApps?: boolean;
}

const getCategoryColor = (category: AppCategory): string => {
  switch (category) {
    case 'productivity':
      return colors.secondary;
    case 'social':
      return colors.primary;
    case 'entertainment':
      return colors.accent;
    default:
      return colors.textSecondary;
  }
};

const getCategoryIcon = (category: AppCategory): string => {
  switch (category) {
    case 'productivity':
      return 'briefcase.fill';
    case 'social':
      return 'person.2.fill';
    case 'entertainment':
      return 'play.circle.fill';
    default:
      return 'app.fill';
  }
};

const formatTime = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
};

type RowProps = { app: AppUsageData; index: number };

const TopAppRow = memo(function TopAppRow({ app, index }: RowProps) {
  const [iconUri, setIconUri] = useState<string | null>(null);
  const [iconFailed, setIconFailed] = useState(false);

  const rawPkg = (app.packageName ?? app.package_name ?? '').trim();
  const resolvedPkg = resolvePackageForIconLookup(
    app.appName,
    app.packageName ?? app.package_name
  );
  const tint = getCategoryColor(app.category);

  useEffect(() => {
    let cancelled = false;
    setIconFailed(false);
    setIconUri(null);

    const logRow = (payload: {
      hasIcon: boolean;
      fallbackReason: string;
    }) => {
      if (!__DEV__) return;
      console.log('[FRONTEND][APP_ICON_ROW]', {
        appName: app.appName,
        packageName: rawPkg || null,
        resolvedPackage: resolvedPkg || '',
        hasIcon: payload.hasIcon,
        fallbackReason: payload.fallbackReason,
      });
    };

    if (!resolvedPkg || Platform.OS !== 'android') {
      logRow({
        hasIcon: false,
        fallbackReason: !resolvedPkg ? 'no_package' : 'non_android',
      });
      return;
    }

    (async () => {
      try {
        const uri = await getAppIcon(resolvedPkg);
        if (cancelled) return;
        if (uri && uri.length > 0) {
          setIconUri(uri);
          logRow({ hasIcon: true, fallbackReason: 'none' });
        } else {
          setIconUri(null);
          logRow({ hasIcon: false, fallbackReason: 'native_null' });
        }
      } catch {
        if (!cancelled) {
          setIconUri(null);
          setIconFailed(true);
          logRow({ hasIcon: false, fallbackReason: 'load_failed' });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolvedPkg, rawPkg, app.appName, app.category, app.package_name, app.packageName]);

  const showRaster = iconUri != null && iconUri.length > 0 && !iconFailed;

  return (
    <Animated.View
      entering={FadeIn.duration(ITEM_DURATION).delay(index * ITEM_DELAY).easing(SOFT_EASE)}
      style={styles.appItem}
    >
      <View style={[styles.iconContainer, { backgroundColor: tint + '20' }]}>
        {showRaster ? (
          <Image
            source={{ uri: iconUri }}
            style={styles.appIconImage}
            resizeMode="cover"
            onError={() => setIconFailed(true)}
          />
        ) : (
          <IconSymbol name={getCategoryIcon(app.category) as any} size={20} color={tint} />
        )}
      </View>
      <View style={styles.appInfo}>
        <Text style={styles.appName}>{app.appName}</Text>
        <Text style={styles.appCategory}>{app.category}</Text>
      </View>
      <View style={styles.appStats}>
        <Text style={styles.usageTime}>{formatTime(app.usageTime)}</Text>
        <Text style={styles.openCount}>{app.openCount} opens</Text>
      </View>
    </Animated.View>
  );
});

export default function AppUsageList({ apps, loading, usagePresentButNoTopApps }: AppUsageListProps) {
  const topApps = useMemo(
    () => apps.filter((a) => (a.appName || '').trim().length > 0).slice(0, 8),
    [apps]
  );

  useEffect(() => {
    if (!__DEV__) return;
    console.log('[FRONTEND][TOP_APPS_RENDER]', { count: topApps.length });
  }, [topApps.length]);

  useEffect(() => {
    if (__DEV__ && !loading && topApps.length === 0) {
      console.log('[FRONTEND][EMPTY_STATE_RENDER]', { area: 'top_apps' });
    }
  }, [loading, topApps.length]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Top Apps</Text>
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Loading app usage…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Top Apps</Text>
      {topApps.length === 0 ? (
        <Text style={styles.emptyText}>
          {usagePresentButNoTopApps
            ? "We're still preparing your top apps. Pull down to refresh in a moment."
            : "We'll show your most-used apps here as you use your phone."}
        </Text>
      ) : null}
      {topApps.map((app, index) => (
        <TopAppRow
          key={`${resolvePackageForIconLookup(app.appName, app.packageName ?? app.package_name) || 'np'}-${app.appName}-${index}`}
          app={app}
          index={index}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 10,
  },
  appItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.highlight,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  appIconImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  appInfo: {
    flex: 1,
  },
  appName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  appCategory: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  appStats: {
    alignItems: 'flex-end',
  },
  usageTime: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 2,
  },
  openCount: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
