// ============================================================================
// src/theme/colors.js — Apple Monochrome + Cyber Obsidian Theme
// ============================================================================

export const COLORS = {
  background: '#000000',
  surface: '#0D0D11',
  surfaceElevated: '#15151C',
  border: '#262630',
  borderActive: '#FFFFFF',
  textPrimary: '#FFFFFF',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',
  accentPrimary: '#FFFFFF',
  // Vault Item Type Accents
  note: '#38BDF8',      // Sky Blue for Quick Notes & Ideas
  snippet: '#A855F7',   // Purple for Code Snippets
  password: '#F43F5E',  // Rose Red for Encrypted/PIN Passwords
  checklist: '#10B981', // Emerald for Tasks & Checklists
  link: '#F59E0B',      // Amber for Saved Links & Bookmarks
  voice: '#EC4899'      // Pink for Voice Memo Notes
};

export const VAULT_CATEGORIES = [
  { id: 'ALL', label: '🧠 All Items', color: '#FFFFFF' },
  { id: 'NOTE', label: '💡 Ideas & Notes', color: '#38BDF8' },
  { id: 'SNIPPET', label: '💻 Code Snippets', color: '#A855F7' },
  { id: 'PASSWORD', label: '🔐 Passwords', color: '#F43F5E' },
  { id: 'CHECKLIST', label: '✅ Tasks & Lists', color: '#10B981' },
  { id: 'LINK', label: '🔗 Saved Links', color: '#F59E0B' },
  { id: 'PINNED', label: '📌 Pinned', color: '#FBBF24' }
];

export const DEFAULT_TAGS = [
  '#dev',
  '#ideas',
  '#passwords',
  '#goals',
  '#school',
  '#work',
  '#urgent',
  '#snippets'
];
