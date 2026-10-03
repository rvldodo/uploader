import { useColorScheme } from 'react-native'

/**
 * Design tokens mirroring the web app (apps/web/src/styles/app.css), so both
 * clients feel like one product. Components use `useTheme()`, never raw colors.
 */
const light = {
  bg: '#F7F8FA',
  surface: '#FFFFFF',
  surface2: '#F0F1F4',
  border: '#E3E5EA',
  fg: '#1A1D24',
  fgMuted: '#62677A',
  fgSubtle: '#9599A8',
  accent: '#4F46E5',
  accentFg: '#FFFFFF',
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
}

const dark: typeof light = {
  bg: '#121318',
  surface: '#1A1C22',
  surface2: '#24262E',
  border: '#2E3039',
  fg: '#F0F1F4',
  fgMuted: '#A6AAB8',
  fgSubtle: '#737786',
  accent: '#7C75F0',
  accentFg: '#FFFFFF',
  success: '#34C26A',
  warning: '#F0A43A',
  danger: '#F06262',
}

export type ThemeColors = typeof light

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const
export const radius = { sm: 8, md: 12, lg: 16, full: 999 } as const

export function useTheme() {
  const scheme = useColorScheme()
  return { colors: scheme === 'dark' ? dark : light, isDark: scheme === 'dark' }
}
