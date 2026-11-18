// ============================================================================
// src/utils/helpers.js — IDs, timestamps, password generator, haptics & filters
// ============================================================================

import * as Haptics from 'expo-haptics';

export function makeId(prefix = 'item') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Today • ${time}`;
  return `${d.toLocaleDateString()} • ${time}`;
}

export function formatDuration(ms = 0) {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function extractDomain(url = '') {
  if (!url) return '';
  try {
    const clean = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const host = new URL(clean).hostname.replace(/^www\./i, '');
    return host;
  } catch (e) {
    return url.replace(/^https?:\/\/(www\.)?/i, '').split('/')[0];
  }
}

export function isLikelyUrl(text = '') {
  const trimmed = text.trim();
  return /^https?:\/\/[^\s]+$/i.test(trimmed);
}

export function hapticTap(level = 'light') {
  try {
    const style =
      level === 'medium'
        ? Haptics.ImpactFeedbackStyle.Medium
        : level === 'heavy'
        ? Haptics.ImpactFeedbackStyle.Heavy
        : Haptics.ImpactFeedbackStyle.Light;
    Haptics.impactAsync(style).catch(() => {});
  } catch (e) {}
}

export function hapticNotify(kind = 'success') {
  try {
    const type =
      kind === 'error'
        ? Haptics.NotificationFeedbackType.Error
        : kind === 'warning'
        ? Haptics.NotificationFeedbackType.Warning
        : Haptics.NotificationFeedbackType.Success;
    Haptics.notificationAsync(type).catch(() => {});
  } catch (e) {}
}

const CHARSETS = {
  lower: 'abcdefghijkmnopqrstuvwxyz',
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  digits: '23456789',
  symbols: '!@#$%^&*-_=+?'
};

export function generatePassword(length = 16) {
  const all = CHARSETS.lower + CHARSETS.upper + CHARSETS.digits + CHARSETS.symbols;
  const pick = (set) => set[Math.floor(Math.random() * set.length)];
  const chars = [
    pick(CHARSETS.lower),
    pick(CHARSETS.upper),
    pick(CHARSETS.digits),
    pick(CHARSETS.symbols)
  ];
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export function passwordStrength(pw = '') {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 2) return { label: 'Weak', color: '#8E8E93', pct: 33 };
  if (score <= 3) return { label: 'Good', color: '#D4D4D8', pct: 66 };
  return { label: 'Strong', color: '#FFFFFF', pct: 100 };
}

export function normalizeTag(raw = '') {
  const t = raw.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^#a-z0-9_-]/g, '');
  if (!t || t === '#') return '';
  return t.startsWith('#') ? t : `#${t}`;
}

export function filterItems(items, { query = '', category = 'ALL', tag = null }) {
  const q = query.trim().toLowerCase();
  return items
    .filter((it) => {
      if (category === 'PINNED' && !it.isPinned) return false;
      if (category !== 'ALL' && category !== 'PINNED' && it.type !== category) return false;
      if (tag && !(it.tags || []).includes(tag)) return false;
      if (!q) return true;
      const hay = [
        it.title,
        it.isLocked ? '' : it.content,
        it.username,
        it.websiteUrl,
        ...(it.tags || []),
        ...(it.checklist || []).map((c) => c.text)
      ]
        .join(' ')
        .toLowerCase();
      return q.split(/\s+/).every((w) => hay.includes(w));
    })
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    });
}

export function computeStats(items) {
  let tasksTotal = 0;
  let tasksDone = 0;
  items.forEach((it) => {
    (it.checklist || []).forEach((c) => {
      tasksTotal++;
      if (c.done) tasksDone++;
    });
  });
  return {
    total: items.length,
    pinned: items.filter((i) => i.isPinned).length,
    voiceMemos: items.filter((i) => i.type === 'VOICE').length,
    passwords: items.filter((i) => i.type === 'PASSWORD').length,
    links: items.filter((i) => i.type === 'LINK').length,
    tasksTotal,
    tasksDone
  };
}

export function isValidBackup(parsed) {
  return (
    parsed &&
    typeof parsed === 'object' &&
    Array.isArray(parsed.items) &&
    parsed.items.every((i) => i && typeof i.id === 'string' && typeof i.type === 'string')
  );
}
