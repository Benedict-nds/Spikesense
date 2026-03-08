import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown, Easing } from 'react-native-reanimated';
import { IconSymbol } from './IconSymbol';
import { colors } from '@/styles/commonStyles';

const SOFT_EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

interface StatCardProps {
  icon: string;
  label: string;
  value: string;
  color: string;
  subtitle?: string;
  index?: number;
}

export default function StatCard({ icon, label, value, color, subtitle, index = 0 }: StatCardProps) {
  return (
    <Animated.View
      entering={FadeInDown.duration(220).delay(index * 50).easing(SOFT_EASE)}
      style={styles.container}
    >
      <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
        <IconSymbol name={icon} size={28} color={color} />
      </View>
      <View style={styles.content}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 2,
    marginBottom: 12,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  value: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
