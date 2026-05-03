import React from 'react';
import { View, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import SpikeMascot from '@/components/SpikeMascot';
import { onboardingColors } from '@/constants/onboardingTheme';

export function OnboardingShieldHero() {
  return (
    <View style={styles.wrap}>
      <SpikeMascot
        state="focused"
        size={76}
        animated
        showGlow
        clipMascot={false}
        style={{ marginBottom: 8 }}
      />
      <View style={styles.heroBlock}>
        <View style={[styles.confetti, styles.c1]} />
        <View style={[styles.confetti, styles.c2]} />
        <View style={[styles.confetti, styles.c3]} />
        <View style={[styles.confetti, styles.c4]} />
        <View style={styles.shield}>
          <MaterialIcons name="shield" size={52} color={onboardingColors.primary} />
          <View style={styles.checkBadge}>
            <MaterialIcons name="check" size={22} color={onboardingColors.card} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    marginBottom: 8,
  },
  heroBlock: {
    width: '100%',
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  shield: {
    width: 100,
    height: 100,
    borderRadius: 28,
    backgroundColor: onboardingColors.softBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: onboardingColors.primary + '33',
    shadowColor: onboardingColors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  checkBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: onboardingColors.mint,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: onboardingColors.card,
  },
  confetti: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  c1: { backgroundColor: onboardingColors.mint, top: 4, left: '14%' },
  c2: { backgroundColor: onboardingColors.violet, top: 0, right: '16%' },
  c3: { backgroundColor: onboardingColors.amber, bottom: 8, left: '18%' },
  c4: { backgroundColor: onboardingColors.teal, bottom: 4, right: '14%' },
});
