
import React, { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScrollView, View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/styles/commonStyles';
import { generateWeeklyMockData } from '@/utils/mockDataGenerator';
import { useAppUsageTracking } from '@/hooks/useAppUsageTracking';
import WeeklyChart from '@/components/WeeklyChart';
import AppUsageList from '@/components/AppUsageList';
import NudgeCard from '@/components/NudgeCard';
import StatCard from '@/components/StatCard';
import DoughnutChart from '@/components/DoughnutChart';
import BadgeCard from '@/components/BadgeCard';
import StreakCard from '@/components/StreakCard';
import ChallengeCard from '@/components/ChallengeCard';
import FocusModeCard from '@/components/FocusModeCard';

type TabType = 'overview' | 'progress' | 'achievements' | 'insights';

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const insets = useSafeAreaInsets();
  const { 
    dailyStats, 
    nudges, 
    dismissNudge, 
    modeConfig,
    badges,
    streaks,
    challenges,
    focusSession,
    startFocusSession,
    endFocusSession,
  } = useAppUsageTracking();

  const weeklyData = generateWeeklyMockData();

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  if (!dailyStats) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const categoryData = [
    { label: 'Productivity', value: dailyStats.productivityTime, color: colors.primary },
    { label: 'Social', value: dailyStats.socialTime, color: colors.secondary },
    { label: 'Entertainment', value: dailyStats.entertainmentTime, color: colors.accent },
    { label: 'Other', value: dailyStats.otherTime, color: colors.textSecondary },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <>
            {/* Focus Score (Motivational) */}
            {modeConfig.motivational.enabled && modeConfig.motivational.showFocusScore && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Today&apos;s Focus Score</Text>
                <View style={styles.focusScoreCard}>
                  <View style={styles.focusScoreCircle}>
                    <Text style={styles.focusScoreValue}>{dailyStats.focusScore}</Text>
                    <Text style={styles.focusScoreLabel}>/ 100</Text>
                  </View>
                  <View style={styles.focusScoreInfo}>
                    <Text style={styles.focusScoreText}>
                      {dailyStats.focusScore >= 80 ? 'Excellent focus today! 🎉' :
                       dailyStats.focusScore >= 60 ? 'Good focus, keep it up! 👍' :
                       dailyStats.focusScore >= 40 ? 'Room for improvement 💪' :
                       'Let\'s work on focus tomorrow 🌱'}
                    </Text>
                    <Text style={styles.focusScoreDetail}>
                      {formatTime(dailyStats.focusTime)} of focused work
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Nudges */}
            {nudges.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Notifications</Text>
                {nudges.map(nudge => (
                  <NudgeCard 
                    key={nudge.id} 
                    nudge={nudge} 
                    onDismiss={dismissNudge}
                  />
                ))}
              </View>
            )}

            {/* Daily Overview */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Today&apos;s Overview</Text>
              <View style={styles.statsGrid}>
                <StatCard
                  icon="clock.fill"
                  label="Screen Time"
                  value={formatTime(dailyStats.totalScreenTime)}
                  color={colors.primary}
                />
                <StatCard
                  icon="arrow.triangle.swap"
                  label="App Switches"
                  value={dailyStats.appSwitches.toString()}
                  color={colors.accent}
                />
              </View>
            </View>
          </>
        );

      case 'progress':
        return (
          <>
            {/* Weekly Trend */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Weekly Trend</Text>
              <WeeklyChart data={weeklyData} />
            </View>

            {/* Category Breakdown */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Usage by Category</Text>
              <View style={styles.chartContainer}>
                <DoughnutChart
                  data={categoryData}
                  size={200}
                  strokeWidth={30}
                  centerText={formatTime(dailyStats.totalScreenTime)}
                  centerSubtext="Total Time"
                />
              </View>
              <View style={styles.legend}>
                {categoryData.map((item, index) => (
                  <View key={index} style={styles.legendItem}>
                    <View style={[styles.legendColor, { backgroundColor: item.color }]} />
                    <Text style={styles.legendLabel}>{item.label}</Text>
                    <Text style={styles.legendValue}>{formatTime(item.value)}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* App Usage List */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>App Usage Details</Text>
              <AppUsageList apps={dailyStats.apps} />
            </View>
          </>
        );

      case 'achievements':
        return (
          <>
            {/* Streaks (Motivational) */}
            {modeConfig.motivational.enabled && modeConfig.motivational.showStreaks && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Your Streaks 🔥</Text>
                {streaks.map((streak, index) => (
                  <StreakCard key={index} streak={streak} />
                ))}
              </View>
            )}

            {/* Challenges (Motivational) */}
            {modeConfig.motivational.enabled && modeConfig.motivational.showChallenges && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Active Challenges</Text>
                {challenges.map(challenge => (
                  <ChallengeCard key={challenge.id} challenge={challenge} />
                ))}
              </View>
            )}

            {/* Badges (Motivational) */}
            {modeConfig.motivational.enabled && modeConfig.motivational.showBadges && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Badges & Achievements</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.badgesContainer}
                >
                  {badges.map(badge => (
                    <BadgeCard key={badge.id} badge={badge} />
                  ))}
                </ScrollView>
              </View>
            )}
          </>
        );

      case 'insights':
        return (
          <>
            {/* Focus Mode Card */}
            {modeConfig.restrictive.enabled && modeConfig.restrictive.enableFocusMode && (
              <View style={styles.section}>
                <FocusModeCard 
                  session={focusSession}
                  onStart={startFocusSession}
                  onEnd={endFocusSession}
                />
              </View>
            )}

            {/* Supportive Insights */}
            {modeConfig.supportive.enabled && modeConfig.supportive.showInsights && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Insights</Text>
                <View style={styles.insightCard}>
                  <View style={styles.insightHeader}>
                    <MaterialCommunityIcons name="lightbulb-on" size={22} color={colors.secondary} style={styles.insightIcon} />
                    <Text style={styles.insightTitle}>Understanding Your Habits</Text>
                  </View>
                  <Text style={styles.insightText}>
                    {dailyStats.appSwitches > 50 
                      ? `You switched apps ${dailyStats.appSwitches} times today. Frequent switching can indicate cognitive overload. Try focusing on one task for 25-minute intervals.`
                      : `Great job! You kept app switching to ${dailyStats.appSwitches} times today. This shows good focus and task management.`}
                  </Text>
                </View>
              </View>
            )}

            {/* Educational Tips (Supportive) */}
            {modeConfig.supportive.enabled && modeConfig.supportive.showEducationalTips && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Wellness Tips</Text>
                <View style={styles.tipCard}>
                  <View style={styles.tipHeader}>
                    <MaterialCommunityIcons name="book-open-variant" size={22} color={colors.primary} style={styles.tipIcon} />
                    <Text style={styles.tipTitle}>Wellness Tip</Text>
                  </View>
                  <Text style={styles.tipText}>
                    Small breaks every 45 minutes can improve focus and reduce stress. Try the 20-20-20 rule: every 20 minutes, look at something 20 feet away for 20 seconds.
                  </Text>
                </View>
              </View>
            )}
          </>
        );

      default:
        return null;
    }
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <MaterialCommunityIcons name="chart-bar" size={20} color={colors.primary} />,
    },
    {
      id: 'progress',
      label: 'Progress',
      icon: <MaterialCommunityIcons name="chart-line" size={20} color={colors.primary} />,
    },
    {
      id: 'achievements',
      label: 'Achievements',
      icon: <MaterialCommunityIcons name="trophy" size={20} color={colors.accent} />,
    },
    {
      id: 'insights',
      label: 'Insights',
      icon: <MaterialCommunityIcons name="lightbulb-on" size={20} color={colors.secondary} />,
    },
  ];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Text style={styles.title}>SpikeSense</Text>
          <Text style={styles.subtitle}>Your Digital Wellness Coach</Text>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabScrollContent}
          >
            {tabs.map(tab => (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.tab,
                  activeTab === tab.id && styles.tabActive
                ]}
                onPress={() => setActiveTab(tab.id)}
              >
                <View style={styles.tabIcon}>{tab.icon}</View>
                <Text style={[
                  styles.tabLabel,
                  activeTab === tab.id && styles.tabLabelActive
                ]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Tab Content */}
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={[
            styles.contentContainer,
            Platform.OS !== 'ios' && styles.contentContainerWithTabBar,
          ]}
        >
          {renderTabContent()}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  contentContainerWithTabBar: {
    paddingBottom: 100,
  },
  tabContainer: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
    paddingVertical: 8,
  },
  tabScrollContent: {
    paddingHorizontal: 8,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginHorizontal: 4,
    backgroundColor: colors.background,
    minWidth: 100,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  tabLabelActive: {
    color: colors.card,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
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
    marginBottom: 12,
  },
  focusScoreCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 2,
  },
  focusScoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  focusScoreValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
  },
  focusScoreLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  focusScoreInfo: {
    flex: 1,
  },
  focusScoreText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  focusScoreDetail: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  insightCard: {
    backgroundColor: colors.highlight,
    borderRadius: 12,
    padding: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 2,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  insightIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  insightText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  tipCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.secondary,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 2,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tipIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  tipText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  legend: {
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 8,
  },
  legendLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  legendValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  badgesContainer: {
    gap: 12,
    paddingRight: 16,
  },
});
