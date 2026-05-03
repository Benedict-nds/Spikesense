import React from 'react';
import { View, StyleSheet } from 'react-native';
import { onboardingColors } from '@/constants/onboardingTheme';

type Props = {
  /** 0 = welcome, 1 = name, … 4 = permissions */
  activeIndex: number;
  total?: number;
};

export function OnboardingProgressDots({ activeIndex, total = 5 }: Props) {
  return (
    <View style={styles.row} accessibilityRole="progressbar">
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[styles.dot, i === activeIndex ? styles.dotActive : styles.dotInactive]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: onboardingColors.mint,
    transform: [{ scale: 1.15 }],
  },
  dotInactive: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
});

/** Variant for light backgrounds */
export function OnboardingProgressDotsLight({ activeIndex, total = 5 }: Props) {
  return (
    <View style={stylesLight.row}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            stylesLight.dot,
            i === activeIndex ? stylesLight.dotActive : stylesLight.dotInactive,
          ]}
        />
      ))}
    </View>
  );
}

const stylesLight = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: onboardingColors.violet,
    transform: [{ scale: 1.15 }],
  },
  dotInactive: {
    backgroundColor: onboardingColors.muted + '55',
  },
});
