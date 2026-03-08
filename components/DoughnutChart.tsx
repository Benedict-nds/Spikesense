
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/styles/commonStyles';
import Svg, { Circle, G } from 'react-native-svg';

interface DoughnutChartProps {
  data: Array<{ label: string; value: number; color: string }>;
  size?: number;
  strokeWidth?: number;
  centerText?: string;
  centerSubtext?: string;
}

export default function DoughnutChart({
  data,
  size = 200,
  strokeWidth = 30,
  centerText,
  centerSubtext,
}: DoughnutChartProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const centerRadius = radius - strokeWidth / 2 - 10; // Inner radius for background circle

  if (total === 0) {
    return (
      <View style={styles.container}>
        <View style={[styles.emptyChart, { width: size, height: size, borderRadius: size / 2 }]}>
          <Text style={styles.emptyChartText}>No usage data yet</Text>
          <Text style={styles.emptyChartSubtext}>Use apps to see breakdown here</Text>
        </View>
      </View>
    );
  }

  let currentAngle = -90; // Start from top

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        <G rotation={0} origin={`${size / 2}, ${size / 2}`}>
          {data.map((item, index) => {
            const percentage = item.value / total;
            const strokeDashoffset = circumference * (1 - percentage);
            const rotation = currentAngle;
            currentAngle += percentage * 360;

            return (
              <Circle
                key={index}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={item.color}
                strokeWidth={strokeWidth}
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                rotation={rotation}
                origin={`${size / 2}, ${size / 2}`}
                strokeLinecap="round"
              />
            );
          })}
        </G>
        {/* Semi-transparent background circle for center text */}
        {centerText && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={centerRadius}
            fill="rgba(0, 0, 0, 0.5)"
          />
        )}
      </Svg>
      {centerText && (
        <View style={[styles.centerTextContainer, { width: size, height: size }]}>
          <Text style={styles.centerText}>{centerText}</Text>
          {centerSubtext && (
            <Text style={styles.centerSubtext}>{centerSubtext}</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyChart: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  emptyChartText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyChartSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  centerTextContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  centerSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
