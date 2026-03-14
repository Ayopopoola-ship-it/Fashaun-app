export const layout = {
  screenHorizontalPadding: 24,
  screenTopPadding: 16,
  screenBottomPadding: 24,
  maxContentWidth: 680,
  buttonHeight: 52,
} as const;

export type AppLayout = typeof layout;
