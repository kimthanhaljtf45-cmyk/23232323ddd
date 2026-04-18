// ATAKA Color Theme
export const colors = {
  // Brand
  primary: '#DC2626', // Red 600
  primaryLight: '#EF4444', // Red 500
  primaryDark: '#B91C1C', // Red 700
  
  // Backgrounds
  background: '#FFFFFF',
  backgroundSecondary: '#F9FAFB', // Gray 50
  backgroundTertiary: '#F3F4F6', // Gray 100
  
  // Text
  text: '#111827', // Gray 900
  textSecondary: '#6B7280', // Gray 500
  textTertiary: '#9CA3AF', // Gray 400
  textInverse: '#FFFFFF',
  
  // Borders
  border: '#E5E7EB', // Gray 200
  borderLight: '#F3F4F6', // Gray 100
  
  // Status
  success: '#10B981', // Emerald 500
  successLight: '#D1FAE5', // Emerald 100
  warning: '#F59E0B', // Amber 500
  warningLight: '#FEF3C7', // Amber 100
  error: '#EF4444', // Red 500
  errorLight: '#FEE2E2', // Red 100
  info: '#3B82F6', // Blue 500
  infoLight: '#DBEAFE', // Blue 100
  
  // Discipline colors
  disciplineHigh: '#10B981',
  disciplineMedium: '#F59E0B',
  disciplineLow: '#EF4444',
  
  // Misc
  overlay: 'rgba(0, 0, 0, 0.5)',
  shadow: 'rgba(0, 0, 0, 0.1)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
};

export const fontSizes = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
};

export const fontWeights = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  full: 9999,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
};

// Typography presets
export const typography = {
  h1: {
    fontSize: fontSizes['4xl'],
    fontWeight: fontWeights.bold,
    lineHeight: 44,
  },
  h2: {
    fontSize: fontSizes['2xl'],
    fontWeight: fontWeights.bold,
    lineHeight: 32,
  },
  h3: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.semibold,
    lineHeight: 28,
  },
  subtitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    lineHeight: 24,
  },
  body: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.normal,
    lineHeight: 22,
  },
  bodySmall: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.normal,
    lineHeight: 20,
  },
  caption: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.normal,
    lineHeight: 16,
  },
  button: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
    lineHeight: 22,
  },
};
