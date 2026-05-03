import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import SpikeMascot, { type SpikeMascotState } from '@/components/SpikeMascot';
import { colors } from '@/styles/commonStyles';
import type { NudgeRealtimePayload } from '@/types/nudgeDelivery';

const AUTO_DISMISS_MS = 4500;

type Props = {
  visible: boolean;
  payload: NudgeRealtimePayload | null;
  onDismiss: () => void;
  onOpenPress?: () => void;
};

function severityToMascotState(severity: string | undefined): SpikeMascotState {
  const s = (severity || 'medium').toLowerCase();
  if (s === 'low') return 'calm';
  if (s === 'high') return 'focused';
  return 'concerned';
}

export default function MiniSpikeOrbAlert({ visible, payload, onDismiss, onOpenPress }: Props) {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const slide = useRef(new Animated.Value(0)).current;
  const autoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (autoRef.current) {
      clearTimeout(autoRef.current);
      autoRef.current = null;
    }
    Animated.timing(slide, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => onDismiss());
  }, [onDismiss, slide]);

  useEffect(() => {
    if (!visible || !payload) {
      slide.setValue(0);
      if (autoRef.current) {
        clearTimeout(autoRef.current);
        autoRef.current = null;
      }
      return;
    }
    slide.setValue(0);
    Animated.spring(slide, { toValue: 1, useNativeDriver: true, friction: 7, tension: 50 }).start();
    autoRef.current = setTimeout(() => dismiss(), AUTO_DISMISS_MS);
    return () => {
      if (autoRef.current) clearTimeout(autoRef.current);
    };
  }, [visible, payload, slide, dismiss]);

  if (!visible || !payload) {
    return null;
  }

  const mascotState = severityToMascotState(payload.severity);
  const y = slide.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] });
  const o = slide.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.85, 1] });

  const line = (payload.message || 'SpikeSense noticed something.').trim();
  const sub =
    (payload.explanation && String(payload.explanation).trim()) != ''
      ? String(payload.explanation).replace(/\s+/g, ' ').slice(0, 120)
      : 'Tap to open SpikeSense';

  const cardShadow = isDark
    ? 'rgba(0,0,0,0.4)'
    : 'rgba(15, 23, 42, 0.12)';

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { paddingTop: insets.top + 8, opacity: o, transform: [{ translateY: y }] },
      ]}
    >
      <Pressable style={styles.backdrop} onPress={dismiss} accessibilityLabel="Dismiss insight" />
      <Pressable
        onPress={onOpenPress}
        style={({ pressed }) => [styles.float, { shadowColor: cardShadow, opacity: pressed ? 0.95 : 1 }]}
        accessibilityRole="summary"
        accessibilityLabel={`${line}. ${sub}`}
      >
        <BlurView
          intensity={isDark ? 50 : 65}
          tint={isDark ? 'dark' : 'light'}
          style={[styles.card, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}
        >
          <View style={styles.row}>
            <SpikeMascot state={mascotState} size={48} animated showGlow />
            <View style={styles.textBlock}>
              <Text style={[styles.eyebrow, { color: isDark ? 'rgba(255,255,255,0.5)' : colors.textSecondary }]}>
                SpikeSense noticed
              </Text>
              <Text
                style={[styles.title, { color: isDark ? '#fff' : colors.text }]}
                numberOfLines={3}
              >
                {line}
              </Text>
              {sub && (
                <Text
                  style={[styles.sub, { color: isDark ? 'rgba(255,255,255,0.7)' : colors.textSecondary }]}
                  numberOfLines={2}
                >
                  {sub}
                </Text>
              )}
            </View>
          </View>
        </BlurView>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 10000,
    elevation: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    minHeight: 200,
  },
  float: {
    marginHorizontal: 14,
    borderRadius: 18,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textBlock: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 11, fontWeight: '600', letterSpacing: 0.4, marginBottom: 4, textTransform: 'uppercase' },
  title: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  sub: { fontSize: 12, marginTop: 4, lineHeight: 16 },
});
