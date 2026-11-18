// ============================================================================
// src/theme/colors.js — Modern Minimalist Monochrome Theme
// ============================================================================

export const COLORS = {
  background: '#000000',
  surface: '#0B0B0D',
  surfaceElevated: '#131316',
  surfaceSubtle: '#1A1A1E',
  border: '#222226',
  borderHover: '#33333A',
  borderLight: '#2C2C32',
  textPrimary: '#EDEDED',
  textSecondary: '#9A9AA2',
  textMuted: '#585860',
  accent: '#FFFFFF',
  accentSubtle: '#27272D',
  // Restrained semantic accents (used sparingly)
  success: '#30A46C',
  danger: '#E5484D',
  badgeBg: '#161619',
  badgeText: '#A1A1AA',
  // Monochrome compatibility aliases
  accentPrimary: '#FFFFFF',
  note: '#EDEDED',
  voice: '#EDEDED',
  password: '#EDEDED',
  checklist: '#30A46C',
  link: '#EDEDED'
};

export const VAULT_CATEGORIES = [
  { id: 'ALL', label: 'All' },
  { id: 'NOTE', label: 'Notes' },
  { id: 'VOICE', label: 'Voice' },
  { id: 'PASSWORD', label: 'Passwords' },
  { id: 'CHECKLIST', label: 'Tasks' },
  { id: 'LINK', label: 'Links' },
  { id: 'PINNED', label: 'Pinned' }
];

export const DEFAULT_TAGS = ['#personal', '#work', '#ideas', '#watchlater', '#passwords'];
