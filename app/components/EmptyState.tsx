import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme/theme';

interface EmptyStateProps {
  title: string;
  subtitle: string;
}

export function EmptyState({ title, subtitle }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.heading,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    letterSpacing: theme.typography.tracking.normal,
    textAlign: 'center',
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.body,
    lineHeight: 22,
    textAlign: 'center',
  },
});
