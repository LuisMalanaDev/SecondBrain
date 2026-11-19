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
      } else if (
        category !== 'HOME' &&
        category !== 'EXPENSES' &&
        category !== 'ANALYTICS' &&
        category !== 'CALENDAR'
      ) {
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

// ============================================================================
// Calendar, Milestones & Countdown Calculations
// ============================================================================

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export function daysInMonth(year, month1To12) {
  return new Date(year, month1To12, 0).getDate();
}

export function ordinalSuffix(n) {
  const num = Math.abs(Math.trunc(Number(n) || 0));
  const mod100 = num % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${num}th`;
  const mod10 = num % 10;
  if (mod10 === 1) return `${num}st`;
  if (mod10 === 2) return `${num}nd`;
  if (mod10 === 3) return `${num}rd`;
  return `${num}th`;
}

export function diffYMD(startDate, endDate) {
  const s = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const e = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  if (e < s) return { years: 0, months: 0, days: 0, totalDays: 0, isFuture: true };

  let years = e.getFullYear() - s.getFullYear();
  let months = e.getMonth() - s.getMonth();
  let days = e.getDate() - s.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonthLastDay = new Date(e.getFullYear(), e.getMonth(), 0).getDate();
    days += prevMonthLastDay;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const totalDays = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return { years, months, days, totalDays, isFuture: false };
}

export function formatYMDParts({ years = 0, months = 0, days = 0 }, includeDays = true) {
  const parts = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'year' : 'years'}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? 'month' : 'months'}`);
  if (includeDays && (days > 0 || parts.length === 0)) {
    parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
  }
  if (parts.length === 0) return 'Today';
  return parts.join(', ');
}

export function formatEventDateLabel(event) {
  if (!event) return '';
  const m = Number(event.month);
  const d = Number(event.day);
  const y = Number(event.year);

  if (event.type === 'MONTHSARY' && (!m || !y) && d) {
    return `Every ${ordinalSuffix(d)} of the month`;
  }
  if (m && d && y) {
    return `${MONTH_SHORT[m - 1]} ${d}, ${y}`;
  }
  if (m && y && !d) {
    return `${MONTH_NAMES[m - 1]} ${y}`;
  }
  if (m && d && !y) {
    return `${MONTH_SHORT[m - 1]} ${d}`;
  }
  if (d) {
    return `Day ${d}`;
  }
  return '';
}

export function getNextOccurrence(event, refDate = new Date()) {
  if (!event) return null;
  const today = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  const ty = today.getFullYear();
  const tm = today.getMonth() + 1;
  const td = today.getDate();

  const evType = event.type || 'IMPORTANT';
  const m = Number(event.month) || null;
  const d = Number(event.day) || null;
  const y = Number(event.year) || null;

  if (evType === 'MONTHSARY') {
    const targetDay = d || 1;
    const clampedThis = Math.min(targetDay, daysInMonth(ty, tm));
    let cand = new Date(ty, tm - 1, clampedThis);
    if (cand < today) {
      const nextM = tm === 12 ? 1 : tm + 1;
      const nextY = tm === 12 ? ty + 1 : ty;
      cand = new Date(nextY, nextM - 1, Math.min(targetDay, daysInMonth(nextY, nextM)));
    }
    const daysUntil = Math.round((cand.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return { date: cand, daysUntil };
  }

  // Repeats yearly: Birthday, Anniversary, or Important with repeatYearly
  const repeatsYearly =
    evType === 'BIRTHDAY' || evType === 'ANNIVERSARY' || Boolean(event.repeatYearly);

  if (repeatsYearly && m) {
    const targetDay = d || 1;
    let cand = new Date(ty, m - 1, Math.min(targetDay, daysInMonth(ty, m)));
    if (cand < today) {
      cand = new Date(ty + 1, m - 1, Math.min(targetDay, daysInMonth(ty + 1, m)));
    }
    const daysUntil = Math.round((cand.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return { date: cand, daysUntil };
  }

  // Non-repeating Important Date
  if (y && m && d) {
    const exact = new Date(y, m - 1, Math.min(d, daysInMonth(y, m)));
    const daysUntil = Math.round((exact.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil >= 0) return { date: exact, daysUntil };
  }

  return null;
}

export function computeEventStats(event, refDate = new Date()) {
  const today = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  const evType = event.type || 'IMPORTANT';
  const y = Number(event.year) || null;
  const m = Number(event.month) || null;
  const d = Number(event.day) || null;

  const next = getNextOccurrence(event, today);
  const daysUntil = next ? next.daysUntil : null;

  let countdownLabel = '';
  if (daysUntil === 0) countdownLabel = 'Today!';
  else if (daysUntil === 1) countdownLabel = 'Tomorrow';
  else if (daysUntil !== null && daysUntil > 1) countdownLabel = `In ${daysUntil} days`;

  let primaryHeadline = '';
  let secondaryDetail = '';

  if (evType === 'BIRTHDAY') {
    if (y && m) {
      const birthDay = d || 1;
      const birthDate = new Date(y, m - 1, Math.min(birthDay, daysInMonth(y, m)));
      if (birthDate <= today) {
        const diff = diffYMD(birthDate, today);
        primaryHeadline = `${formatYMDParts(diff, Boolean(d))} old`;
        if (next) {
          const nextAge = next.date.getFullYear() - y;
          secondaryDetail = d
            ? `${countdownLabel} • Turning ${nextAge} (${MONTH_SHORT[next.date.getMonth()]} ${next.date.getDate()})`
            : `Born ${MONTH_NAMES[m - 1]} ${y} • Turning ${nextAge} this ${MONTH_NAMES[m - 1]}`;
        }
      } else {
        primaryHeadline = 'Upcoming birth date';
      }
    } else if (m && d) {
      primaryHeadline = `Every ${MONTH_SHORT[m - 1]} ${d}`;
      secondaryDetail = countdownLabel;
    }
  } else if (evType === 'ANNIVERSARY') {
    if (y && m) {
      const startDay = d || 1;
      const startDate = new Date(y, m - 1, Math.min(startDay, daysInMonth(y, m)));
      if (startDate <= today) {
        const diff = diffYMD(startDate, today);
        const totalMonths = diff.years * 12 + diff.months;
        primaryHeadline = `${formatYMDParts(diff, Boolean(d))} together`;
        const nextYears = next ? next.date.getFullYear() - y : diff.years + 1;
        secondaryDetail = `${diff.totalDays.toLocaleString()} days (${totalMonths} mos) • Next: ${ordinalSuffix(
          nextYears
        )} (${countdownLabel || formatEventDateLabel(event)})`;
      } else {
        primaryHeadline = countdownLabel || 'Upcoming';
      }
    } else if (m && d) {
      primaryHeadline = `Every ${MONTH_SHORT[m - 1]} ${d}`;
      secondaryDetail = countdownLabel;
    }
  } else if (evType === 'MONTHSARY') {
    if (y && m) {
      const startDay = d || 1;
      const startDate = new Date(y, m - 1, Math.min(startDay, daysInMonth(y, m)));
      if (startDate <= today) {
        const diff = diffYMD(startDate, today);
        const totalMonths = diff.years * 12 + diff.months;
        primaryHeadline = `${totalMonths} ${totalMonths === 1 ? 'month' : 'months'}${
          diff.days > 0 ? `, ${diff.days} ${diff.days === 1 ? 'day' : 'days'}` : ''
        } together`;
        secondaryDetail = `${ordinalSuffix(totalMonths + (daysUntil === 0 ? 0 : 1))} Monthsary • ${countdownLabel}`;
      } else {
        primaryHeadline = countdownLabel || 'Upcoming Monthsary';
      }
    } else {
      primaryHeadline = `Every ${ordinalSuffix(d || 1)} of the month`;
      secondaryDetail = countdownLabel ? `Next Monthsary: ${countdownLabel}` : '';
    }
  } else {
    // IMPORTANT
    if (y && m && d) {
      const target = new Date(y, m - 1, Math.min(d, daysInMonth(y, m)));
      if (target > today) {
        const diff = diffYMD(today, target);
        primaryHeadline = countdownLabel || `In ${diff.totalDays} days`;
        secondaryDetail = diff.months > 0 || diff.years > 0 ? formatYMDParts(diff, true) : formatEventDateLabel(event);
      } else if (target.getTime() === today.getTime()) {
        primaryHeadline = 'Today!';
        secondaryDetail = formatEventDateLabel(event);
      } else {
        const diff = diffYMD(target, today);
        primaryHeadline = `${formatYMDParts(diff, true)} ago`;
        secondaryDetail = event.repeatYearly && countdownLabel ? `Repeats yearly • ${countdownLabel}` : formatEventDateLabel(event);
      }
    } else if (m && d) {
      primaryHeadline = countdownLabel || `${MONTH_SHORT[m - 1]} ${d}`;
    }
  }

  return {
    daysUntil,
    nextDate: next?.date || null,
    countdownLabel,
    primaryHeadline,
    secondaryDetail,
    isDueSoon: daysUntil !== null && daysUntil <= 7
  };
}

export function eventOccursOnDay(event, year, month1To12, day) {
  if (!event) return false;
  const evType = event.type || 'IMPORTANT';
  const em = Number(event.month) || null;
  const ed = Number(event.day) || null;
  const ey = Number(event.year) || null;

  if (evType === 'MONTHSARY') {
    const targetDay = ed || 1;
    const clamped = Math.min(targetDay, daysInMonth(year, month1To12));
    if (ey && em && (year < ey || (year === ey && month1To12 < em))) return false;
    return day === clamped;
  }

  if (!em || em !== month1To12) return false;
  const targetDay = ed || 1;
  const clamped = Math.min(targetDay, daysInMonth(year, month1To12));
  if (evType === 'BIRTHDAY' || evType === 'ANNIVERSARY' || event.repeatYearly) {
    return day === clamped;
  }
  return ey === year && day === clamped;
}
