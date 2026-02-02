
export type AppCategory = 'productivity' | 'social' | 'entertainment' | 'other';

export interface AppUsageData {
  appName: string;
  category: AppCategory;
  usageTime: number; // in minutes
  openCount: number;
  lastUsed: Date;
}

export interface DailyStats {
  date: string;
  totalScreenTime: number; // in minutes
  appSwitches: number;
  productivityTime: number;
  socialTime: number;
  entertainmentTime: number;
  otherTime: number;
  apps: AppUsageData[];
  focusTime: number; // time spent in focused sessions
  focusScore: number; // daily focus score (0-100)
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
  timestamp: Date;
  dismissed: boolean;
  actionLabel?: string;
  actionType?: 'focus_mode' | 'take_break' | 'view_stats';
}

export type SpikeSenseMode = 'supportive' | 'motivational' | 'restrictive' | 'balanced';

export interface ModeConfig {
  mode: SpikeSenseMode;
  supportive: {
    enabled: boolean;
    showInsights: boolean;
    showEducationalTips: boolean;
  };
  motivational: {
    enabled: boolean;
    showBadges: boolean;
    showStreaks: boolean;
    showChallenges: boolean;
    showFocusScore: boolean;
  };
  restrictive: {
    enabled: boolean;
    enableFocusMode: boolean;
    pauseNotifications: boolean;
    showCooldowns: boolean;
    autoEnableFocusMode: boolean;
  };
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: Date | null;
  progress: number; // 0-100
  requirement: string;
}

export interface Streak {
  type: 'focus' | 'low_switching' | 'balanced_usage';
  currentStreak: number;
  longestStreak: number;
  lastUpdated: Date;
}

export interface FocusSession {
  id: string;
  startTime: Date;
  endTime: Date | null;
  duration: number; // in minutes
  appSwitches: number;
  completed: boolean;
  targetDuration: number;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  target: number;
  current: number;
  type: 'app_switches' | 'focus_time' | 'entertainment_limit';
  expiresAt: Date;
  completed: boolean;
  reward?: string;
}
