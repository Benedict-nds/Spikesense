import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { onboardingColors, onboardingSpace } from '@/constants/onboardingTheme';

type Variant = 'mintTeal' | 'violetBlue';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
};

const GRADIENTS: Record<Variant, readonly [string, string]> = {
  mintTeal: [onboardingColors.mint, onboardingColors.teal],
  violetBlue: [onboardingColors.violet, onboardingColors.primary],
};

export function OnboardingButton({
  label,
  onPress,
  variant = 'violetBlue',
  style,
}: Props) {
  const colors = GRADIENTS[variant];
  const labelStyle = variant === 'mintTeal' ? styles.labelMint : styles.labelViolet;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.press, pressed && styles.pressed, style]}
      accessibilityRole="button"
    >
      <LinearGradient
        colors={[...colors]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.gradient}
      >
        <Text style={labelStyle}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: {
    borderRadius: onboardingSpace.buttonRadius,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: onboardingColors.deepNavy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  pressed: { opacity: 0.92 },
  gradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: onboardingSpace.buttonRadius,
  },
  labelViolet: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  labelMint: {
    color: onboardingColors.deepNavy,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
