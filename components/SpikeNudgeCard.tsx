import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, useColorScheme } from 'react-native';
import { IconSymbol } from './IconSymbol';
import SpikeMascot, { type SpikeMascotState } from './SpikeMascot';
import { colors } from '@/styles/commonStyles';

const WHY_FALLBACK =
  'We noticed a recent pattern in your activity that may be affecting your focus.';

export type SpikeNudgeSeverity = 'low' | 'medium' | 'high';

function resolveMascotState(
  severity: SpikeNudgeSeverity | undefined,
  pattern: string | undefined
): SpikeMascotState {
  const s = (severity || 'medium').toLowerCase() as SpikeNudgeSeverity;
  const pat = (pattern || '').toLowerCase();
  if (s === 'high') return 'focused';
  if (s === 'low') return 'calm';
  if (pat.includes('rapid') || pat.includes('switch')) return 'concerned';
  return 'concerned';
}

export type SpikeNudgeCardProps = {
  message: string;
  explanation?: string;
  severity?: SpikeNudgeSeverity | string;
  pattern?: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
};

export default function SpikeNudgeCard({
  message,
  explanation,
  severity,
  pattern,
  actionLabel,
  onAction,
  onDismiss,
}: SpikeNudgeCardProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const sevNorm = (severity || 'medium').toLowerCase() as SpikeNudgeSeverity;
  const mascotState = useMemo(
    () => resolveMascotState(sevNorm, pattern),
    [sevNorm, pattern]
  );

  useEffect(() => {
    if (!__DEV__) return;
    console.log('[FRONTEND][SPIKE_NUDGE_RENDER]', {
      count: 1,
      mascotState,
      severity: sevNorm,
      pattern: pattern ?? null,
    });
  }, [mascotState, sevNorm, pattern]);

  const whyText = (explanation || '').trim() || WHY_FALLBACK;
  const cardBg = isDark ? 'rgba(36,40,48,0.94)' : 'rgba(255,255,255,0.94)';
  const borderCol = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol }]}>
      <View style={styles.topRow}>
        <View style={styles.mascotCol}>
          <SpikeMascot
            state={mascotState}
            size={80}
            animated
            showGlow
            glowBoost={sevNorm === 'high'}
          />
        </View>
        <View style={styles.textCol}>
          <Text style={[styles.message, { color: isDark ? '#F7FAFC' : colors.text }]} numberOfLines={6}>
            {(message || ' ').trim()}
          </Text>
          <View style={styles.whyBlock}>
            <Text style={[styles.whyLabel, { color: isDark ? 'rgba(255,255,255,0.5)' : colors.textSecondary }]}>
              Why this appeared
            </Text>
            <Text style={[styles.whyText, { color: isDark ? 'rgba(255,255,255,0.72)' : colors.textSecondary }]}>
              {whyText}
            </Text>
          </View>
          {actionLabel ? (
            <Pressable style={styles.actionButton} onPress={onAction}>
              <Text style={styles.actionButtonText}>{actionLabel}</Text>
              <IconSymbol name="arrow.right" size={14} color={colors.primary} />
            </Pressable>
          ) : null}
        </View>
        {onDismiss ? (
          <Pressable style={styles.dismissButton} onPress={onDismiss} accessibilityLabel="Dismiss nudge">
            <IconSymbol name="xmark" size={20} color={isDark ? 'rgba(255,255,255,0.55)' : colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    boxShadow: '0px 2px 12px rgba(0, 0, 0, 0.08)',
    elevation: 3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  mascotCol: {
    width: 86,
    marginRight: 8,
    marginTop: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
    fontWeight: '500',
  },
  whyBlock: {
    paddingTop: 10,
    marginBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(120,120,128,0.25)',
  },
  whyLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  whyText: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.primary + '18',
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    marginRight: 4,
  },
  dismissButton: {
    padding: 6,
    marginLeft: 4,
    marginTop: -4,
  },
});
