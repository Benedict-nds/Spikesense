import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { colors } from '@/styles/commonStyles';
import type { DailyStats } from '@/types/appUsage';

function formatSeconds(sec: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(sec) ? sec : 0));
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${mm}m`;
}

function entertainmentRatio(d: DailyStats): number {
  const total =
    d.totalUsageSeconds ??
    Math.max(1, Math.round((d.totalScreenTime || 0) * 60));
  const ent = d.entertainmentSeconds ?? Math.round((d.entertainmentTime || 0) * 60);
  return total > 0 ? ent / total : 0;
}

/** Daily aggregate from API `peak_switch_rate` (switches per hour of screen time). */
function peakSwitchInsightLine(d: DailyStats, focusScore: number): string | null {
  const p = d.peakSwitchRate;
  if (p == null || !Number.isFinite(p) || p <= 0) return null;
  const display = p >= 100 ? String(Math.round(p)) : p >= 10 ? p.toFixed(1) : p.toFixed(2);
  if (focusScore >= 70) {
    return `Switching averaged about ${display} app changes per hour of screen time—a reference point, not a verdict.`;
  }
  if (p >= 35) {
    return `At your busiest stretches, switching ran high—about ${display} app changes per hour of screen time.`;
  }
  if (p >= 18) {
    return `You had faster stretches of switching—roughly ${display} app switches per hour of screen at those times.`;
  }
  return `Switch intensity averaged about ${display} app switches per hour of screen time.`;
}

function switchingIntense(d: DailyStats): boolean {
  const peak =
    d.peakSwitchRate != null && Number.isFinite(d.peakSwitchRate) ? d.peakSwitchRate : 0;
  return (d.appSwitches ?? 0) >= 15 || peak >= 40;
}

/** Observations stay aligned with focus_score: high score → supportive; low → honest but kind. */
function buildObservations(d: DailyStats): string[] {
  const out: string[] = [];
  const score = Number.isFinite(d.focusScore) ? d.focusScore : 0;
  const ratio = entertainmentRatio(d);
  const prodSec = d.productivitySeconds ?? Math.round((d.productivityTime || 0) * 60);
  const entSec = d.entertainmentSeconds ?? Math.round((d.entertainmentTime || 0) * 60);
  const switchesHigh = d.appSwitches > 40;
  const intense = switchingIntense(d);
  const entertainmentDominant = ratio > 0.5;

  if (score >= 70) {
    if (intense && (d.appSwitches ?? 0) >= 15) {
      out.push(
        'Rapid app switching showed up in your day—even with a solid focus score, that pace can feel scattered.'
      );
    }
    if (prodSec > entSec && (d.totalUsageSeconds ?? 0) > 0) {
      out.push('You gave more time to productive apps today—a quiet win.');
    }
    out.push('Overall, your day leaned steady, which matches your focus score.');
    const peakLine = peakSwitchInsightLine(d, score);
    if (peakLine) out.push(peakLine);
    return out;
  }

  if ((d.appSwitches ?? 0) >= 15 && !switchesHigh) {
    out.push('You switched between apps frequently today—that often tracks with a busier rhythm.');
  }
  if (switchesHigh) {
    out.push('You moved between apps quite a bit—common on a busy day.');
  }
  if (entertainmentDominant) {
    out.push('Entertainment took more than half of tracked screen time today.');
  } else if (prodSec > entSec && (d.totalUsageSeconds ?? 0) > 0) {
    out.push('Productive apps still accounted for more minutes than entertainment.');
  }
  const peakLine = peakSwitchInsightLine(d, score);
  if (peakLine) out.push(peakLine);
  return out;
}

function buildSuggestions(d: DailyStats): string[] {
  const score = Number.isFinite(d.focusScore) ? d.focusScore : 0;
  const ratio = entertainmentRatio(d);
  const peak =
    d.peakSwitchRate != null && Number.isFinite(d.peakSwitchRate) ? d.peakSwitchRate : 0;
  const switchingHigh = (d.appSwitches ?? 0) >= 15 || peak >= 40;

  if (switchingHigh) {
    return [
      'Your switching intensity was high today. A short focus block could help you reset.',
    ];
  }
  if (score < 60) {
    return [
      'A short focus block—even a few minutes—can help you reset at your own pace.',
    ];
  }
  if (ratio > 0.5) {
    return [
      'Balancing entertainment with intentional breaks can help keep your day steady.',
    ];
  }
  return ["You're in a comfortable range today."];
}

type Props = {
  dailyStats: DailyStats;
  refreshing: boolean;
  loadError?: string | null;
  onRetry?: () => void;
  /** Local profile name for a single optional personal line (not sent to backend). */
  displayName?: string | null;
};

export default function InsightsTabContent({
  dailyStats,
  refreshing,
  loadError,
  onRetry,
  displayName,
}: Props) {
  const hasActivity =
    (dailyStats.totalUsageSeconds ?? 0) > 0 ||
    dailyStats.appSwitches > 0 ||
    dailyStats.totalScreenTime > 0;

  const ratio = entertainmentRatio(dailyStats);
  const observations = useMemo(() => buildObservations(dailyStats), [dailyStats]);
  const suggestions = useMemo(() => buildSuggestions(dailyStats), [dailyStats]);

  useEffect(() => {
    if (!__DEV__) return;
    const peak =
      dailyStats.peakSwitchRate != null && Number.isFinite(dailyStats.peakSwitchRate)
        ? dailyStats.peakSwitchRate
        : null;
    console.log('[FRONTEND][INSIGHTS_RENDER]', {
      focus_score: dailyStats.focusScore,
      app_switches: dailyStats.appSwitches,
      peak_switch_rate: peak,
      entertainment_ratio: Math.round(ratio * 1000) / 1000,
      suggestion_count: suggestions.length,
    });
  }, [dailyStats.focusScore, dailyStats.appSwitches, dailyStats.peakSwitchRate, ratio, suggestions.length]);

  if (refreshing) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingHint}>Updating insights…</Text>
      </View>
    );
  }

  if (!hasActivity) {
    return (
      <View style={styles.emptyBox}>
        {loadError ? (
          <>
            <Text style={styles.errorBannerTitle}>Couldn&apos;t refresh stats</Text>
            <Text style={styles.errorBannerSub}>{loadError}</Text>
            {onRetry ? (
              <Pressable style={styles.retryBtn} onPress={onRetry}>
                <Text style={styles.retryBtnText}>Retry</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
        <Text style={styles.emptyPrimary}>
          Once you start using your phone, we&apos;ll show insights about your habits.
        </Text>
      </View>
    );
  }

  const summaryBody =
    dailyStats.focusScoreReason?.trim() ||
    'Your focus score brings together switching, entertainment, and productive time for today.';

  const entSec = dailyStats.entertainmentSeconds ?? Math.round((dailyStats.entertainmentTime || 0) * 60);
  const prodSec = dailyStats.productivitySeconds ?? Math.round((dailyStats.productivityTime || 0) * 60);
  const peakRate =
    dailyStats.peakSwitchRate != null && Number.isFinite(dailyStats.peakSwitchRate)
      ? dailyStats.peakSwitchRate
      : null;

  const named = (displayName ?? '').trim();
  const focusOk =
    Number.isFinite(dailyStats.focusScore) && (dailyStats.focusScore as number) >= 70;
  const calmLineBlocked = switchingIntense(dailyStats);
  const personalCalmLine =
    named.length > 0 && focusOk && !calmLineBlocked
      ? `${named}, your usage looks calm today.`
      : null;

  return (
    <View style={styles.wrap}>
      {loadError ? (
        <View style={styles.warnBanner}>
          <Text style={styles.warnText}>Couldn&apos;t refresh — showing last loaded data.</Text>
          {onRetry ? (
            <Pressable onPress={onRetry} hitSlop={8}>
              <Text style={styles.warnRetry}>Retry</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <View style={styles.cardTop}>
        <Text style={styles.cardEyebrow}>Today&apos;s Insight</Text>
        {personalCalmLine ? <Text style={styles.personalCalm}>{personalCalmLine}</Text> : null}
        <Text style={styles.summaryBody}>{summaryBody}</Text>
        <View style={styles.scoreRow}>
          <Text style={styles.scoreLabel}>Focus score</Text>
          <Text style={styles.scoreValue}>{Math.round(Number.isFinite(dailyStats.focusScore) ? dailyStats.focusScore : 0)}</Text>
          <Text style={styles.scoreOutOf}>/ 100</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Key signals</Text>
        <View style={styles.signalRow}>
          <Text style={styles.signalLabel}>App switches</Text>
          <Text style={styles.signalValue}>{Math.max(0, Math.floor(dailyStats.appSwitches || 0))}</Text>
        </View>
        <View style={styles.signalRow}>
          <Text style={styles.signalLabel}>Entertainment time</Text>
          <Text style={styles.signalValue}>{formatSeconds(entSec)}</Text>
        </View>
        <View style={styles.signalRow}>
          <Text style={styles.signalLabel}>Productive time</Text>
          <Text style={styles.signalValue}>{formatSeconds(prodSec)}</Text>
        </View>
        {(dailyStats.totalUsageSeconds ?? 0) > 0 ? (
          <View style={styles.signalRow}>
            <Text style={styles.signalLabel}>Total screen time</Text>
            <Text style={styles.signalValue}>{formatSeconds(dailyStats.totalUsageSeconds ?? 0)}</Text>
          </View>
        ) : null}
        {dailyStats.impulsiveSwitches != null && Number.isFinite(dailyStats.impulsiveSwitches) ? (
          <View style={styles.signalRow}>
            <Text style={styles.signalLabel}>Impulsive switches</Text>
            <Text style={styles.signalValue}>{Math.round(dailyStats.impulsiveSwitches)}</Text>
          </View>
        ) : null}
        {peakRate != null ? (
          <View style={styles.signalRow}>
            <Text style={styles.signalLabel}>Switch intensity (per hr screen)</Text>
            <Text style={styles.signalValue}>{peakRate.toFixed(2)}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Smart observations</Text>
        {observations.length > 0 ? (
          observations.map((line, i) => (
            <Text key={i} style={styles.bullet}>
              • {line}
            </Text>
          ))
        ) : (
          <Text style={styles.muted}>Nothing dramatic stood out—keep tracking and patterns will emerge.</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Suggestions</Text>
        {suggestions.length > 0 ? (
          suggestions.map((line, i) => (
            <Text key={i} style={styles.bullet}>
              • {line}
            </Text>
          ))
        ) : (
          <Text style={styles.muted}>You&apos;re in a comfortable range today.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 16,
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  loadingHint: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyBox: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
  },
  emptyPrimary: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  warnBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.textSecondary + '55',
  },
  warnText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    minWidth: '60%',
  },
  warnRetry: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  errorBannerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  errorBannerSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: colors.primary + '22',
    marginBottom: 16,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  cardTop: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 18,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 2,
  },
  cardEyebrow: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  personalCalm: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 10,
    lineHeight: 22,
  },
  summaryBody: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
    marginBottom: 14,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  scoreLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  scoreValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
  },
  scoreOutOf: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  signalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.textSecondary + '35',
  },
  signalLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
    paddingRight: 12,
  },
  signalValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  bullet: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 21,
    marginBottom: 8,
  },
  muted: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
