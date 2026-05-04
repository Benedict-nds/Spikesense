import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import {
  DailyStats,
  Nudge,
  NudgeConfig,
  ModeConfig,
  Badge,
  type BadgeCategory,
  type BadgeRarity,
  Streak,
  Challenge,
  FocusSession,
  type AppCategory,
  type AppUsageData,
} from '@/types/appUsage';
import { apiService } from '@/services/api';
import { appUsageTracker } from '@/services/appUsageTracker';
import { bootstrapUser } from '@/services/userBootstrap';
import { getOnboardingCompleted, getStoredUserId } from '@/services/userProfile';
import {
  subscribeFocusEnforcement,
  type FocusEnforcementPayload,
} from '@/services/focusEnforcementBridge';
import { subscribeFocusSessionEnded } from '@/services/focusSessionBridge';
import { setFocusSessionRuntimeActive } from '@/services/focusSessionRuntime';
import {
  normalizeMode,
  uiModeFromBackendAdaptive,
  type AdaptiveModePayload,
  type Mode,
} from '@/constants/modes';
import { resolveBadgeIconName } from '@/constants/badgeIcons';
import { useInterventionState } from '@/hooks/useInterventionState';
import { violationsCountToOrbState, type SpikeOrbState } from '@/utils/focusEnforcementEscalation';

export type WeeklyChartData = Array<{ date: string; screenTime: number; appSwitches: number }>;

const BADGE_CATEGORIES = new Set<BadgeCategory>([
  'focus',
  'switching',
  'social',
  'recovery',
  'consistency',
  'special',
]);
const BADGE_RARITIES = new Set<BadgeRarity>(['common', 'rare', 'epic']);

function parseBadgeCategory(raw: unknown): BadgeCategory | undefined {
  const s = String(raw ?? '').toLowerCase();
  return BADGE_CATEGORIES.has(s as BadgeCategory) ? (s as BadgeCategory) : undefined;
}

function parseBadgeRarity(raw: unknown): BadgeRarity | undefined {
  const s = String(raw ?? '').toLowerCase();
  return BADGE_RARITIES.has(s as BadgeRarity) ? (s as BadgeRarity) : undefined;
}

function inferCategoryFromKey(key: string | undefined): BadgeCategory {
  if (!key) return 'special';
  const k = key.toUpperCase();
  if (k.includes('FOCUS') || k === 'DEEP_FOCUS' || k === 'DEEP_FOCUS_SESSION') return 'focus';
  if (k.includes('SWITCH') || k.includes('TAMER')) return 'switching';
  if (k.includes('SOCIAL') || k.includes('LOOP') || k.includes('INSTAGRAM')) return 'social';
  if (k.includes('RESET') || k.includes('HINT') || k.includes('TOOK')) return 'recovery';
  if (
    k.includes('STREAK') ||
    k.includes('COMEBACK') ||
    k.includes('RHYTHM') ||
    k.includes('LOCKED') ||
    k.includes('CHALLENGE')
  )
    return 'consistency';
  if (k.includes('SPIKE')) return 'special';
  return 'special';
}

function inferRarityFromKey(key: string | undefined): BadgeRarity {
  if (!key) return 'common';
  const k = key.toUpperCase();
  if (
    k.includes('SPIKE_APPROVED') ||
    k.includes('RHYTHM') ||
    k.includes('CHALLENGE_TRIPLE') ||
    k.includes('LOCKED_IN') ||
    k.includes('FOCUS_STREAK_3') ||
    k.includes('STREAK_3')
  )
    return 'epic';
  if (
    k.includes('SWITCH') ||
    k.includes('LOOP') ||
    k.includes('INSTAGRAM') ||
    k.includes('RESET') ||
    k.includes('COMEBACK')
  )
    return 'rare';
  return 'common';
}

function mapAchievementBadgeRow(raw: Record<string, unknown>, idx: number, locked: boolean): Badge {
  const badgeKey =
    typeof raw.badge_key === 'string' && raw.badge_key.trim() !== ''
      ? raw.badge_key.trim()
      : String(raw.name ?? `badge-${idx}`).trim();
  const title = String(raw.title ?? raw.name ?? '').trim() || 'Badge';
  const subtitle = String(raw.subtitle ?? '').trim();
  const longDesc = String(raw.description ?? '').trim();
  const category = parseBadgeCategory(raw.category) ?? inferCategoryFromKey(badgeKey);
  const rarity = parseBadgeRarity(raw.rarity) ?? inferRarityFromKey(badgeKey);
  const rowId =
    raw.id != null && String(raw.id) !== '' && !locked
      ? String(raw.id)
      : locked
        ? `locked-${badgeKey}-${idx}`
        : `badge-fallback-${idx}-${badgeKey}`;
  const progressN = Number(raw.progress);
  const progress = Number.isFinite(progressN) ? Math.min(100, Math.max(0, progressN)) : locked ? 0 : 100;
  const requirement = String(raw.requirement ?? raw.subtitle ?? '').trim();

  return {
    id: rowId,
    name: title,
    subtitle: subtitle || undefined,
    badgeKey: badgeKey || undefined,
    description: longDesc || subtitle || title,
    icon: resolveBadgeIconName(badgeKey || undefined, title),
    earnedAt: locked || !raw.earned_at ? null : new Date(String(raw.earned_at)),
    progress,
    requirement,
    category,
    rarity,
    locked,
  };
}

function normalizeAppCategory(raw: unknown): AppCategory {
  const c = String(raw ?? 'other').toLowerCase();
  if (c === 'productivity' || c === 'social' || c === 'entertainment' || c === 'other') {
    return c;
  }
  return 'other';
}

function mapBackendChallenge(raw: Record<string, unknown>): Challenge | null {
  const idStr = raw.id != null && String(raw.id) !== '' ? String(raw.id) : '';
  const key = typeof raw.challenge_key === 'string' ? raw.challenge_key.trim() : '';
  if (!idStr && !key) return null;

  const title = String(raw.title ?? '').trim();
  const description = String(raw.description ?? '').trim();
  const hasBody = title !== '' || description !== '' || raw.progress !== undefined;
  if (!hasBody && !key) return null;

  const backendType = String(raw.type ?? '').toLowerCase();
  const directionRaw = String(raw.direction ?? '').toLowerCase();
  const direction: Challenge['direction'] =
    directionRaw === 'under' || directionRaw === 'over' || directionRaw === 'action'
      ? directionRaw
      : undefined;

  const statusAllowed: NonNullable<Challenge['status']>[] = [
    'on_track',
    'at_risk',
    'exceeded',
    'completed',
    'in_progress',
  ];
  const st = String(raw.status ?? '').toLowerCase();
  const status = statusAllowed.includes(st as NonNullable<Challenge['status']>)
    ? (st as Challenge['status'])
    : undefined;

  let type: Challenge['type'] = 'behavior';
  if (backendType === 'over_goal' || key === 'FOCUS_SESSION_STARTER') type = 'focus_time';
  else if (key === 'ENTERTAINMENT_BALANCE' || (backendType === 'stay_under' && key === 'ENTERTAINMENT_BALANCE'))
    type = 'entertainment_limit';
  else if (backendType === 'stay_under') type = 'app_switches';
  else if (backendType === 'action') type = 'action';
  else if (key === 'FOCUS_BLOCK') type = 'focus_time';
  else if (key === 'ENTERTAINMENT_BALANCE') type = 'entertainment_limit';
  else if (key === 'STABILITY_WINDOW' || key === 'LOW_IMPULSE') type = 'app_switches';

  const targetNum = Number(raw.target);
  const currentNum = Number(raw.current);
  let target = Number.isFinite(targetNum) && targetNum > 0 ? Math.round(targetNum) : 100;
  let current = Number.isFinite(currentNum) ? Math.max(0, Math.round(currentNum)) : 0;

  const rawP = raw.progress;
  let progress01: number | undefined;
  if (typeof rawP === 'number' && !Number.isNaN(rawP)) {
    progress01 = Math.min(1, Math.max(0, rawP <= 1 ? rawP : rawP / 100));
  }

  if ((!Number.isFinite(targetNum) || targetNum <= 0) && progress01 !== undefined) {
    target = 100;
    current = Math.round(progress01 * 100);
  }

  const startedAt = raw.started_at ? new Date(String(raw.started_at)) : new Date();
  let expiresAt: Date;
  if (raw.expires_at && String(raw.expires_at)) {
    const d = new Date(String(raw.expires_at));
    expiresAt = Number.isNaN(d.getTime()) ? new Date() : d;
  } else {
    expiresAt = new Date(startedAt);
    expiresAt.setHours(23, 59, 59, 999);
  }

  return {
    id: idStr || `today-${key || 'challenge'}`,
    title: title || "Today's Challenge",
    description:
      description || 'Work toward today’s goal—small steps add up.',
    target,
    current,
    type,
    challengeKey: key || undefined,
    expiresAt,
    completed: Boolean(raw.is_completed ?? raw.completed),
    direction,
    status,
    progress01,
  };
}

export function useAppUsageTracking() {
  const currentIntervention = useInterventionState();
  const [dailyStats, setDailyStats] = useState<DailyStats | null>(null);
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [lockedBadges, setLockedBadges] = useState<Badge[]>([]);
  const [streaks, setStreaks] = useState<Streak[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyChartData>([]);
  const [focusSession, setFocusSession] = useState<FocusSession | null>(null);
  const [enforcementTrigger, setEnforcementTrigger] = useState<FocusEnforcementPayload>(null);
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

  const [modeConfig, setModeConfig] = useState<ModeConfig>({ mode: 'balanced' });

  /** Single-flight gate so concurrent callers await one load instead of hammering /stats/daily. */
  const dailyStatsGateRef = useRef<Promise<void> | null>(null);

  const loadWeeklyStats = useCallback(async (uid: number) => {
    try {
      const weekData: WeeklyChartData = [];
      const today = new Date();
      const toNumber = (value: unknown): number => {
        const n = Number(value);
        return Number.isFinite(n) ? n : 0;
      };
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const result = await apiService.getDailyStats(uid, dateStr);
        if (result.success && result.data?.stats) {
          const s = result.data.stats;
          const totalMinutes = toNumber(s.total_screen_time) || Math.floor(toNumber(s.total_usage_seconds) / 60);
          weekData.push({
            date: dateStr,
            screenTime: totalMinutes,
            appSwitches: toNumber(s.app_switches),
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

  const loadUserModeFromBackend = useCallback(async (uid: number) => {
    try {
      const res = await apiService.getUserAdaptiveMode(uid);
      if (res.success && res.data && typeof (res.data as { mode?: string }).mode === 'string') {
        setModeConfig({ mode: uiModeFromBackendAdaptive(res.data) });
      }
    } catch {
      /* non-fatal */
    }
  }, []);

  const loadFocusStatus = useCallback(async (uid: number) => {
    try {
      const res = await apiService.getFocusSessionStatus(uid);
      if (!res.success || !res.data) return;
      const root = res.data;
      if (root.active && root.session?.id != null) {
        const s = root.session;
        const rawStart = s.start_time ? new Date(String(s.start_time)) : new Date();
        const startTime = Number.isNaN(rawStart.getTime()) ? new Date() : rawStart;
        setFocusSession({
          id: String(s.id),
          serverId: s.id,
          startTime,
          endTime: null,
          duration: 0,
          appSwitches: 0,
          completed: false,
          targetDuration: Number(s.duration_minutes) || 25,
          violationsCount: Number(s.violations_count) || 0,
        });
      } else {
        setFocusSession(null);
      }
    } catch {
      /* non-fatal */
    }
  }, []);

  const refreshUserMode = useCallback(async () => {
    if (!userId) return;
    await loadUserModeFromBackend(userId);
  }, [userId, loadUserModeFromBackend]);

  const loadDailyStats = useCallback(async (uid: number) => {
    // Serialize concurrent loads (focus + resume + interval + pull-to-refresh).
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const waitOn = dailyStatsGateRef.current;
      if (waitOn) {
        if (__DEV__) {
          console.log('[FRONTEND][REFRESH_SKIPPED_IN_FLIGHT]', { userId: uid });
        }
        await waitOn;
        continue;
      }
      let releaseGate!: () => void;
      const gate = new Promise<void>((resolve) => {
        releaseGate = resolve;
      });
      dailyStatsGateRef.current = gate;
      try {
        if (__DEV__) console.log('[FRONTEND][FETCH_STATS]', { userId: uid });
        await appUsageTracker.flushUsageToBackend();
        const result = await apiService.getDailyStats(uid);
        if (result.success && result.data?.stats) {
          const stats = result.data?.stats ?? {
          total_usage_seconds: 0,
          productivity_seconds: 0,
          social_seconds: 0,
          entertainment_seconds: 0,
          other_seconds: 0,
          app_switches: 0,
          total_screen_time: 0,
          productivity_time: 0,
          social_time: 0,
          entertainment_time: 0,
          other_time: 0,
          focus_time: 0,
          focus_score: 0,
          focus_score_reason: '',
          date: new Date().toISOString().split('T')[0],
          };

          const toNumber = (value: unknown): number => {
            const n = Number(value);
            return Number.isFinite(n) ? n : 0;
          };

          if (__DEV__) {
            console.log('[STATS]', stats);
          }

          const totalMinutes = toNumber(stats.total_screen_time) || Math.floor(toNumber(stats.total_usage_seconds) / 60);
          const productivityMinutes = toNumber(stats.productivity_time) || Math.floor(toNumber(stats.productivity_seconds) / 60);
          const socialMinutes = toNumber(stats.social_time) || Math.floor(toNumber(stats.social_seconds) / 60);
          const entertainmentMinutes = toNumber(stats.entertainment_time) || Math.floor(toNumber(stats.entertainment_seconds) / 60);
          const otherMinutes = toNumber(stats.other_time) || Math.floor(toNumber(stats.other_seconds) / 60);

          const topRaw = result.data.top_apps ?? [];
          if (__DEV__) {
            console.log('[FRONTEND][FETCH_TOP_APPS]', { userId: uid, count: topRaw.length });
          }

          const apps: AppUsageData[] = (topRaw as Record<string, unknown>[]).map((row) => {
            const pkgRaw = row.package_name ?? row.packageName;
            const pkg =
              typeof pkgRaw === 'string' && pkgRaw.trim() !== '' ? pkgRaw.trim() : undefined;
            return {
              appName: String(row.app_name ?? ''),
              category: normalizeAppCategory(row.category),
              usageTime: Math.max(0, Math.floor((Number(row.total_duration) || 0) / 60)),
              openCount: Number(row.usage_count) || 0,
              lastUsed: new Date(),
              packageName: pkg,
              package_name: pkg,
            };
          });

          const totalUsageSeconds = toNumber(stats.total_seconds ?? stats.total_usage_seconds);

          setDailyStats({
            date: String(stats.date ?? new Date().toISOString().split('T')[0]),
            totalScreenTime: totalMinutes,
            totalUsageSeconds,
            appSwitches: toNumber(stats.app_switches),
            productivityTime: productivityMinutes,
            socialTime: socialMinutes,
            entertainmentTime: entertainmentMinutes,
            otherTime: otherMinutes,
            entertainmentSeconds: toNumber(stats.entertainment_seconds),
            productivitySeconds: toNumber(stats.productivity_seconds),
            peakSwitchRate:
              stats.peak_switch_rate != null && stats.peak_switch_rate !== ''
                ? Number(stats.peak_switch_rate)
                : null,
            impulsiveSwitches:
              stats.impulsive_switches != null && stats.impulsive_switches !== ''
                ? Number(stats.impulsive_switches)
                : null,
            apps,
            focusTime: toNumber(stats.focus_time),
            focusScore: toNumber(stats.focus_score),
            focusScoreReason: String(stats.focus_score_reason ?? ''),
          });
          if (__DEV__) {
            console.log('[FRONTEND][STATS_APPLIED]', {
              userId: uid,
              totalUsageSeconds,
              appSwitches: toNumber(stats.app_switches),
            });
          }
          setError(null);
        } else {
          setError('Unable to load data.');
        }
        return;
      } catch (err) {
        if (__DEV__) console.warn('[useAppUsageTracking] loadDailyStats failed:', err);
        setError('Unable to load data.');
        return;
      } finally {
        dailyStatsGateRef.current = null;
        releaseGate();
      }
    }
  }, []);

  const loadNudges = useCallback(async (uid: number) => {
    try {
      const result = await apiService.getPendingNudges(uid);
      const rawList =
        result.success && Array.isArray(result.data?.nudges) ? result.data!.nudges! : [];
      if (result.success) {
        const backendNudges: Nudge[] = rawList.map((raw) => {
          const n = raw as Record<string, unknown>;
          const rawType = String(n.type ?? 'insight');
          const type = (rawType === 'support' ? 'insight' : rawType) as Nudge['type'];
          return {
            id: String(n.id ?? ''),
            type,
            message: String(n.message ?? ''),
            explanation: n.explanation != null && String(n.explanation).trim() !== '' ? String(n.explanation) : undefined,
            timestamp: new Date(String(n.created_at ?? '')),
            dismissed: false,
            actionLabel: n.action_label != null ? String(n.action_label) : undefined,
            actionType: n.action_type as Nudge['actionType'],
            pattern: typeof n.pattern === 'string' && n.pattern.trim() !== '' ? n.pattern.trim() : undefined,
            severity:
              n.severity === 'low' || n.severity === 'medium' || n.severity === 'high'
                ? n.severity
                : undefined,
          };
        });
        setNudges(backendNudges);
        if (__DEV__) {
          console.log('[FRONTEND][NUDGES_APPLIED]', {
            count: backendNudges.length,
            firstNudge: backendNudges[0] ?? null,
          });
        }
      }
    } catch (err) {
      if (__DEV__) console.warn('[useAppUsageTracking] loadNudges failed:', err);
    }
  }, []);

  /** Home resume / tab focus: stats + nudges without extra mode/focus/status churn. */
  const refreshStatsAndNudges = useCallback(async () => {
    if (!userId) return;
    await Promise.all([loadDailyStats(userId), loadNudges(userId)]);
  }, [userId, loadDailyStats, loadNudges]);

  const loadAchievements = useCallback(async (uid: number) => {
    if (__DEV__) console.log('[FRONTEND][FETCH_ACHIEVEMENTS][START]', { userId: uid });
    try {
      const result = await apiService.getAchievements(uid);
      if (!result.success || !result.data) {
        if (__DEV__) console.warn('[FRONTEND][FETCH_ACHIEVEMENTS][ERROR]', { userId: uid, reason: 'request_failed' });
        return;
      }

      const data = result.data as {
        badges?: unknown[];
        available_badges?: unknown[];
        today_challenge?: Record<string, unknown> | null;
        streaks?: Record<string, unknown> | null;
        challenges?: unknown[];
      };

      const earnedBadges: Badge[] = (data.badges ?? []).map((raw: unknown, idx: number) =>
        mapAchievementBadgeRow(raw as Record<string, unknown>, idx, false),
      );
      setBadges(earnedBadges);

      const lockedMapped: Badge[] = (data.available_badges ?? []).map((raw: unknown, idx: number) =>
        mapAchievementBadgeRow(raw as Record<string, unknown>, idx, true),
      );
      setLockedBadges(lockedMapped);

      if (__DEV__) {
        console.log('[FRONTEND][BADGES_MAPPED]', {
          earned: earnedBadges.length,
          locked: lockedMapped.length,
          keysEarned: earnedBadges.map((x) => x.badgeKey ?? x.id),
        });
      }

      const tc = data.today_challenge ?? null;
      const rawList: unknown[] =
        Array.isArray(data.challenges) && (data.challenges as unknown[]).length > 0
          ? (data.challenges as unknown[])
          : tc && typeof tc === 'object'
            ? [tc]
            : [];

      const mapped: Challenge[] = [];
      for (const item of rawList) {
        if (!item || typeof item !== 'object') continue;
        const row = item as Record<string, unknown>;
        const idStr = row.id != null && String(row.id) !== '' ? String(row.id) : '';
        const keyStr = typeof row.challenge_key === 'string' ? row.challenge_key.trim() : '';
        const hasBody =
          String(row.title ?? '').trim() !== '' ||
          String(row.description ?? '').trim() !== '' ||
          row.progress !== undefined;

        let normalized: Record<string, unknown> = row;
        if (idStr && keyStr) {
          normalized = row;
        } else if (idStr && hasBody) {
          normalized = { ...row, challenge_key: keyStr || 'STABILITY_WINDOW' };
        } else if (idStr) {
          normalized = {
            ...row,
            challenge_key: keyStr || 'STABILITY_WINDOW',
            title: row.title ?? "Today's Challenge",
            description: row.description ?? '',
            progress: row.progress ?? 0,
          };
        } else if (keyStr && hasBody) {
          normalized = { ...row, id: row.id ?? `today-${uid}`, challenge_key: keyStr };
        } else {
          continue;
        }

        const m = mapBackendChallenge(normalized);
        if (m) mapped.push(m);
      }

      const seen = new Set<string>();
      const deduped: Challenge[] = [];
      for (const ch of mapped) {
        const dedupeKey = ch.challengeKey || ch.id;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        deduped.push(ch);
      }

      setChallenges(deduped.slice(0, 5));

      if (__DEV__) {
        console.log('[FRONTEND][CHALLENGES_MAPPED]', {
          count: deduped.length,
          keys: deduped.map((x) => x.challengeKey ?? x.id),
        });
      }

      const st = data.streaks;
      if (st && typeof st === 'object') {
        setStreaks([
          {
            type: 'focus',
            currentStreak: Number(st.current_streak) || 0,
            longestStreak: Number(st.longest_streak) || 0,
            lastUpdated: st.last_active_date ? new Date(String(st.last_active_date)) : new Date(),
          },
        ]);
      } else {
        setStreaks([]);
      }

      if (__DEV__) {
        console.log('[FRONTEND][FETCH_ACHIEVEMENTS][SUCCESS]', {
          userId: uid,
          badges: earnedBadges.length,
          challengeCount: deduped.length,
        });
      }
    } catch (err) {
      if (__DEV__) console.warn('[FRONTEND][FETCH_ACHIEVEMENTS][ERROR]', err);
    }
  }, []);

  const initialize = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await appUsageTracker.initialize();

      let trackerUserId = (await getStoredUserId()) ?? appUsageTracker.getUserId();

      if (trackerUserId == null) {
        const completed = await getOnboardingCompleted();
        if (completed) {
          try {
            trackerUserId = await bootstrapUser({});
          } catch {
            /* leave null */
          }
        }
      }

      if (trackerUserId == null) {
        console.log('[FRONTEND][USER_ID_MISSING_SKIP_FETCH]');
        setError('Unable to connect to backend.');
        setLoading(false);
        setIsInitialized(true);
        return;
      }

      console.log('[FRONTEND][USER_ID_READY]', { userId: trackerUserId });

      setUserId(trackerUserId);
      await appUsageTracker.startTracking();

      const thresholdsResult = await apiService.getUserThresholds(trackerUserId);
      if (thresholdsResult.success && thresholdsResult.data?.thresholds) {
        const thresholds = thresholdsResult.data.thresholds;
        setNudgeConfig(prev => ({
          ...prev,
          switchThreshold: Number(thresholds.switch_threshold ?? prev.switchThreshold),
          entertainmentThreshold: Number(thresholds.entertainment_threshold ?? prev.entertainmentThreshold),
          breakInterval: Number(thresholds.break_interval ?? prev.breakInterval),
        }));
      }

      if (__DEV__) console.log('[FRONTEND][REFRESH]', { userId: trackerUserId, phase: 'initialize' });
      await loadDailyStats(trackerUserId);
      await loadUserModeFromBackend(trackerUserId);
      await loadAchievements(trackerUserId);
      await loadNudges(trackerUserId);
      await loadWeeklyStats(trackerUserId);
      await loadFocusStatus(trackerUserId);
    } catch (err) {
      if (__DEV__) console.warn('[useAppUsageTracking] initialize failed:', err);
      setError('Unable to load data.');
    } finally {
      setLoading(false);
      setIsInitialized(true);
    }
  }, [
    loadDailyStats,
    loadUserModeFromBackend,
    loadNudges,
    loadAchievements,
    loadWeeklyStats,
    loadFocusStatus,
  ]);

  useEffect(() => {
    initialize();
    return () => {
      appUsageTracker.stopTracking();
    };
  }, [initialize]);

  useEffect(() => subscribeFocusEnforcement(setEnforcementTrigger), []);

  useEffect(() => subscribeFocusSessionEnded(() => setFocusSession(null)), []);

  useEffect(() => {
    setFocusSessionRuntimeActive(!!focusSession);
  }, [focusSession]);

  const enforcementOrbState: SpikeOrbState = useMemo(() => {
    if (!enforcementTrigger) {
      return 'calm';
    }
    const m = violationsCountToOrbState(enforcementTrigger.violationsCount);
    return m === 'calm' ? 'warning' : m;
  }, [enforcementTrigger]);

  useEffect(() => {
    if (!__DEV__ || !enforcementTrigger) return;
    console.log('[FRONTEND][FOCUS_ENFORCEMENT_ESCALATION]', {
      source: 'useAppUsageTracking',
      orbState: enforcementOrbState,
      violations: enforcementTrigger.violationsCount,
    });
  }, [enforcementTrigger, enforcementOrbState]);

  const refreshDailyStats = useCallback(async () => {
    if (!userId) return;
    await loadDailyStats(userId);
  }, [userId, loadDailyStats]);

  const refreshAchievements = useCallback(async () => {
    if (!userId) return;
    await loadAchievements(userId);
  }, [userId, loadAchievements]);

  const refreshProgressData = useCallback(async () => {
    if (!userId) return;
    await loadWeeklyStats(userId);
  }, [userId, loadWeeklyStats]);

  // Monitor app state changes to detect app switches
  useEffect(() => {
    if (!userId) return;

    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active') {
        try {
          await appUsageTracker.trackAppSwitch();
          if (__DEV__) console.log('[FRONTEND][REFRESH]', { userId, phase: 'app_active' });
          await loadDailyStats(userId);
          await loadNudges(userId);
        } catch (error) {
          console.error('Failed to track app switch:', error);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [userId, loadDailyStats, loadNudges]);

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

    const mode = modeConfig.mode;

    // Relax: minimal nudges
    if (mode === 'relax') return;

    // Focus / Balanced / Adaptive: context-based insights (adaptive uses inferred thresholds on backend)
    if (mode === 'focus' || mode === 'balanced' || mode === 'auto') {
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
          if (__DEV__) console.log('Created supportive insight nudge');
        }
      }
    }

    // Balanced: Challenges and encouragement
    if (mode === 'balanced') {
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
          if (__DEV__) console.log('Created motivational challenge nudge');
        }
      }
    }

    // Focus: Adaptive restrictions
    if (mode === 'focus') {
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
          if (__DEV__) console.log('Created restrictive nudge');
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
        if (__DEV__) console.log('Created app switching nudge');
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
        if (__DEV__) console.log('Created entertainment overload nudge');
      }
    }
  }, [dailyStats, nudgeConfig, nudges, modeConfig.mode]);

  const dismissNudge = useCallback(async (nudgeId: string) => {
    // Update local state
    setNudges(prev => 
      prev.map(n => n.id === nudgeId ? { ...n, dismissed: true } : n)
    );
    
    // Sync with backend if available
    if (userId) {
      try {
        const nid = parseInt(nudgeId, 10);
        if (Number.isFinite(nid)) {
          await apiService.dismissNudge(userId, nid);
        }
      } catch (error) {
        if (__DEV__) console.error('Failed to dismiss nudge on backend:', error);
      }
    }
    
    if (__DEV__) console.log('Dismissed nudge:', nudgeId);
  }, [userId]);

  const updateNudgeConfig = useCallback((config: Partial<NudgeConfig>) => {
    setNudgeConfig(prev => ({ ...prev, ...config }));
    if (__DEV__) console.log('Updated nudge config:', config);
  }, []);

  const updateModeConfig = useCallback((config: Partial<ModeConfig>) => {
    setModeConfig(prev => ({ ...prev, ...config }));
    if (__DEV__) console.log('Updated mode config:', config);
  }, []);

  const setMode = useCallback(async (mode: Mode) => {
    const normalized = normalizeMode(mode);
    setModeConfig({ mode: normalized });

    if (userId) {
      try {
        const res = await apiService.postUserMode(userId, normalized);
        const adm = res.success && res.data ? (res.data as { adaptive_mode?: { mode?: string } }).adaptive_mode : undefined;
        if (adm?.mode) {
          setModeConfig({ mode: uiModeFromBackendAdaptive(adm) });
        } else {
          await loadUserModeFromBackend(userId);
        }
      } catch (error) {
        console.error('Failed to update mode on backend:', error);
        try {
          await apiService.updateUserMode(userId, normalized);
          await loadUserModeFromBackend(userId);
        } catch (e2) {
          console.error('PATCH mode fallback failed:', e2);
        }
      }
    }

    if (__DEV__) console.log('Set mode to:', normalized);
  }, [userId, loadUserModeFromBackend]);

  const startFocusSession = useCallback(
    async (targetDuration: number) => {
      const uid = userId ?? appUsageTracker.getUserId();
      if (uid) {
        const res = await apiService.startFocusSession(uid, targetDuration);
        if (res.success && res.data?.session?.id != null) {
          const s = res.data.session;
          const rawStart = s.start_time ? new Date(String(s.start_time)) : new Date();
          const startTime = Number.isNaN(rawStart.getTime()) ? new Date() : rawStart;
          setFocusSession({
            id: String(s.id),
            serverId: s.id,
            startTime,
            endTime: null,
            duration: 0,
            appSwitches: 0,
            completed: false,
            targetDuration: Number(s.duration_minutes) || targetDuration,
            violationsCount: Number(s.violations_count) || 0,
          });
          if (__DEV__) console.log('Started focus session (server):', s.id, targetDuration);
          return;
        }
      }
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
      if (__DEV__) console.log('Started focus session (local only):', targetDuration);
    },
    [userId]
  ); // userId triggers refresh when set; getUserId() covers first paint race

  const endFocusSession = useCallback(async () => {
    if (!focusSession) return;
    if (userId) {
      try {
        await apiService.stopFocusSession(userId);
      } catch {
        /* non-fatal */
      }
    }
    const endTime = new Date();
    const duration = Math.floor((endTime.getTime() - focusSession.startTime.getTime()) / 60000);
    const completed = duration >= focusSession.targetDuration;

    setFocusSession({
      ...focusSession,
      endTime,
      duration,
      completed,
    });

    if (__DEV__) console.log('Ended focus session:', duration, 'minutes, completed:', completed);

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

    setTimeout(() => setFocusSession(null), 3000);
  }, [focusSession, userId]);

  return {
    dailyStats,
    nudges: nudges.filter(n => !n.dismissed),
    nudgeConfig,
    modeConfig,
    badges,
    lockedBadges,
    streaks,
    challenges,
    weeklyData,
    focusSession,
    enforcementTrigger,
    enforcementOrbState,
    currentIntervention,
    loading,
    error,
    isInitialized,
    retry: initialize,
    refreshDailyStats,
    refreshStatsAndNudges,
    refreshUserMode,
    refreshAchievements,
    refreshProgressData,
    dismissNudge,
    updateNudgeConfig,
    updateModeConfig,
    setMode,
    startFocusSession,
    endFocusSession,
  };
}
