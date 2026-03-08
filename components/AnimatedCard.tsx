import React from 'react';
import { ViewStyle } from 'react-native';
import Animated, { FadeInDown, Easing } from 'react-native-reanimated';

const SOFT_EASE_OUT = Easing.bezier(0.25, 0.1, 0.25, 1);
const CARD_ENTER_DURATION = 220;

interface AnimatedCardProps {
  children: React.ReactNode;
  delay?: number;
  style?: ViewStyle;
  index?: number;
}

export default function AnimatedCard({
  children,
  delay = 0,
  style,
  index = 0,
}: AnimatedCardProps) {
  const staggeredDelay = delay + index * 45;

  return (
    <Animated.View
      entering={FadeInDown.duration(CARD_ENTER_DURATION)
        .delay(staggeredDelay)
        .easing(SOFT_EASE_OUT)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
