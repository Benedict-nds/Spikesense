
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/styles/commonStyles';
import { Badge } from '@/types/appUsage';

interface BadgeCardProps {
  badge: Badge;
}

export default function BadgeCard({ badge }: BadgeCardProps) {
  const isEarned = badge.earnedAt !== null;

  // Choose icon based on badge name
  let iconName = 'star';
  switch (badge.name) {
    case 'Early Bird':
      iconName = 'weather-sunset-up';
      break;
    case 'Calm Streak':
      iconName = 'leaf';
      break;
    case 'Balanced Day':
      iconName = 'scale-balance';
      break;
    case 'Steady Focus':
      iconName = 'target';
      break;
    case 'Focus Master':
      iconName = 'trophy';
      break;
    default:
      iconName = 'star';
  }
  return (
    <View style={[styles.container, !isEarned && styles.containerLocked]}>
      <View style={[styles.iconContainer, !isEarned && styles.iconContainerLocked]}>
        <MaterialCommunityIcons
          name={iconName}
          size={32}
          color={isEarned ? colors.primary : colors.textSecondary}
        />
      </View>
      <Text style={[styles.name, !isEarned && styles.nameLocked]}>{badge.name}</Text>
      <Text style={styles.description}>{badge.description}</Text>
      {!isEarned && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${badge.progress}%` }]} />
          </View>
          <Text style={styles.progressText}>{badge.progress}%</Text>
        </View>
      )}
      {isEarned && badge.earnedAt && (
        <Text style={styles.earnedText}>
          Earned {new Date(badge.earnedAt).toLocaleDateString()}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    minWidth: 140,
    maxWidth: 160,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 2,
  },
  containerLocked: {
    opacity: 0.6,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  iconContainerLocked: {
    backgroundColor: colors.textSecondary + '20',
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  nameLocked: {
    color: colors.textSecondary,
  },
  description: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  progressContainer: {
    width: '100%',
    marginTop: 12,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.textSecondary + '30',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  progressText: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  earnedText: {
    fontSize: 10,
    color: colors.secondary,
    marginTop: 8,
    textAlign: 'center',
  },
});
