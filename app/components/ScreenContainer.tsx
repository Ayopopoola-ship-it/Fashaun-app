import { PropsWithChildren } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';

import { theme } from '../theme/theme';

export function ScreenContainer({ children }: PropsWithChildren) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.frame}>
        <View style={styles.content}>{children}</View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  frame: {
    flex: 1,
    alignItems: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: theme.layout.maxContentWidth,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
});
