import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SpikeMascot, { type SpikeMascotState } from '@/components/SpikeMascot';
import { colors } from '@/styles/commonStyles';
import { violationsCountToOrbState, type SpikeOrbState } from '@/utils/focusEnforcementEscalation';

type Props = {
  visible: boolean;
  category: string;
  violationsCount: number;
  /** Optional: override visual tier (defaults from violations) */
  orbState?: SpikeOrbState;
  ignoreDelayMs?: number;
  onContinueFocus: () => void;
  onPauseSession: () => void;
  onIgnore: () => Promise<void>;
};

const MODAL_COPY: Record<SpikeOrbState, { title: string; body: string; titleAccent?: boolean }> = {
  calm: {
    title: "Let's stay with your focus session.",
    body: 'You opened a distracting app while Focus Mode is active.',
  },
  warning: {
    title: "Let's stay with your focus session.",
    body: 'You opened a distracting app while Focus Mode is active.',
  },
  strict: {
    title: "Careful — you're drifting from your focus goal.",
    body: 'SpikeSense noticed repeated distractions during this session.',
  },
  blocking: {
    title: 'Focus Mode is still active.',
    body: 'Take a breath and return to your session.',
    titleAccent: true,
  },
};

function resolveDisplayOrbState(orb: SpikeOrbState | undefined, violations: number): SpikeOrbState {
  const mapped = violationsCountToOrbState(violations);
  const tier: SpikeOrbState = mapped === 'calm' ? 'warning' : mapped;
  if (orb) {
    return orb === 'calm' ? 'warning' : orb;
  }
  return tier;
}

function orbToMascot(orb: SpikeOrbState): { state: SpikeMascotState; glowBoost: boolean } {
  if (orb === 'blocking') return { state: 'focused', glowBoost: true };
  if (orb === 'strict') return { state: 'focused', glowBoost: false };
  if (orb === 'warning') return { state: 'concerned', glowBoost: false };
  return { state: 'calm', glowBoost: false };
}

export default function FocusEnforcementModal({
  visible,
  category,
  violationsCount,
  orbState: orbStateProp,
  ignoreDelayMs = 2000,
  onContinueFocus,
  onPauseSession,
  onIgnore,
}: Props) {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const [ignoreReady, setIgnoreReady] = useState(false);
  const [ignoring, setIgnoring] = useState(false);
  const [ignoreSeconds, setIgnoreSeconds] = useState(0);
  const content = useRef(new Animated.Value(0)).current;
  const ignoreIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasVisible = useRef(false);
  const prevShow = useRef(false);

  const vCount = Number.isFinite(Number(violationsCount)) ? Math.max(0, Math.floor(Number(violationsCount))) : 0;
  const effectiveOrbState: SpikeOrbState = resolveDisplayOrbState(orbStateProp, vCount);
  const copy = MODAL_COPY[effectiveOrbState] ?? MODAL_COPY.warning;
  const isBlocking = effectiveOrbState === 'blocking';
  const { state: mascotState, glowBoost } = orbToMascot(effectiveOrbState);

  useEffect(() => {
    if (!visible) {
      if (__DEV__) {
        console.log('[FRONTEND][FOCUS_ENFORCEMENT_MODAL]', {
          visible: false,
          orbState: effectiveOrbState,
          violations: vCount,
          ignoreEnabled: false,
        });
      }
      wasVisible.current = false;
      setIgnoreReady(false);
      setIgnoring(false);
      content.setValue(0);
      if (ignoreIntervalRef.current) {
        clearInterval(ignoreIntervalRef.current);
        ignoreIntervalRef.current = null;
      }
      return;
    }

    if (!wasVisible.current) {
      if (__DEV__) {
        console.log('[FRONTEND][FOCUS_ENFORCEMENT_MODAL]', {
          visible: true,
          orbState: effectiveOrbState,
          violations: vCount,
          ignoreEnabled: false,
        });
        console.log('[FRONTEND][FOCUS_GUARD_SPIKE_RENDER]', {
          orbState: effectiveOrbState,
          mascotState,
          glowBoost,
          violations: vCount,
        });
      }
    }
    wasVisible.current = true;

    setIgnoreReady(false);
    const totalSec = Math.max(1, Math.ceil(ignoreDelayMs / 1000));
    setIgnoreSeconds(totalSec);

    if (ignoreIntervalRef.current) clearInterval(ignoreIntervalRef.current);
    const started = Date.now();
    ignoreIntervalRef.current = setInterval(() => {
      const left = Math.max(0, totalSec - Math.floor((Date.now() - started) / 1000));
      setIgnoreSeconds(left);
    }, 250);

    const readyTimer = setTimeout(() => {
      if (ignoreIntervalRef.current) {
        clearInterval(ignoreIntervalRef.current);
        ignoreIntervalRef.current = null;
      }
      setIgnoreReady(true);
      if (__DEV__) {
        console.log('[FRONTEND][FOCUS_ENFORCEMENT_MODAL]', {
          visible: true,
          orbState: effectiveOrbState,
          violations: vCount,
          ignoreEnabled: true,
        });
      }
    }, ignoreDelayMs);

    content.setValue(0);
    const showContent = setTimeout(() => {
      Animated.timing(content, { toValue: 1, duration: 360, useNativeDriver: true }).start();
    }, 220);

    return () => {
      clearTimeout(readyTimer);
      clearTimeout(showContent);
      if (ignoreIntervalRef.current) {
        clearInterval(ignoreIntervalRef.current);
        ignoreIntervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, ignoreDelayMs, content]);

  useEffect(() => {
    if (visible && !prevShow.current) {
      if (isBlocking || effectiveOrbState === 'strict') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    }
    prevShow.current = visible;
  }, [visible, isBlocking, effectiveOrbState]);

  const handleIgnore = useCallback(async () => {
    if (!ignoreReady || ignoring) return;
    setIgnoring(true);
    try {
      await onIgnore();
    } finally {
      setIgnoring(false);
    }
  }, [ignoreReady, ignoring, onIgnore]);

  const cardBg = isDark ? 'rgba(28,28,30,0.98)' : 'rgba(255,255,255,0.98)';
  const textMain = isDark ? '#fff' : colors.text;
  const textSub = isDark ? 'rgba(255,255,255,0.7)' : colors.textSecondary;
  const titleColor = copy.titleAccent
    ? isDark
      ? '#c4b5fd'
      : '#553C9A'
    : isDark
      ? '#E2E8F0'
      : colors.text;
  const categoryLabel = category ? category.charAt(0).toUpperCase() + category.slice(1) : 'This app';
  const contentY = content.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
  const contentF = content.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.4, 1] });

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onContinueFocus}
    >
      <View style={[styles.backdrop, isBlocking && styles.backdropBlocking, effectiveOrbState === 'strict' && styles.backdropUrgent]}>
        <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
          <SpikeMascot
            state={mascotState}
            size={isBlocking ? 'lg' : 'md'}
            animated
            showGlow
            glowBoost={glowBoost}
          />
        </View>

        <Animated.View
          style={[
            styles.card,
            { marginTop: 12, backgroundColor: cardBg, opacity: contentF, transform: [{ translateY: contentY }] },
          ]}
        >
          <Text style={[styles.title, { color: titleColor }]}>{copy.title}</Text>
          <Text style={[styles.body, { color: textMain }]}>{copy.body}</Text>
          <Text style={[styles.hint, { color: textSub }]}>
            {categoryLabel} — soft nudge (you can always continue after choosing)
          </Text>

          <Pressable style={[styles.btn, styles.btnPrimary]} onPress={onContinueFocus} accessibilityLabel="Continue focus">
            <Text style={styles.btnPrimaryText}>Continue Focus</Text>
          </Pressable>

          <Pressable style={[styles.btn, styles.btnSecondary]} onPress={onPauseSession} accessibilityLabel="Pause session">
            <Text style={[styles.btnSecondaryText, { color: textMain }]}>Pause Session</Text>
          </Pressable>

          <Pressable
            style={[styles.btn, styles.btnGhost, !ignoreReady && styles.btnDisabled]}
            onPress={handleIgnore}
            disabled={!ignoreReady || ignoring}
            accessibilityState={{ disabled: !ignoreReady || ignoring }}
            accessibilityLabel="Ignore for now"
          >
            <Text style={[styles.btnGhostText, { color: textSub, opacity: ignoreReady ? 1 : 0.55 }]}>
              {ignoreReady
                ? ignoring
                  ? 'Recording…'
                  : 'Ignore for now'
                : `Ignore for now (${ignoreSeconds}s)`}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.86)',
    alignItems: 'stretch',
    paddingHorizontal: 20,
  },
  backdropUrgent: {
    backgroundColor: 'rgba(45, 12, 12, 0.9)',
  },
  backdropBlocking: {
    backgroundColor: 'rgba(8, 4, 20, 0.92)',
  },
  top: { alignItems: 'center' },
  card: {
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 8,
  },
  hint: {
    fontSize: 13,
    marginBottom: 20,
  },
  btn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  btnSecondary: {
    backgroundColor: 'rgba(120,120,128,0.2)',
  },
  btnSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
  },
  btnGhost: {
    backgroundColor: 'transparent',
  },
  btnGhostText: {
    fontSize: 15,
    fontWeight: '500',
  },
  btnDisabled: {
    opacity: 0.65,
  },
});
