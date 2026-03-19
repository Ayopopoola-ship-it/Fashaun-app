import { StyleSheet, Text } from 'react-native';

import { theme } from '../theme/theme';

interface SectionLabelProps {
  children: string;
}

export function SectionLabel({ children }: SectionLabelProps) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  label: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.overline,
    textTransform: 'uppercase',
    letterSpacing: theme.typography.tracking.wide,
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
  },
});
