import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, Platform, ImageBackground, ActivityIndicator, Pressable } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing, runOnJS, cancelAnimation } from 'react-native-reanimated';
import { colors } from '@/styles/commonStyles';
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
import AnimatedSection from '@/components/AnimatedSection';
import AnimatedPressable from '@/components/AnimatedPressable';

const BACKGROUND_IMAGES = [
  require('@/assets/images/spikewall.jpeg'),
  require('@/assets/images/spikewall2.jpeg'),
  require('@/assets/images/spikewall4.jpeg'),
];
const CROSSFADE_DURATION_MS = 1200;
const BACKGROUND_VISIBLE_MS = 5000;

type TabType = 'overview' | 'progress' | 'achievements' | 'insights';

const N = BACKGROUND_IMAGES.length;

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  // Two layers: we alternate which one fades in. Only the *hidden* layer gets its image updated (no switchback).
  const [layer0ImageIndex, setLayer0ImageIndex] = useState(0);
  const [layer1ImageIndex, setLayer1ImageIndex] = useState(1 % N);
  const opacity0 = useSharedValue(1);
  const opacity1 = useSharedValue(0);
  const insets = useSafeAreaInsets();

  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextLayerToFadeRef = React.useRef<0 | 1>(1); // start by fading in layer 1
  // Refs keep indices in sync so the timeout (runFade) always reads current values, not stale closure state
  const layer0ImageIndexRef = React.useRef(0);
  const layer1ImageIndexRef = React.useRef(1 % N);

  const onFadeComplete = (fadedLayer: 0 | 1, visibleImageIndex: number) => {
    const hiddenLayer = (1 - fadedLayer) as 0 | 1;
    const nextIndex = (visibleImageIndex + 1) % N;
    if (hiddenLayer === 0) {
      opacity0.value = 0;
      setLayer0ImageIndex(nextIndex);
      layer0ImageIndexRef.current = nextIndex;
    } else {
      opacity1.value = 0;
      setLayer1ImageIndex(nextIndex);
      layer1ImageIndexRef.current = nextIndex;
    }
    nextLayerToFadeRef.current = hiddenLayer;
    scheduleNextFade();
  };

  const runFade = () => {
    const layer = nextLayerToFadeRef.current;
    // Use refs so we get current indices when timeout fires (avoids stale closure)
    const visibleIndex = layer === 0 ? layer0ImageIndexRef.current : layer1ImageIndexRef.current;
    const opacity = layer === 0 ? opacity0 : opacity1;
    // Cancel any in-flight animation and force start from 0 so every transition is a visible crossfade
    cancelAnimation(opacity);
    opacity.value = 0;
    opacity.value = withTiming(
      1,
      { duration: CROSSFADE_DURATION_MS, easing: Easing.inOut(Easing.ease) },
      (finished) => {
        if (finished) runOnJS(onFadeComplete)(layer, visibleIndex);
      }
    );
  };

  const scheduleNextFade = () => {
    timeoutRef.current = setTimeout(runFade, BACKGROUND_VISIBLE_MS);
  };

  useEffect(() => {
    scheduleNextFade();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const layer0Style = useAnimatedStyle(() => ({ opacity: opacity0.value }));
  const layer1Style = useAnimatedStyle(() => ({ opacity: opacity1.value }));
  const {
    dailyStats,
    nudges,
    dismissNudge,
    modeConfig,
    badges,
    streaks,
    challenges,
    weeklyData,
    focusSession,
    loading,
    error,
    retry,
    startFocusSession,
    endFocusSession,
  } = useAppUsageTracking();

  const formatTime = (minutes: number) => {
    const totalMins = Math.floor(Number(minutes));
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
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
    );
  }

  if (!dailyStats) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>No data yet.</Text>
        <Text style={styles.errorSubtext}>Use the app to start tracking.</Text>
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
              <AnimatedSection index={0}>
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
              </AnimatedSection>
            )}

            {/* Nudges */}
            {nudges.length > 0 && (
              <AnimatedSection index={1}>
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
              </AnimatedSection>
            )}

            {/* Daily Overview */}
            <AnimatedSection index={2}>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Today&apos;s Overview</Text>
                <View style={styles.statsGrid}>
                  <StatCard
                    icon="clock.fill"
                    label="Screen Time"
                    value={formatTime(dailyStats.totalScreenTime)}
                    color={colors.primary}
                    index={0}
                  />
                  <StatCard
                    icon="arrow.triangle.swap"
                    label="App Switches"
                    value={dailyStats.appSwitches.toString()}
                    color={colors.accent}
                    index={1}
                  />
                </View>
              </View>
            </AnimatedSection>
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
                <AppUsageList apps={dailyStats.apps} />
              </View>
            </AnimatedSection>
          </>
        );

      case 'achievements':
        return (
          <>
            {modeConfig.motivational.enabled && modeConfig.motivational.showStreaks && (
              <AnimatedSection index={0}>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Your Streaks</Text>
                  {streaks.length > 0 ? (
                    streaks.map((streak, index) => (
                      <StreakCard key={index} streak={streak} index={index} />
                    ))
                  ) : (
                    <Text style={styles.emptySectionText}>No streaks yet.</Text>
                  )}
                </View>
              </AnimatedSection>
            )}

            {modeConfig.motivational.enabled && modeConfig.motivational.showChallenges && (
              <AnimatedSection index={1}>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Active Challenges</Text>
                  {challenges.length > 0 ? (
                    challenges.map((challenge, index) => (
                      <ChallengeCard key={challenge.id} challenge={challenge} index={index} />
                    ))
                  ) : (
                    <Text style={styles.emptySectionText}>No challenges yet.</Text>
                  )}
                </View>
              </AnimatedSection>
            )}

            {modeConfig.motivational.enabled && modeConfig.motivational.showBadges && (
              <AnimatedSection index={2}>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Badges & Achievements</Text>
                  {badges.length > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.badgesContainer}
                    >
                      {badges.map(badge => (
                        <BadgeCard key={badge.id} badge={badge} />
                      ))}
                    </ScrollView>
                  ) : (
                    <Text style={styles.emptySectionText}>No badges yet.</Text>
                  )}
                </View>
              </AnimatedSection>
            )}
          </>
        );

      case 'insights':
        return (
          <>
            {modeConfig.restrictive.enabled && modeConfig.restrictive.enableFocusMode && (
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

            {modeConfig.supportive.enabled && modeConfig.supportive.showInsights && (
              <AnimatedSection index={1}>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Insights</Text>
                  <View style={styles.insightCard}>
                    <View style={styles.insightHeader}>
                      <Text style={styles.insightIcon}>💡</Text>
                      <Text style={styles.insightTitle}>Understanding Your Habits</Text>
                    </View>
                    <Text style={styles.insightText}>
                      {dailyStats.appSwitches > 50 
                        ? `You switched apps ${dailyStats.appSwitches} times today. Frequent switching can indicate cognitive overload. Try focusing on one task for 25-minute intervals.`
                        : `Great job! You kept app switching to ${dailyStats.appSwitches} times today. This shows good focus and task management.`}
                    </Text>
                  </View>
                </View>
              </AnimatedSection>
            )}

            {modeConfig.supportive.enabled && modeConfig.supportive.showEducationalTips && (
              <AnimatedSection index={2}>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Wellness Tips</Text>
                  <View style={styles.tipCard}>
                    <View style={styles.tipHeader}>
                      <Text style={styles.tipIcon}>📚</Text>
                      <Text style={styles.tipTitle}>Wellness Tip</Text>
                    </View>
                    <Text style={styles.tipText}>
                      Small breaks every 45 minutes can improve focus and reduce stress. Try the 20-20-20 rule: every 20 minutes, look at something 20 feet away for 20 seconds.
                    </Text>
                  </View>
                </View>
              </AnimatedSection>
            )}
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
      <View style={styles.backgroundWrap}>
        {/* Two-layer slideshow: we only ever update the *hidden* layer to the next image, so the visible image never switches back */}
        <Animated.View style={[styles.backgroundLayer, layer0Style]}>
          <ImageBackground
            source={BACKGROUND_IMAGES[layer0ImageIndex]}
            style={styles.backgroundImage}
            resizeMode="cover"
          />
        </Animated.View>
        <Animated.View style={[styles.backgroundLayer, layer1Style]}>
          <ImageBackground
            source={BACKGROUND_IMAGES[layer1ImageIndex]}
            style={styles.backgroundImage}
            resizeMode="cover"
          />
        </Animated.View>
        {/* Dark Overlay for Readability */}
        <View style={styles.overlay} />

        <View style={styles.container}>
          {/* Header */}
          <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
            <Text style={styles.title}>SpikeSense</Text>
            <Text style={styles.subtitle}>Your Digital Wellness Coach</Text>
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
                    style={[
                      styles.tab,
                      activeTab === tab.id && styles.tabActive
                    ]}
                    onPress={() => setActiveTab(tab.id)}
                  >
                  <View style={styles.tabInner}>
                    <Text style={[
                      styles.tabLabel,
                      activeTab === tab.id && styles.tabLabelActive
                    ]}>
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
              Platform.OS !== 'ios' && styles.contentContainerWithTabBar,
            ]}
          >
            {renderTabContent()}
          </ScrollView>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  backgroundWrap: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
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
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  contentContainerWithTabBar: {
    paddingBottom: 100,
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
  emptySectionText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'rgba(255, 255, 255, 0.95)',
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
