import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import BackgroundFrame from '@/components/BackgroundFrame';
import { OnboardingLightShell } from '@/components/onboarding/OnboardingLightShell';
import { OnboardingOrb } from '@/components/onboarding/OnboardingOrb';
import { onboardingColors, onboardingSpace } from '@/constants/onboardingTheme';
import { setStoredDisplayName } from '@/services/userProfile';

export default function OnboardingName() {
  const [name, setName] = useState('');
  const trimmed = name.trim();
  const valid = trimmed.length >= 1;

  const onNext = async () => {
    await setStoredDisplayName(name);
    router.push('/onboarding/how');
  };

  return (
    <BackgroundFrame
      screen="name"
      overlayColor="rgba(2,6,23,0.62)"
      contentTone="dark"
    >
      <OnboardingLightShell
        activeStep={1}
        showBack
        onBack={() => router.back()}
        primaryLabel="Continue"
        onPrimary={() => void onNext()}
        primaryVariant="violetBlue"
        secondaryLabel="Back"
        onSecondary={() => router.back()}
        keyboard
        transparentBackground
        surfaceTone="dark"
      >
      <View style={styles.orbWrap}>
        <OnboardingOrb size="small" showDecor={false} />
      </View>
      <Text style={styles.kicker}>Nice to meet you!</Text>
      <Text style={styles.title}>What should SpikeSense call you?</Text>
      <Text style={styles.sub}>This stays on your device only.</Text>

      <View style={styles.inputCard}>
        <MaterialIcons name="person" size={22} color={onboardingColors.muted} />
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor={onboardingColors.muted}
          style={styles.input}
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={80}
          returnKeyType="done"
          onSubmitEditing={() => void onNext()}
        />
        {valid ? (
          <MaterialIcons name="check-circle" size={24} color={onboardingColors.mint} />
        ) : (
          <View style={styles.checkSpacer} />
        )}
      </View>
      <Text style={styles.helper}>We&apos;ll use this to personalize your experience.</Text>
      </OnboardingLightShell>
    </BackgroundFrame>
  );
}

const styles = StyleSheet.create({
  orbWrap: { alignItems: 'center', marginBottom: 12 },
  kicker: {
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
    marginBottom: 20,
    lineHeight: 22,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: onboardingColors.card,
    borderRadius: onboardingSpace.cardRadius,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: onboardingColors.muted + '33',
    shadowColor: onboardingColors.deepNavy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  input: {
    flex: 1,
    fontSize: 17,
    color: onboardingColors.darkText,
    paddingVertical: 8,
  },
  checkSpacer: { width: 24 },
  helper: {
    marginTop: 12,
    fontSize: 14,
    color: 'rgba(255,255,255,0.68)',
    lineHeight: 20,
  },
});
