
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { IconSymbol } from '@/components/IconSymbol';
import { useRouter, usePathname } from 'expo-router';
import { colors } from '@/styles/commonStyles';

export interface TabBarItem {
  name: string;
  route: string;
  icon: string;
  label: string;
}

interface FloatingTabBarProps {
  tabs: TabBarItem[];
  containerWidth?: number;
  borderRadius?: number;
  bottomMargin?: number;
}

export default function FloatingTabBar({
  tabs,
  containerWidth = Dimensions.get('window').width - 40,
  borderRadius = 25,
  bottomMargin = 20,
}: FloatingTabBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const activeIndex = useSharedValue(0);

  const handleTabPress = (route: string) => {
    const index = tabs.findIndex((tab) => tab.route === route);
    activeIndex.value = withSpring(index);
    router.push(route as any);
  };

  React.useEffect(() => {
    const index = tabs.findIndex((tab) => pathname.includes(tab.name));
    if (index !== -1) {
      activeIndex.value = withSpring(index);
    }
  }, [pathname]);

  const animatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      activeIndex.value,
      tabs.map((_, i) => i),
      tabs.map((_, i) => (i * containerWidth) / tabs.length)
    );

    return {
      transform: [{ translateX }],
    };
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={[styles.container, { marginBottom: bottomMargin }]}>
        <BlurView intensity={80} tint="light" style={[styles.tabBar, { width: containerWidth, borderRadius }]}>
          <Animated.View
            style={[
              styles.activeIndicator,
              {
                width: containerWidth / tabs.length,
                borderRadius: borderRadius - 5,
              },
              animatedStyle,
            ]}
          />
          {tabs.map((tab) => {
            const isActive = pathname.includes(tab.name);
            return (
              <TouchableOpacity
                key={tab.name}
                style={styles.tab}
                onPress={() => handleTabPress(tab.route)}
                activeOpacity={0.7}
              >
                <IconSymbol
                  name={tab.icon}
                  size={24}
                  color={isActive ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.label,
                    { color: isActive ? colors.primary : colors.textSecondary },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </BlurView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    height: 60,
    backgroundColor: colors.card + 'E6',
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.15)',
    elevation: 8,
    overflow: 'hidden',
  },
  activeIndicator: {
    position: 'absolute',
    height: 50,
    backgroundColor: colors.primary + '20',
    top: 5,
    left: 5,
  },
  tab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});
