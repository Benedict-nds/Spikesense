import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { SpikeOrbState } from '@/utils/focusEnforcementEscalation';

export type { SpikeOrbState };

const BASE = 80;

const STATE_CONFIG: Record<
  SpikeOrbState,
  {
    size: number;
    pulseScale: [number, number];
    pulseMs: number;
    glow: string;
    grad: [string, string, string];
    shake: boolean;
  }
> = {
  calm: {
    size: 0.75,
    pulseScale: [1, 1.04],
    pulseMs: 2200,
    glow: 'rgba(79, 209, 197, 0.45)',
    grad: ['#2C5282', '#5A67D8', '#4FD1C5'],
    shake: false,
  },
  warning: {
    size: 0.92,
    pulseScale: [0.98, 1.08],
    pulseMs: 1500,
    glow: 'rgba(230, 180, 60, 0.5)',
    grad: ['#744210', '#D69E2E', '#F6E05E'],
    shake: false,
  },
  strict: {
    size: 1,
    pulseScale: [0.95, 1.12],
    pulseMs: 1000,
    glow: 'rgba(237, 137, 54, 0.6)',
    grad: ['#7B341E', '#DD6B20', '#F6AD55'],
    shake: true,
  },
  blocking: {
    size: 1.28,
    pulseScale: [0.9, 1.18],
    pulseMs: 800,
    glow: 'rgba(120, 70, 200, 0.7)',
    grad: ['#322659', '#6B46C1', '#9F7AEA'],
    shake: true,
  },
};

type Props = {
  state: SpikeOrbState;
  visible: boolean;
  message?: string;
  compact?: boolean;
  /** violations count for dev logging only */
  violationsForLog?: number;
};

function SpikeOrbComponent({
  state: rawState,
  visible,
  message,
  compact,
  violationsForLog,
}: Props) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const state = stateOrFallback(rawState);
  const cfg = STATE_CONFIG[state];
  const compactScale = compact ? 0.72 : 1;
  const orbSize = Math.round(BASE * cfg.size * compactScale);
  const pulse = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const entrance = useRef(new Animated.Value(0)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  const ripple1 = useRef(new Animated.Value(0)).current;
  const loopsRef = useRef<Animated.CompositeAnimation[]>([]);
  const shakeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAnims = useCallback(() => {
    loopsRef.current.forEach((a) => a.stop && a.stop());
    loopsRef.current = [];
    if (shakeTimerRef.current) {
      clearInterval(shakeTimerRef.current);
      shakeTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (__DEV__) {
      try {
        console.log('[FRONTEND][SPIKE_ORB_RENDER]', {
          state,
          visible,
          violations: violationsForLog,
        });
      } catch {
        /* no-op */
      }
    }
  }, [state, visible, violationsForLog]);

  useEffect(() => {
    if (!visible) {
      stopAnims();
      return;
    }

    entrance.setValue(0);
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: cfg.pulseMs / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: cfg.pulseMs / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: cfg.pulseMs * 0.6,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: cfg.pulseMs * 0.6,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    const rip = Animated.loop(
      Animated.timing(ripple1, {
        toValue: 1,
        duration: state === 'calm' ? 2800 : 2000,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      })
    );

    loopsRef.current = [pulseLoop, breatheLoop, rip];
    pulseLoop.start();
    breatheLoop.start();
    rip.start();
    pulse.setValue(0);
    breathe.setValue(0);
    ripple1.setValue(0);

    Animated.spring(entrance, {
      toValue: 1,
      useNativeDriver: true,
      friction: 7,
      tension: 50,
    }).start();

    if (cfg.shake && (state === 'strict' || state === 'blocking')) {
      const runShake = () => {
        const s = Animated.sequence(
          [4, -4, 3, -2, 0].map((x, i) =>
            Animated.timing(shakeX, {
              toValue: x,
              duration: 45,
              useNativeDriver: true,
            })
          )
        );
        s.start();
      };
      runShake();
      shakeTimerRef.current = setInterval(runShake, state === 'blocking' ? 2200 : 2800);
    } else {
      shakeX.setValue(0);
    }

    return stopAnims;
  }, [visible, state, cfg.pulseMs, cfg.shake, pulse, breathe, entrance, ripple1, shakeX, stopAnims]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: cfg.pulseScale });
  const outerOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] });
  const innerOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.88, 0.95] });
  const rippleScale = ripple1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.65] });
  const rippleO = ripple1.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.4, 0] });

  const yIn = entrance.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  const fadeIn = entrance.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.5, 1] });

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.col} accessibilityRole="image" accessibilityLabel="Focus companion">
      <Animated.View
        style={[
          styles.orbRow,
          {
            opacity: fadeIn,
            transform: [{ translateY: yIn }, { translateX: shakeX }, { scale: entrance }],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.ripple,
            { width: orbSize, height: orbSize, borderRadius: orbSize / 2, opacity: rippleO, borderColor: cfg.glow, transform: [{ scale: rippleScale }] },
          ]}
        />
        <Animated.View
          style={{
            transform: [{ scale }],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Animated.View
            style={[
              {
                position: 'absolute',
                width: orbSize,
                height: orbSize,
                borderRadius: orbSize / 2,
                backgroundColor: cfg.glow,
                opacity: outerOpacity,
                ...styles.shadow,
              },
            ]}
          />
          <Animated.View style={{ opacity: innerOpacity }}>
            <LinearGradient
              colors={cfg.grad}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={[
                styles.orb,
                { width: orbSize, height: orbSize, borderRadius: orbSize / 2, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.35)' },
              ]}
            />
          </Animated.View>
        </Animated.View>
        {state === 'blocking' && (
          <View style={[styles.ring, { width: orbSize + 20, height: orbSize + 20, borderRadius: (orbSize + 20) / 2, borderColor: cfg.glow, opacity: 0.5 }]} />
        )}
      </Animated.View>
      {message && String(message).trim() !== '' && (
        <Text style={[styles.caption, { color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.6)' }]} numberOfLines={2}>
          {message}
        </Text>
      )}
    </View>
  );
}

function stateOrFallback(s: SpikeOrbState): SpikeOrbState {
  if (s === 'calm' || s === 'warning' || s === 'strict' || s === 'blocking') return s;
  return 'warning';
}

const styles = StyleSheet.create({
  col: { alignItems: 'center' },
  orbRow: { alignItems: 'center', justifyContent: 'center' },
  orb: { borderWidth: 1.5 },
  shadow: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 10 },
  ripple: { position: 'absolute', borderWidth: 1.2 },
  ring: { position: 'absolute', borderWidth: 2.5, backgroundColor: 'transparent' },
  caption: { fontSize: 12, textAlign: 'center', marginTop: 8, maxWidth: 200, lineHeight: 16 },
});

export const SpikeOrb = React.memo(SpikeOrbComponent);
