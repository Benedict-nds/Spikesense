import type { IconSymbolName } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';

const CHALLENGE_KEY_TO_ICON: Record<string, IconSymbolName> = {
  SOCIAL_SWITCH_REDUCER: 'person.2.fill',
  APP_SWITCH_STABILITY: 'arrow.triangle.2.circlepath',
  FOCUS_SESSION_STARTER: 'timer',
  SOCIAL_COOLDOWN: 'leaf.fill',
  ENTERTAINMENT_BALANCE: 'play.circle.fill',
  SCREEN_BREAK: 'moon.fill',
  TOP_APP_LIMIT: 'iphone',
  MAINTAIN_RHYTHM: 'calendar.circle',
  LIGHT_CHECKIN: 'checkmark.circle.fill',
};

/** Subtle icon bubble + icon color per challenge (hex). */
const CHALLENGE_KEY_TO_TINT: Record<
  string,
  { iconBg: string; iconFg: string; progressFill?: string }
> = {
  SOCIAL_SWITCH_REDUCER: { iconBg: '#E8EEFC', iconFg: '#4C63D2', progressFill: '#5B73E8' },
  APP_SWITCH_STABILITY: { iconBg: '#EDE9FE', iconFg: '#6D28D9', progressFill: '#7C3AED' },
  FOCUS_SESSION_STARTER: { iconBg: '#DCFCE7', iconFg: '#15803D', progressFill: '#22C55E' },
  SOCIAL_COOLDOWN: { iconBg: '#D1FAE5', iconFg: '#0F766E', progressFill: '#14B8A6' },
  ENTERTAINMENT_BALANCE: { iconBg: '#FEF3C7', iconFg: '#B45309', progressFill: '#F59E0B' },
  SCREEN_BREAK: { iconBg: '#E0E7FF', iconFg: '#4338CA', progressFill: '#6366F1' },
  TOP_APP_LIMIT: { iconBg: '#FCE7F3', iconFg: '#BE185D', progressFill: '#EC4899' },
  MAINTAIN_RHYTHM: { iconBg: '#E0E7FF', iconFg: '#3730A3', progressFill: '#4F46E5' },
  LIGHT_CHECKIN: { iconBg: '#CCFBF1', iconFg: '#0F766E', progressFill: '#14B8A6' },
};

const DEFAULT_TINT = { iconBg: colors.primary + '20', iconFg: colors.primary };

/**
 * Resolve SF-style icon name for IconSymbol / Material mapping.
 * Prefer `challengeKey`; fall back to backend `type` string.
 */
export function getChallengeIcon(challengeKey?: string, type?: string): IconSymbolName {
  const k = (challengeKey || '').trim().toUpperCase();
  if (k && CHALLENGE_KEY_TO_ICON[k]) {
    return CHALLENGE_KEY_TO_ICON[k];
  }

  const t = (type || '').toLowerCase();
  if (t === 'over_goal' || t === 'focus_time') return 'timer';
  if (t === 'entertainment_limit') return 'play.circle.fill';
  if (t === 'action') return 'leaf.fill';
  if (t === 'stay_under' || t === 'app_switches') return 'arrow.triangle.2.circlepath';
  if (t === 'behavior') return 'flag.fill';

  return 'flag.fill';
}

export function getChallengeIconTint(challengeKey?: string): {
  iconBg: string;
  iconFg: string;
  progressFill?: string;
} {
  const k = (challengeKey || '').trim().toUpperCase();
  return CHALLENGE_KEY_TO_TINT[k] ?? DEFAULT_TINT;
}
