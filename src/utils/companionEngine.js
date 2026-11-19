// ============================================================================
// src/utils/companionEngine.js
// Computes Monochrome Companion (Focus Orb / Vault Tree) Progression from All Sections
// ============================================================================

import { computeExpenseStats, computeEventStats, toLocalDateKey, addDaysToDateKey } from './helpers';

export const DEFAULT_COMPANION_STATE = {
  form: 'ORB', // 'ORB' | 'TREE'
  streak: 0,
  bestStreak: 0,
  lastCheckInKey: null,
  checkInCount: 0,
  bonusXp: 0
};

const LEVEL_THRESHOLDS = [
  { level: 1, minXp: 0, title: 'Quiet Spark' },
  { level: 2, minXp: 80, title: 'Steadfast Core' },
  { level: 3, minXp: 200, title: 'Balanced Orbit' },
  { level: 4, minXp: 380, title: 'Living Sanctuary' },
  { level: 5, minXp: 620, title: 'Radiant Vault' },
  { level: 6, minXp: 950, title: 'Sovereign Mind' }
];

export function computeCompanionProgress({
  items = [],
  expenses = [],
  events = [],
  hasPin = false,
  companionState = DEFAULT_COMPANION_STATE,
  now = new Date()
}) {
  const safeState = { ...DEFAULT_COMPANION_STATE, ...(companionState || {}) };
  const todayKey = toLocalDateKey(now);
  const yesterdayKey = addDaysToDateKey(todayKey, -1);

  const notes = items.filter((i) => i.type === 'NOTE');
  const voiceMemos = items.filter((i) => i.type === 'VOICE');
  const passwords = items.filter((i) => i.type === 'PASSWORD');
  const checklists = items.filter((i) => i.type === 'CHECKLIST');
  const links = items.filter((i) => i.type === 'LINK');
  const pinned = items.filter((i) => i.isPinned);

  const photoCount = items.reduce(
    (acc, i) => acc + (Array.isArray(i.attachments) ? i.attachments.length : 0),
    0
  );

  let totalTasks = 0;
  let doneTasks = 0;
  for (const list of checklists) {
    const ch = Array.isArray(list.checklist) ? list.checklist : [];
    totalTasks += ch.length;
    doneTasks += ch.filter((t) => t.done).length;
  }

  const expenseStats = computeExpenseStats(expenses);
  const todayEvents = events.filter((ev) => computeEventStats(ev, now).daysUntil === 0);
  const hasTodayCelebration = todayEvents.length > 0;

  // Compute XP per Vault Section
  const expensesXp =
    expenses.length * 12 + (expenses.length > 0 && expenseStats.balance > 0 ? 15 : 0);
  const calendarBaseXp = events.length * 25 + (hasTodayCelebration ? 35 : 0);
  const tasksXp = doneTasks * 12 + checklists.length * 6;
  const notesXp = notes.length * 15 + photoCount * 10;
  const voiceXp = voiceMemos.length * 18;
  const passwordsXp = passwords.length * 20 + (hasPin ? 25 : 0);
  const linksXp = links.length * 12;
  const pinnedXp = pinned.length * 10;
  const dailyXp = Number(safeState.bonusXp || 0);

  const rawXp =
    expensesXp +
    calendarBaseXp +
    tasksXp +
    notesXp +
    voiceXp +
    passwordsXp +
    linksXp +
    pinnedXp +
    dailyXp;

  // 2x Celebration Multiplier on special Birthdays, Monthsaries, or Anniversaries!
  const celebrationMultiplier = hasTodayCelebration ? 2 : 1;
  const totalXp = hasTodayCelebration ? Math.round(rawXp * 1.25) + 25 : rawXp;

  // Determine Current Level & Progress to Next
  let currentRank = LEVEL_THRESHOLDS[0];
  let nextRank = LEVEL_THRESHOLDS[1];
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (totalXp >= LEVEL_THRESHOLDS[i].minXp) {
      currentRank = LEVEL_THRESHOLDS[i];
      nextRank = LEVEL_THRESHOLDS[i + 1] || null;
    }
  }

  const levelFloor = currentRank.minXp;
  const levelCeil = nextRank ? nextRank.minXp : currentRank.minXp + 300;
  const levelSpan = Math.max(1, levelCeil - levelFloor);
  const levelProgressPct = nextRank
    ? Math.max(0, Math.min(100, Math.round(((totalXp - levelFloor) / levelSpan) * 100)))
    : 100;

  // Active streak calculation
  const checkedInToday = safeState.lastCheckInKey === todayKey;
  const displayStreak =
    checkedInToday || safeState.lastCheckInKey === yesterdayKey ? safeState.streak : 0;

  // Section contributions list (connects ALL 8 data sections directly)
  const sources = [
    {
      id: 'EXPENSES',
      label: 'Expenses & Cash',
      icon: 'credit-card',
      xp: expensesXp,
      detail:
        expenses.length > 0
          ? `${expenses.length} entries${expenseStats.balance > 0 ? ' • +Cash' : ''}`
          : 'Log cash or expense'
    },
    {
      id: 'CALENDAR',
      label: 'Calendar & Milestones',
      icon: 'calendar',
      xp: calendarBaseXp,
      detail:
        events.length > 0
          ? `${events.length} dates${hasTodayCelebration ? ' • Today 2x!' : ''}`
          : 'Add birthday or monthsary'
    },
    {
      id: 'CHECKLIST',
      label: 'Tasks & Checklists',
      icon: 'check-square',
      xp: tasksXp,
      detail:
        totalTasks > 0
          ? `${doneTasks}/${totalTasks} completed`
          : 'Create & check off tasks'
    },
    {
      id: 'NOTE',
      label: 'Notes & Photos',
      icon: 'file-text',
      xp: notesXp,
      detail:
        notes.length > 0 || photoCount > 0
          ? `${notes.length} notes • ${photoCount} photos`
          : 'Write a private note'
    },
    {
      id: 'VOICE',
      label: 'Voice Memos',
      icon: 'mic',
      xp: voiceXp,
      detail: voiceMemos.length > 0 ? `${voiceMemos.length} recorded` : 'Record a voice memo'
    },
    {
      id: 'PASSWORD',
      label: 'Password Vault',
      icon: 'lock',
      xp: passwordsXp,
      detail:
        passwords.length > 0 || hasPin
          ? `${passwords.length} saved${hasPin ? ' • PIN On' : ''}`
          : 'Secure a login or set PIN'
    },
    {
      id: 'LINK',
      label: 'Saved Links',
      icon: 'link-2',
      xp: linksXp,
      detail: links.length > 0 ? `${links.length} bookmarked` : 'Save a video or link'
    },
    {
      id: 'PINNED',
      label: 'Pinned Memories',
      icon: 'bookmark',
      xp: pinnedXp,
      detail: pinned.length > 0 ? `${pinned.length} pinned` : 'Star any important item'
    }
  ];

  const activeSectionsCount = sources.filter((s) => s.xp > 0).length;

  const badges = [
    {
      id: 'spark',
      label: 'First Spark',
      icon: 'zap',
      unlocked: rawXp > 0
    },
    {
      id: 'keeper',
      label: 'Date Keeper',
      icon: 'calendar',
      unlocked: events.length > 0
    },
    {
      id: 'budget',
      label: 'Budget Tracker',
      icon: 'credit-card',
      unlocked: expenses.length >= 3
    },
    {
      id: 'finisher',
      label: 'Task Finisher',
      icon: 'check-square',
      unlocked: doneTasks >= 3
    },
    {
      id: 'shield',
      label: 'Shielded Vault',
      icon: 'shield',
      unlocked: hasPin && passwords.length >= 1
    },
    {
      id: 'bond',
      label: '3-Day Streak',
      icon: 'heart',
      unlocked: (safeState.bestStreak || 0) >= 3 || displayStreak >= 3
    }
  ];

  return {
    form: safeState.form === 'TREE' ? 'TREE' : 'ORB',
    totalXp,
    dailyXp,
    level: currentRank.level,
    rankTitle: currentRank.title,
    nextRank,
    xpToNext: nextRank ? Math.max(0, nextRank.minXp - totalXp) : 0,
    levelProgressPct,
    checkedInToday,
    streak: displayStreak,
    bestStreak: Math.max(safeState.bestStreak || 0, displayStreak),
    checkInCount: safeState.checkInCount || 0,
    hasTodayCelebration,
    celebrationMultiplier,
    todayEvents,
    activeSectionsCount,
    totalSectionsCount: sources.length,
    sources,
    badges
  };
}
