import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, View, Text, StyleSheet, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { colors } from '@/styles/commonStyles';
import { useAppUsageTracking } from '@/hooks/useAppUsageTracking';
import { useDisplayName } from '@/hooks/useOnboarding';
import { callName } from '@/services/userProfile';
import WeeklyChart from '@/components/WeeklyChart';
import AppUsageList from '@/components/AppUsageList';
import NudgeCard, { NudgeErrorBoundary } from '@/components/NudgeCard';
import StatCard from '@/components/StatCard';
import DoughnutChart from '@/components/DoughnutChart';
import BadgeCard from '@/components/BadgeCard';
import StreakCard from '@/components/StreakCard';
import ChallengeCard from '@/components/ChallengeCard';
import FocusModeCard from '@/components/FocusModeCard';
import AnimatedSection from '@/components/AnimatedSection';
import AnimatedPressable from '@/components/AnimatedPressable';
import InsightsTabContent from '@/components/InsightsTabContent';
import SpikeMascot from '@/components/SpikeMascot';
import BackgroundSlideshow from '@/components/BackgroundSlideshow';
import { getDashboardBackgroundMeta } from '@/constants/backgroundImages';

type TabType = 'overview' | 'progress' | 'achievements' | 'insights';

/** Space below scroll content so floating / native tab bars never cover cards */
const TAB_BAR_SCROLL_PADDING = 88;

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const insets = useSafeAreaInsets();
  const {
    dailyStats,
    nudges,
    dismissNudge,
    modeConfig,
    badges,
    lockedBadges,
    streaks,
    challenges,
    weeklyData,
    focusSession,
    loading,
    error,
    retry,
    refreshDailyStats,
    refreshStatsAndNudges,
    refreshAchievements,
    refreshProgressData,
    startFocusSession,
    endFocusSession,
  } = useAppUsageTracking();

  const { displayName, refresh: refreshDisplayName } = useDisplayName();

  const [refreshing, setRefreshing] = useState(false);
  const skipFocusRefreshOnce = React.useRef(true);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshDailyStats();
      await refreshAchievements();
      await refreshProgressData();
    } finally {
      setRefreshing(false);
    }
  }, [refreshDailyStats, refreshAchievements, refreshProgressData]);

  useFocusEffect(
    useCallback(() => {
      void refreshDisplayName();
      if (skipFocusRefreshOnce.current) {
        skipFocusRefreshOnce.current = false;
        return;
      }
      if (__DEV__) console.log('[FRONTEND][HOME_FOCUS_REFRESH]');
      void refreshStatsAndNudges();
    }, [refreshStatsAndNudges, refreshDisplayName])
  );

  useEffect(() => {
    if (!__DEV__) return;
    console.log('[FRONTEND][NUDGES_RENDER]', { count: nudges.length });
  }, [nudges.length]);

  useEffect(() => {
    if (activeTab === 'achievements') {
      void refreshAchievements();
    }
    if (activeTab === 'progress') {
      void refreshProgressData();
    }
    if (activeTab === 'insights') {
      void refreshDailyStats();
    }
  }, [activeTab, refreshAchievements, refreshProgressData, refreshDailyStats]);

  const tabBackgroundImages = React.useMemo(
    () => getDashboardBackgroundMeta(activeTab).images,
    [activeTab]
  );

  useEffect(() => {
    if (!__DEV__ || activeTab !== 'achievements') return;
    console.log('[FRONTEND][TODAY_CHALLENGES_RENDER]', {
      count: challenges.length,
      keys: challenges.map((c) => c.challengeKey ?? c.id),
      sample: challenges[0]
        ? {
            id: challenges[0].id,
            title: challenges[0].title,
            challengeKey: challenges[0].challengeKey,
            completed: challenges[0].completed,
            status: challenges[0].status,
          }
        : null,
    });
    console.log('[FRONTEND][BADGES_RENDER]', {
      earned: badges.length,
      locked: lockedBadges.length,
      firstEarned: badges[0]
        ? { id: badges[0].id, badgeKey: badges[0].badgeKey, name: badges[0].name }
        : null,
      firstLocked: lockedBadges[0]
        ? { badgeKey: lockedBadges[0].badgeKey, name: lockedBadges[0].name }
        : null,
    });
    if (badges.length === 0 && lockedBadges.length === 0) {
      console.log('[FRONTEND][EMPTY_STATE_RENDER]', { area: 'badges', reason: 'badges_array_empty' });
    }
    if (challenges.length === 0) {
      console.log('[FRONTEND][EMPTY_STATE_RENDER]', { area: 'challenges', reason: 'no_mapped_challenge' });
    }
    if (modeConfig.mode !== 'relax' && streaks.length === 0) {
      console.log('[FRONTEND][EMPTY_STATE_RENDER]', { area: 'streaks' });
    }
  }, [activeTab, modeConfig.mode, badges, lockedBadges, challenges, streaks.length]);

  const formatTime = (minutes: number) => {
    const totalMins = Math.floor(Number(minutes));
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <BackgroundSlideshow
          mode={modeConfig.mode}
          screen={activeTab}
          images={tabBackgroundImages}
          rotate={false}
          overlayVariant="dark"
          overlayOpacity={0.58}
        >
          <View style={[styles.loadingContainer, { flex: 1 }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        </BackgroundSlideshow>
      </>
    );
  }

  if (error && !dailyStats) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <BackgroundSlideshow
          mode={modeConfig.mode}
          screen={activeTab}
          images={tabBackgroundImages}
          rotate={false}
          overlayVariant="dark"
          overlayOpacity={0.58}
        >
          <View style={[styles.loadingContainer, { flex: 1 }]}>
            <Text style={styles.errorText}>Unable to load data.</Text>
            <Text style={styles.errorSubtext}>{error}</Text>
            {__DEV__ && (error === 'Unable to connect to backend.' || error === 'Unable to load data.') && (
              <Text style={styles.errorHint}>
                On a physical device, the app uses your dev machine&apos;s address from Expo, or set EXPO_PUBLIC_API_URL in .env (e.g. http://YOUR_IP:5000/api) if needed.
              </Text>
            )}
            <Pressable style={styles.retryButton} onPress={retry}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        </BackgroundSlideshow>
      </>
    );
  }

  if (!dailyStats) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <BackgroundSlideshow
          mode={modeConfig.mode}
          screen={activeTab}
          images={tabBackgroundImages}
          rotate={false}
          overlayVariant="dark"
          overlayOpacity={0.58}
        >
          <View style={[styles.loadingContainer, { flex: 1 }]}>
            <Text style={styles.errorText}>Almost there</Text>
            <Text style={styles.errorSubtext}>
              Once you start using your phone, we&apos;ll show your usage and focus score here.
            </Text>
          </View>
        </BackgroundSlideshow>
      </>
    );
  }

  const safeMin = (n: number) => (Number.isFinite(n) && n >= 0 ? n : 0);
  const overviewScreenMin =
    safeMin(dailyStats.totalScreenTime) ||
    (dailyStats.totalUsageSeconds != null && dailyStats.totalUsageSeconds > 0
      ? Math.floor(safeMin(dailyStats.totalUsageSeconds) / 60)
      : 0);
  const overviewSwitches = safeMin(dailyStats.appSwitches);
  const overviewFocusMin =
    safeMin(dailyStats.focusTime) || safeMin(dailyStats.productivityTime ?? 0);
  const overviewEntMin = safeMin(dailyStats.entertainmentTime);
  const showTodaysOverview =
    overviewScreenMin > 0 ||
    overviewSwitches > 0 ||
    overviewFocusMin > 0 ||
    overviewEntMin > 0;
  const focusScoreDisplay = Number.isFinite(dailyStats.focusScore)
    ? Math.round(Math.max(0, Math.min(100, dailyStats.focusScore)))
    : 0;
  const hasDayUsage =
    safeMin(dailyStats.totalScreenTime) > 0 ||
    safeMin(dailyStats.appSwitches) > 0 ||
    (dailyStats.totalUsageSeconds ?? 0) > 0;
  const namedTopApps = dailyStats.apps.filter((a) => (a.appName || '').trim().length > 0);

  const categoryData = [
    { label: 'Productivity', value: safeMin(dailyStats.productivityTime), color: colors.primary },
    { label: 'Social', value: safeMin(dailyStats.socialTime), color: colors.secondary },
    { label: 'Entertainment', value: safeMin(dailyStats.entertainmentTime), color: colors.accent },
    { label: 'Other', value: safeMin(dailyStats.otherTime), color: colors.textSecondary },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <>
            {/* Focus Score */}
            {modeConfig.mode !== 'relax' && (
              <AnimatedSection index={0}>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Today&apos;s Focus Score</Text>
                  <View style={styles.focusScoreCard}>
                    <View style={styles.focusScoreCircle}>
                      <Text style={styles.focusScoreValue}>{focusScoreDisplay}</Text>
                      <Text style={styles.focusScoreLabel}>/ 100</Text>
                    </View>
                    <View style={[styles.focusScoreInfo, styles.focusScoreInfoFlex]}>
                      <Text style={styles.focusScoreText}>
                        {dailyStats.focusScoreReason?.trim()
                          ? dailyStats.focusScoreReason
                          : 'Your focus score summarizes switching, entertainment, and productive time for today.'}
                      </Text>
                      <Text style={styles.focusScoreSubDetail}>
                        {formatTime(safeMin(dailyStats.focusTime))} on productivity apps
                      </Text>
                    </View>
                  </View>
                </View>
              </AnimatedSection>
            )}

            {/* Nudges */}
            {nudges.length > 0 && (
              <AnimatedSection index={1}>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Notifications</Text>
                  {nudges.map((nudge, nudgeIndex) => (
                    <NudgeErrorBoundary key={String(nudge?.id ?? `nudge-${nudgeIndex}`)}>
                      <NudgeCard nudge={nudge} onDismiss={dismissNudge} />
                    </NudgeErrorBoundary>
                  ))}
                </View>
              </AnimatedSection>
            )}

            {/* Daily Overview — hidden when there is no meaningful day data */}
            {showTodaysOverview && (
              <AnimatedSection index={2}>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Today&apos;s Overview</Text>
                  <View style={styles.statsGridColumn}>
                    <View style={styles.statsRow}>
                      <View style={styles.statCell}>
                        <StatCard
                          icon="clock.fill"
                          label="Screen Time"
                          value={formatTime(overviewScreenMin)}
                          color={colors.primary}
                          index={0}
                        />
                      </View>
                      <View style={styles.statCell}>
                        <StatCard
                          icon="arrow.triangle.swap"
                          label="App Switches"
                          value={String(Math.max(0, Math.floor(overviewSwitches)))}
                          color={colors.accent}
                          index={1}
                        />
                      </View>
                    </View>
                    <View style={styles.statsRow}>
                      <View style={styles.statCell}>
                        <StatCard
                          icon="lightbulb.fill"
                          label="Focus Time"
                          value={formatTime(overviewFocusMin)}
                          color={colors.secondary}
                          index={2}
                        />
                      </View>
                      <View style={styles.statCell}>
                        <StatCard
                          icon="play.fill"
                          label="Entertainment"
                          value={formatTime(overviewEntMin)}
                          color={colors.primary}
                          index={3}
                        />
                      </View>
                    </View>
                  </View>
                </View>
              </AnimatedSection>
            )}
          </>
        );

      case 'progress':
        return (
          <>
            <AnimatedSection index={0}>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Weekly Trend</Text>
                <WeeklyChart data={weeklyData} />
              </View>
            </AnimatedSection>

            <AnimatedSection index={1}>
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
            </AnimatedSection>

            <AnimatedSection index={2}>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>App Usage Details</Text>
                <AppUsageList
                  apps={dailyStats.apps}
                  loading={refreshing}
                  usagePresentButNoTopApps={hasDayUsage && namedTopApps.length === 0}
                />
              </View>
            </AnimatedSection>
          </>
        );

      case 'achievements':
        return (
          <>
            {refreshing ? (
              <View style={styles.syncBanner}>
                <Text style={styles.syncBannerText}>Syncing latest…</Text>
              </View>
            ) : null}
            {modeConfig.mode !== 'relax' && (
              <AnimatedSection index={0}>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Your Streaks</Text>
                  {streaks.length > 0 ? (
                    streaks.map((streak, index) => (
                      <StreakCard key={index} streak={streak} index={index} />
                    ))
                  ) : (
                    <Text style={styles.emptySectionText}>
                      Open SpikeSense on consecutive days to start a streak—gentle and optional.
                    </Text>
                  )}
                </View>
              </AnimatedSection>
            )}

            {/* Daily challenges: behavior-aware list from backend (max 3 shown here) */}
            <AnimatedSection index={1}>
              <View style={styles.section}>
                {challenges.some((c) => c.completed) ? (
                  <View style={styles.spikeCelebrateWrap} accessibilityLabel="Progress celebration">
                    <SpikeMascot state="celebrating" size={56} animated showGlow />
                  </View>
                ) : null}
                <Text style={styles.sectionTitle}>Today&apos;s Challenges</Text>
                {challenges.length > 0 ? (
                  challenges.slice(0, 3).map((challenge, index) => (
                    <ChallengeCard key={challenge.id || `ch-${index}`} challenge={challenge} index={index} />
                  ))
                ) : (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptySectionText}>
                      Challenges will appear once SpikeSense understands your day. Pull down to refresh anytime.
                    </Text>
                  </View>
                )}
              </View>
            </AnimatedSection>

            {/* Badge collection: earned first, then locked previews from API */}
            <AnimatedSection index={2}>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Badge Collection</Text>
                <Text style={styles.sectionSubtitle}>
                  Rewards earned from focus, switching, and healthier habits.
                </Text>
                {badges.length > 0 ? (
                  <Text style={styles.badgeCountHint}>{badges.length} earned</Text>
                ) : null}
                {badges.length > 0 || lockedBadges.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.badgesContainer}
                  >
                    {badges.map((badge, badgeIndex) => (
                      <BadgeCard
                        key={badge.id ? `badge-${badge.id}` : `badge-${badge.badgeKey ?? 'row'}-${badgeIndex}`}
                        badge={badge}
                      />
                    ))}
                    {lockedBadges.map((badge, badgeIndex) => (
                      <BadgeCard
                        key={`locked-${badge.badgeKey ?? badgeIndex}`}
                        badge={badge}
                      />
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={styles.emptySectionText}>
                    Badges will show up here as you keep tracking—no rush.
                  </Text>
                )}
              </View>
            </AnimatedSection>
          </>
        );

      case 'insights':
        return (
          <>
            {modeConfig.mode === 'focus' && (
              <AnimatedSection index={0}>
                <View style={styles.section}>
                  <FocusModeCard 
                    session={focusSession}
                    onStart={startFocusSession}
                    onEnd={endFocusSession}
                  />
                </View>
              </AnimatedSection>
            )}

            <AnimatedSection index={modeConfig.mode === 'focus' ? 1 : 0}>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Insights</Text>
                <InsightsTabContent
                  dailyStats={dailyStats}
                  refreshing={refreshing}
                  loadError={activeTab === 'insights' && error ? error : null}
                  onRetry={retry}
                  displayName={displayName}
                />
              </View>
            </AnimatedSection>
          </>
        );

      default:
        return null;
    }
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'progress', label: 'Progress' },
    { id: 'achievements', label: 'Achievements' },
    { id: 'insights', label: 'Insights' },
  ];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <BackgroundSlideshow
        mode={modeConfig.mode}
        screen={activeTab}
        images={tabBackgroundImages}
        rotate={false}
        overlayVariant="dark"
        overlayOpacity={0.58}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
            <Text style={styles.title}>SpikeSense</Text>
            <Text style={styles.subtitle}>Welcome back, {callName(displayName)}</Text>
            <Text style={styles.tagline}>Your digital wellness coach</Text>
          </View>

          {/* Tab Navigation — frosted glass blending with wallpaper */}
          <View style={styles.tabContainerOuter}>
            <BlurView intensity={64} tint="default" style={styles.tabBlur}>
              <View style={styles.tabBlurOverlay} pointerEvents="none" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tabScrollContent}
              >
                {tabs.map(tab => (
                  <AnimatedPressable
                    key={tab.id}
                    style={{ ...styles.tab, ...(activeTab === tab.id ? styles.tabActive : {}) }}
                    onPress={() => setActiveTab(tab.id)}
                  >
                  <View style={styles.tabInner}>
                    <Text
                      style={{ ...styles.tabLabel, ...(activeTab === tab.id ? styles.tabLabelActive : {}) }}
                    >
                      {tab.label}
                    </Text>
                  </View>
                  </AnimatedPressable>
                ))}
              </ScrollView>
            </BlurView>
          </View>

          {/* Tab Content */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.contentContainer,
              { paddingBottom: 16 + insets.bottom + TAB_BAR_SCROLL_PADDING },
            ]}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
          >
            {renderTabContent()}
          </ScrollView>
        </View>
      </BackgroundSlideshow>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 16,
  },
  tabContainerOuter: {
    marginHorizontal: 12,
    marginVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  tabBlur: {
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 4,
    overflow: 'hidden',
  },
  tabBlurOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
  },
  tabScrollContent: {
    paddingHorizontal: 4,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginHorizontal: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    minWidth: 100,
  },
  tabInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.primary,
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
    padding: 24,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 12,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  errorHint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 16,
    maxWidth: 320,
  },
  retryButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  spikeCelebrateWrap: {
    alignItems: 'center',
    marginBottom: 10,
  },
  emptySectionText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
  },
  syncBanner: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
  },
  syncBannerText: {
    fontSize: 13,
    color: colors.card,
    textAlign: 'center',
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.textSecondary + '35',
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  tagline: {
    fontSize: 13,
    marginTop: 4,
    color: 'rgba(255, 255, 255, 0.75)',
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
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
    marginBottom: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  sectionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255, 255, 255, 0.72)',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  badgeCountHint: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.65)',
    marginBottom: 10,
  },
  focusScoreCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    flexShrink: 0,
    marginTop: 2,
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
  focusScoreInfoFlex: {
    minWidth: 0,
    flexShrink: 1,
  },
  focusScoreText: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.text,
    lineHeight: 22,
    marginBottom: 8,
  },
  focusScoreSubDetail: {
    fontSize: 12,
    color: colors.textSecondary,
    opacity: 0.9,
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
  statsGridColumn: {
    gap: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },
  statCell: {
    flex: 1,
    minWidth: 0,
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
    color: 'rgba(255, 255, 255, 0.9)',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  legendValue: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.95)',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  badgesContainer: {
    gap: 12,
    paddingRight: 16,
  },
});
