
import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { colors } from '@/styles/commonStyles';

interface WeeklyChartProps {
  data: Array<{ date: string; screenTime: number; appSwitches: number }>;
}

const CHART_HEIGHT = 150;
const CHART_WIDTH = Dimensions.get('window').width - 64;

export default function WeeklyChart({ data }: WeeklyChartProps) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const toNumber = (value: unknown): number => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };
  const hasData = data && data.length > 0;
  const hasMeaningfulData = hasData && data.some(d => toNumber(d.screenTime) > 0);
  const maxScreenTime = hasMeaningfulData ? Math.max(1, ...data.map(d => toNumber(d.screenTime))) : 1;

  if (!hasData || !hasMeaningfulData) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Weekly Screen Time</Text>
        <Text style={styles.emptyText}>No data yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Weekly Screen Time</Text>
      <View style={styles.chartContainer}>
        <View style={styles.chart}>
          {data.map((item, index) => {
            const screenTime = toNumber(item.screenTime);
            const height = maxScreenTime > 0 ? (screenTime / maxScreenTime) * CHART_HEIGHT : 0;
            const date = new Date(item.date);
            const dayName = days[date.getDay()];
            
            return (
              <View key={index} style={styles.barContainer}>
                <View style={styles.barWrapper}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: height || 5,
                        backgroundColor: index === data.length - 1 ? colors.primary : colors.primary + '60',
                      },
                    ]}
                  />
                </View>
                <Text style={styles.dayLabel}>{dayName}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 2,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  chartContainer: {
    height: CHART_HEIGHT + 30,
  },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: CHART_HEIGHT,
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barWrapper: {
    width: '70%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: CHART_HEIGHT,
  },
  bar: {
    width: '100%',
    borderRadius: 6,
    minHeight: 5,
  },
  dayLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 8,
  },
});
