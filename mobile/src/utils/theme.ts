import { DefaultTheme } from 'react-native-paper';

export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#0ea5e9',
    primaryContainer: '#e0f2fe',
    secondary: '#10b981',
    secondaryContainer: '#d1fae5',
    error: '#ef4444',
    errorContainer: '#fee2e2',
    background: '#f8fafc',
    surface: '#ffffff',
    surfaceVariant: '#f1f5f9',
    onSurface: '#1e293b',
    onSurfaceVariant: '#64748b',
    outline: '#cbd5e1',
  },
  roundness: 12,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const typography = {
  heading1: { fontSize: 28, fontWeight: '700' as const, color: '#0f172a' },
  heading2: { fontSize: 22, fontWeight: '600' as const, color: '#1e293b' },
  heading3: { fontSize: 18, fontWeight: '600' as const, color: '#1e293b' },
  body: { fontSize: 15, color: '#334155' },
  caption: { fontSize: 12, color: '#64748b' },
  label: { fontSize: 13, fontWeight: '500' as const, color: '#475569' },
};
