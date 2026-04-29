export interface AppTheme {
  id: string;
  name: string;
  color: string;    // primary-600 hex — used for swatches
  sidebar: string;  // sidebar background hex
}

export const THEMES: AppTheme[] = [
  { id: 'sky',     name: 'Ocean',  color: '#0284c7', sidebar: '#0f172a' },
  { id: 'indigo',  name: 'Indigo', color: '#4f46e5', sidebar: '#1e1b4b' },
  { id: 'emerald', name: 'Forest', color: '#059669', sidebar: '#022c22' },
  { id: 'violet',  name: 'Purple', color: '#7c3aed', sidebar: '#2e1065' },
  { id: 'rose',    name: 'Rose',   color: '#e11d48', sidebar: '#4c0519' },
  { id: 'amber',   name: 'Warm',   color: '#d97706', sidebar: '#1c1917' },
];

export const DEFAULT_THEME_ID = 'sky';
