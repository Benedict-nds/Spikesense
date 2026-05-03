export type Mode = 'focus' | 'balanced' | 'relax' | 'auto';

export const MODES: Mode[] = ['focus', 'balanced', 'relax', 'auto'];

export const MODE_LABELS: Record<Mode, string> = {
  focus: 'Focus Mode',
  balanced: 'Balanced Mode',
  relax: 'Relax Mode',
  auto: 'Adaptive (Auto)',
};

export const MODE_DESCRIPTIONS: Record<Mode, string> = {
  focus: 'Minimize distractions and stay in deep work.',
  balanced: 'Keep the default middle profile: same thresholds until you change mode.',
  relax: 'Enjoy your downtime with minimal nudges.',
  auto: 'Let SpikeSense pick Focus, Balanced, or Relax from your recent usage.',
};

export const MODE_ALIASES: Record<string, Mode> = {
  strict: 'focus',
  moderate: 'balanced',
  relaxed: 'relax',
  adaptive: 'auto',

  // Previous app-specific modes (kept for backward compatibility)
  supportive: 'relax',
  motivational: 'balanced',
  restrictive: 'focus',
};

export function normalizeMode(mode: unknown): Mode {
  const raw = typeof mode === 'string' ? mode.trim().toLowerCase() : '';
  const normalized = MODE_ALIASES[raw] ?? raw;
  return (MODES.includes(normalized as Mode) ? normalized : 'balanced') as Mode;
}

/** Payload from GET /users/:id/mode or stats.adaptive_mode */
export type AdaptiveModePayload = {
  mode?: string;
  manual_lock?: boolean;
  auto?: boolean;
  mode_source?: 'manual' | 'adaptive';
};

/**
 * Map backend mode payload to the mode card the user has chosen.
 * Manual locks (focus / balanced / relax) follow `mode` + manual flags.
 * Adaptive follows stored preference auto/adaptive even when inferred `mode` is Relax, etc.
 */
export function uiModeFromBackendAdaptive(payload: AdaptiveModePayload | null | undefined): Mode {
  if (!payload) return 'balanced';

  const manualExplicit =
    payload.mode_source === 'manual' || payload.manual_lock === true;

  if (manualExplicit) {
    const m = String(payload.mode ?? '').trim().toLowerCase();
    if (m === 'focus') return 'focus';
    if (m === 'relax') return 'relax';
    return 'balanced';
  }

  if (
    payload.mode_source === 'adaptive' ||
    payload.manual_lock === false ||
    payload.auto === true
  ) {
    return 'auto';
  }

  const m = String(payload.mode ?? '').trim().toLowerCase();
  if (m === 'focus') return 'focus';
  if (m === 'relax') return 'relax';
  return 'balanced';
}
