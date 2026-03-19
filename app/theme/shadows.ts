import { Platform } from 'react-native';

export const shadows = {
  none: {},
  sm: Platform.select({
    ios: {
      shadowColor: '#161A18',
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
    },
    android: {
      elevation: 1,
    },
    default: {},
  }),
  md: Platform.select({
    ios: {
      shadowColor: '#161A18',
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
    },
    android: {
      elevation: 3,
    },
    default: {},
  }),
} as const;

export type AppShadows = typeof shadows;
