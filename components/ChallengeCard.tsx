import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown, Easing } from 'react-native-reanimated';
import { IconSymbol } from './IconSymbol';
import { colors } from '@/styles/commonStyles';
import { Challenge } from '@/types/appUsage';
import { getChallengeIcon, getChallengeIconTint } from '@/constants/challengeIcons';

const SOFT_EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

interface ChallengeCardProps {
  challenge: Challenge;
  index?: number;
}

function statusDisplayLabel(challenge: Challenge): string {
  const s = challenge.status;
  if (s === 'on_track') return 'On track';
  if (s === 'at_risk') return 'At risk';
  if (s === 'exceeded') return 'Exceeded';
  if (s === 'completed') return 'Completed';
  if (s === 'in_progress') return 'In progress';
  return '';
}

function currentTargetCaption(challenge: Challenge): string {
  const key = challenge.challengeKey ?? '';
  if (challenge.direction === 'action') {
    return challenge.status === 'completed' ? 'Done' : '—';
  }
  if (key === 'ENTERTAINMENT_BALANCE' || challenge.type === 'entertainment_limit') {
    const cm = Math.round(challenge.current / 60);
    const tm = Math.round(challenge.target / 60);
    return `${cm} / ${tm} min`;
  }
  if (key === 'FOCUS_SESSION_STARTER' || challenge.type === 'focus_time') {
    return `${challenge.current} / ${challenge.target} min`;
  }
  if (key === 'APP_SWITCH_STABILITY' || key === 'MAINTAIN_RHYTHM') {
    return `${challenge.current} / ${challenge.target} switches`;
  }
  if (key === 'TOP_APP_LIMIT' || key === 'SOCIAL_SWITCH_REDUCER') {
    return `${challenge.current} / ${challenge.target} opens`;
  }
  return `${challenge.current} / ${challenge.target}`;
}

function barFillPercent(challenge: Challenge): number {
  const target = Math.max(1, challenge.target || 1);
  const current = Number.isFinite(challenge.current) ? Math.max(0, challenge.current) : 0;
  if (challenge.progress01 !== undefined && challenge.progress01 >= 0 && challenge.progress01 <= 1) {
    return Math.min(100, Math.max(0, challenge.progress01 * 100));
  }
  return Math.min(100, Math.max(0, (current / target) * 100));
}

function isVisuallyCompleted(challenge: Challenge): boolean {
  if (challenge.direction === 'under' || challenge.direction === 'action') {
    return Boolean(challenge.completed);
  }
  if (challenge.direction === 'over') {
    return Boolean(challenge.completed);
  }
  const target = Math.max(1, challenge.target || 100);
  const current = Number.isFinite(challenge.current) ? Math.max(0, challenge.current) : 0;
  return Boolean(challenge.completed || current >= target);
}

export default function ChallengeCard({ challenge, index = 0 }: ChallengeCardProps) {
  const title = challenge.title?.trim() || "Today's Challenge";
  const description =
    challenge.description?.trim() || 'Complete your daily goal to build mindful habits.';
  const progress = barFillPercent(challenge);
  const isCompleted = isVisuallyCompleted(challenge);
  const statusFromApi = statusDisplayLabel(challenge);
  const caption = currentTargetCaption(challenge);

  const challengeKey = challenge.challengeKey?.trim();
  const iconName = getChallengeIcon(challengeKey, challenge.type);
  const tint = getChallengeIconTint(challengeKey);
  const iconColor = isCompleted ? colors.secondary : tint.iconFg;
  const progressFillColor = tint.progressFill ?? colors.primary;

  useEffect(() => {
    if (__DEV__) {
      console.log('[FRONTEND][CHALLENGE_ICON_RENDER]', {
        challengeKey: challengeKey ?? null,
        iconName,
        title,
      });
    }
  }, [challengeKey, iconName, title]);

  return (
    <Animated.View
      entering={FadeInDown.duration(220).delay(index * 50).easing(SOFT_EASE)}
      style={[styles.container, isCompleted && styles.containerCompleted]}
    >
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: tint.iconBg }]}>
          <IconSymbol name={iconName} size={20} color={iconColor} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          {challenge.reward && (
            <Text style={styles.reward}>🏆 {challenge.reward}</Text>
          )}
        </View>
      </View>

      <Text style={styles.description}>{description}</Text>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: progressFillColor }]} />
        </View>
        <View style={styles.progressMetaRow}>
          <Text style={styles.captionText}>{caption}</Text>
          <Text style={styles.progressText}>
            {statusFromApi ? statusFromApi : `${Math.round(progress)}%`}
          </Text>
        </View>
      </View>

      {isCompleted && (
        <View style={styles.completedBadge}>
          <IconSymbol name="checkmark.circle.fill" size={16} color={colors.secondary} />
          <Text style={styles.completedText}>Completed</Text>
        </View>
      )}
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
  progressMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  captionText: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  progressText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
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
