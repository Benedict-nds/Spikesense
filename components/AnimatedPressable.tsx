import React from 'react';
import { Pressable, type PressableProps, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const PRESS_SCALE = 0.98;
const PRESS_DURATION = 150;
const SOFT_EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

interface AnimatedPressableProps extends PressableProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export default function AnimatedPressable({ children, onPressIn, onPressOut, style, ...rest }: AnimatedPressableProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = (e: any) => {
    scale.value = withTiming(PRESS_SCALE, { duration: PRESS_DURATION, easing: SOFT_EASE });
    onPressIn?.(e);
  };

  const handlePressOut = (e: any) => {
    scale.value = withTiming(1, { duration: PRESS_DURATION, easing: SOFT_EASE });
    onPressOut?.(e);
  };

  return (
    <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} style={style} {...rest}>
      <Animated.View style={animatedStyle}>{children}</Animated.View>
    </Pressable>
  );
}
