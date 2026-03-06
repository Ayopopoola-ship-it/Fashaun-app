import { Text, StyleSheet } from 'react-native';

import { ScreenContainer } from '../components/ScreenContainer';
import { theme } from '../theme/theme';

export function HomeFeedScreen() {
  return (
    <ScreenContainer>
      <Text style={styles.title}>Home Feed</Text>
      <Text style={styles.subtitle}>Placeholder for feed content.</Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: theme.typography.title,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.body,
    color: theme.colors.textMuted,
  },
});
