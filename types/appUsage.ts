
import type { Mode } from '@/constants/modes';

export type AppCategory = 'productivity' | 'social' | 'entertainment' | 'other';

export interface AppUsageData {
  appName: string;
  category: AppCategory;
  usageTime: number; // in minutes
  openCount: number;
  lastUsed: Date;
  /** Present when backend aggregates by package (Android real icons). */
  packageName?: string;
  /** Same as package_name from API when mapped (snake_case alias). */
  package_name?: string;
}

export interface DailyStats {
  date: string;
  totalScreenTime: number; // in minutes
  /** Total usage seconds from API (for ratios / insights) */
  totalUsageSeconds?: number;
  appSwitches: number;
  productivityTime: number;
  socialTime: number;
  entertainmentTime: number;
  otherTime: number;
  /** Raw seconds from API when present */
  entertainmentSeconds?: number;
  productivitySeconds?: number;
  /** Switches per hour of screen time (daily aggregate); optional */
  peakSwitchRate?: number | null;
  /** Window-level metric; usually null from daily stats */
  impulsiveSwitches?: number | null;
  apps: AppUsageData[];
  focusTime: number; // productive screen time (minutes), aligned with backend focus_time
  focusScore: number; // daily focus score (0-100)
  /** Short explanation from backend (why the score looks like this) */
  focusScoreReason?: string;
}

export interface WeeklyStats {
  weekStart: string;
  weekEnd: string;
  dailyStats: DailyStats[];
  averageScreenTime: number;
  averageAppSwitches: number;
  totalProductivityTime: number;
  totalSocialTime: number;
  totalEntertainmentTime: number;
}

export interface NudgeConfig {
  enabled: boolean;
  switchThreshold: number; // number of switches before nudge
  entertainmentThreshold: number; // minutes of entertainment before nudge
  breakInterval: number; // minutes between break reminders
}

export interface Nudge {
  id: string;
  type: 'app_switching' | 'entertainment_overload' | 'break_reminder' | 'insight' | 'challenge' | 'restriction';
  message: string;
  /** Rule-based reason from backend ("Why this appeared") */
  explanation?: string;
  severity?: 'low' | 'medium' | 'high';
  /** When backend infers pattern (e.g. rapid_switching) for analytics / display */
  pattern?: string;
  timestamp: Date;
  dismissed: boolean;
  actionLabel?: string;
  actionType?: 'focus_mode' | 'take_break' | 'view_stats';
}

export interface ModeConfig {
  mode: Mode;
}

export type BadgeCategory = 'focus' | 'switching' | 'social' | 'recovery' | 'consistency' | 'special';

export type BadgeRarity = 'common' | 'rare' | 'epic';

export interface Badge {
  id: string;
  /** Display label from backend `title` when present. */
  name: string;
  /** Short line under title (collectible subtitle). */
  subtitle?: string;
  /** Stable canonical key e.g. LOCKED_IN, DEEP_FOCUS. */
  badgeKey?: string;
  /** Longer flavor copy when provided by API. */
  description: string;
  icon: string;
  earnedAt: Date | null;
  progress: number; // 0-100
  requirement: string;
  category?: BadgeCategory;
  rarity?: BadgeRarity;
  /** True for `available_badges` rows from the API. */
  locked?: boolean;
}

export interface Streak {
  type: 'focus' | 'low_switching' | 'balanced_usage';
  currentStreak: number;
  longestStreak: number;
  lastUpdated: Date;
}

export interface FocusSession {
  id: string;
  /** Server `focus_sessions.id` when session is synced with backend */
  serverId?: number;
  startTime: Date;
  endTime: Date | null;
  duration: number; // in minutes
  appSwitches: number;
  completed: boolean;
  targetDuration: number;
  violationsCount?: number;
}

export type ChallengeDirection = 'under' | 'over' | 'action';

export type ChallengeStatusLabel =
  | 'on_track'
  | 'at_risk'
  | 'exceeded'
  | 'completed'
  | 'in_progress';

export interface Challenge {
  id: string;
  title: string;
  description: string;
  target: number;
  current: number;
  type:
    | 'app_switches'
    | 'focus_time'
    | 'entertainment_limit'
    | 'behavior'
    | 'stay_under'
    | 'over_goal'
    | 'action';
  expiresAt: Date;
  completed: boolean;
  reward?: string;
  /** Backend behavior challenge key when present */
  challengeKey?: string;
  /** Lower is better until end of day — UI must not treat low usage as “done”. */
  direction?: ChallengeDirection;
  /** Backend daily challenge lifecycle / stay-under semantics */
  status?: ChallengeStatusLabel;
  /** Raw 0–1 from API when distinct from current/target bar */
  progress01?: number;
}
