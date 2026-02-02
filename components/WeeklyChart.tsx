
import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { colors } from '@/styles/commonStyles';

interface WeeklyChartProps {
  data: Array<{ date: string; screenTime: number; appSwitches: number }>;
}

const CHART_HEIGHT = 150;
const CHART_WIDTH = Dimensions.get('window').width - 64;

export default function WeeklyChart({ data }: WeeklyChartProps) {
  const maxScreenTime = Math.max(...data.map(d => d.screenTime));
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Weekly Screen Time</Text>
      <View style={styles.chartContainer}>
        <View style={styles.chart}>
          {data.map((item, index) => {
            const height = (item.screenTime / maxScreenTime) * CHART_HEIGHT;
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
