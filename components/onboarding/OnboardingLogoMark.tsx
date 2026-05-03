import React from 'react';
import { View, StyleSheet } from 'react-native';
import { onboardingColors } from '@/constants/onboardingTheme';

/** Abstract linked rings (no external asset). */
export function OnboardingLogoMark() {
  return (
    <View style={styles.wrap}>
      <View style={[styles.ring, styles.ringBack]} />
      <View style={[styles.ring, styles.ringFront]} />
    </View>
  );
}

const R = 28;
const styles = StyleSheet.create({
  wrap: {
    width: R * 2 + 8,
    height: R + 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: R * 2,
    height: R * 2,
    borderRadius: R,
    borderWidth: 4,
  },
  ringBack: {
    borderColor: onboardingColors.teal,
    opacity: 0.95,
    transform: [{ translateX: -10 }, { translateY: 2 }],
  },
  ringFront: {
    borderColor: onboardingColors.mint,
    opacity: 0.95,
    transform: [{ translateX: 10 }, { translateY: -2 }],
  },
});
