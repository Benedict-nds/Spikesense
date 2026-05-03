import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import BackgroundFrame from '@/components/BackgroundFrame';
import { OnboardingLightShell } from '@/components/onboarding/OnboardingLightShell';
import { OnboardingIllustrationPhone } from '@/components/onboarding/OnboardingIllustrationPhone';
import { OnboardingFeatureCard } from '@/components/onboarding/OnboardingFeatureCard';
import { onboardingColors, onboardingSpace } from '@/constants/onboardingTheme';

export default function OnboardingHow() {
  return (
    <BackgroundFrame screen="how" overlayColor="rgba(2,6,23,0.58)" contentTone="dark">
      <OnboardingLightShell
        activeStep={2}
        showBack
        onBack={() => router.back()}
        primaryLabel="Continue"
        onPrimary={() => router.push('/onboarding/modes')}
        primaryVariant="violetBlue"
        secondaryLabel="Back"
        onSecondary={() => router.back()}
        transparentBackground
        surfaceTone="dark"
      >
        <OnboardingIllustrationPhone />
        <Text style={styles.step}>Step 1 of 3</Text>
        <Text style={styles.title}>How SpikeSense works</Text>
        <Text style={styles.body}>
          SpikeSense looks at app switching, app categories, and usage patterns to detect signs of
          digital overstimulation.
        </Text>
        <View style={styles.cards}>
          <OnboardingFeatureCard
            text="Tracks your app usage in the background"
            icon="analytics"
            bubbleColor={onboardingColors.mint}
          />
          <OnboardingFeatureCard
            text="Understands patterns that affect your focus"
            icon="psychology"
            bubbleColor={onboardingColors.violet}
          />
          <OnboardingFeatureCard
            text="Gives you insights and helps you feel in control"
            icon="auto-awesome"
            bubbleColor={onboardingColors.primary}
          />
        </View>
      </OnboardingLightShell>
    </BackgroundFrame>
  );
}

const styles = StyleSheet.create({
  step: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B7F7DC',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.88)',
    marginBottom: onboardingSpace.sectionGap,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cards: { marginTop: 4 },
});
