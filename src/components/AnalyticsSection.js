// ============================================================================
// src/components/AnalyticsSection.js
// Full-App Analytics: Expenses, Calendar Milestones, Notes, Voice, Passwords,
// Tasks, Links & Pinned Vault Insights
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/colors';
import {
  toLocalDateKey,
  addDaysToDateKey,
  formatShortDate,
  formatPeso,
  formatDuration,
  extractDomain,
  passwordStrength,
  computeExpenseStats,
  computeEventStats,
  hapticTap
} from '../utils/helpers';
import DatePickerModal from './DatePickerModal';

const PERIODS = [
  { id: '7D', label: '7 Days' },
  { id: '30D', label: '30 Days' },
  { id: 'MONTH', label: 'This Month' },
  { id: 'CUSTOM', label: 'Pick Date' }
];

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AnalyticsSection({
  items = [],
  expenses = [],
  events = [],
  stats,
  onSelectSection
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [scope, setScope] = useState('ALL'); // 'ALL' | 'FINANCE' | 'VAULT'
  const [period, setPeriod] = useState('7D');
  const todayKey = toLocalDateKey(new Date());
  const [customDateKey, setCustomDateKey] = useState(todayKey);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDayKey, setSelectedDayKey] = useState(todayKey);

  const markedDateKeys = useMemo(
    () =>
      Array.from(
        new Set([
          ...expenses.map((e) => toLocalDateKey(e.createdAt)),
          ...items.map((i) => toLocalDateKey(i.updatedAt || i.createdAt))
        ])
      ),
    [expenses, items]
  );

  function inSelectedPeriod(iso) {
    if (!iso) return false;
    const key = toLocalDateKey(iso);
    const start7 = addDaysToDateKey(todayKey, -6);
    const start30 = addDaysToDateKey(todayKey, -29);
    const monthPrefix = todayKey.slice(0, 7);
    if (period === '7D') return key >= start7 && key <= todayKey;
    if (period === '30D') return key >= start30 && key <= todayKey;
    if (period === 'MONTH') return key.startsWith(monthPrefix);
    if (period === 'CUSTOM') return key === customDateKey;
    return true;
  }

  const periodExpenses = useMemo(
    () => expenses.filter((e) => inSelectedPeriod(e.createdAt)),
    [expenses, period, todayKey, customDateKey]
  );

  const flow = useMemo(() => computeExpenseStats(periodExpenses), [periodExpenses]);

  const dailyAvgSpend = useMemo(() => {
    if (flow.totalSpent <= 0) return 0;
    if (period === '7D') return flow.totalSpent / 7;
    if (period === '30D') return flow.totalSpent / 30;
    if (period === 'MONTH') {
      const dayOfMonth = Number(todayKey.slice(8, 10)) || 1;
      return flow.totalSpent / dayOfMonth;
    }
    if (period === 'CUSTOM') return flow.totalSpent;
    const distinctDays = new Set(
      periodExpenses.filter((e) => e.kind !== 'CASH_IN').map((e) => toLocalDateKey(e.createdAt))
    ).size;
    return flow.totalSpent / Math.max(1, distinctDays);
  }, [flow.totalSpent, period, periodExpenses, todayKey]);

  const savedPct = useMemo(() => {
    if (flow.totalCashIn <= 0) return null;
    const raw = Math.round(((flow.totalCashIn - flow.totalSpent) / flow.totalCashIn) * 100);
    return Math.max(0, Math.min(100, raw));
  }, [flow]);

  const last7Days = useMemo(() => {
    const days = [];
    for (let i = -6; i <= 0; i++) {
      const key = addDaysToDateKey(todayKey, i);
      const [y, m, d] = key.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      const dayItems = expenses.filter((e) => toLocalDateKey(e.createdAt) === key);
      let spent = 0;
      let cashIn = 0;
      dayItems.forEach((e) => {
        if (e.kind === 'CASH_IN') cashIn += Number(e.amount) || 0;
        else spent += Number(e.amount) || 0;
      });
      days.push({
        key,
        dayName: i === 0 ? 'Today' : WEEKDAY_SHORT[dt.getDay()],
        spent,
        cashIn
      });
    }
    return days;
  }, [expenses, todayKey]);

  const maxDaySpent = useMemo(
    () => Math.max(1, ...last7Days.map((d) => d.spent)),
    [last7Days]
  );

  const selectedDayData = useMemo(
    () => last7Days.find((d) => d.key === selectedDayKey) || last7Days[last7Days.length - 1],
    [last7Days, selectedDayKey]
  );

  const categoryBreakdown = useMemo(() => {
    const map = {};
    const onlySpent = periodExpenses.filter((e) => e.kind !== 'CASH_IN');
    onlySpent.forEach((e) => {
      const cat = e.category || 'Other';
      if (!map[cat]) map[cat] = { category: cat, amount: 0, count: 0 };
      map[cat].amount += Number(e.amount) || 0;
      map[cat].count += 1;
    });
    return Object.values(map).sort((a, b) => b.amount - a.amount);
  }, [periodExpenses]);

  const topExpenses = useMemo(() => {
    return [...periodExpenses]
      .filter((e) => e.kind !== 'CASH_IN')
      .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
      .slice(0, 5);
  }, [periodExpenses]);

  // ---------------- CALENDAR ANALYTICS ----------------
  const calendarStats = useMemo(() => {
    const byType = { ANNIVERSARY: 0, MONTHSARY: 0, BIRTHDAY: 0, IMPORTANT: 0 };
    let alertsActive = 0;
    let due30Days = 0;
    const enriched = [];

    events.forEach((ev) => {
      if (byType[ev.type] !== undefined) byType[ev.type] += 1;
      else byType.IMPORTANT += 1;
      if (ev.notifyLeadDays == null || ev.notifyLeadDays >= 0) alertsActive += 1;
      const st = computeEventStats(ev);
      if (st.daysUntil !== null && st.daysUntil <= 30) due30Days += 1;
      enriched.push({ ev, st });
    });

    enriched.sort((a, b) => (a.st.daysUntil ?? 99999) - (b.st.daysUntil ?? 99999));

    return {
      total: events.length,
      byType,
      alertsActive,
      due30Days,
      nextUp: enriched[0] || null
    };
  }, [events]);

  // ---------------- ALL VAULT SECTIONS ANALYTICS ----------------
  const sectionStats = useMemo(() => {
    const notesList = items.filter((i) => i.type === 'NOTE');
    const voiceList = items.filter((i) => i.type === 'VOICE');
    const passList = items.filter((i) => i.type === 'PASSWORD');
    const taskLists = items.filter((i) => i.type === 'CHECKLIST');
    const linkList = items.filter((i) => i.type === 'LINK');
    const pinnedList = items.filter((i) => i.isPinned);

    const periodActivity = items.filter((i) => inSelectedPeriod(i.updatedAt || i.createdAt)).length;

    // Notes: photos & locked notes
    let photoCount = 0;
    let lockedNotes = 0;
    notesList.forEach((n) => {
      photoCount += (n.attachments || []).length;
      if (n.isLocked) lockedNotes += 1;
    });

    // Voice: total audio duration
    let totalAudioMs = 0;
    voiceList.forEach((v) => {
      totalAudioMs += Number(v.audioDurationMs) || 0;
    });

    // Passwords: strength audit
    let strongPw = 0;
    let goodPw = 0;
    let weakPw = 0;
    passList.forEach((p) => {
      const s = passwordStrength(p.secretPassword || '', colors);
      if (s.label === 'Strong') strongPw += 1;
      else if (s.label === 'Good') goodPw += 1;
      else weakPw += 1;
    });
    const pwHealthPct =
      passList.length > 0 ? Math.round(((strongPw + goodPw * 0.6) / passList.length) * 100) : 100;

    // Checklists: completion rate & completed lists
    let completedLists = 0;
    taskLists.forEach((l) => {
      const cl = l.checklist || [];
      if (cl.length > 0 && cl.every((c) => c.done)) completedLists += 1;
    });

    // Links: top domains
    const domainMap = {};
    linkList.forEach((lk) => {
      const dom = extractDomain(lk.websiteUrl || '') || 'other';
      domainMap[dom] = (domainMap[dom] || 0) + 1;
    });
    const topDomains = Object.entries(domainMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    // Total records across the entire app
    const totalAllRecords = items.length + expenses.length + events.length;
    const shareRows = [
      { id: 'NOTE', label: 'Notes', count: notesList.length, icon: 'file-text' },
      { id: 'EXPENSES', label: 'Expenses', count: expenses.length, icon: 'credit-card' },
      { id: 'CALENDAR', label: 'Calendar', count: events.length, icon: 'calendar' },
      { id: 'CHECKLIST', label: 'Tasks', count: taskLists.length, icon: 'check-square' },
      { id: 'PASSWORD', label: 'Passwords', count: passList.length, icon: 'lock' },
      { id: 'LINK', label: 'Links', count: linkList.length, icon: 'link-2' },
      { id: 'VOICE', label: 'Voice', count: voiceList.length, icon: 'mic' }
    ];

    return {
      periodActivity,
      photoCount,
      lockedNotes,
      totalAudioMs,
      strongPw,
      goodPw,
      weakPw,
      pwCount: passList.length,
      pwHealthPct,
      completedLists,
      taskListsCount: taskLists.length,
      topDomains,
      linksCount: linkList.length,
      pinnedCount: pinnedList.length,
      totalAllRecords,
      shareRows
    };
  }, [items, expenses.length, events.length, colors, period, todayKey, customDateKey]);

  const taskPct =
    stats.tasksTotal > 0 ? Math.round((stats.tasksDone / stats.tasksTotal) * 100) : 0;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Scope Switcher */}
        <View style={styles.scopeRow}>
          {[
            { id: 'ALL', label: 'All Sections' },
            { id: 'FINANCE', label: 'Expenses' },
            { id: 'VAULT', label: 'Calendar & Vault' }
          ].map((tab) => {
            const active = scope === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.scopeBtn, active && styles.scopeBtnActive]}
                onPress={() => {
                  hapticTap('light');
                  setScope(tab.id);
                }}
              >
                <Text style={[styles.scopeText, active && styles.scopeTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Period Filter (applies to Expenses + Vault Activity) */}
        <View style={styles.periodRow}>
          {PERIODS.map((p) => {
            const active = period === p.id;
            const label =
              p.id === 'CUSTOM' && active
                ? formatShortDate(customDateKey)
                : p.label;
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.periodBtn, active && styles.periodBtnActive]}
                onPress={() => {
                  hapticTap('light');
                  if (p.id === 'CUSTOM') {
                    setCalendarOpen(true);
                  } else {
                    setPeriod(p.id);
                  }
                }}
              >
                <View style={styles.periodBtnInner}>
                  {p.id === 'CUSTOM' && (
                    <Feather
                      name="calendar"
                      size={11}
                      color={active ? colors.textPrimary : colors.textMuted}
                    />
                  )}
                  <Text
                    style={[styles.periodText, active && styles.periodTextActive]}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Global Cross-Section Pulse (Shown in ALL) */}
        {scope === 'ALL' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>SECONDBRAIN PULSE</Text>
            <View style={styles.pulseGrid}>
              <View style={styles.pulseTile}>
                <Text style={styles.pulseNum}>{sectionStats.totalAllRecords}</Text>
                <Text style={styles.pulseLbl}>Total Records</Text>
              </View>
              <View style={styles.pulseTile}>
                <Text style={styles.pulseNum}>{sectionStats.periodActivity}</Text>
                <Text style={styles.pulseLbl}>Vault Touched</Text>
              </View>
              <View style={styles.pulseTile}>
                <Text style={styles.pulseNum}>{calendarStats.total}</Text>
                <Text style={styles.pulseLbl}>Calendar Dates</Text>
              </View>
              <View style={styles.pulseTile}>
                <Text style={styles.pulseNum}>{taskPct}%</Text>
                <Text style={styles.pulseLbl}>Tasks Done</Text>
              </View>
            </View>
          </View>
        )}

        {/* ==================== FINANCE / EXPENSES SECTION ==================== */}
        {(scope === 'ALL' || scope === 'FINANCE') && (
          <>
            <View style={styles.gridRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>CASH ADDED</Text>
                <Text style={[styles.statVal, { color: colors.success }]}>
                  +{formatPeso(flow.totalCashIn)}
                </Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statLabel}>TOTAL SPENT</Text>
                <Text style={styles.statVal}>-{formatPeso(flow.totalSpent)}</Text>
              </View>
            </View>

            <View style={[styles.gridRow, { marginBottom: 18 }]}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>NET REMAINING</Text>
                <Text
                  style={[
                    styles.statVal,
                    flow.balance < 0 && { color: colors.danger }
                  ]}
                >
                  {formatPeso(flow.balance)}
                </Text>
                {savedPct !== null && (
                  <Text style={styles.statSub}>{savedPct}% kept</Text>
                )}
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statLabel}>
                  {period === 'CUSTOM' ? 'SPENT ON DATE' : 'DAILY AVG SPEND'}
                </Text>
                <Text style={styles.statVal}>{formatPeso(dailyAvgSpend)}</Text>
                <Text style={styles.statSub}>
                  {period === 'CUSTOM' ? formatShortDate(customDateKey) : 'per day'}
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>LAST 7 DAYS SPENDING</Text>
                <TouchableOpacity onPress={() => onSelectSection('EXPENSES')} hitSlop={8}>
                  <Text style={styles.cardLink}>Open Ledger ›</Text>
                </TouchableOpacity>
              </View>

              {selectedDayData && (
                <View style={styles.dayFocusStrip}>
                  <Text style={styles.dayFocusTitle}>
                    {formatShortDate(selectedDayData.key)}
                  </Text>
                  <Text style={styles.dayFocusNums}>
                    +{formatPeso(selectedDayData.cashIn)} cash • -{formatPeso(selectedDayData.spent)} spent
                  </Text>
                </View>
              )}

              <View style={styles.chartArea}>
                {last7Days.map((d) => {
                  const heightPct =
                    d.spent > 0 ? Math.max(8, Math.round((d.spent / maxDaySpent) * 100)) : 4;
                  const isSelected = d.key === selectedDayData?.key;
                  return (
                    <TouchableOpacity
                      key={d.key}
                      style={styles.barCol}
                      onPress={() => {
                        hapticTap('light');
                        setSelectedDayKey(d.key);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            { height: `${heightPct}%` },
                            d.spent === 0 && styles.barEmpty,
                            isSelected && d.spent > 0 && styles.barSelected
                          ]}
                        />
                      </View>
                      <Text
                        style={[styles.barDayLabel, isSelected && styles.barDayLabelActive]}
                        numberOfLines={1}
                      >
                        {d.dayName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>SPENDING BY CATEGORY</Text>
              {categoryBreakdown.length === 0 ? (
                <Text style={styles.emptySmall}>No expenses logged in this period.</Text>
              ) : (
                <View style={{ marginTop: 10, gap: 12 }}>
                  {categoryBreakdown.map((cat) => {
                    const pct =
                      flow.totalSpent > 0
                        ? Math.round((cat.amount / flow.totalSpent) * 100)
                        : 0;
                    return (
                      <View key={cat.category}>
                        <View style={styles.catRowTop}>
                          <Text style={styles.catName}>
                            {cat.category}{' '}
                            <Text style={styles.catCount}>({cat.count}x)</Text>
                          </Text>
                          <Text style={styles.catAmount}>
                            {formatPeso(cat.amount)} • {pct}%
                          </Text>
                        </View>
                        <View style={styles.catBarTrack}>
                          <View style={[styles.catBarFill, { width: `${pct}%` }]} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {topExpenses.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>TOP EXPENSES</Text>
                <View style={{ marginTop: 8 }}>
                  {topExpenses.map((exp, idx) => (
                    <View
                      key={exp.id}
                      style={[styles.topRow, idx > 0 && styles.topRowBorder]}
                    >
                      <Text style={styles.topRank}>{idx + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.topTitle} numberOfLines={1}>
                          {exp.title}
                        </Text>
                        <Text style={styles.topMeta}>
                          {exp.category || 'Expense'} • {formatShortDate(exp.createdAt)}
                        </Text>
                      </View>
                      <Text style={styles.topAmt}>-{formatPeso(exp.amount)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        {/* ==================== CALENDAR & ALL VAULT SECTIONS ==================== */}
        {(scope === 'ALL' || scope === 'VAULT') && (
          <>
            {/* CALENDAR ANALYTICS */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>CALENDAR & MILESTONES</Text>
                <TouchableOpacity onPress={() => onSelectSection('CALENDAR')} hitSlop={8}>
                  <Text style={styles.cardLink}>Open Calendar ›</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.vaultStatsGrid}>
                <View style={styles.vaultChip}>
                  <Feather name="heart" size={12} color={colors.textSecondary} />
                  <Text style={styles.vaultChipText}>
                    {calendarStats.byType.ANNIVERSARY} Anniv
                  </Text>
                </View>
                <View style={styles.vaultChip}>
                  <Feather name="calendar" size={12} color={colors.textSecondary} />
                  <Text style={styles.vaultChipText}>
                    {calendarStats.byType.MONTHSARY} Monthsary
                  </Text>
                </View>
                <View style={styles.vaultChip}>
                  <Feather name="gift" size={12} color={colors.textSecondary} />
                  <Text style={styles.vaultChipText}>
                    {calendarStats.byType.BIRTHDAY} Birthdays
                  </Text>
                </View>
                <View style={styles.vaultChip}>
                  <Feather name="star" size={12} color={colors.textSecondary} />
                  <Text style={styles.vaultChipText}>
                    {calendarStats.byType.IMPORTANT} Important
                  </Text>
                </View>
              </View>

              <View style={styles.calFocusBox}>
                {calendarStats.nextUp ? (
                  <>
                    <Text style={styles.calFocusLabel}>
                      NEXT COMING UP · {calendarStats.due30Days} IN NEXT 30 DAYS ·{' '}
                      {calendarStats.alertsActive} ALERTS ON
                    </Text>
                    <Text style={styles.calFocusTitle}>
                      {calendarStats.nextUp.ev.title} ({calendarStats.nextUp.st.countdownLabel || 'Upcoming'})
                    </Text>
                    <Text style={styles.calFocusSub}>
                      {calendarStats.nextUp.st.primaryHeadline}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.emptySmall}>
                    No dates saved yet. Add birthdays, monthsaries, or anniversaries in Calendar.
                  </Text>
                )}
              </View>
            </View>

            {/* DATA DISTRIBUTION ACROSS ALL SECTIONS */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>DATA BY SECTION</Text>
              {sectionStats.totalAllRecords === 0 ? (
                <Text style={styles.emptySmall}>Start saving items across sections to see distribution.</Text>
              ) : (
                <View style={{ marginTop: 10, gap: 10 }}>
                  {sectionStats.shareRows.map((row) => {
                    const pct = Math.round((row.count / sectionStats.totalAllRecords) * 100);
                    return (
                      <TouchableOpacity
                        key={row.id}
                        activeOpacity={0.75}
                        onPress={() => {
                          hapticTap('light');
                          onSelectSection(row.id);
                        }}
                      >
                        <View style={styles.catRowTop}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Feather name={row.icon} size={12} color={colors.textSecondary} />
                            <Text style={styles.catName}>{row.label}</Text>
                          </View>
                          <Text style={styles.catAmount}>
                            {row.count} ({pct}%)
                          </Text>
                        </View>
                        <View style={styles.catBarTrack}>
                          <View style={[styles.catBarFill, { width: `${pct}%` }]} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* NOTES & VOICE ANALYTICS */}
            <View style={styles.gridRow}>
              <TouchableOpacity
                style={styles.statCard}
                activeOpacity={0.75}
                onPress={() => onSelectSection('NOTE')}
              >
                <Text style={styles.statLabel}>NOTES & PHOTOS</Text>
                <Text style={styles.statVal}>{stats.notes || 0} Notes</Text>
                <Text style={styles.statSub}>
                  {sectionStats.photoCount} photos · {sectionStats.lockedNotes} locked
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.statCard}
                activeOpacity={0.75}
                onPress={() => onSelectSection('VOICE')}
              >
                <Text style={styles.statLabel}>VOICE MEMOS</Text>
                <Text style={styles.statVal}>{stats.voiceMemos || 0} Clips</Text>
                <Text style={styles.statSub}>
                  {formatDuration(sectionStats.totalAudioMs)} total audio
                </Text>
              </TouchableOpacity>
            </View>

            {/* PASSWORD HEALTH ANALYTICS */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>PASSWORD SECURITY</Text>
                <TouchableOpacity onPress={() => onSelectSection('PASSWORD')} hitSlop={8}>
                  <Text style={styles.cardLink}>Open Vault ›</Text>
                </TouchableOpacity>
              </View>
              {sectionStats.pwCount === 0 ? (
                <Text style={styles.emptySmall}>No passwords stored yet.</Text>
              ) : (
                <>
                  <View style={styles.catRowTop}>
                    <Text style={styles.catName}>
                      Strength Score ({sectionStats.pwCount} accounts)
                    </Text>
                    <Text style={styles.catAmount}>{sectionStats.pwHealthPct}%</Text>
                  </View>
                  <View style={[styles.catBarTrack, { marginBottom: 10 }]}>
                    <View
                      style={[
                        styles.catBarFill,
                        { width: `${sectionStats.pwHealthPct}%` },
                        sectionStats.weakPw > 0 && { backgroundColor: colors.warning }
                      ]}
                    />
                  </View>
                  <View style={styles.vaultStatsGrid}>
                    <View style={styles.vaultChip}>
                      <Text style={styles.vaultChipText}>{sectionStats.strongPw} Strong</Text>
                    </View>
                    <View style={styles.vaultChip}>
                      <Text style={styles.vaultChipText}>{sectionStats.goodPw} Good</Text>
                    </View>
                    <View
                      style={[
                        styles.vaultChip,
                        sectionStats.weakPw > 0 && { borderColor: colors.danger }
                      ]}
                    >
                      <Text
                        style={[
                          styles.vaultChipText,
                          sectionStats.weakPw > 0 && { color: colors.danger }
                        ]}
                      >
                        {sectionStats.weakPw} Weak
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>

            {/* TASKS & CHECKLISTS */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>TASKS & CHECKLISTS</Text>
                <TouchableOpacity onPress={() => onSelectSection('CHECKLIST')} hitSlop={8}>
                  <Text style={styles.cardLink}>Open Tasks ›</Text>
                </TouchableOpacity>
              </View>
              {sectionStats.taskListsCount === 0 ? (
                <Text style={styles.emptySmall}>No checklists created yet.</Text>
              ) : (
                <>
                  <View style={styles.catRowTop}>
                    <Text style={styles.catName}>
                      Items Done ({sectionStats.completedLists}/{sectionStats.taskListsCount} lists finished)
                    </Text>
                    <Text style={styles.catAmount}>
                      {stats.tasksDone}/{stats.tasksTotal} ({taskPct}%)
                    </Text>
                  </View>
                  <View style={styles.catBarTrack}>
                    <View style={[styles.catBarFill, { width: `${taskPct}%` }]} />
                  </View>
                </>
              )}
            </View>

            {/* LINKS & PINNED */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>LINKS & PINNED</Text>
                <TouchableOpacity onPress={() => onSelectSection('LINK')} hitSlop={8}>
                  <Text style={styles.cardLink}>Open Links ›</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.vaultStatsGrid}>
                <TouchableOpacity
                  style={styles.vaultChip}
                  onPress={() => onSelectSection('LINK')}
                >
                  <Feather name="link-2" size={12} color={colors.textSecondary} />
                  <Text style={styles.vaultChipText}>{sectionStats.linksCount} Saved Links</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.vaultChip}
                  onPress={() => onSelectSection('PINNED')}
                >
                  <Feather name="bookmark" size={12} color={colors.textSecondary} />
                  <Text style={styles.vaultChipText}>{sectionStats.pinnedCount} Pinned</Text>
                </TouchableOpacity>
              </View>

              {sectionStats.topDomains.length > 0 && (
                <View style={{ marginTop: 10 }}>
                  <Text style={[styles.statLabel, { marginBottom: 6 }]}>TOP SAVED SITES</Text>
                  <View style={styles.vaultStatsGrid}>
                    {sectionStats.topDomains.map(([dom, cnt]) => (
                      <View key={dom} style={styles.vaultChip}>
                        <Text style={styles.vaultChipText}>
                          {dom} ({cnt})
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <DatePickerModal
        visible={calendarOpen}
        selectedDateKey={customDateKey}
        markedDateKeys={markedDateKeys}
        title="Pick Analytics Date"
        onSelect={(key) => {
          setCustomDateKey(key);
          setPeriod('CUSTOM');
          setSelectedDayKey(key);
          setCalendarOpen(false);
        }}
        onClose={() => setCalendarOpen(false)}
      />
    </View>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 4,
      paddingBottom: 28
    },
    scopeRow: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 8
    },
    scopeBtn: {
      flex: 1,
      paddingVertical: 7,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center'
    },
    scopeBtnActive: {
      backgroundColor: colors.solidBtnBg,
      borderColor: colors.solidBtnBg
    },
    scopeText: {
      fontSize: 11.5,
      fontWeight: '700',
      color: colors.textSecondary
    },
    scopeTextActive: {
      color: colors.solidBtnText
    },
    periodRow: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 3,
      marginBottom: 14
    },
    periodBtn: {
      flex: 1,
      paddingVertical: 7,
      paddingHorizontal: 4,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 7
    },
    periodBtnActive: {
      backgroundColor: colors.surfaceElevated
    },
    periodBtnInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4
    },
    periodText: {
      fontSize: 11.5,
      fontWeight: '600',
      color: colors.textMuted
    },
    periodTextActive: {
      color: colors.textPrimary,
      fontWeight: '700'
    },
    pulseGrid: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 10
    },
    pulseTile: {
      flex: 1,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 4,
      alignItems: 'center'
    },
    pulseNum: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.textPrimary
    },
    pulseLbl: {
      fontSize: 9.5,
      fontWeight: '600',
      color: colors.textMuted,
      marginTop: 2,
      textAlign: 'center'
    },
    gridRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 10
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 14
    },
    statLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.7,
      marginBottom: 4
    },
    statVal: {
      fontSize: 19,
      fontWeight: '700',
      color: colors.textPrimary
    },
    statSub: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 15,
      marginBottom: 12
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8
    },
    cardTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.8
    },
    cardLink: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary
    },
    dayFocusStrip: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginTop: 4,
      marginBottom: 14
    },
    dayFocusTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary
    },
    dayFocusNums: {
      fontSize: 11.5,
      color: colors.textSecondary
    },
    chartArea: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      height: 116,
      paddingTop: 10
    },
    barCol: {
      flex: 1,
      alignItems: 'center',
      height: '100%'
    },
    barTrack: {
      flex: 1,
      width: 18,
      justifyContent: 'flex-end',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 5,
      overflow: 'hidden',
      marginBottom: 6
    },
    barFill: {
      width: '100%',
      backgroundColor: colors.textSecondary,
      borderRadius: 5
    },
    barSelected: {
      backgroundColor: colors.solidBtnBg
    },
    barEmpty: {
      backgroundColor: colors.border
    },
    barDayLabel: {
      fontSize: 10.5,
      color: colors.textMuted,
      fontWeight: '600'
    },
    barDayLabelActive: {
      color: colors.textPrimary,
      fontWeight: '700'
    },
    emptySmall: {
      fontSize: 12.5,
      color: colors.textMuted,
      marginTop: 8
    },
    catRowTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 5
    },
    catName: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary
    },
    catCount: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '500'
    },
    catAmount: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary
    },
    catBarTrack: {
      height: 5,
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 3,
      overflow: 'hidden'
    },
    catBarFill: {
      height: '100%',
      backgroundColor: colors.textPrimary,
      borderRadius: 3
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      gap: 10
    },
    topRowBorder: {
      borderTopWidth: 1,
      borderTopColor: colors.border
    },
    topRank: {
      width: 20,
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted
    },
    topTitle: {
      fontSize: 13.5,
      fontWeight: '600',
      color: colors.textPrimary
    },
    topMeta: {
      fontSize: 11,
      color: colors.textMuted
    },
    topAmt: {
      fontSize: 13.5,
      fontWeight: '700',
      color: colors.textPrimary
    },
    vaultStatsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 6
    },
    vaultChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6
    },
    vaultChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary
    },
    calFocusBox: {
      marginTop: 12,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 11
    },
    calFocusLabel: {
      fontSize: 9.5,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.6
    },
    calFocusTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 3
    },
    calFocusSub: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2
    }
  });
