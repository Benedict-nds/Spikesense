
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/styles/commonStyles';
import { Streak } from '@/types/appUsage';

interface StreakCardProps {
  streak: Streak;
}

export default function StreakCard({ streak }: StreakCardProps) {
  const getStreakIcon = () => {
    switch (streak.type) {
      case 'focus':
        return 'fire';
      case 'low_switching':
        return 'target';
      case 'balanced_usage':
        return 'scale-balance';
      default:
        return 'star';
    }
  };

  const getStreakTitle = () => {
    switch (streak.type) {
      case 'focus':
        return 'Focus Streak';
      case 'low_switching':
        return 'Steady Streak';
      case 'balanced_usage':
        return 'Balance Streak';
      default:
        return 'Streak';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <MaterialCommunityIcons name={getStreakIcon()} size={28} color={colors.accent} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{getStreakTitle()}</Text>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{streak.currentStreak}</Text>
            <Text style={styles.statLabel}>Current</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{streak.longestStreak}</Text>
            <Text style={styles.statLabel}>Best</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 2,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.accent,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: colors.textSecondary + '30',
    marginHorizontal: 16,
  },
});
