import { useRef } from 'react';
import { Animated, ImageStyle, StyleProp, StyleSheet, View } from 'react-native';

import { theme } from '../theme/theme';

interface FadeInImageProps {
  uri: string | null;
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
}

export function FadeInImage({ uri, style, resizeMode = 'cover' }: FadeInImageProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  if (!uri) {
    return <View style={[styles.fallbackWrap, style]} />;
  }

  return (
    <View style={[styles.imageWrap, style]}>
      <Animated.Image
        source={{ uri }}
        style={[StyleSheet.absoluteFillObject, { opacity }]}
        resizeMode={resizeMode}
        onLoadEnd={() => {
          Animated.timing(opacity, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }).start();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fallbackWrap: {
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceMuted,
  },
  imageWrap: {
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceMuted,
  },
});
