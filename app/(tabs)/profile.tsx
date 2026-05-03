import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, Switch, Pressable, ImageBackground, Linking } from 'react-native';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { useAppUsageTracking } from '@/hooks/useAppUsageTracking';
import { useDisplayName } from '@/hooks/useOnboarding';
import { callName, resetOnboardingForTesting } from '@/services/userProfile';
import { openUsageAccessSettingsFromOnboarding } from '@/services/permissions';
import { MODES, MODE_DESCRIPTIONS, MODE_LABELS, type Mode } from '@/constants/modes';

export default function ProfileScreen() {
  const { nudgeConfig, updateNudgeConfig, modeConfig, setMode } = useAppUsageTracking();
  const { displayName, refresh: refreshDisplayName } = useDisplayName();
  const [localConfig, setLocalConfig] = useState(nudgeConfig);
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      void refreshDisplayName();
    }, [refreshDisplayName])
  );

  const handleToggle = (key: keyof typeof nudgeConfig) => {
    const newValue = !localConfig[key];
    setLocalConfig(prev => ({ ...prev, [key]: newValue }));
    updateNudgeConfig({ [key]: newValue });
  };

  const handleModeSelect = (mode: Mode) => {
    setMode(mode);
  };

  const MODE_ICONS: Record<Mode, string> = {
    focus: 'brain.head.profile',
    balanced: 'scale.3d',
    relax: 'moon.stars.fill',
    auto: 'arrow.triangle.2.circlepath',
  };

  return (
    <ImageBackground 
      source={require('@/assets/images/spikewall4.jpeg')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      {/* Dark Overlay for Readability */}
      <View style={styles.overlay} />
      
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingTop: insets.top + 16 },
          Platform.OS !== 'ios' && styles.contentContainerWithTabBar,
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <IconSymbol name="person.circle.fill" size={80} color={colors.primary} />
          </View>
          <Text style={styles.name}>{callName(displayName)}</Text>
          <Text style={styles.email}>On-device profile for greetings</Text>
        </View>

        {/* Mode Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choose Your Mode</Text>
          <Text style={styles.sectionDescription}>
            Select how you want SpikeSense to support you
          </Text>
          
          {MODES.map((mode) => (
            <Pressable
              key={mode}
              style={[
                styles.modeCard,
                modeConfig.mode === mode && styles.modeCardActive,
              ]}
              onPress={() => handleModeSelect(mode)}
            >
              <View style={styles.modeHeader}>
                <View style={[
                  styles.modeIconContainer,
                  modeConfig.mode === mode && styles.modeIconContainerActive,
                ]}>
                  <IconSymbol 
                    name={MODE_ICONS[mode] as any} 
                    size={24} 
                    color={modeConfig.mode === mode ? colors.primary : colors.textSecondary} 
                  />
                </View>
                <View style={styles.modeInfo}>
                  <Text style={[
                    styles.modeTitle,
                    modeConfig.mode === mode && styles.modeTitleActive,
                  ]}>
                    {MODE_LABELS[mode]}
                  </Text>
                  {modeConfig.mode === mode && (
                    <View style={styles.activeBadge}>
                      <IconSymbol name="checkmark.circle.fill" size={16} color={colors.secondary} />
                      <Text style={styles.activeBadgeText}>Active</Text>
                    </View>
                  )}
                </View>
              </View>
              <Text style={styles.modeDescription}>{MODE_DESCRIPTIONS[mode]}</Text>
            </Pressable>
          ))}
        </View>

        {/* Mode Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What this changes</Text>
          <View style={styles.featureCard}>
            <Text style={styles.modeDescription}>{MODE_DESCRIPTIONS[modeConfig.mode]}</Text>
          </View>
        </View>

        {Platform.OS === 'android' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Floating Spike</Text>
            <View style={styles.settingCard}>
              <Text style={styles.settingLabel}>Enable floating Spike</Text>
              <Text style={styles.settingDescription}>
                Allow SpikeSense to show a small floating reminder over other apps during focus sessions.
                Optional — system notifications still work if you do not enable &quot;Display over other apps&quot;.
              </Text>
              <Pressable
                style={styles.overlaySettingsBtn}
                onPress={() => {
                  void Linking.openSettings();
                }}
              >
                <Text style={styles.overlaySettingsBtnText}>Open Android settings</Text>
              </Pressable>
              <Pressable
                style={[styles.overlaySettingsBtn, styles.usageAccessBtn]}
                onPress={() => {
                  openUsageAccessSettingsFromOnboarding();
                }}
              >
                <Text style={styles.overlaySettingsBtnText}>Open Usage Access settings</Text>
              </Pressable>
              <Text style={styles.overlayHint}>
                In Settings, find {Constants.expoConfig?.android?.package ?? 'SpikeSense'} and turn on
                &quot;Display over other apps&quot; (wording varies by device). Usage Access is under
                Special app access → Usage access.
              </Text>
            </View>
          </View>
        ) : null}

        {/* Nudge Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nudge Settings</Text>
          
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Enable Nudges</Text>
                <Text style={styles.settingDescription}>
                  Receive wellness reminders and suggestions
                </Text>
              </View>
              <Switch
                value={localConfig.enabled}
                onValueChange={() => handleToggle('enabled')}
                trackColor={{ false: colors.textSecondary + '40', true: colors.primary + '60' }}
                thumbColor={localConfig.enabled ? colors.primary : colors.card}
              />
            </View>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingHeader}>
              <IconSymbol name="arrow.triangle.swap" size={20} color={colors.accent} />
              <Text style={styles.settingCardTitle}>App Switching Threshold</Text>
            </View>
            <Text style={styles.thresholdValue}>{localConfig.switchThreshold} switches</Text>
            <Text style={styles.settingDescription}>
              Get notified after this many app switches
            </Text>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingHeader}>
              <IconSymbol name="play.circle.fill" size={20} color={colors.primary} />
              <Text style={styles.settingCardTitle}>Entertainment Threshold</Text>
            </View>
            <Text style={styles.thresholdValue}>{localConfig.entertainmentThreshold} minutes</Text>
            <Text style={styles.settingDescription}>
              Get notified after this much entertainment time
            </Text>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingHeader}>
              <IconSymbol name="cup.and.saucer.fill" size={20} color={colors.secondary} />
              <Text style={styles.settingCardTitle}>Break Reminder Interval</Text>
            </View>
            <Text style={styles.thresholdValue}>{localConfig.breakInterval} minutes</Text>
            <Text style={styles.settingDescription}>
              Remind me to take breaks every
            </Text>
          </View>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About SpikeSense</Text>
          
          <View style={styles.aboutCard}>
            <Text style={styles.aboutText}>
              SpikeSense is a student-focused wellness assistant that helps you manage digital overstimulation through behavioral analysis and personalized nudges.
            </Text>
            <View style={styles.featureList}>
              <View style={styles.featureItem}>
                <IconSymbol name="checkmark.circle.fill" size={20} color={colors.secondary} />
                <Text style={styles.featureText}>Track app usage patterns</Text>
              </View>
              <View style={styles.featureItem}>
                <IconSymbol name="checkmark.circle.fill" size={20} color={colors.secondary} />
                <Text style={styles.featureText}>Monitor app-switching frequency</Text>
              </View>
              <View style={styles.featureItem}>
                <IconSymbol name="checkmark.circle.fill" size={20} color={colors.secondary} />
                <Text style={styles.featureText}>Receive personalized nudges</Text>
              </View>
              <View style={styles.featureItem}>
                <IconSymbol name="checkmark.circle.fill" size={20} color={colors.secondary} />
                <Text style={styles.featureText}>View daily & weekly summaries</Text>
              </View>
            </View>
          </View>
        </View>

        {__DEV__ ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Testing</Text>
            <Pressable
              style={styles.devButton}
              onPress={async () => {
                await resetOnboardingForTesting();
                router.replace('/onboarding');
              }}
            >
              <Text style={styles.devButtonText}>Replay onboarding</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Privacy Notice */}
        <View style={styles.privacyNotice}>
          <IconSymbol name="lock.shield.fill" size={24} color={colors.primary} />
          <Text style={styles.privacyText}>
            Your data stays on your device. SpikeSense is privacy-friendly and doesn&apos;t share your usage data.
          </Text>
        </View>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  contentContainerWithTabBar: {
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  email: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'rgba(255, 255, 255, 0.95)',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  sectionDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 16,
    lineHeight: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  modeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 2,
  },
  modeCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  modeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  modeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.textSecondary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  modeIconContainerActive: {
    backgroundColor: colors.primary + '20',
  },
  modeInfo: {
    flex: 1,
  },
  modeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  modeTitleActive: {
    color: colors.primary,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.secondary,
    marginLeft: 4,
  },
  modeDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  featureCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 2,
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 8,
  },
  featureList: {
    gap: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 14,
    color: colors.text,
    marginLeft: 8,
  },
  settingCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  settingCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 8,
  },
  thresholdValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 4,
  },
  aboutCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 2,
  },
  aboutText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    marginBottom: 16,
  },
  devButton: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary + '55',
  },
  devButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  overlaySettingsBtn: {
    alignSelf: 'flex-start',
    marginTop: 12,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  usageAccessBtn: {
    marginTop: 10,
    backgroundColor: colors.secondary,
  },
  overlaySettingsBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  overlayHint: {
    marginTop: 10,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  privacyNotice: {
    backgroundColor: 'rgba(235, 244, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  privacyText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    marginLeft: 12,
  },
});
