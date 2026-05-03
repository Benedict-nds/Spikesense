import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { onboardingColors, onboardingSpace } from '@/constants/onboardingTheme';

type Props = {
  title: string;
  description: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  iconColor: string;
  tint: string;
  recommended?: boolean;
};

export function OnboardingModeCard({
  title,
  description,
  icon,
  iconColor,
  tint,
  recommended,
}: Props) {
  const borderCol = recommended ? iconColor + '55' : tint + '28';

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: borderCol,
          shadowColor: tint,
        },
      ]}
    >
      {recommended ? (
        <View style={[styles.badge, { backgroundColor: iconColor + '18' }]}>
          <Text style={[styles.badgeText, { color: iconColor }]}>Recommended</Text>
        </View>
      ) : null}
      <View style={styles.row}>
        <View style={[styles.bubble, { backgroundColor: tint + '12' }]}>
          <MaterialIcons name={icon} size={26} color={iconColor} />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.desc}>{description}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: onboardingColors.card,
    borderRadius: onboardingSpace.cardRadius,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 10,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  textCol: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  desc: {
    fontSize: 14,
    lineHeight: 20,
    color: onboardingColors.muted,
  },
});
