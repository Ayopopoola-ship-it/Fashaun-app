export const theme = {
  colors: {
    background: '#F5F7FA',
    surface: '#FFFFFF',
    text: '#111827',
    textMuted: '#667085',
    primary: '#1D4ED8',
    border: '#E4E7EC',
    surfaceMuted: '#EEF2F7',
  },
  spacing: {
    xs: 4,
    sm: 8,
    smd: 12,
    md: 16,
    lg: 24,
    xl: 32,
  },
  typography: {
    title: 28,
    heading: 21,
    body: 16,
    caption: 14,
    overline: 12,
  },
  radius: {
    sm: 10,
    md: 12,
    lg: 16,
    xl: 20,
    pill: 999,
  },
  button: {
    height: 52,
  },
};

export type AppTheme = typeof theme;
