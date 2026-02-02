
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { IconSymbol } from './IconSymbol';
import { colors } from '@/styles/commonStyles';
import { FocusSession } from '@/types/appUsage';

interface FocusModeCardProps {
  session: FocusSession | null;
  onStart: (duration: number) => void;
  onEnd: () => void;
}

export default function FocusModeCard({ session, onStart, onEnd }: FocusModeCardProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (session && !session.endTime) {
      const interval = setInterval(() => {
        const now = new Date();
        const elapsedMinutes = Math.floor((now.getTime() - session.startTime.getTime()) / 60000);
        setElapsed(elapsedMinutes);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [session]);

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

  const progress = Math.min(100, (elapsed / session.targetDuration) * 100);
  const remaining = Math.max(0, session.targetDuration - elapsed);

  return (
    <View style={[styles.container, styles.activeContainer]}>
      <View style={styles.header}>
        <IconSymbol name="brain.head.profile" size={24} color={colors.secondary} />
        <Text style={[styles.title, styles.activeTitle]}>Focus Mode Active</Text>
      </View>
      
      <View style={styles.timerContainer}>
        <Text style={styles.timerText}>{remaining} min remaining</Text>
        <Text style={styles.elapsedText}>{elapsed} / {session.targetDuration} min</Text>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
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
