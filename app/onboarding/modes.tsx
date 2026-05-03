import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import BackgroundFrame from '@/components/BackgroundFrame';
import { OnboardingLightShell } from '@/components/onboarding/OnboardingLightShell';
import { OnboardingModeCard } from '@/components/onboarding/OnboardingModeCard';
import { OnboardingOrb } from '@/components/onboarding/OnboardingOrb';
import { onboardingColors, onboardingSpace } from '@/constants/onboardingTheme';

export default function OnboardingModes() {
  return (
    <BackgroundFrame
      screen="modes"
      overlayColor="rgba(2,6,23,0.6)"
      contentTone="dark"
    >
      <OnboardingLightShell
        activeStep={3}
        showBack
        onBack={() => router.back()}
        primaryLabel="Continue"
        onPrimary={() => router.push('/onboarding/permissions')}
        primaryVariant="violetBlue"
        secondaryLabel="Back"
        onSecondary={() => router.back()}
        transparentBackground
        surfaceTone="dark"
      >
      <Text style={styles.step}>Step 2 of 3</Text>

      <View style={styles.spikeRow}>
        <OnboardingOrb size="small" showDecor={false} mascotState="calm" />
      </View>

      <Text style={styles.title}>Choose your mode of support</Text>
      <Text style={styles.sub}>You can change this anytime.</Text>

      <View style={styles.list}>
        <OnboardingModeCard
          title="Focus"
          description="Stricter limits and stronger nudges to help you deeply focus."
          icon="center-focus-strong"
          iconColor={onboardingColors.violet}
          tint={onboardingColors.violet}
        />
        <OnboardingModeCard
          title="Balanced"
          description="Smart, steady support to keep you aligned every day."
          icon="stacked-line-chart"
          iconColor={onboardingColors.primary}
          tint={onboardingColors.primary}
        />
        <OnboardingModeCard
          title="Relax"
          description="Lighter support for downtime and mental recharge."
          icon="eco"
          iconColor={onboardingColors.mint}
          tint={onboardingColors.mint}
        />
        <OnboardingModeCard
          title="Adaptive"
          description="SpikeSense chooses the best mode for you automatically."
          icon="auto-awesome"
          iconColor={onboardingColors.amber}
          tint={onboardingColors.amber}
          recommended
        />
      </View>
      </OnboardingLightShell>
    </BackgroundFrame>
  );
}

const styles = StyleSheet.create({
  spikeRow: {
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 4,
  },
  step: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B7F7DC',
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  sub: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.82)',
    marginBottom: onboardingSpace.sectionGap,
    lineHeight: 22,
  },
  list: { marginTop: 4 },
});
