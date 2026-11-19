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
  bonusXp: 0,
  focusMinutesTotal: 0,
  focusSessionsCount: 0,
  lastFocusDateKey: null,
  quizSolvedCount: 0,
  lastDailyClearKey: null
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

  // 3 Live Daily Quests auto-tracked from real activity today
  const loggedExpenseToday = expenses.some((e) => toLocalDateKey(e.createdAt) === todayKey);
  const touchedVaultToday = items.some(
    (i) => toLocalDateKey(i.updatedAt || i.createdAt) === todayKey
  );
  const focusedToday = safeState.lastFocusDateKey === todayKey;

  const dailyQuests = [
    {
      id: 'checkin',
      label: 'Daily Check-In with Companion',
      hint: checkedInToday ? 'Completed today' : 'Tap Nurture below',
      done: checkedInToday,
      targetSection: null
    },
    {
      id: 'expense',
      label: 'Log Cash or Expense Today',
      hint: loggedExpenseToday ? 'Logged today' : 'Open Expenses ›',
      done: loggedExpenseToday,
      targetSection: 'EXPENSES'
    },
    {
      id: 'create_or_focus',
      label: 'Check Task, Save Item, or Focus',
      hint:
        touchedVaultToday || focusedToday
          ? 'Active today'
          : 'Open Tasks / Start Focus',
      done: touchedVaultToday || focusedToday,
      targetSection: 'CHECKLIST'
    }
  ];

  const dailyQuestsDone = dailyQuests.filter((q) => q.done).length;
  const dailyClearClaimed = safeState.lastDailyClearKey === todayKey;
  const canClaimDailyClear = dailyQuestsDone === dailyQuests.length && !dailyClearClaimed;

  // Collect open tasks for Focus Orb Task Picker
  const openTasksList = [];
  for (const list of checklists) {
    const ch = Array.isArray(list.checklist) ? list.checklist : [];
    for (const t of ch) {
      if (!t.done && t.text) {
        openTasksList.push({
          itemId: list.id,
          taskId: t.id,
          listTitle: list.title || 'Tasks',
          text: t.text
        });
      }
    }
  }

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
    focusMinutesTotal: safeState.focusMinutesTotal || 0,
    focusSessionsCount: safeState.focusSessionsCount || 0,
    quizSolvedCount: safeState.quizSolvedCount || 0,
    dailyQuests,
    dailyQuestsDone,
    dailyClearClaimed,
    canClaimDailyClear,
    openTasksList,
    hasTodayCelebration,
    celebrationMultiplier,
    todayEvents,
    activeSectionsCount,
    totalSectionsCount: sources.length,
    sources,
    badges
  };
}

function pickDistractors(correct, pool, count = 2) {
  const unique = Array.from(new Set(pool.filter((x) => x && x !== correct)));
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unique[i], unique[j]] = [unique[j], unique[i]];
  }
  return unique.slice(0, count);
}

function shuffleChoices(correct, wrongList) {
  const arr = [correct, ...wrongList.slice(0, 2)].map((label, idx) => ({
    label: String(label),
    isCorrect: idx === 0
  }));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Generates a playful 3-choice quiz question strictly from non-secret data
 * across Calendar, Expenses, Tasks, Notes, and Links (Passwords excluded).
 */
export function generateVaultQuizQuestion({ items = [], expenses = [], events = [], prevQuestionKey = '' }) {
  const pool = [];
  const now = new Date();

  // Calendar event questions
  for (const ev of events) {
    if (ev.day != null) {
      const correctDay = `Day ${ev.day}`;
      const wrongs = pickDistractors(
        correctDay,
        [1, 5, 10, 14, 15, 19, 24, 28, 30].map((d) => `Day ${d}`)
      );
      pool.push({
        key: `ev_day_${ev.id}`,
        section: 'Calendar',
        prompt: `Which day of the month does "${ev.title}" fall on?`,
        choices: shuffleChoices(correctDay, wrongs)
      });
    }
    const typeMap = {
      BIRTHDAY: 'Birthday',
      MONTHSARY: 'Monthsary',
      ANNIVERSARY: 'Anniversary',
      IMPORTANT: 'Important Date'
    };
    const correctType = typeMap[ev.type] || 'Important Date';
    pool.push({
      key: `ev_type_${ev.id}`,
      section: 'Calendar',
      prompt: `What milestone category is "${ev.title}" saved under?`,
      choices: shuffleChoices(
        correctType,
        pickDistractors(correctType, ['Birthday', 'Monthsary', 'Anniversary', 'Important Date'])
      )
    });

    const stats = computeEventStats(ev, now);
    if (stats.daysUntil !== null) {
      const correctLabel =
        stats.daysUntil === 0
          ? 'Today!'
          : stats.daysUntil === 1
          ? 'Tomorrow'
          : `${stats.daysUntil} days`;
      const wrongs = pickDistractors(correctLabel, ['Today!', '3 days', '12 days', '25 days', '40 days']);
      pool.push({
        key: `ev_cnt_${ev.id}`,
        section: 'Calendar',
        prompt: `How soon is the next "${ev.title}"?`,
        choices: shuffleChoices(correctLabel, wrongs)
      });
    }
  }

  // Expenses questions
  if (expenses.length > 0) {
    const latestExp = expenses[0];
    if (latestExp?.title) {
      const wrongs = pickDistractors(latestExp.title, [
        'Groceries',
        'Coffee Run',
        'Transpo',
        'Load & Data',
        ...expenses.slice(1).map((e) => e.title)
      ]);
      pool.push({
        key: `exp_latest_${latestExp.id}`,
        section: 'Expenses',
        prompt: 'What was your most recent Cash or Expense entry?',
        choices: shuffleChoices(latestExp.title, wrongs)
      });
    }
    const catTotals = {};
    for (const e of expenses) {
      if (e.kind !== 'CASH_IN' && e.category) {
        catTotals[e.category] = (catTotals[e.category] || 0) + Number(e.amount || 0);
      }
    }
    const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
    if (sortedCats.length > 0) {
      const topCat = sortedCats[0][0];
      const wrongs = pickDistractors(topCat, ['Transpo', 'Food', 'Bills', 'Load', 'Shopping', 'Other']);
      pool.push({
        key: `exp_topcat`,
        section: 'Expenses',
        prompt: 'Which spending category has your highest total so far?',
        choices: shuffleChoices(topCat, wrongs)
      });
    }
  }

  // Notes, Links & Checklists (strictly skip PASSWORD items)
  const safeItems = items.filter((i) => i && i.type !== 'PASSWORD');
  const pinnedSafe = safeItems.filter((i) => i.isPinned);
  if (pinnedSafe.length > 0) {
    const p = pinnedSafe[0];
    const wrongs = pickDistractors(p.title, [
      'Grocery List',
      'Weekend Plan',
      'Movie Picks',
      ...safeItems.filter((x) => !x.isPinned).map((x) => x.title)
    ]);
    pool.push({
      key: `pinned_${p.id}`,
      section: 'Pinned',
      prompt: 'Which of these items is pinned in your Vault?',
      choices: shuffleChoices(p.title, wrongs)
    });
  }

  const checklists = safeItems.filter((i) => i.type === 'CHECKLIST');
  if (checklists.length > 0) {
    const c = checklists[0];
    const remaining = (c.checklist || []).filter((t) => !t.done).length;
    const correctRem = `${remaining} left`;
    const wrongs = pickDistractors(correctRem, ['0 left', '2 left', '4 left', '7 left']);
    pool.push({
      key: `chk_${c.id}`,
      section: 'Tasks',
      prompt: `How many unchecked items are left in "${c.title}"?`,
      choices: shuffleChoices(correctRem, wrongs)
    });
  }

  // Fallback prompts if vault is still nearly empty
  if (pool.length === 0) {
    pool.push(
      {
        key: 'fb_offline',
        section: 'Vault Basics',
        prompt: 'Where is all your SecondBrain Vault data stored?',
        choices: shuffleChoices('100% locally on your phone', ['Public cloud server', 'Social media drafts'])
      },
      {
        key: 'fb_alarm',
        section: 'Calendar',
        prompt: 'How do Calendar alerts behave if you miss the first beep?',
        choices: shuffleChoices('Repeat every hour until opened/stopped', ['Never alert again', 'Only ring once a year'])
      }
    );
  }

  const filtered = pool.length > 1 ? pool.filter((q) => q.key !== prevQuestionKey) : pool;
  return filtered[Math.floor(Math.random() * filtered.length)];
}
