import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme/theme';
import { SkeletonBlock } from './SkeletonBlock';

interface LoadingStateProps {
  label: string;
  variant?: 'spinner' | 'cards';
  cardCount?: number;
}

export function LoadingState({ label, variant = 'spinner', cardCount = 3 }: LoadingStateProps) {
  if (variant === 'cards') {
    return (
      <View style={styles.cardsWrap}>
        {Array.from({ length: cardCount }).map((_, index) => (
          <View key={index} style={styles.card}>
            <SkeletonBlock height={190} borderRadius={theme.radius.md} />
            <View style={styles.cardMeta}>
              <SkeletonBlock height={11} width="32%" />
              <SkeletonBlock height={16} width="74%" />
              <SkeletonBlock height={12} width="28%" />
            </View>
          </View>
        ))}
        <Text style={styles.label}>{label}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator color={theme.colors.text} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
  },
  cardsWrap: {
    width: '100%',
    gap: theme.spacing.smd,
    paddingBottom: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.sm,
  },
  cardMeta: {
    marginTop: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  label: {
    marginTop: theme.spacing.sm,
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
    textTransform: 'uppercase',
    letterSpacing: theme.typography.tracking.wide,
    fontWeight: '600',
  },
});
