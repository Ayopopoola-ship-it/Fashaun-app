export const typography = {
  family: {
    regular: 'System',
    medium: 'System',
    semibold: 'System',
    bold: 'System',
  },
  title: 28,
  heading: 21,
  body: 16,
  caption: 14,
  overline: 12,
} as const;

export type AppTypography = typeof typography;
