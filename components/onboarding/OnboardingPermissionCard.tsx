import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { onboardingColors, onboardingSpace } from '@/constants/onboardingTheme';

type Props = {
  title: string;
  subtitle: string;
  onPress?: () => void;
  icon?: React.ComponentProps<typeof MaterialIcons>['name'];
};

export function OnboardingPermissionCard({
  title,
  subtitle,
  onPress,
  icon = 'bar-chart',
}: Props) {
  const Inner = (
    <>
      <View style={styles.iconWrap}>
        <MaterialIcons name={icon} size={26} color={onboardingColors.primary} />
      </View>
      <View style={styles.textCol}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={28} color={onboardingColors.muted} />
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        {Inner}
      </Pressable>
    );
  }

  return <View style={styles.card}>{Inner}</View>;
}

export function OnboardingPrivacyNoteCard({ text }: { text: string }) {
  return (
    <View style={[styles.card, styles.privacyCard]}>
      <View style={styles.iconWrap}>
        <MaterialIcons name="lock" size={24} color={onboardingColors.teal} />
      </View>
      <Text style={styles.privacyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: onboardingColors.card,
    borderRadius: onboardingSpace.cardRadius,
    padding: 16,
    marginBottom: 12,
    shadowColor: onboardingColors.deepNavy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  pressed: { opacity: 0.92 },
  privacyCard: {
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: onboardingColors.teal + '33',
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: onboardingColors.softBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  textCol: { flex: 1, paddingRight: 8 },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: onboardingColors.darkText,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: onboardingColors.muted,
  },
  privacyText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: onboardingColors.darkText,
    fontWeight: '500',
  },
});
