import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type ViewStyle,
} from 'react-native';
import VectorSpikeMascotFallback from './VectorSpikeMascotFallback';
import type { SpikeMascotState } from './spikeMascotTypes';

export type { SpikeMascotState };

type SizeToken = 'sm' | 'md' | 'lg';

export type SpikeMascotProps = {
  state?: SpikeMascotState;
  size?: SizeToken | number;
  animated?: boolean;
  showGlow?: boolean;
  /** Stronger under-glow (e.g. focus guard blocking tier) */
  glowBoost?: boolean;
  label?: string;
  style?: ViewStyle;
  /** When true, draw the legacy RN vector mascot instead of PNG sprites. */
  useVectorFallback?: boolean;
  /**
   * When false, the PNG is not clipped to a tight rounded mask (full sprite visible).
   * Compact cards (e.g. nudges) keep the default true.
   */
  clipMascot?: boolean;
};

const SPIKE_ASSETS: Record<SpikeMascotState, ImageSourcePropType> = {
  calm: require('@/assets/images/spike/spike-calm.png'),
  concerned: require('@/assets/images/spike/spike-concerned.png'),
  focused: require('@/assets/images/spike/spike-focused.png'),
  motivated: require('@/assets/images/spike/spike-motivated.png'),
  celebrating: require('@/assets/images/spike/spike-celebrating.png'),
  sleepy: require('@/assets/images/spike/spike-sleepy.png'),
};

export function dimForSize(size: SizeToken | number | undefined): number {
  if (typeof size === 'number' && Number.isFinite(size) && size > 0) return Math.round(size);
  switch (size) {
    case 'lg':
      return 112;
    case 'md':
      return 80;
    case 'sm':
    default:
      return 48;
  }
}

export default function SpikeMascot({
  state = 'calm',
  size = 'md',
  animated = true,
  showGlow = true,
  glowBoost = false,
  label,
  style,
  useVectorFallback = false,
  clipMascot = true,
}: SpikeMascotProps) {
  if (useVectorFallback) {
    return (
      <VectorSpikeMascotFallback
        state={state}
        size={size}
        animated={animated}
        showGlow={showGlow}
        glowBoost={glowBoost}
        label={label}
        style={style}
        clipMascot={clipMascot}
      />
    );
  }

  const dim = dimForSize(size);
  const scale = dim / 80;
  const breathe = useRef(new Animated.Value(1)).current;
  const lastLogKey = useRef<string | null>(null);

  const source = SPIKE_ASSETS[state] ?? SPIKE_ASSETS.calm;

  useEffect(() => {
    const key = `${state}|${dim}|${glowBoost}`;
    if (lastLogKey.current !== key) {
      lastLogKey.current = key;
      if (__DEV__) {
        console.log('[FRONTEND][SPIKE_MASCOT_RENDER]', { state, dim, glowBoost });
        console.log('[FRONTEND][SPIKE_MASCOT_ASSET_MODE]', { state, assetKey: state });
      }
    }
  }, [state, dim, glowBoost]);

  useEffect(() => {
    if (!animated) {
      breathe.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1.02,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animated, breathe]);

  const glowOuter = glowBoost ? 0.2 : 0.11;
  const glowMid = glowBoost ? 0.14 : 0.08;
  const glowFloor = glowBoost ? 0.12 : 0.07;
  const glowScale = glowBoost ? 1.06 : 1;

  const clipRadius = dim * 0.36;
  const imageFrameStyle = clipMascot
    ? {
        width: dim,
        height: dim,
        borderRadius: clipRadius,
      }
    : {
        width: dim,
        height: dim,
        borderRadius: 0,
      };

  const halo = useMemo(
    () => (
      <>
        <View
          style={[
            styles.glowHalo,
            {
              width: dim * 1.14 * glowScale,
              height: dim * 1.14 * glowScale,
              borderRadius: (dim * 1.14 * glowScale) / 2,
              backgroundColor: '#5B8FD8',
              opacity: glowOuter,
            },
          ]}
        />
        <View
          style={[
            styles.glowHalo,
            {
              width: dim * 0.98 * glowScale,
              height: dim * 0.98 * glowScale,
              borderRadius: (dim * 0.98 * glowScale) / 2,
              backgroundColor: '#8FD4C4',
              opacity: glowMid,
            },
          ]}
        />
        <View
          style={[
            styles.glowFloor,
            {
              width: dim * 1.02 * glowScale,
              height: dim * 0.32 * glowScale,
              borderRadius: (dim * 1.02 * glowScale) / 2,
              backgroundColor: '#805AD5',
              opacity: glowFloor,
              bottom: -dim * 0.03,
            },
          ]}
        />
      </>
    ),
    [dim, glowFloor, glowMid, glowOuter, glowScale]
  );

  return (
    <View style={[styles.root, style]} accessibilityLabel={label || 'Spike mascot'}>
      {showGlow ? halo : null}

      <Animated.View
        style={[
          styles.imageStack,
          imageFrameStyle,
          { transform: [{ scale: breathe }] },
          !clipMascot && styles.imageStackUnclipped,
        ]}
      >
        <View
          style={[
            clipMascot ? styles.clip : styles.clipOpen,
            imageFrameStyle,
          ]}
        >
          <Image source={source} style={styles.image} resizeMode="contain" accessibilityIgnoresInvertColors />
        </View>
      </Animated.View>

      {label ? (
        <Text style={[styles.label, { fontSize: Math.max(10, 11 * scale), marginTop: 4 }]} numberOfLines={2}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowHalo: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 0,
  },
  glowFloor: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 0,
  },
  imageStack: {
    zIndex: 2,
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageStackUnclipped: {
    overflow: 'visible',
  },
  clip: {
    overflow: 'hidden',
    backgroundColor: 'rgba(15,23,42,0.04)',
  },
  clipOpen: {
    overflow: 'visible',
    backgroundColor: 'transparent',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  label: {
    color: 'rgba(45,55,72,0.85)',
    textAlign: 'center',
    fontWeight: '500',
    maxWidth: 200,
  },
});
