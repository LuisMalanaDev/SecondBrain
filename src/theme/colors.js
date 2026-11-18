// ============================================================================
// src/theme/colors.js — Modern Minimalist Monochrome Theme & Sections
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
  // Restrained semantic accents
  success: '#30A46C',
  danger: '#E5484D',
  badgeBg: '#161619',
  badgeText: '#A1A1AA',
  accentPrimary: '#FFFFFF',
  note: '#EDEDED',
  voice: '#EDEDED',
  password: '#EDEDED',
  checklist: '#30A46C',
  link: '#EDEDED'
};

export const VAULT_SECTIONS = [
  { id: 'HOME', label: 'Home', description: 'App guide & overview', icon: 'home' },
  { id: 'EXPENSES', label: 'Expenses', description: 'Cash on hand & daily spending', icon: 'credit-card' },
  { id: 'NOTE', label: 'Notes', description: 'Private notes & photos', icon: 'file-text' },
  { id: 'VOICE', label: 'Voice', description: 'Offline voice memos', icon: 'mic' },
  { id: 'PASSWORD', label: 'Passwords', description: 'PIN-locked credentials', icon: 'lock' },
  { id: 'CHECKLIST', label: 'Tasks', description: 'Interactive checklists', icon: 'check-square' },
  { id: 'LINK', label: 'Links', description: 'Saved videos & bookmarks', icon: 'link-2' },
  { id: 'PINNED', label: 'Pinned', description: 'Starred vault items', icon: 'bookmark' }
];
