import React from 'react';
import { View, ViewStyle } from 'react-native';
import Animated, { FadeInDown, Easing } from 'react-native-reanimated';

const SOFT_EASE_OUT = Easing.bezier(0.25, 0.1, 0.25, 1);
const ENTER_DURATION = 280;

interface AnimatedSectionProps {
  children: React.ReactNode;
  delay?: number;
  style?: ViewStyle;
  index?: number;
}

export default function AnimatedSection({
  children,
  delay = 0,
  style,
  index = 0,
}: AnimatedSectionProps) {
  const staggeredDelay = delay + index * 50;

  return (
    <Animated.View
      entering={FadeInDown.duration(ENTER_DURATION)
        .delay(staggeredDelay)
        .easing(SOFT_EASE_OUT)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
