import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, Easing } from 'react-native-reanimated';
import { IconSymbol } from './IconSymbol';
import { colors } from '@/styles/commonStyles';
import { AppUsageData, AppCategory } from '@/types/appUsage';

const SOFT_EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
const ITEM_DELAY = 50;
const ITEM_DURATION = 200;

interface AppUsageListProps {
  apps: AppUsageData[];
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

export default function AppUsageList({ apps }: AppUsageListProps) {
  const topApps = apps.slice(0, 8);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Top Apps</Text>
      {topApps.map((app, index) => (
        <Animated.View
          key={index}
          entering={FadeIn.duration(ITEM_DURATION).delay(index * ITEM_DELAY).easing(SOFT_EASE)}
          style={styles.appItem}
        >
          <View style={[styles.iconContainer, { backgroundColor: getCategoryColor(app.category) + '20' }]}>
            <IconSymbol name={getCategoryIcon(app.category)} size={20} color={getCategoryColor(app.category)} />
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
