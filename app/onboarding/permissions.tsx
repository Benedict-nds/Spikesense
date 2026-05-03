import React, { useCallback, useEffect, useState } from 'react';
import {
  Text,
  StyleSheet,
  View,
  Platform,
  AppState,
  type AppStateStatus,
  Alert,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { OnboardingLightShell } from '@/components/onboarding/OnboardingLightShell';
import { OnboardingShieldHero } from '@/components/onboarding/OnboardingShieldHero';
import {
  OnboardingPermissionCard,
  OnboardingPrivacyNoteCard,
} from '@/components/onboarding/OnboardingPermissionCard';
import { onboardingColors, onboardingSpace } from '@/constants/onboardingTheme';
import { setOnboardingCompleted } from '@/services/userProfile';
import { requestNotificationPermissionIfAndroidOptional } from '@/services/nudgeNotifications';
import {
  checkUsageAccessPermission,
  openUsageAccessSettingsFromOnboarding,
} from '@/services/permissions';
import BackgroundFrame from '@/components/BackgroundFrame';

export default function OnboardingPermissions() {
  const [usageAccessGranted, setUsageAccessGranted] = useState(Platform.OS !== 'android');

  const refreshUsageAccess = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setUsageAccessGranted(true);
      return;
    }
    const granted = await checkUsageAccessPermission();
    if (__DEV__) {
      console.log('[ONBOARDING][USAGE_ACCESS_STATUS]', { granted });
    }
    setUsageAccessGranted(granted);
  }, []);

  useEffect(() => {
    void requestNotificationPermissionIfAndroidOptional();
  }, []);

  useEffect(() => {
    void refreshUsageAccess();
  }, [refreshUsageAccess]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        void refreshUsageAccess();
      }
    });
    return () => sub.remove();
  }, [refreshUsageAccess]);

  const finish = async () => {
    if (Platform.OS === 'android' && !usageAccessGranted) {
      if (__DEV__) {
        console.log('[ONBOARDING][CONTINUE_BLOCKED_USAGE_ACCESS_REQUIRED]');
      }
      Alert.alert(
        'Usage Access required',
        'Please enable Usage Access for SpikeSense, then return here to continue.'
      );
      return;
    }
    try {
      await setOnboardingCompleted(true);
    } catch {
      /* still enter app */
    }
    if (__DEV__) {
      console.log('[ONBOARDING][PERMISSIONS_COMPLETE]');
    }
    router.replace('/(tabs)/(home)');
  };

  const onPrimary = () => {
    if (Platform.OS === 'ios') {
      void finish();
      return;
    }
    if (usageAccessGranted) {
      void finish();
      return;
    }
    if (__DEV__) {
      console.log('[ONBOARDING][OPEN_USAGE_ACCESS_SETTINGS_TAP]');
    }
    void openUsageAccessSettingsFromOnboarding();
  };

  const primaryLabel =
    Platform.OS === 'ios'
      ? 'Continue to SpikeSense'
      : usageAccessGranted
        ? 'Continue to SpikeSense'
        : 'Open usage access settings';

  const footerHelper =
    Platform.OS === 'ios'
      ? 'Some usage insights are Android-only. You can still use SpikeSense on this device.'
      : usageAccessGranted
        ? 'Usage Access enabled. You’re ready to continue.'
        : 'Enable Usage Access, then return here to continue.';

  const bodyCopy =
    Platform.OS === 'ios'
      ? 'SpikeSense works best with the permissions you choose below. Full app-switch tracking is Android-only on this build.'
      : 'SpikeSense needs Usage Access to understand app switching and give accurate focus support.';

  const usageCardSubtitle =
    Platform.OS === 'ios'
      ? 'Optional on this device. Full switch tracking is Android-only in this version.'
      : 'Required for app-switch tracking, top apps, insights, and focus nudges.';

  const notificationsSubtitle =
    'Recommended for reminders outside the app. You can enable this later in Settings.';

  const floatingSubtitle =
    'Optional. Lets Spike appear over other apps during focus sessions. Enable later in Profile if you prefer.';

  return (
    <BackgroundFrame
      screen="permissions"
      overlayColor="rgba(2,6,23,0.62)"
      contentTone="dark"
    >
      <OnboardingLightShell
        activeStep={4}
        showBack
        onBack={() => router.back()}
        leading="close"
        primaryLabel={primaryLabel}
        onPrimary={() => void onPrimary()}
        primaryVariant="violetBlue"
        secondaryLabel={Platform.OS === 'ios' ? 'Open app settings' : undefined}
        onSecondary={Platform.OS === 'ios' ? () => void Linking.openSettings() : undefined}
        transparentBackground
        surfaceTone="dark"
      >
      <OnboardingShieldHero />
      <Text style={styles.step}>Step 3 of 3</Text>
      <Text style={styles.title}>Almost there!</Text>
      <Text style={styles.body}>{bodyCopy}</Text>

      <View style={styles.cards}>
        <OnboardingPermissionCard
          title="Usage Access"
          subtitle={usageCardSubtitle}
          icon="bar-chart"
        />
        {Platform.OS === 'android' ? (
          <>
            <OnboardingPermissionCard
              title="Notifications"
              subtitle={notificationsSubtitle}
              icon="notifications"
            />
            <OnboardingPermissionCard
              title="Floating Spike"
              subtitle={floatingSubtitle}
              icon="layers"
            />
          </>
        ) : null}
        <OnboardingPrivacyNoteCard text="Your data is private and stays on your device." />
      </View>

      {Platform.OS === 'android' && !usageAccessGranted ? (
        <Text style={styles.usageReturnNote}>
          After enabling Usage Access, return to SpikeSense to continue.
        </Text>
      ) : null}

      <Text style={styles.footerHint}>{footerHelper}</Text>
      {Platform.OS === 'android' ? (
        <Text style={styles.footerOptional}>
          Notifications and Floating Spike can be enabled later in Settings.
        </Text>
      ) : null}
      </OnboardingLightShell>
    </BackgroundFrame>
  );
}

const styles = StyleSheet.create({
  step: {
    fontSize: 14,
    fontWeight: '700',
    color: '#A78BFA',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 10,
    letterSpacing: -0.4,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.82)',
    marginBottom: onboardingSpace.sectionGap,
  },
  cards: { marginTop: 4 },
  usageReturnNote: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.72)',
    fontStyle: 'italic',
  },
  footerHint: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.82)',
    fontWeight: '600',
  },
  footerOptional: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.68)',
  },
});
