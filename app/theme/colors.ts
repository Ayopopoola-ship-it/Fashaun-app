export const colors = {
  background: '#F5F7FA',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF2F7',
  text: '#111827',
  textMuted: '#667085',
  primary: '#1D4ED8',
  border: '#E4E7EC',

  // Extended neutrals for future UI usage.
  neutral950: '#0A0D14',
  neutral900: '#101828',
  neutral700: '#344054',
  neutral500: '#667085',
  neutral300: '#D0D5DD',
  neutral200: '#EAECF0',
  neutral100: '#F2F4F7',
  neutral50: '#F9FAFB',

  success: '#027A48',
  error: '#B42318',
} as const;

export type AppColors = typeof colors;
