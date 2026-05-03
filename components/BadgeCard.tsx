import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from './IconSymbol';
import { colors } from '@/styles/commonStyles';
import { Badge, type BadgeCategory } from '@/types/appUsage';
import { resolveBadgeIconName } from '@/constants/badgeIcons';

interface BadgeCardProps {
  badge: Badge;
}

const CATEGORY_GRADIENT: Record<BadgeCategory, [string, string]> = {
  focus: ['#1a2838', '#2a3a52'],
  switching: ['#261f32', '#362a48'],
  social: ['#2c2230', '#3d2f42'],
  recovery: ['#1a2f2c', '#263d38'],
  consistency: ['#221c34', '#322848'],
  special: ['#1a2430', '#283545'],
};

function gradientFor(badge: Badge): [string, string] {
  const c = badge.category ?? 'special';
  return CATEGORY_GRADIENT[c] ?? CATEGORY_GRADIENT.special;
}

function rarityLabel(r: Badge['rarity']): string {
  if (r === 'epic') return 'Epic';
  if (r === 'rare') return 'Rare';
  return 'Common';
}

export default function BadgeCard({ badge }: BadgeCardProps) {
  const isEarned = badge.locked !== true && badge.earnedAt !== null;
  const iconName = resolveBadgeIconName(badge.badgeKey ?? undefined, badge.name);
  const [c0, c1] = gradientFor(badge);
  const rarity = badge.rarity ?? 'common';

  useEffect(() => {
    if (__DEV__) {
      console.log('[FRONTEND][BADGE_CARD_RENDER]', {
        key: badge.badgeKey ?? badge.id,
        category: badge.category ?? 'inferred',
        rarity,
        locked: Boolean(badge.locked),
      });
    }
  }, [badge.badgeKey, badge.id, badge.category, rarity, badge.locked]);

  return (
    <View style={[styles.outer, badge.locked && styles.outerLocked]}>
      <LinearGradient
        colors={[c0, c1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={[styles.innerBorder, styles.innerFlex]}>
          {badge.locked ? (
            <View style={styles.lockCorner}>
              <IconSymbol name="lock.fill" size={16} color="rgba(255,255,255,0.55)" />
            </View>
          ) : null}

          <View style={[styles.medal, badge.locked && styles.medalLocked]}>
            <IconSymbol
              name={iconName}
              size={34}
              color={badge.locked ? 'rgba(255,255,255,0.45)' : colors.primary}
            />
          </View>

          <Text style={[styles.title, badge.locked && styles.mutedText]} numberOfLines={2}>
            {badge.name || 'Badge'}
          </Text>
          {badge.subtitle ? (
            <Text style={[styles.subtitle, badge.locked && styles.mutedTextSoft]} numberOfLines={2}>
              {badge.subtitle}
            </Text>
          ) : null}

          <View style={styles.footer}>
            {isEarned && badge.earnedAt ? (
              <Text style={styles.earnedDate}>
                Earned{' '}
                {badge.earnedAt.toLocaleDateString(undefined, {
                  month: '2-digit',
                  day: '2-digit',
                  year: 'numeric',
                })}
              </Text>
            ) : badge.locked ? (
              <Text style={styles.lockedLabel}>Locked</Text>
            ) : null}
            <View
              style={[
                styles.rarityPill,
                rarity === 'epic' ? styles.rarity_epic : rarity === 'rare' ? styles.rarity_rare : styles.rarity_common,
              ]}
            >
              <Text style={styles.rarityText}>{rarityLabel(rarity)}</Text>
            </View>
          </View>

          {badge.locked && badge.requirement ? (
            <Text style={styles.requirementHint} numberOfLines={3}>
              {badge.requirement}
            </Text>
          ) : null}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: 160,
    minHeight: 198,
    borderRadius: 22,
    overflow: 'hidden',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 5,
  },
  outerLocked: {
    opacity: 0.72,
  },
  gradient: {
    flex: 1,
    minHeight: 198,
  },
  innerFlex: {
    flex: 1,
  },
  innerBorder: {
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22,
  },
  lockCorner: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
  },
  medal: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  medalLocked: {
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
    lineHeight: 16,
    minHeight: 32,
  },
  mutedText: {
    color: 'rgba(255,255,255,0.78)',
  },
  mutedTextSoft: {
    color: 'rgba(255,255,255,0.55)',
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 8,
    gap: 6,
    alignItems: 'center',
  },
  earnedDate: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.secondary,
    textAlign: 'center',
  },
  lockedLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },
  rarityPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  rarityText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  rarity_common: {
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  rarity_rare: {
    borderColor: 'rgba(167, 139, 250, 0.55)',
    backgroundColor: 'rgba(124, 58, 237, 0.18)',
  },
  rarity_epic: {
    borderColor: 'rgba(251, 191, 36, 0.55)',
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
  },
  requirementHint: {
    marginTop: 8,
    fontSize: 10,
    lineHeight: 14,
    color: 'rgba(255,255,255,0.48)',
    textAlign: 'center',
  },
});
