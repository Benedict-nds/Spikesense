import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { SpikeMascotState } from './spikeMascotTypes';

type SizeToken = 'sm' | 'md' | 'lg';

export type VectorSpikeMascotFallbackProps = {
  state?: SpikeMascotState;
  size?: SizeToken | number;
  animated?: boolean;
  showGlow?: boolean;
  glowBoost?: boolean;
  label?: string;
  style?: ViewStyle;
  clipMascot?: boolean;
};

function dimForSize(size: SizeToken | number | undefined): number {
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

type ConfettiDot = {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  c: string;
  w: number;
  h: number;
  o: number;
};

function ConfettiBits({ scale, spread }: { scale: number; spread: number }) {
  const dots = useMemo<ConfettiDot[]>(
    () => [
      { left: spread * 0.1, top: spread * 0.04, c: '#B2F5EA', w: 3, h: 3, o: 0.55 },
      { right: spread * 0.08, top: spread * 0.14, c: '#C4B5FD', w: 3, h: 4, o: 0.5 },
      { left: spread * 0.06, top: spread * 0.24, c: '#90CDF4', w: 3, h: 3, o: 0.45 },
      { right: spread * 0.12, top: spread * 0.3, c: '#FBB6CE', w: 2, h: 3, o: 0.5 },
      { left: spread * 0.18, bottom: spread * 0.1, c: '#81E6D9', w: 3, h: 2, o: 0.45 },
      { right: spread * 0.16, bottom: spread * 0.06, c: '#B794F4', w: 2, h: 2, o: 0.4 },
    ],
    [spread]
  );
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {dots.map((d, i) => (
        <View
          key={i}
          style={[
            styles.confettiDot,
            {
              backgroundColor: d.c,
              width: d.w * scale,
              height: d.h * scale,
              borderRadius: 2 * scale,
              left: d.left,
              right: d.right,
              top: d.top,
              bottom: d.bottom,
              opacity: d.o,
            },
          ]}
        />
      ))}
    </View>
  );
}

/** Tiny ambient sparkles around the silhouette (all states, very subtle). */
function AmbientSparkles({ dim }: { dim: number }) {
  const s = dim * 0.02;
  return (
    <View style={[styles.ambientWrap, { width: dim * 1.15, height: dim * 1.2 }]} pointerEvents="none">
      <View style={[styles.ambientDot, { top: '8%', left: '4%', width: s, height: s, opacity: 0.35 }]} />
      <View style={[styles.ambientDot, { top: '22%', right: '2%', width: s * 0.9, height: s * 0.9, opacity: 0.28 }]} />
      <View style={[styles.ambientDot, { bottom: '18%', left: '0%', width: s * 0.8, height: s * 0.8, opacity: 0.32 }]} />
      <View style={[styles.ambientDot, { bottom: '8%', right: '6%', width: s, height: s, opacity: 0.25 }]} />
    </View>
  );
}

export default function VectorSpikeMascotFallback({
  state = 'calm',
  size = 'md',
  animated = true,
  showGlow = true,
  glowBoost = false,
  label,
  style,
  clipMascot = true,
}: VectorSpikeMascotFallbackProps) {
  const dim = dimForSize(size);
  const scale = dim / 80;
  const bob = useRef(new Animated.Value(0)).current;
  const lastLogKey = useRef<string | null>(null);

  useEffect(() => {
    const key = `${state}|${dim}|${glowBoost}`;
    if (lastLogKey.current !== key) {
      lastLogKey.current = key;
      if (__DEV__) {
        console.log('[FRONTEND][SPIKE_MASCOT_RENDER]', { state, dim, glowBoost });
      }
    }
  }, [state, dim, glowBoost]);

  useEffect(() => {
    if (!animated) {
      bob.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animated, bob]);

  const translateY = bob.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -Math.max(1, 2 * scale)],
  });

  // Vertical bean: narrower than tall, soft squircle corners (not a flat circle).
  const bodyW = dim * 0.7;
  const bodyH = dim * 0.92;
  const rTop = bodyW * 0.48;
  const rBot = bodyW * 0.4;

  const eyeW = Math.max(3.5, 6.2 * scale);
  const eyeH = Math.max(4.5, 7.2 * scale);
  const eyeGap = Math.max(8, 13 * scale);
  const pupilW = eyeW * 0.42;
  const pupilH = eyeH * 0.5;
  const highlight = Math.max(1.5, 2 * scale);

  const gradStops =
    state === 'concerned'
      ? (['#2A4A62', '#3D6B9E', '#4FA3C8', '#7EC9B0'] as const)
      : state === 'focused'
        ? (['#284058', '#356599', '#4B9BC4', '#6EC4B0'] as const)
        : state === 'motivated' || state === 'celebrating'
          ? (['#243D58', '#2E5A8A', '#4A7AB8', '#6EB89E'] as const)
          : (['#2C5080', '#3D7AB8', '#56A8C4', '#82CDB2'] as const);

  const glowOuter = glowBoost ? 0.22 : state === 'concerned' ? 0.16 : 0.12;
  const glowMid = glowBoost ? 0.18 : 0.1;
  const glowInner = glowBoost ? 0.14 : 0.08;
  const glowScale = glowBoost ? 1.08 : 1;

  const tuftHeight = dim * 0.1;
  const tuftW = dim * 0.08;

  return (
    <View style={[styles.root, style]} accessibilityLabel={label || 'Spike mascot'}>
      <AmbientSparkles dim={dim} />

      {showGlow ? (
        <>
          <View
            style={[
              styles.glowHalo,
              {
                width: dim * 1.22 * glowScale,
                height: dim * 1.22 * glowScale,
                borderRadius: (dim * 1.22 * glowScale) / 2,
                backgroundColor: '#5B8FD8',
                opacity: glowOuter,
              },
            ]}
          />
          <View
            style={[
              styles.glowHalo,
              {
                width: dim * 1.02 * glowScale,
                height: dim * 1.02 * glowScale,
                borderRadius: (dim * 1.02 * glowScale) / 2,
                backgroundColor: '#7EC8B8',
                opacity: glowMid,
              },
            ]}
          />
          <View
            style={[
              styles.glowFloor,
              {
                width: dim * 1.08 * glowScale,
                height: dim * 0.36 * glowScale,
                borderRadius: (dim * 1.08 * glowScale) / 2,
                backgroundColor: '#805AD5',
                opacity: glowInner,
                bottom: -dim * 0.04,
              },
            ]}
          />
        </>
      ) : null}

      <Animated.View style={[styles.floatLayer, { transform: [{ translateY }] }]}>
        <View style={[styles.column, { width: bodyW, minHeight: bodyH + tuftHeight + dim * 0.04 }]}>
          {/* Abstract tuft: slim mint capsule + two micro sparks */}
          <View style={[styles.tuftWrap, { marginBottom: -bodyH * 0.06 }]}>
            <LinearGradient
              colors={['#9AE6B4', '#90CDF4', '#B794F4']}
              start={{ x: 0, y: 1 }}
              end={{ x: 1, y: 0 }}
              style={{
                width: tuftW,
                height: tuftHeight,
                borderRadius: tuftW / 2,
                opacity: 0.92,
              }}
            />
            <View style={[styles.tuftSpark, { left: -dim * 0.02, backgroundColor: '#C4F1F9' }]} />
            <View style={[styles.tuftSpark, { right: -dim * 0.02, backgroundColor: '#E9D8FD' }]} />
          </View>

          <View
            style={[
              styles.bodyShell,
              !clipMascot && styles.bodyShellOpen,
              {
                width: bodyW,
                height: bodyH,
                borderTopLeftRadius: rTop,
                borderTopRightRadius: rTop,
                borderBottomLeftRadius: rBot,
                borderBottomRightRadius: rBot,
              },
            ]}
          >
            <LinearGradient
              colors={[...gradStops]}
              locations={[0, 0.32, 0.65, 1]}
              start={{ x: 0.08, y: 0.05 }}
              end={{ x: 0.92, y: 1 }}
              style={[
                styles.bodyFace,
                !clipMascot && styles.bodyFaceOpen,
                {
                  borderTopLeftRadius: rTop,
                  borderTopRightRadius: rTop,
                  borderBottomLeftRadius: rBot,
                  borderBottomRightRadius: rBot,
                },
              ]}
            >
              {state === 'celebrating' ? <ConfettiBits scale={scale} spread={bodyW} /> : null}

              {/* Top-left dimensional highlight */}
              <LinearGradient
                colors={['rgba(255,255,255,0.42)', 'rgba(255,255,255,0)', 'transparent']}
                start={{ x: 0.15, y: 0.1 }}
                end={{ x: 0.65, y: 0.55 }}
                style={[
                  styles.topSheen,
                  {
                    borderTopLeftRadius: rTop * 0.95,
                    borderTopRightRadius: rTop * 0.4,
                  },
                ]}
              />

              {state === 'focused' ? (
                <View
                  style={[
                    styles.headband,
                    {
                      top: bodyH * 0.1,
                      paddingHorizontal: bodyW * 0.1,
                    },
                  ]}
                >
                  <View style={[styles.headbandLine, { height: Math.max(2, 3 * scale), flex: 1, maxWidth: '68%' }]} />
                  <View
                    style={[
                      styles.headbandGem,
                      { width: dim * 0.065, height: dim * 0.065, borderRadius: dim * 0.032 },
                    ]}
                  />
                </View>
              ) : null}

              {state === 'concerned' ? (
                <View
                  style={[
                    styles.browBand,
                    {
                      top: bodyH * 0.2,
                      width: bodyW * 0.52,
                      alignSelf: 'center',
                    },
                  ]}
                >
                  <View style={[styles.browSoft, { width: eyeW + 2, transform: [{ rotate: '-5deg' }] }]} />
                  <View style={[styles.browSoft, { width: eyeW + 2, transform: [{ rotate: '5deg' }] }]} />
                </View>
              ) : null}

              <View style={[styles.eyeRow, { gap: eyeGap, marginTop: bodyH * 0.28 }]}>
                {state === 'sleepy' ? (
                  <>
                    <View style={[styles.sleepCurve, { width: eyeW + 3 }]} />
                    <View style={[styles.sleepCurve, { width: eyeW + 3 }]} />
                  </>
                ) : (
                  <>
                    <View style={styles.eyeSlot}>
                      <View style={[styles.sclera, { width: eyeW, height: eyeH, borderRadius: eyeH / 2 }]}>
                        <View
                          style={[
                            styles.pupil,
                            {
                              width: pupilW,
                              height: pupilH,
                              borderRadius: pupilH / 2,
                              marginLeft:
                                state === 'concerned'
                                  ? -0.5
                                  : state === 'focused'
                                    ? 0.25
                                    : 0.35,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.pupilGlint,
                              {
                                width: highlight,
                                height: highlight,
                                borderRadius: highlight / 2,
                                top: 1,
                                left: 1,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    </View>
                    <View style={styles.eyeSlot}>
                      <View style={[styles.sclera, { width: eyeW, height: eyeH, borderRadius: eyeH / 2 }]}>
                        <View
                          style={[
                            styles.pupil,
                            {
                              width: pupilW,
                              height: pupilH,
                              borderRadius: pupilH / 2,
                              marginLeft:
                                state === 'concerned'
                                  ? -0.5
                                  : state === 'focused'
                                    ? 0.25
                                    : 0.35,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.pupilGlint,
                              {
                                width: highlight,
                                height: highlight,
                                borderRadius: highlight / 2,
                                top: 1,
                                left: 1,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    </View>
                  </>
                )}
              </View>

              {state === 'calm' || state === 'sleepy' ? (
                <View
                  style={[
                    styles.smileSoft,
                    {
                      width: dim * 0.2,
                      height: Math.max(5, 6 * scale),
                      marginTop: bodyH * 0.045,
                      borderBottomWidth: 1.25,
                    },
                  ]}
                />
              ) : state === 'concerned' ? (
                <View
                  style={[
                    styles.mouthConcern,
                    {
                      width: dim * 0.12,
                      marginTop: bodyH * 0.04,
                      height: Math.max(1, 1.5 * scale),
                    },
                  ]}
                />
              ) : (
                <View
                  style={[
                    styles.smileSoft,
                    {
                      width: dim * 0.22,
                      height: Math.max(5, 6 * scale),
                      marginTop: bodyH * 0.038,
                      borderBottomWidth: 1.35,
                    },
                  ]}
                />
              )}

              {/* Subtle chest glow */}
              <View style={[styles.chestGlow, { marginTop: bodyH * 0.05 }]}>
                <LinearGradient
                  colors={['rgba(251,182,206,0.55)', 'rgba(213,63,140,0.35)', 'rgba(255,255,255,0)']}
                  style={[
                    styles.chestHeart,
                    {
                      width: dim * 0.085,
                      height: dim * 0.07,
                      borderRadius: dim * 0.035,
                    },
                  ]}
                />
              </View>

              {state === 'motivated' || state === 'celebrating' ? (
                <View style={[styles.armRow, { width: bodyW, bottom: bodyH * 0.11 }]}>
                  <View style={[styles.armNub, { width: dim * 0.07, height: dim * 0.12, borderRadius: dim * 0.035 }]} />
                  <View style={[styles.armNub, { width: dim * 0.07, height: dim * 0.12, borderRadius: dim * 0.035 }]} />
                </View>
              ) : null}

              {state === 'motivated' ? (
                <View style={[styles.microSparks, { top: bodyH * 0.08 }]}>
                  <View style={[styles.microSpark, { backgroundColor: 'rgba(246,224,94,0.75)' }]} />
                  <View style={[styles.microSpark, { right: 1, top: 6, backgroundColor: 'rgba(255,255,255,0.5)' }]} />
                </View>
              ) : null}
            </LinearGradient>
          </View>
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
  ambientWrap: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 0,
  },
  ambientDot: {
    position: 'absolute',
    borderRadius: 99,
    backgroundColor: '#E0F2FE',
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
  floatLayer: {
    zIndex: 2,
    alignItems: 'center',
  },
  column: {
    alignItems: 'center',
  },
  tuftWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  tuftSpark: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 2,
    opacity: 0.85,
  },
  bodyShell: {
    overflow: 'hidden',
    zIndex: 2,
  },
  bodyShellOpen: {
    overflow: 'visible',
  },
  bodyFace: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    overflow: 'hidden',
  },
  bodyFaceOpen: {
    overflow: 'visible',
  },
  topSheen: {
    position: 'absolute',
    left: '4%',
    top: '5%',
    width: '58%',
    height: '38%',
    zIndex: 1,
  },
  headband: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    zIndex: 4,
  },
  headbandLine: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 3,
  },
  headbandGem: {
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  browBand: {
    position: 'absolute',
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 4,
  },
  browSoft: {
    height: 1.5,
    borderRadius: 1,
    backgroundColor: 'rgba(15,23,42,0.22)',
  },
  eyeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  eyeSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sclera: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  pupil: {
    backgroundColor: '#0F2744',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  pupilGlint: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  sleepCurve: {
    height: 5,
    borderBottomWidth: 1.5,
    borderColor: 'rgba(15,23,42,0.28)',
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  smileSoft: {
    borderColor: 'rgba(15,23,42,0.22)',
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  mouthConcern: {
    borderRadius: 2,
    backgroundColor: 'rgba(15,23,42,0.28)',
  },
  chestGlow: {
    alignItems: 'center',
    zIndex: 2,
  },
  chestHeart: {
    opacity: 0.75,
  },
  armRow: {
    position: 'absolute',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: '6%',
    zIndex: 2,
  },
  armNub: {
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  microSparks: {
    position: 'absolute',
    right: 10,
    width: 14,
    height: 16,
    zIndex: 4,
  },
  microSpark: {
    position: 'absolute',
    width: 2.5,
    height: 2.5,
    borderRadius: 2,
    top: 0,
    left: 0,
  },
  confettiDot: {
    position: 'absolute',
  },
  label: {
    color: 'rgba(45,55,72,0.85)',
    textAlign: 'center',
    fontWeight: '500',
    maxWidth: 200,
  },
});
