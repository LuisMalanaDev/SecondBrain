// ============================================================================
// src/theme/colors.js — OLED Dark (Default) & Clean Monochrome Light Themes
// ============================================================================

import React, { createContext, useContext, useMemo } from 'react';

export const DARK_COLORS = {
  mode: 'dark',
  background: '#070709',
  surface: '#111116',
  surfaceElevated: '#1A1A21',
  surfaceSubtle: '#22222B',
  border: '#25252E',
  borderHover: '#383846',
  borderLight: '#30303C',
  textPrimary: '#F2F2F5',
  textSecondary: '#A1A1AA',
  textMuted: '#6D6D76',
  accent: '#FFFFFF',
  accentSubtle: '#272730',
  solidBtnBg: '#F4F4F6',
  solidBtnText: '#09090B',
  backdrop: 'rgba(0,0,0,0.84)',
  success: '#30A46C',
  warning: '#F5A623',
  danger: '#E5484D',
  activeTabBg: 'rgba(255, 255, 255, 0.09)',
  warningTint: 'rgba(245, 166, 35, 0.11)',
  warningBorder: 'rgba(245, 166, 35, 0.40)',
  successTint: 'rgba(48, 164, 108, 0.13)',
  badgeBg: '#191920',
  badgeText: '#A1A1AA',
  switchTrackFalse: '#25252E',
  switchTrackTrue: '#FFFFFF',
  switchThumbFalse: '#8E8E93',
  switchThumbTrue: '#000000'
};

export const LIGHT_COLORS = {
  mode: 'light',
  background: '#F4F4F6',
  surface: '#FFFFFF',
  surfaceElevated: '#EBEBEF',
  surfaceSubtle: '#E1E1E7',
  border: '#E2E2E8',
  borderHover: '#C7C7D1',
  borderLight: '#D4D4DC',
  textPrimary: '#111113',
  textSecondary: '#52525B',
  textMuted: '#868690',
  accent: '#111113',
  accentSubtle: '#E5E5EA',
  solidBtnBg: '#111113',
  solidBtnText: '#FFFFFF',
  backdrop: 'rgba(0,0,0,0.42)',
  success: '#18794E',
  warning: '#D97706',
  danger: '#CD2B31',
  activeTabBg: 'rgba(17, 17, 19, 0.07)',
  warningTint: 'rgba(217, 119, 6, 0.09)',
  warningBorder: 'rgba(217, 119, 6, 0.36)',
  successTint: 'rgba(24, 121, 78, 0.10)',
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
