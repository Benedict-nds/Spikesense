import type { IconSymbolName } from '@/components/IconSymbol';

/**
 * Maps backend canonical `badge_key` (after normalization) to SF-symbol names in IconSymbol / MAPPING.
 */
const BADGE_KEY_TO_ICON: Record<string, IconSymbolName> = {
  SWITCH_TAMER: 'arrow.triangle.2.circlepath',
  LOOP_BREAKER: 'link',
  INSTAGRAM_ESCAPE: 'phone.fill',
  DEEP_FOCUS: 'timer',
  DEEP_FOCUS_SESSION: 'timer',
  LOCKED_IN: 'lock.fill',
  FOCUS_STREAK_3: 'lock.fill',
  '3_DAY_STREAK': 'lock.fill',
  TOOK_THE_HINT: 'checkmark.circle.fill',
  RESET_MASTER: 'leaf.fill',
  RHYTHM_BUILDER: 'square.grid.3x3',
  CHALLENGE_TRIPLE: 'square.grid.3x3',
  COMEBACK_DAY: 'calendar',
  COME_BACK: 'calendar',
  SPIKE_APPROVED: 'sparkles',
};

const DEFAULT_BADGE_ICON: IconSymbolName = 'star.fill';

/**
 * Resolve a MaterialIcons-backed symbol name for a badge row.
 */
export function resolveBadgeIconName(badgeKey: string | undefined, _nameFallback?: string): IconSymbolName {
  if (!badgeKey || typeof badgeKey !== 'string') {
    return DEFAULT_BADGE_ICON;
  }
  const k = badgeKey.trim().toUpperCase().replace(/-/g, '_');
  return BADGE_KEY_TO_ICON[k] ?? DEFAULT_BADGE_ICON;
}
