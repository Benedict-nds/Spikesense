import React, { Component, type ErrorInfo, type ReactNode, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeOutUp, Easing } from 'react-native-reanimated';
import SpikeNudgeCard from './SpikeNudgeCard';
import { Nudge } from '@/types/appUsage';

const SOFT_EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

/** Isolates a single nudge so a render error does not take down the whole notifications list. */
export class NudgeErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo): void {
    if (__DEV__) console.warn('[NudgeCard] NudgeErrorBoundary caught error:', error?.message);
  }

  render(): ReactNode {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

interface NudgeCardProps {
  nudge: Nudge;
  onDismiss: (id: string) => void;
}

export default function NudgeCard({ nudge, onDismiss }: NudgeCardProps) {
  const nudgeId = nudge?.id != null ? String(nudge.id).trim() : '';
  const message = typeof nudge?.message === 'string' ? nudge.message : String(nudge?.message ?? '');

  useEffect(() => {
    if (__DEV__ && nudge.explanation?.trim()) {
      console.log('[FRONTEND][NUDGE_EXPLANATION_RENDER]', { nudgeId, hasExplanation: true });
    }
  }, [nudgeId, nudge.explanation]);

  const handleDismiss = () => {
    if (nudgeId) onDismiss(nudgeId);
    else if (__DEV__) console.warn('[NudgeCard] dismiss skipped: missing id');
  };

  const handleAction = () => {
    if (__DEV__) console.log('Action pressed:', nudge?.actionType);
    handleDismiss();
  };

  const actionLabel =
    typeof nudge?.actionLabel === 'string' && nudge.actionLabel.trim().length > 0
      ? nudge.actionLabel.trim()
      : undefined;

  return (
    <Animated.View
      entering={FadeInDown.duration(250).easing(SOFT_EASE)}
      exiting={FadeOutUp.duration(180).easing(SOFT_EASE)}
      style={styles.wrapper}
    >
      <View style={styles.inner}>
        <SpikeNudgeCard
          message={message || ' '}
          explanation={nudge.explanation}
          severity={nudge.severity}
          pattern={nudge.pattern}
          actionLabel={actionLabel}
          onAction={handleAction}
          onDismiss={handleDismiss}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 0,
  },
  inner: {},
});
