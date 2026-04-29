export const tokens = {
  light: {
    primary: '#3A86FF',
    primaryHover: '#2A6FD6',
    secondary: '#2EC4B6',

    background: '#F7F9FB',
    surface: '#FFFFFF',
    surfaceAlt: '#EEF3F8',

    textPrimary: '#1F2937',
    textSecondary: '#6B7280',

    border: '#E5E7EB',

    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3A86FF',
  },
  dark: {
    primary: '#60A5FA',
    primaryHover: '#3B82F6',
    secondary: '#2DD4BF',

    background: '#0F172A',
    surface: '#1E293B',
    surfaceAlt: '#334155',

    textPrimary: '#E5E7EB',
    textSecondary: '#9CA3AF',

    border: '#334155',

    success: '#4ADE80',
    warning: '#FBBF24',
    error: '#F87171',
    info: '#60A5FA',
  },
} as const;

export type TokenKey = keyof typeof tokens.light;
