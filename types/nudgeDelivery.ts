/**
 * Real-time nudge delivery (additive to persisted /nudges API).
 */

export type NudgeDeliveryTier = 'notification' | 'mini_orb' | 'focus_guard';

export type NudgeRealtimePayload = {
  id?: number | null;
  message: string;
  explanation?: string;
  action_label?: string | null;
  action_type?: string | null;
  severity?: string;
  pattern?: string;
};

export type ClientInterventionKind = 'none' | 'focus_guard' | 'mini_orb' | 'notification';
