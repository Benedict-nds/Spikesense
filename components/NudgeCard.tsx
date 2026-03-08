import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInDown, FadeOutUp, Easing } from 'react-native-reanimated';
import { IconSymbol } from './IconSymbol';
import { colors } from '@/styles/commonStyles';
import { Nudge } from '@/types/appUsage';

const SOFT_EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

interface NudgeCardProps {
  nudge: Nudge;
  onDismiss: (id: string) => void;
}

export default function NudgeCard({ nudge, onDismiss }: NudgeCardProps) {
  const getIcon = () => {
    switch (nudge.type) {
      case 'app_switching':
        return 'arrow.triangle.swap';
      case 'entertainment_overload':
        return 'play.circle.fill';
      case 'break_reminder':
        return 'cup.and.saucer.fill';
      case 'insight':
        return 'lightbulb.fill';
      case 'challenge':
        return 'star.fill';
      case 'restriction':
        return 'shield.fill';
      default:
        return 'bell.fill';
    }
  };

  const getColor = () => {
    switch (nudge.type) {
      case 'app_switching':
        return colors.accent;
      case 'entertainment_overload':
        return colors.primary;
      case 'break_reminder':
        return colors.secondary;
      case 'insight':
        return colors.primary;
      case 'challenge':
        return colors.secondary;
      case 'restriction':
        return colors.accent;
      default:
        return colors.primary;
    }
  };

  const handleAction = () => {
    console.log('Action pressed:', nudge.actionType);
    // In a real app, this would trigger the appropriate action
    // For now, just dismiss the nudge
    onDismiss(nudge.id);
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(250).easing(SOFT_EASE)}
      exiting={FadeOutUp.duration(180).easing(SOFT_EASE)}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: getColor() + '20' }]}>
          <IconSymbol name={getIcon() as any} size={24} color={getColor()} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.message}>{nudge.message}</Text>
          {nudge.actionLabel && (
            <Pressable style={styles.actionButton} onPress={handleAction}>
              <Text style={styles.actionButtonText}>{nudge.actionLabel}</Text>
              <IconSymbol name="arrow.right" size={14} color={colors.primary} />
            </Pressable>
          )}
        </View>
        <Pressable
          style={styles.dismissButton}
          onPress={() => onDismiss(nudge.id)}
        >
          <IconSymbol name="xmark" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>
    </Animated.View>
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
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  message: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    marginBottom: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.primary + '15',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    marginRight: 4,
  },
  dismissButton: {
    padding: 4,
    marginLeft: 8,
  },
});
