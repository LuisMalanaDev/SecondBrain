// ============================================================================
// src/utils/helpers.js — IDs, currency, dates, sharing, haptics & filters
// ============================================================================

import * as Haptics from 'expo-haptics';

export function makeId(prefix = 'item') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function toLocalDateKey(input = new Date()) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return toLocalDateKey(new Date());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function dateKeyToIso(dateKey) {
  const [y, m, d] = (dateKey || '').split('-').map(Number);
  if (!y || !m || !d) return nowIso();
  const now = new Date();
  const target = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
  return target.toISOString();
}

export function addDaysToDateKey(dateKey, delta) {
  const [y, m, d] = (dateKey || '').split('-').map(Number);
  const base = y && m && d ? new Date(y, m - 1, d) : new Date();
  base.setDate(base.getDate() + delta);
  return toLocalDateKey(base);
}

export function formatShortDate(input) {
  if (!input) return '';
  const key = /^\d{4}-\d{2}-\d{2}$/.test(String(input)) ? input : toLocalDateKey(input);
  const todayKey = toLocalDateKey(new Date());
  const yestKey = addDaysToDateKey(todayKey, -1);
  if (key === todayKey) return 'Today';
  if (key === yestKey) return 'Yesterday';
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Today • ${time}`;
  return `${formatShortDate(d)} • ${time}`;
}

export function formatDuration(ms = 0) {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function formatPeso(num = 0) {
  const n = Number(num) || 0;
  const abs = Math.abs(n);
  const hasDecimals = Math.round(abs * 100) % 100 !== 0;
  const fixed = hasDecimals ? abs.toFixed(2) : Math.round(abs).toString();
  const [intPart, decPart] = fixed.split('.');
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${n < 0 ? '-' : ''}₱${withCommas}${decPart ? `.${decPart}` : ''}`;
}

export function extractDomain(url = '') {
  if (!url) return '';
  try {
    const clean = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(clean).hostname.replace(/^www\./i, '');
  } catch (e) {
    return url.replace(/^https?:\/\/(www\.)?/i, '').split('/')[0];
  }
}

export function isLikelyUrl(text = '') {
  const trimmed = text.trim();
  return /^https?:\/\/[^\s]+$/i.test(trimmed);
}

export function formatShareText(item) {
  if (!item) return '';
  if (item.type === 'CHECKLIST') {
    const list = item.checklist || [];
    const done = list.filter((c) => c.done).length;
    const lines = list.map((c) => `${c.done ? '[✓]' : '[ ]'} ${c.text}`).join('\n');
    const note = item.content ? `\n\n${item.content}` : '';
    return `${item.title} (${done}/${list.length})\n\n${lines}${note}`.trim();
  }
  if (item.type === 'LINK') {
    const parts = [item.title, item.websiteUrl, item.content].filter(Boolean);
    return parts.join('\n\n');
  }
  return [item.title, item.content].filter(Boolean).join('\n\n');
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

export function passwordStrength(pw = '', colors = null) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 2) return { label: 'Weak', color: colors?.textMuted || '#8E8E93', pct: 33 };
  if (score <= 3) return { label: 'Good', color: colors?.textSecondary || '#9A9AA2', pct: 66 };
  return { label: 'Strong', color: colors?.textPrimary || '#FFFFFF', pct: 100 };
}

export function filterItems(items, { query = '', category = 'NOTE' }) {
  const q = query.trim().toLowerCase();
  return items
    .filter((it) => {
      if (category === 'PINNED') {
        if (!it.isPinned) return false;
      } else if (category !== 'HOME' && category !== 'EXPENSES' && category !== 'ANALYTICS') {
        if (it.type !== category) return false;
      }
      if (!q) return true;
      const hay = [
        it.title,
        it.isLocked ? '' : it.content,
        it.username,
        it.websiteUrl,
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
    notes: items.filter((i) => i.type === 'NOTE').length,
    voiceMemos: items.filter((i) => i.type === 'VOICE').length,
    passwords: items.filter((i) => i.type === 'PASSWORD').length,
    checklists: items.filter((i) => i.type === 'CHECKLIST').length,
    links: items.filter((i) => i.type === 'LINK').length,
    tasksTotal,
    tasksDone
  };
}

export function computeExpenseStats(expenses = []) {
  let totalCashIn = 0;
  let totalSpent = 0;
  expenses.forEach((e) => {
    const amt = Number(e.amount) || 0;
    if (e.kind === 'CASH_IN') totalCashIn += amt;
    else totalSpent += amt;
  });
  return {
    totalCashIn,
    totalSpent,
    balance: totalCashIn - totalSpent
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
