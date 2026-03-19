export const layout = {
  screenHorizontalPadding: 22,
  screenTopPadding: 18,
  screenBottomPadding: 24,
  maxContentWidth: 680,
  buttonHeight: 50,
} as const;

export type AppLayout = typeof layout;
