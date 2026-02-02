
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, Switch, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { useAppUsageTracking } from '@/hooks/useAppUsageTracking';
import { SpikeSenseMode } from '@/types/appUsage';

export default function ProfileScreen() {
  const { nudgeConfig, updateNudgeConfig, modeConfig, setMode } = useAppUsageTracking();
  const [localConfig, setLocalConfig] = useState(nudgeConfig);

  const handleToggle = (key: keyof typeof nudgeConfig) => {
    const newValue = !localConfig[key];
    setLocalConfig(prev => ({ ...prev, [key]: newValue }));
    updateNudgeConfig({ [key]: newValue });
  };

  const handleModeSelect = (mode: SpikeSenseMode) => {
    setMode(mode);
  };

  const getModeDescription = (mode: SpikeSenseMode) => {
    switch (mode) {
      case 'supportive':
        return 'Focus on awareness and education. Get insights about your habits without restrictions.';
      case 'motivational':
        return 'Gamified experience with badges, streaks, and challenges to keep you engaged.';
      case 'restrictive':
        return 'Adaptive restrictions with focus mode and gentle boundaries when needed.';
      case 'balanced':
        return 'Perfect balance of awareness, motivation, and light restrictions.';
    }
  };

  const getModeIcon = (mode: SpikeSenseMode) => {
    switch (mode) {
      case 'supportive':
        return 'lightbulb.fill';
      case 'motivational':
        return 'star.fill';
      case 'restrictive':
        return 'shield.fill';
      case 'balanced':
        return 'scale.3d';
    }
  };

  const modes: SpikeSenseMode[] = ['supportive', 'motivational', 'restrictive', 'balanced'];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          Platform.OS !== 'ios' && styles.contentContainerWithTabBar,
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <IconSymbol name="person.circle.fill" size={80} color={colors.primary} />
          </View>
          <Text style={styles.name}>Student User</Text>
          <Text style={styles.email}>student@university.edu</Text>
        </View>

        {/* Mode Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choose Your Mode</Text>
          <Text style={styles.sectionDescription}>
            Select how restrictive you want SpikeSense to be
          </Text>
          
          {modes.map((mode) => (
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
                    name={getModeIcon(mode) as any} 
                    size={24} 
                    color={modeConfig.mode === mode ? colors.primary : colors.textSecondary} 
                  />
                </View>
                <View style={styles.modeInfo}>
                  <Text style={[
                    styles.modeTitle,
                    modeConfig.mode === mode && styles.modeTitleActive,
                  ]}>
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </Text>
                  {modeConfig.mode === mode && (
                    <View style={styles.activeBadge}>
                      <IconSymbol name="checkmark.circle.fill" size={16} color={colors.secondary} />
                      <Text style={styles.activeBadgeText}>Active</Text>
                    </View>
                  )}
                </View>
              </View>
              <Text style={styles.modeDescription}>{getModeDescription(mode)}</Text>
            </Pressable>
          ))}
        </View>

        {/* Mode Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Features</Text>
          
          {modeConfig.supportive.enabled && (
            <View style={styles.featureCard}>
              <View style={styles.featureHeader}>
                <IconSymbol name="lightbulb.fill" size={20} color={colors.accent} />
                <Text style={styles.featureTitle}>Supportive Features</Text>
              </View>
              <View style={styles.featureList}>
                {modeConfig.supportive.showInsights && (
                  <View style={styles.featureItem}>
                    <IconSymbol name="checkmark.circle.fill" size={16} color={colors.secondary} />
                    <Text style={styles.featureText}>Context-based insights</Text>
                  </View>
                )}
                {modeConfig.supportive.showEducationalTips && (
                  <View style={styles.featureItem}>
                    <IconSymbol name="checkmark.circle.fill" size={16} color={colors.secondary} />
                    <Text style={styles.featureText}>Educational tips</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {modeConfig.motivational.enabled && (
            <View style={styles.featureCard}>
              <View style={styles.featureHeader}>
                <IconSymbol name="star.fill" size={20} color={colors.primary} />
                <Text style={styles.featureTitle}>Motivational Features</Text>
              </View>
              <View style={styles.featureList}>
                {modeConfig.motivational.showBadges && (
                  <View style={styles.featureItem}>
                    <IconSymbol name="checkmark.circle.fill" size={16} color={colors.secondary} />
                    <Text style={styles.featureText}>Badges & achievements</Text>
                  </View>
                )}
                {modeConfig.motivational.showStreaks && (
                  <View style={styles.featureItem}>
                    <IconSymbol name="checkmark.circle.fill" size={16} color={colors.secondary} />
                    <Text style={styles.featureText}>Streaks tracking</Text>
                  </View>
                )}
                {modeConfig.motivational.showChallenges && (
                  <View style={styles.featureItem}>
                    <IconSymbol name="checkmark.circle.fill" size={16} color={colors.secondary} />
                    <Text style={styles.featureText}>Daily challenges</Text>
                  </View>
                )}
                {modeConfig.motivational.showFocusScore && (
                  <View style={styles.featureItem}>
                    <IconSymbol name="checkmark.circle.fill" size={16} color={colors.secondary} />
                    <Text style={styles.featureText}>Focus score</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {modeConfig.restrictive.enabled && (
            <View style={styles.featureCard}>
              <View style={styles.featureHeader}>
                <IconSymbol name="shield.fill" size={20} color={colors.accent} />
                <Text style={styles.featureTitle}>Restrictive Features</Text>
              </View>
              <View style={styles.featureList}>
                {modeConfig.restrictive.enableFocusMode && (
                  <View style={styles.featureItem}>
                    <IconSymbol name="checkmark.circle.fill" size={16} color={colors.secondary} />
                    <Text style={styles.featureText}>Focus mode</Text>
                  </View>
                )}
                {modeConfig.restrictive.pauseNotifications && (
                  <View style={styles.featureItem}>
                    <IconSymbol name="checkmark.circle.fill" size={16} color={colors.secondary} />
                    <Text style={styles.featureText}>Pause notifications</Text>
                  </View>
                )}
                {modeConfig.restrictive.showCooldowns && (
                  <View style={styles.featureItem}>
                    <IconSymbol name="checkmark.circle.fill" size={16} color={colors.secondary} />
                    <Text style={styles.featureText}>Cooldown screens</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>

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

        {/* Privacy Notice */}
        <View style={styles.privacyNotice}>
          <IconSymbol name="lock.shield.fill" size={24} color={colors.primary} />
          <Text style={styles.privacyText}>
            Your data stays on your device. SpikeSense is privacy-friendly and doesn&apos;t share your usage data.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
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
    color: colors.text,
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  modeCard: {
    backgroundColor: colors.card,
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
    backgroundColor: colors.card,
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
    backgroundColor: colors.card,
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
    backgroundColor: colors.card,
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
  privacyNotice: {
    backgroundColor: colors.highlight,
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
