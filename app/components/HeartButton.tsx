import { GestureResponderEvent, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';

import { theme } from '../theme/theme';

type HeartButtonProps = {
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  size?: number;
};

export function HeartButton({ active, onPress, disabled = false, style, size = 26 }: HeartButtonProps) {
  function handlePress(event: GestureResponderEvent): void {
    event.stopPropagation();
    onPress();
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={active ? 'Unsave' : 'Save'}
      accessibilityState={{ disabled, selected: active }}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed ? styles.buttonPressed : undefined, style]}
      onPress={handlePress}
      disabled={disabled}
    >
      <Text
        style={[
          styles.icon,
          { fontSize: size, lineHeight: size },
          active ? styles.iconActive : undefined,
          disabled ? styles.iconDisabled : undefined,
        ]}
      >
        {active ? '♥' : '♡'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 28,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  icon: {
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  iconActive: {
    color: theme.colors.accent,
  },
  iconDisabled: {
    opacity: 0.45,
  },
});
