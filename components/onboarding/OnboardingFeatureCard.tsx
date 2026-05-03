import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { onboardingColors, onboardingSpace } from '@/constants/onboardingTheme';

type Props = {
  text: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  bubbleColor: string;
};

export function OnboardingFeatureCard({ text, icon, bubbleColor }: Props) {
  return (
    <View style={styles.card}>
      <View style={[styles.bubble, { backgroundColor: bubbleColor + '28' }]}>
        <MaterialIcons name={icon} size={22} color={bubbleColor} />
      </View>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: onboardingColors.card,
    borderRadius: onboardingSpace.cardRadius,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    shadowColor: onboardingColors.deepNavy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  bubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  text: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: onboardingColors.darkText,
    fontWeight: '500',
  },
});
