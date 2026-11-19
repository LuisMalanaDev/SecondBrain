// ============================================================================
// src/theme/colors.js — OLED Dark (Default) & Clean Monochrome Light Themes
// ============================================================================

import React, { createContext, useContext, useMemo } from 'react';

export const DARK_COLORS = {
  mode: 'dark',
  background: '#000000',
  surface: '#0B0B0D',
  surfaceElevated: '#131316',
  surfaceSubtle: '#1A1A1E',
  border: '#222226',
  borderHover: '#33333A',
  borderLight: '#2C2C32',
  textPrimary: '#EDEDED',
  textSecondary: '#9A9AA2',
  textMuted: '#63636B',
  accent: '#FFFFFF',
  accentSubtle: '#27272D',
  solidBtnBg: '#FFFFFF',
  solidBtnText: '#000000',
  backdrop: 'rgba(0,0,0,0.84)',
  success: '#30A46C',
  warning: '#F5A623',
  danger: '#E5484D',
  badgeBg: '#161619',
  badgeText: '#A1A1AA',
  switchTrackFalse: '#222226',
  switchTrackTrue: '#FFFFFF',
  switchThumbFalse: '#8E8E93',
  switchThumbTrue: '#000000'
};

export const LIGHT_COLORS = {
  mode: 'light',
  background: '#F5F5F7',
  surface: '#FFFFFF',
  surfaceElevated: '#EFEFF4',
  surfaceSubtle: '#E5E5EA',
  border: '#E4E4E7',
  borderHover: '#C7C7CC',
  borderLight: '#D1D1D6',
  textPrimary: '#111113',
  textSecondary: '#52525B',
  textMuted: '#8E8E93',
  accent: '#111113',
  accentSubtle: '#E5E5EA',
  solidBtnBg: '#111113',
  solidBtnText: '#FFFFFF',
  backdrop: 'rgba(0,0,0,0.42)',
  success: '#18794E',
  warning: '#D97706',
  danger: '#CD2B31',
  badgeBg: '#EFEFF4',
  badgeText: '#52525B',
  switchTrackFalse: '#D1D1D6',
  switchTrackTrue: '#111113',
  switchThumbFalse: '#FFFFFF',
  switchThumbTrue: '#FFFFFF'
};

// Default fallback export
export const COLORS = DARK_COLORS;

const ThemeContext = createContext({
  colors: DARK_COLORS,
  isDark: true,
  themeMode: 'dark'
});

export function ThemeProvider({ mode = 'dark', children }) {
  const value = useMemo(() => {
    const isDark = mode !== 'light';
    return {
      colors: isDark ? DARK_COLORS : LIGHT_COLORS,
      isDark,
      themeMode: isDark ? 'dark' : 'light'
    };
  }, [mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export const VAULT_SECTIONS = [
  { id: 'HOME', label: 'Home', description: 'App guide & global search', icon: 'home' },
  { id: 'EXPENSES', label: 'Expenses', description: 'Cash on hand & daily spending', icon: 'credit-card' },
  { id: 'ANALYTICS', label: 'Analytics', description: 'Cash flow & spending insights', icon: 'bar-chart-2' },
  { id: 'CALENDAR', label: 'Calendar', description: 'Birthdays, anniversaries & countdowns', icon: 'calendar' },
  { id: 'NOTE', label: 'Notes', description: 'Private notes & photos', icon: 'file-text' },
  { id: 'VOICE', label: 'Voice', description: 'Offline voice memos', icon: 'mic' },
  { id: 'PASSWORD', label: 'Passwords', description: 'PIN-locked credentials', icon: 'lock' },
  { id: 'CHECKLIST', label: 'Tasks', description: 'Interactive checklists', icon: 'check-square' },
  { id: 'LINK', label: 'Links', description: 'Saved videos & bookmarks', icon: 'link-2' },
  { id: 'PINNED', label: 'Pinned', description: 'Bookmarked vault items', icon: 'bookmark' }
];
