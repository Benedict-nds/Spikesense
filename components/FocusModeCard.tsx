
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { IconSymbol } from './IconSymbol';
import { colors } from '@/styles/commonStyles';
import { FocusSession } from '@/types/appUsage';

interface FocusModeCardProps {
  session: FocusSession | null;
  onStart: (duration: number) => void | Promise<void>;
  onEnd: () => void | Promise<void>;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export default function FocusModeCard({ session, onStart, onEnd }: FocusModeCardProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!session || session.endTime) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [session]);

  const metrics = useMemo(() => {
    if (!session) {
      return null;
    }
    const rawStartedAt =
      session.startTime instanceof Date
        ? session.startTime.toISOString()
        : String(session.startTime ?? '');
    const st =
      session.startTime instanceof Date
        ? session.startTime
        : new Date(session.startTime as unknown as string);
    const startValid = !Number.isNaN(st.getTime());
    const endMs = session.endTime ? session.endTime.getTime() : null;
    const now = endMs != null ? endMs : Date.now();
    const rawElapsedMinutes = startValid
      ? (now - st.getTime()) / 60000
      : 0;
    const rawTd = Number(session.targetDuration);
    const durationMinutes =
      Number.isFinite(rawTd) && rawTd > 0 ? Math.floor(rawTd) : 20;
    const elapsedMinutes = clamp(Math.floor(rawElapsedMinutes), 0, durationMinutes);
    const remainingMinutes = Math.max(0, durationMinutes - elapsedMinutes);
    const isExpired = rawElapsedMinutes >= durationMinutes;
    const progress01 = clamp(elapsedMinutes / durationMinutes, 0, 1);
    return {
      rawStartedAt,
      rawElapsedMinutes,
      elapsedMinutes,
      durationMinutes,
      remainingMinutes,
      isExpired,
      progressPct: progress01 * 100,
      startValid,
      ended: Boolean(session.endTime),
    };
  }, [session, session?.endTime ? 0 : tick]);

  useEffect(() => {
    if (!__DEV__ || !session || !metrics) return;
    console.log('[FRONTEND][FOCUS_SESSION_RENDER]', {
      rawStartedAt: metrics.rawStartedAt,
      rawElapsedMinutes: Math.round(metrics.rawElapsedMinutes * 1000) / 1000,
      elapsedMinutes: metrics.elapsedMinutes,
      durationMinutes: metrics.durationMinutes,
      remainingMinutes: metrics.remainingMinutes,
      isExpired: metrics.isExpired,
      startValid: metrics.startValid,
    });
    // Intentionally once per session id to avoid console spam on the 1s ticker.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- metrics tick every second
  }, [session?.id]);

  if (!session) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <IconSymbol name="brain.head.profile" size={24} color={colors.primary} />
          <Text style={styles.title}>Focus Mode</Text>
        </View>
        <Text style={styles.description}>
          Start a focused session to minimize distractions and boost productivity
        </Text>
        <View style={styles.durationOptions}>
          <Pressable 
            style={styles.durationButton}
            onPress={() => onStart(20)}
          >
            <Text style={styles.durationText}>20 min</Text>
          </Pressable>
          <Pressable 
            style={styles.durationButton}
            onPress={() => onStart(30)}
          >
            <Text style={styles.durationText}>30 min</Text>
          </Pressable>
          <Pressable 
            style={styles.durationButton}
            onPress={() => onStart(45)}
          >
            <Text style={styles.durationText}>45 min</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!metrics) {
    return null;
  }

  const { elapsedMinutes, durationMinutes, remainingMinutes, isExpired, progressPct, ended } = metrics;
  const mainLine = ended
    ? session.completed
      ? 'Session complete'
      : 'Session ended'
    : isExpired
      ? 'Session complete'
      : `${remainingMinutes} min remaining`;
  const subLine = `${elapsedMinutes} / ${durationMinutes} min`;

  return (
    <View style={[styles.container, styles.activeContainer]}>
      <View style={styles.header}>
        <IconSymbol name="brain.head.profile" size={24} color={colors.secondary} />
        <Text style={[styles.title, styles.activeTitle]}>Focus Mode Active</Text>
      </View>
      
      <View style={styles.timerContainer}>
        <Text style={styles.timerText}>{mainLine}</Text>
        <Text style={styles.elapsedText}>{subLine}</Text>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
      </View>

      <Pressable style={styles.endButton} onPress={onEnd}>
        <Text style={styles.endButtonText}>End Session</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 2,
  },
  activeContainer: {
    borderWidth: 2,
    borderColor: colors.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 8,
  },
  activeTitle: {
    color: colors.secondary,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  durationOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  durationButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  durationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  timerText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.secondary,
  },
  elapsedText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.textSecondary + '30',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.secondary,
  },
  endButton: {
    backgroundColor: colors.textSecondary + '20',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  endButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
});
