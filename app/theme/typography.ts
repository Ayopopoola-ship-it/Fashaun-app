export const typography = {
  family: {
    regular: 'System',
    medium: 'System',
    semibold: 'System',
    bold: 'System',
  },
  display: 36,
  title: 30,
  heading: 22,
  body: 16,
  caption: 13,
  overline: 11,
  tracking: {
    tight: -0.8,
    normal: -0.3,
    wide: 0.8,
  },
} as const;

export type AppTypography = typeof typography;
