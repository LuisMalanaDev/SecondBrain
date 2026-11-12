// ============================================================================
// src/utils/helpers.js — IDs, timestamps, password generator, search & stats
// ============================================================================

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

const CHARSETS = {
  lower: 'abcdefghijkmnopqrstuvwxyz',
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  digits: '23456789',
  symbols: '!@#$%^&*-_=+?'
};

export function generatePassword(length = 16) {
  const all = CHARSETS.lower + CHARSETS.upper + CHARSETS.digits + CHARSETS.symbols;
  const pick = (set) => set[Math.floor(Math.random() * set.length)];
  // Guarantee at least one of each character class
  const chars = [
    pick(CHARSETS.lower),
    pick(CHARSETS.upper),
    pick(CHARSETS.digits),
    pick(CHARSETS.symbols)
  ];
  while (chars.length < length) chars.push(pick(all));
  // Fisher-Yates shuffle
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
        it.language,
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
    snippets: items.filter((i) => i.type === 'SNIPPET').length,
    passwords: items.filter((i) => i.type === 'PASSWORD').length,
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
