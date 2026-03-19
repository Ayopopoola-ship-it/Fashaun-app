export const colors = {
  background: '#FAF9F7',
  surface: '#FFFFFF',
  surfaceMuted: '#F3F4F1',
  text: '#1F2321',
  textMuted: '#6C716D',
  primary: '#2F3331',
  border: '#E5E4E0',
  accent: '#6C5C4D',
  accentSoft: '#EFEAE4',

  // Extended neutrals for future UI usage.
  neutral950: '#171A18',
  neutral900: '#232826',
  neutral700: '#4A504D',
  neutral500: '#767C79',
  neutral300: '#BCC0BD',
  neutral200: '#DADDD9',
  neutral100: '#F0F1EE',
  neutral50: '#F8F7F4',

  success: '#3A5A40',
  error: '#9A3B33',
} as const;

export type AppColors = typeof colors;
