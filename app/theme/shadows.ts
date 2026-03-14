import { Platform } from 'react-native';

export const shadows = {
  none: {},
  sm: Platform.select({
    ios: {
      shadowColor: '#101828',
      shadowOpacity: 0.05,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },
    android: {
      elevation: 2,
    },
    default: {},
  }),
  md: Platform.select({
    ios: {
      shadowColor: '#101828',
      shadowOpacity: 0.08,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
    },
    android: {
      elevation: 5,
    },
    default: {},
  }),
} as const;

export type AppShadows = typeof shadows;
