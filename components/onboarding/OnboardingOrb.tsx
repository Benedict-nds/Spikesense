import React from 'react';
import { View, StyleSheet } from 'react-native';
import { onboardingColors } from '@/constants/onboardingTheme';
import SpikeMascot, { type SpikeMascotState } from '@/components/SpikeMascot';

type Size = 'hero' | 'small';

type Props = {
  size?: Size;
  /** Decorative stars/dots around hero orb */
  showDecor?: boolean;
  /** Mascot emotional state */
  mascotState?: SpikeMascotState;
};

export function OnboardingOrb({ size = 'hero', showDecor, mascotState }: Props) {
  const isHero = size === 'hero';
  const dim = isHero ? 182 : 80;
  const state = mascotState ?? (isHero ? 'calm' : 'calm');
  const pad = isHero ? 28 : 20;
  const stageW = dim + pad * 2;
  const stageH = dim + pad * 2;

  return (
    <View style={[styles.stage, { width: stageW, minHeight: stageH }]}>
      <View style={styles.glowWrap} pointerEvents="none">
        <View
          style={[
            styles.glowDisk,
            {
              width: dim * 1.35,
              height: dim * 1.35,
              borderRadius: (dim * 1.35) / 2,
              backgroundColor: onboardingColors.mint,
              opacity: isHero ? 0.14 : 0.1,
            },
          ]}
        />
        <View
          style={[
            styles.glowDisk,
            {
              width: dim * 0.92,
              height: dim * 0.92,
              borderRadius: (dim * 0.92) / 2,
              backgroundColor: onboardingColors.primary,
              opacity: isHero ? 0.1 : 0.07,
              marginTop: -dim * 0.08,
            },
          ]}
        />
      </View>
      {showDecor !== false && isHero ? (
        <>
          <View style={[styles.star, styles.s1]} />
          <View style={[styles.star, styles.s2]} />
          <View style={[styles.star, styles.s3]} />
        </>
      ) : null}
      <View style={styles.mascotLayer}>
        <SpikeMascot state={state} size={dim} animated showGlow clipMascot={false} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  glowWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
  },
  glowDisk: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotLayer: {
    zIndex: 2,
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'center',
  },
  star: {
    position: 'absolute',
    backgroundColor: onboardingColors.mint,
    borderRadius: 3,
    opacity: 0.7,
    zIndex: 1,
  },
  s1: { width: 6, height: 6, top: '10%', right: '8%' },
  s2: { width: 4, height: 4, top: '26%', left: '6%' },
  s3: { width: 5, height: 5, bottom: '18%', right: '10%' },
});
