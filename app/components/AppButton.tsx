import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { theme } from '../theme/theme';

type Variant = 'primary' | 'secondary' | 'ghost';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
}

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
}: AppButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' ? styles.primary : undefined,
        variant === 'secondary' ? styles.secondary : undefined,
        variant === 'ghost' ? styles.ghost : undefined,
        isDisabled ? styles.disabled : undefined,
        pressed && !isDisabled ? styles.pressed : undefined,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? theme.colors.surface : theme.colors.text} />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'primary' ? styles.primaryLabel : undefined,
            variant === 'secondary' ? styles.secondaryLabel : undefined,
            variant === 'ghost' ? styles.ghostLabel : undefined,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: theme.button.height,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  primary: {
    backgroundColor: theme.colors.primary,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  secondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  label: {
    fontSize: theme.typography.overline,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: theme.typography.tracking.wide,
  },
  primaryLabel: {
    color: theme.colors.surface,
  },
  secondaryLabel: {
    color: theme.colors.text,
  },
  ghostLabel: {
    color: theme.colors.textMuted,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.78,
  },
});
