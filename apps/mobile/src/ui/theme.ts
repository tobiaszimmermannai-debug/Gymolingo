/** Gymolingo design tokens – premium dark UI with lime accent. */
import type { TextStyle } from 'react-native';
export const colors = {
  bg: '#0B0C0E',
  bgElevated: '#101215',
  surface: '#15171B',
  surface2: '#1C1F24',
  surface3: '#252930',
  border: '#2A2E35',
  borderStrong: '#3A3F48',
  text: '#F4F5F7',
  textSecondary: '#A6ACB5',
  textMuted: '#6E7580',
  accent: '#C6F432',
  accentPressed: '#B2DD24',
  accentSoft: 'rgba(198, 244, 50, 0.14)',
  accentSofter: 'rgba(198, 244, 50, 0.07)',
  onAccent: '#0B0C0E',
  protein: '#C6F432',
  carbs: '#F5B83D',
  fat: '#FF7A59',
  fiber: '#8B9DFF',
  kcal: '#F4F5F7',
  steps: '#5AC8FA',
  weight: '#B79CFF',
  success: '#4ADE80',
  warning: '#F5B83D',
  danger: '#FF5C5C',
  dangerSoft: 'rgba(255, 92, 92, 0.12)',
  info: '#5AC8FA',
  overlay: 'rgba(0, 0, 0, 0.6)',
} as const;

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 22, xxl: 28, pill: 999 } as const;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  heavy: 'Inter_800ExtraBold',
} as const;

const typeDefs = {
  display: { fontFamily: fonts.heavy, fontSize: 34, lineHeight: 40, letterSpacing: -0.8 },
  h1: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 32, letterSpacing: -0.5 },
  h2: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  h3: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, letterSpacing: -0.1 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  bodyMedium: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21 },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  smallMedium: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.6, textTransform: 'uppercase' as const },
  number: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 26, letterSpacing: -0.4, fontVariant: ['tabular-nums' as const] },
  numberLarge: { fontFamily: fonts.heavy, fontSize: 40, lineHeight: 44, letterSpacing: -1.2, fontVariant: ['tabular-nums' as const] },
} as const;

export type TypeVariant = keyof typeof typeDefs;
export const type = typeDefs as unknown as Record<TypeVariant, TextStyle>;
export const MAX_CONTENT_WIDTH = 560;
