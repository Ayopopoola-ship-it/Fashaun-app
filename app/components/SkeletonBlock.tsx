import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { theme } from '../theme/theme';

interface SkeletonBlockProps {
  width?: number | `${number}%` | 'auto';
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export function SkeletonBlock({
  width = '100%',
  height,
  borderRadius = theme.radius.sm,
  style,
}: SkeletonBlockProps) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.62,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.block,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: theme.colors.surfaceMuted,
  },
});
