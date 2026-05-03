import React from 'react';
import { View, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { onboardingColors } from '@/constants/onboardingTheme';

/** Stylized phone + chart for “How it works”. */
export function OnboardingIllustrationPhone() {
  return (
    <View style={styles.wrap}>
      <View style={styles.floatIcon} accessibilityElementsHidden>
        <MaterialIcons name="schedule" size={18} color={onboardingColors.primary} />
      </View>
      <View style={styles.floatIcon2}>
        <MaterialIcons name="apps" size={16} color={onboardingColors.teal} />
      </View>
      <View style={styles.phone}>
        <View style={styles.notch} />
        <View style={styles.chartRow}>
          <View style={[styles.bar, { height: 28, backgroundColor: onboardingColors.mint }]} />
          <View style={[styles.bar, { height: 40, backgroundColor: onboardingColors.primary }]} />
          <View style={[styles.bar, { height: 22, backgroundColor: onboardingColors.violet }]} />
          <View style={[styles.bar, { height: 34, backgroundColor: onboardingColors.teal }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 140,
    marginBottom: 8,
  },
  phone: {
    width: 100,
    height: 150,
    borderRadius: 16,
    backgroundColor: onboardingColors.card,
    borderWidth: 3,
    borderColor: onboardingColors.softBg,
    paddingTop: 12,
    paddingHorizontal: 12,
    shadowColor: onboardingColors.deepNavy,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  notch: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: onboardingColors.softBg,
    marginBottom: 16,
  },
  chartRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: 20,
  },
  bar: {
    width: 14,
    borderRadius: 6,
  },
  floatIcon: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: onboardingColors.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: onboardingColors.deepNavy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
    zIndex: 2,
  },
  floatIcon2: {
    position: 'absolute',
    top: 36,
    right: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: onboardingColors.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: onboardingColors.deepNavy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    zIndex: 2,
  },
});
