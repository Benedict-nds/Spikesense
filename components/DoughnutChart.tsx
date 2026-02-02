
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
      </Svg>
      {centerText && (
        <View style={styles.centerTextContainer}>
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
  centerTextContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
  },
  centerSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
});
