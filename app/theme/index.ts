import { colors } from './colors';
import { layout } from './layout';
import { radius } from './radius';
import { shadows } from './shadows';
import { spacing } from './spacing';
import { typography } from './typography';

export { colors, layout, radius, shadows, spacing, typography };

export const theme = {
  colors,
  spacing,
  radius,
  typography,
  shadows,
  layout,
  button: {
    height: layout.buttonHeight,
  },
} as const;

export type AppTheme = typeof theme;
