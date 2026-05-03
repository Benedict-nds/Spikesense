import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { onboardingColors, onboardingSpace } from '@/constants/onboardingTheme';
import BackgroundFrame from '@/components/BackgroundFrame';
import { OnboardingLogoMark } from '@/components/onboarding/OnboardingLogoMark';
import { OnboardingOrb } from '@/components/onboarding/OnboardingOrb';
import { OnboardingProgressDots } from '@/components/onboarding/OnboardingProgressDots';
import { OnboardingButton } from '@/components/onboarding/OnboardingButton';

export default function OnboardingWelcome() {
  return (
    <BackgroundFrame screen="welcome" overlayColor="rgba(2,6,23,0.56)" contentTone="dark">
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.top}>
            <OnboardingLogoMark />
          </View>

          <View style={styles.heroText}>
            <Text style={styles.welcomeLine}>Welcome to</Text>
            <Text style={styles.brandRow}>
              <Text style={styles.brandSpike}>Spike</Text>
              <Text style={styles.brandSense}>Sense</Text>
            </Text>
            <Text style={styles.subtitle}>
              Your personal companion for focus, balance, and healthier phone habits.
            </Text>
          </View>

          <View style={styles.orbSection}>
            <OnboardingOrb size="hero" showDecor mascotState="motivated" />
          </View>
        </ScrollView>

        <View style={styles.bottom}>
          <OnboardingProgressDots activeIndex={0} total={5} />
          <OnboardingButton
            label="Let's get started  →"
            onPress={() => router.push('/onboarding/name')}
            variant="mintTeal"
          />
        </View>
      </SafeAreaView>
    </BackgroundFrame>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: onboardingSpace.horizontal },
  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 8,
  },
  top: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  heroText: {
    alignItems: 'center',
    paddingTop: 8,
  },
  welcomeLine: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.88)',
    fontWeight: '500',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 14,
  },
  brandSpike: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  brandSense: {
    fontSize: 36,
    fontWeight: '800',
    color: onboardingColors.mint,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    paddingHorizontal: 8,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  orbSection: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 220,
    paddingVertical: 12,
  },
  bottom: {
    paddingBottom: 12,
    gap: 16,
  },
});
