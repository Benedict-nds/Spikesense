
import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';
import { IconSymbol } from './IconSymbol';
import { colors } from '@/styles/commonStyles';
import { Challenge } from '@/types/appUsage';

interface ChallengeCardProps {
  challenge: Challenge;
}

export default function ChallengeCard({ challenge }: ChallengeCardProps) {
  const progress = Math.min(100, (challenge.current / challenge.target) * 100);
  const isCompleted = challenge.completed || progress >= 100;

  const getIcon = () => {
    switch (challenge.type) {
      case 'app_switches':
        return { name: 'target', color: colors.primary };
      case 'focus_time':
        return { name: 'timer', color: colors.primary };
      case 'entertainment_limit':
        return { name: 'play-circle', color: colors.primary };
      default:
        return { name: 'flag', color: colors.primary };
    }
  };

  return (
    <View style={[styles.container, isCompleted && styles.containerCompleted]}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons 
            name={getIcon().name} 
            size={24} 
            color={getIcon().color} 
          />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>{challenge.title}</Text>
          {challenge.reward && (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="trophy" size={18} color={colors.secondary} style={{ marginRight: 4 }} />
              <Text style={styles.reward}>{challenge.reward}</Text>
            </View>
          )}
        </View>
      </View>
      
      <Text style={styles.description}>{challenge.description}</Text>
      
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {challenge.current} / {challenge.target}
        </Text>
      </View>

      {isCompleted && (
        <View style={styles.completedBadge}>
          <IconSymbol name="checkmark.circle.fill" size={16} color={colors.secondary} />
          <Text style={styles.completedText}>Completed!</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 2,
  },
  containerCompleted: {
    borderWidth: 2,
    borderColor: colors.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  reward: {
    fontSize: 12,
    color: colors.accent,
    marginTop: 2,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
    lineHeight: 20,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.textSecondary + '30',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  progressText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.textSecondary + '20',
  },
  completedText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.secondary,
    marginLeft: 6,
  },
});
