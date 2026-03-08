import { useState, useEffect, useCallback } from 'react';
import { AppState } from 'react-native';
import {
  DailyStats,
  Nudge,
  NudgeConfig,
  ModeConfig,
  Badge,
  Streak,
  Challenge,
  FocusSession,
  SpikeSenseMode,
} from '@/types/appUsage';
import { apiService } from '@/services/api';
import { appUsageTracker } from '@/services/appUsageTracker';

export type WeeklyChartData = Array<{ date: string; screenTime: number; appSwitches: number }>;

export function useAppUsageTracking() {
  const [dailyStats, setDailyStats] = useState<DailyStats | null>(null);
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [streaks, setStreaks] = useState<Streak[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyChartData>([]);
  const [focusSession, setFocusSession] = useState<FocusSession | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const [nudgeConfig, setNudgeConfig] = useState<NudgeConfig>({
    enabled: true,
    switchThreshold: 15,
    entertainmentThreshold: 60,
    breakInterval: 45,
  });

  const [modeConfig, setModeConfig] = useState<ModeConfig>({
    mode: 'balanced',
    supportive: {
      enabled: true,
      showInsights: true,
      showEducationalTips: true,
    },
    motivational: {
      enabled: true,
      showBadges: true,
      showStreaks: true,
      showChallenges: true,
      showFocusScore: true,
    },
    restrictive: {
      enabled: false,
      enableFocusMode: true,
      pauseNotifications: false,
      showCooldowns: false,
      autoEnableFocusMode: false,
    },
  });

  const loadWeeklyStats = useCallback(async (uid: number) => {
    try {
      const weekData: WeeklyChartData = [];
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const result = await apiService.getDailyStats(uid, dateStr);
        if (result.success && result.data?.stats) {
          const s = result.data.stats;
          weekData.push({
            date: dateStr,
            screenTime: s.total_screen_time ?? 0,
            appSwitches: s.app_switches ?? 0,
          });
        } else {
          weekData.push({ date: dateStr, screenTime: 0, appSwitches: 0 });
        }
      }
      setWeeklyData(weekData);
    } catch (err) {
      if (__DEV__) console.warn('[useAppUsageTracking] loadWeeklyStats failed:', err);
      setWeeklyData([]);
    }
  }, []);

  const initialize = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const trackerInitialized = await appUsageTracker.initialize();
      const trackerUserId = trackerInitialized ? appUsageTracker.getUserId() : null;

      if (trackerUserId) {
        setUserId(trackerUserId);
        await appUsageTracker.startTracking();

        const thresholdsResult = await apiService.getUserThresholds(trackerUserId);
        if (thresholdsResult.success && thresholdsResult.data?.thresholds) {
          const thresholds = thresholdsResult.data.thresholds;
          setNudgeConfig(prev => ({
            ...prev,
            switchThreshold: thresholds.switch_threshold ?? prev.switchThreshold,
            entertainmentThreshold: thresholds.entertainment_threshold ?? prev.entertainmentThreshold,
            breakInterval: thresholds.break_interval ?? prev.breakInterval,
          }));
        }

        await loadDailyStats(trackerUserId);
        await loadNudges(trackerUserId);
        await loadWeeklyStats(trackerUserId);
      } else {
        setError('Unable to connect to backend.');
      }
    } catch (err) {
      if (__DEV__) console.warn('[useAppUsageTracking] initialize failed:', err);
      setError('Unable to load data.');
    } finally {
      setLoading(false);
      setIsInitialized(true);
    }
  }, [loadDailyStats, loadNudges, loadWeeklyStats]);

  useEffect(() => {
    initialize();
    return () => {
      appUsageTracker.stopTracking();
    };
  }, [initialize]);

  const loadDailyStats = useCallback(async (uid: number) => {
    try {
      await appUsageTracker.flushUsageToBackend();
      const result = await apiService.getDailyStats(uid);
      if (result.success && result.data?.stats) {
        const stats = result.data.stats;

        const toNumber = (value: unknown): number => {
          const n = Number(value);
          return Number.isFinite(n) ? n : 0;
        };

        setDailyStats({
          date: stats.date,
          totalScreenTime: toNumber(stats.total_screen_time),
          appSwitches: toNumber(stats.app_switches),
          productivityTime: toNumber(stats.productivity_time),
          socialTime: toNumber(stats.social_time),
          entertainmentTime: toNumber(stats.entertainment_time),
          otherTime: toNumber(stats.other_time),
          apps: [],
          focusTime: stats.focus_time ?? 0,
          focusScore: stats.focus_score ?? 0,
        });
        setError(null);
      } else {
        setError('Unable to load data.');
      }
    } catch (err) {
      if (__DEV__) console.warn('[useAppUsageTracking] loadDailyStats failed:', err);
      setError('Unable to load data.');
    }
  }, []);

  const loadNudges = useCallback(async (uid: number) => {
    try {
      const result = await apiService.getPendingNudges(uid);
      if (result.success && result.data?.nudges) {
        const backendNudges = result.data.nudges.map((n: { id: number; type: string; message: string; created_at: string; action_label?: string; action_type?: string }) => ({
          id: n.id.toString(),
          type: n.type,
          message: n.message,
          timestamp: new Date(n.created_at),
          dismissed: false,
          actionLabel: n.action_label,
          actionType: n.action_type,
        }));
        setNudges(backendNudges);
      }
    } catch (err) {
      if (__DEV__) console.warn('[useAppUsageTracking] loadNudges failed:', err);
    }
  }, []);

  // Monitor app state changes to detect app switches
  useEffect(() => {
    if (!userId) return;

    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active') {
        // Track app switch
        try {
          await appUsageTracker.trackAppSwitch('Unknown App'); // Would need actual app name
          await loadNudges(userId);
        } catch (error) {
          console.error('Failed to track app switch:', error);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [userId]);

  // Periodic refresh of stats and nudges
  useEffect(() => {
    if (!userId) return;

    const interval = setInterval(() => {
      loadDailyStats(userId);
      loadNudges(userId);
    }, 60000); // Refresh every minute

    return () => clearInterval(interval);
  }, [userId]);

  const checkForOverstimulation = useCallback(() => {
    if (!dailyStats || !nudgeConfig.enabled) return;

    // Supportive: Context-based insights
    if (modeConfig.supportive.enabled && modeConfig.supportive.showInsights) {
      if (dailyStats.appSwitches >= nudgeConfig.switchThreshold) {
        const existingInsight = nudges.find(
          n => n.type === 'insight' && !n.dismissed
        );
        
        if (!existingInsight) {
          const newNudge: Nudge = {
            id: Date.now().toString(),
            type: 'insight',
            message: `You switched apps ${dailyStats.appSwitches} times today — that's a sign of cognitive overload. Consider focusing on one task at a time.`,
            timestamp: new Date(),
            dismissed: false,
            actionLabel: 'View Stats',
            actionType: 'view_stats',
          };
          setNudges(prev => [...prev, newNudge]);
          console.log('Created supportive insight nudge');
        }
      }
    }

    // Motivational: Challenges and encouragement
    if (modeConfig.motivational.enabled && modeConfig.motivational.showChallenges) {
      if (dailyStats.focusTime >= 120) {
        const existingChallenge = nudges.find(
          n => n.type === 'challenge' && !n.dismissed
        );
        
        if (!existingChallenge) {
          const newNudge: Nudge = {
            id: Date.now().toString() + '_challenge',
            type: 'challenge',
            message: `Nice work! 2 focused hours today with only ${dailyStats.appSwitches} app switches 👏`,
            timestamp: new Date(),
            dismissed: false,
          };
          setNudges(prev => [...prev, newNudge]);
          console.log('Created motivational challenge nudge');
        }
      }
    }

    // Restrictive: Adaptive restrictions
    if (modeConfig.restrictive.enabled) {
      if (dailyStats.appSwitches >= nudgeConfig.switchThreshold * 1.5) {
        const existingRestriction = nudges.find(
          n => n.type === 'restriction' && !n.dismissed
        );
        
        if (!existingRestriction) {
          const newNudge: Nudge = {
            id: Date.now().toString() + '_restriction',
            type: 'restriction',
            message: 'You\'ve been switching rapidly. Would you like to enable Focus Mode for 30 minutes to regain focus?',
            timestamp: new Date(),
            dismissed: false,
            actionLabel: 'Enable Focus Mode',
            actionType: 'focus_mode',
          };
          setNudges(prev => [...prev, newNudge]);
          console.log('Created restrictive nudge');
        }
      }
    }

    // Standard nudges
    if (dailyStats.appSwitches >= nudgeConfig.switchThreshold) {
      const existingSwitchNudge = nudges.find(
        n => n.type === 'app_switching' && !n.dismissed
      );
      
      if (!existingSwitchNudge) {
        const newNudge: Nudge = {
          id: Date.now().toString() + '_switch',
          type: 'app_switching',
          message: 'You\'ve been switching apps frequently. Take a moment to focus on one task.',
          timestamp: new Date(),
          dismissed: false,
        };
        setNudges(prev => [...prev, newNudge]);
        console.log('Created app switching nudge');
      }
    }

    if (dailyStats.entertainmentTime >= nudgeConfig.entertainmentThreshold) {
      const existingEntertainmentNudge = nudges.find(
        n => n.type === 'entertainment_overload' && !n.dismissed
      );
      
      if (!existingEntertainmentNudge) {
        const newNudge: Nudge = {
          id: Date.now().toString() + '_ent',
          type: 'entertainment_overload',
          message: 'You\'ve spent quite a bit of time on entertainment. Consider taking a break or switching to something productive.',
          timestamp: new Date(),
          dismissed: false,
          actionLabel: 'Take a Break',
          actionType: 'take_break',
        };
        setNudges(prev => [...prev, newNudge]);
        console.log('Created entertainment overload nudge');
      }
    }
  }, [dailyStats, nudgeConfig, nudges, modeConfig]);

  const dismissNudge = useCallback(async (nudgeId: string) => {
    // Update local state
    setNudges(prev => 
      prev.map(n => n.id === nudgeId ? { ...n, dismissed: true } : n)
    );
    
    // Sync with backend if available
    if (userId) {
      try {
        await apiService.dismissNudge(userId, parseInt(nudgeId));
      } catch (error) {
        console.error('Failed to dismiss nudge on backend:', error);
      }
    }
    
    console.log('Dismissed nudge:', nudgeId);
  }, [userId]);

  const updateNudgeConfig = useCallback((config: Partial<NudgeConfig>) => {
    setNudgeConfig(prev => ({ ...prev, ...config }));
    console.log('Updated nudge config:', config);
  }, []);

  const updateModeConfig = useCallback((config: Partial<ModeConfig>) => {
    setModeConfig(prev => ({ ...prev, ...config }));
    console.log('Updated mode config:', config);
  }, []);

  const setMode = useCallback(async (mode: SpikeSenseMode) => {
    let newConfig: ModeConfig;
    
    switch (mode) {
      case 'supportive':
        newConfig = {
          mode: 'supportive',
          supportive: {
            enabled: true,
            showInsights: true,
            showEducationalTips: true,
          },
          motivational: {
            enabled: false,
            showBadges: false,
            showStreaks: false,
            showChallenges: false,
            showFocusScore: false,
          },
          restrictive: {
            enabled: false,
            enableFocusMode: false,
            pauseNotifications: false,
            showCooldowns: false,
            autoEnableFocusMode: false,
          },
        };
        break;
      
      case 'motivational':
        newConfig = {
          mode: 'motivational',
          supportive: {
            enabled: true,
            showInsights: true,
            showEducationalTips: false,
          },
          motivational: {
            enabled: true,
            showBadges: true,
            showStreaks: true,
            showChallenges: true,
            showFocusScore: true,
          },
          restrictive: {
            enabled: false,
            enableFocusMode: true,
            pauseNotifications: false,
            showCooldowns: false,
            autoEnableFocusMode: false,
          },
        };
        break;
      
      case 'restrictive':
        newConfig = {
          mode: 'restrictive',
          supportive: {
            enabled: true,
            showInsights: true,
            showEducationalTips: true,
          },
          motivational: {
            enabled: true,
            showBadges: true,
            showStreaks: true,
            showChallenges: true,
            showFocusScore: true,
          },
          restrictive: {
            enabled: true,
            enableFocusMode: true,
            pauseNotifications: true,
            showCooldowns: true,
            autoEnableFocusMode: false,
          },
        };
        break;
      
      case 'balanced':
      default:
        newConfig = {
          mode: 'balanced',
          supportive: {
            enabled: true,
            showInsights: true,
            showEducationalTips: true,
          },
          motivational: {
            enabled: true,
            showBadges: true,
            showStreaks: true,
            showChallenges: true,
            showFocusScore: true,
          },
          restrictive: {
            enabled: false,
            enableFocusMode: true,
            pauseNotifications: false,
            showCooldowns: false,
            autoEnableFocusMode: false,
          },
        };
    }
    
    setModeConfig(newConfig);
    
    // Sync with backend
    if (userId) {
      try {
        await apiService.updateUserMode(userId, mode);
      } catch (error) {
        console.error('Failed to update mode on backend:', error);
      }
    }
    
    console.log('Set mode to:', mode);
  }, [userId]);

  const startFocusSession = useCallback((targetDuration: number) => {
    const session: FocusSession = {
      id: Date.now().toString(),
      startTime: new Date(),
      endTime: null,
      duration: 0,
      appSwitches: 0,
      completed: false,
      targetDuration,
    };
    setFocusSession(session);
    console.log('Started focus session:', targetDuration, 'minutes');
  }, []);

  const endFocusSession = useCallback(() => {
    if (focusSession) {
      const endTime = new Date();
      const duration = Math.floor((endTime.getTime() - focusSession.startTime.getTime()) / 60000);
      const completed = duration >= focusSession.targetDuration;
      
      setFocusSession({
        ...focusSession,
        endTime,
        duration,
        completed,
      });
      
      console.log('Ended focus session:', duration, 'minutes, completed:', completed);
      
      // Show completion message
      if (completed) {
        const newNudge: Nudge = {
          id: Date.now().toString() + '_focus_complete',
          type: 'challenge',
          message: `Great job! You completed a ${focusSession.targetDuration}-minute focus session 🎉`,
          timestamp: new Date(),
          dismissed: false,
        };
        setNudges(prev => [...prev, newNudge]);
      }
      
      // Clear session after a delay
      setTimeout(() => setFocusSession(null), 3000);
    }
  }, [focusSession]);

  return {
    dailyStats,
    nudges: nudges.filter(n => !n.dismissed),
    nudgeConfig,
    modeConfig,
    badges,
    streaks,
    challenges,
    weeklyData,
    focusSession,
    loading,
    error,
    isInitialized,
    retry: initialize,
    dismissNudge,
    updateNudgeConfig,
    updateModeConfig,
    setMode,
    startFocusSession,
    endFocusSession,
  };
}
