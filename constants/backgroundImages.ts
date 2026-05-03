import type { ImageSourcePropType } from 'react-native';

/** Canonical background routing keys (dashboard mode, tab, onboarding step). */
export type SpikeBackgroundMode =
  | 'focus'
  | 'balanced'
  | 'relax'
  | 'adaptive'
  | 'onboarding'
  | 'welcome'
  | 'name'
  | 'how'
  | 'modes'
  | 'permissions'
  | 'achievements'
  | 'progress'
  | 'insights'
  | 'overview'
  | 'default';

const bg = {
  balanceThrive: require('@/assets/images/backgrounds/bg-balance-thrive.png'),
  smallChoices: require('@/assets/images/backgrounds/bg-small-choices.png'),
  awarenessBrain: require('@/assets/images/backgrounds/bg-awareness-brain.png'),
  lessOverload: require('@/assets/images/backgrounds/bg-less-overload.png'),
  focusFreedom: require('@/assets/images/backgrounds/bg-focus-freedom.png'),
  trackPatterns: require('@/assets/images/backgrounds/bg-track-patterns.png'),
  everyMinute: require('@/assets/images/backgrounds/bg-every-minute.png'),
  phoneBalanced: require('@/assets/images/backgrounds/bg-phone-balanced.png'),
  progressNotPerfection: require('@/assets/images/backgrounds/bg-progress-not-perfection.png'),
  restReset: require('@/assets/images/backgrounds/bg-rest-reset.png'),
  aiDashboard: require('@/assets/images/backgrounds/bg-ai-dashboard.png'),
} as const;

/** One portrait crop per dashboard tab (no cluster sheet, no rotation pool). */
const DASHBOARD_TAB_IMAGE: Record<
  'overview' | 'progress' | 'achievements' | 'insights' | 'default',
  ImageSourcePropType
> = {
  overview: bg.awarenessBrain,
  progress: bg.phoneBalanced,
  achievements: bg.progressNotPerfection,
  insights: bg.aiDashboard,
  default: bg.aiDashboard,
};

const DASHBOARD_TAB_KEY: Record<
  'overview' | 'progress' | 'achievements' | 'insights' | 'default',
  string
> = {
  overview: 'bg-awareness-brain',
  progress: 'bg-phone-balanced',
  achievements: 'bg-progress-not-perfection',
  insights: 'bg-ai-dashboard',
  default: 'bg-ai-dashboard',
};

const ONBOARDING_POOL: Partial<Record<SpikeBackgroundMode, ImageSourcePropType[]>> = {
  welcome: [bg.balanceThrive, bg.focusFreedom],
  name: [bg.smallChoices, bg.progressNotPerfection],
  how: [bg.awarenessBrain, bg.trackPatterns, bg.aiDashboard],
  modes: [bg.lessOverload, bg.focusFreedom, bg.progressNotPerfection],
  permissions: [bg.phoneBalanced, bg.aiDashboard],
};

function normalizeTab(screen?: string): keyof typeof DASHBOARD_TAB_IMAGE {
  const s = (screen || 'default').toLowerCase();
  if (s === 'overview') return 'overview';
  if (s === 'progress') return 'progress';
  if (s === 'achievements') return 'achievements';
  if (s === 'insights') return 'insights';
  return 'default';
}

/**
 * Dashboard: exactly one cropped background per tab (static slideshow / no collage).
 */
export function getDashboardBackgroundMeta(screen?: string): {
  images: ImageSourcePropType[];
  imageKey: string;
} {
  const tab = normalizeTab(screen);
  return {
    images: [DASHBOARD_TAB_IMAGE[tab]],
    imageKey: DASHBOARD_TAB_KEY[tab],
  };
}

/**
 * Background list for the dashboard layer. Always length 1 — one portrait crop per tab.
 * `mode` is accepted for API compatibility but does not change the image (demo-stable).
 */
export function getBackgroundsForMode(_mode?: string, screen?: string): ImageSourcePropType[] {
  return getDashboardBackgroundMeta(screen).images;
}

export function getDashboardBackgroundImageKey(screen?: string): string {
  return getDashboardBackgroundMeta(screen).imageKey;
}

/** Registry keys for the active dashboard tab (always one entry). */
export function getDashboardBackgroundKeys(screen?: string): string[] {
  return [getDashboardBackgroundImageKey(screen)];
}

/** First image for a static screen (onboarding steps, or simple fallbacks). */
export function getStaticBackgroundForScreen(screen?: string, _mode?: string): ImageSourcePropType {
  const s = (screen || 'default').toLowerCase() as SpikeBackgroundMode;
  const onboard = ONBOARDING_POOL[s];
  if (onboard?.length) return onboard[0];
  if (s === 'overview' || s === 'progress' || s === 'achievements' || s === 'insights') {
    return DASHBOARD_TAB_IMAGE[normalizeTab(s)];
  }
  return DASHBOARD_TAB_IMAGE.default;
}
