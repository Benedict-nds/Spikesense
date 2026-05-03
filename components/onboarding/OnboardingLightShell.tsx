import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { onboardingColors, onboardingSpace } from '@/constants/onboardingTheme';
import {
  OnboardingProgressDots,
  OnboardingProgressDotsLight,
} from '@/components/onboarding/OnboardingProgressDots';
import { OnboardingButton } from '@/components/onboarding/OnboardingButton';

export type OnboardingLightShellProps = {
  /** 1=name … 4=permissions (welcome uses its own layout). */
  activeStep: number;
  showBack?: boolean;
  onBack?: () => void;
  leading?: 'back' | 'close';
  children: React.ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  primaryVariant?: 'mintTeal' | 'violetBlue';
  secondaryLabel?: string;
  onSecondary?: () => void;
  keyboard?: boolean;
  transparentBackground?: boolean;
  /** On dark photo backgrounds: light header icon, dots, and secondary link. */
  surfaceTone?: 'light' | 'dark';
};

export function OnboardingLightShell({
  activeStep,
  showBack,
  onBack,
  leading = 'back',
  children,
  primaryLabel,
  onPrimary,
  primaryVariant = 'violetBlue',
  secondaryLabel,
  onSecondary,
  keyboard,
  transparentBackground,
  surfaceTone = 'light',
}: OnboardingLightShellProps) {
  const leadIcon = leading === 'close' ? 'close' : 'arrow-back';
  const bg = transparentBackground ? 'transparent' : onboardingColors.softBg;
  const onDarkPhoto = Boolean(transparentBackground && surfaceTone === 'dark');
  const headerIconColor = onDarkPhoto ? 'rgba(255,255,255,0.88)' : onboardingColors.darkText;
  const secondaryLinkColor = onDarkPhoto ? '#C4B5FD' : onboardingColors.primary;
  const footerBorderTop = onDarkPhoto ? 'rgba(255,255,255,0.15)' : onboardingColors.muted + '33';

  const inner = (
    <View style={[styles.flex, { backgroundColor: bg }]}>
      <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          {showBack && onBack ? (
            <Pressable
              onPress={onBack}
              hitSlop={16}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel={leading === 'close' ? 'Close' : 'Back'}
            >
              <MaterialIcons name={leadIcon} size={24} color={headerIconColor} />
            </Pressable>
          ) : (
            <View style={styles.backPlaceholder} />
          )}
        </View>
        <ScrollView
          style={[styles.scroll, { backgroundColor: bg }]}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
        <SafeAreaView
          edges={['bottom']}
          style={[
            styles.footerSafe,
            {
              backgroundColor: transparentBackground ? 'transparent' : onboardingColors.softBg,
              borderTopColor: footerBorderTop,
            },
          ]}
        >
          <View style={styles.footer}>
            {onDarkPhoto ? (
              <OnboardingProgressDots activeIndex={activeStep} total={5} />
            ) : (
              <OnboardingProgressDotsLight activeIndex={activeStep} total={5} />
            )}
            <OnboardingButton label={primaryLabel} onPress={onPrimary} variant={primaryVariant} />
            {secondaryLabel && onSecondary ? (
              <Pressable onPress={onSecondary} style={styles.linkBtn} hitSlop={12}>
                <Text style={[styles.linkText, { color: secondaryLinkColor }]}>{secondaryLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        </SafeAreaView>
      </SafeAreaView>
    </View>
  );

  if (keyboard) {
    return (
      <KeyboardAvoidingView
        style={[styles.flex, { backgroundColor: bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {inner}
      </KeyboardAvoidingView>
    );
  }

  return inner;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1 },
  header: {
    paddingHorizontal: onboardingSpace.horizontal,
    paddingBottom: 4,
    minHeight: 44,
    justifyContent: 'center',
  },
  backBtn: { alignSelf: 'flex-start', padding: 4 },
  backPlaceholder: { height: 32 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: onboardingSpace.horizontal,
    paddingBottom: 24,
    flexGrow: 1,
  },
  footerSafe: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footer: {
    paddingHorizontal: onboardingSpace.horizontal,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  linkBtn: { alignItems: 'center', paddingVertical: 8 },
  linkText: {
    fontSize: 16,
    fontWeight: '600',
    color: onboardingColors.primary,
  },
});
