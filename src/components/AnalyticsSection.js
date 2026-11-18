// ============================================================================
// src/components/AnalyticsSection.js — Cash Flow, Spending & Vault Analytics
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
  computeExpenseStats,
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
  expenses = [],
  stats,
  onSelectSection
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [period, setPeriod] = useState('7D');
  const todayKey = toLocalDateKey(new Date());
  const [customDateKey, setCustomDateKey] = useState(todayKey);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDayKey, setSelectedDayKey] = useState(todayKey);

  const markedDateKeys = useMemo(
    () => Array.from(new Set(expenses.map((e) => toLocalDateKey(e.createdAt)))),
    [expenses]
  );

  const periodExpenses = useMemo(() => {
    const start7 = addDaysToDateKey(todayKey, -6);
    const start30 = addDaysToDateKey(todayKey, -29);
    const monthPrefix = todayKey.slice(0, 7);

    return expenses.filter((e) => {
      const key = toLocalDateKey(e.createdAt);
      if (period === '7D') return key >= start7 && key <= todayKey;
      if (period === '30D') return key >= start30 && key <= todayKey;
      if (period === 'MONTH') return key.startsWith(monthPrefix);
      if (period === 'CUSTOM') return key === customDateKey;
      return true;
    });
  }, [expenses, period, todayKey, customDateKey]);

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

  const taskPct =
    stats.tasksTotal > 0 ? Math.round((stats.tasksDone / stats.tasksTotal) * 100) : 0;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
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
          <Text style={styles.cardTitle}>BY CATEGORY</Text>
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

        <View style={styles.card}>
          <Text style={styles.cardTitle}>VAULT OVERVIEW</Text>
          <View style={styles.vaultStatsGrid}>
            <View style={styles.vaultChip}>
              <Feather name="file-text" size={13} color={colors.textSecondary} />
              <Text style={styles.vaultChipText}>{stats.notes || 0} Notes</Text>
            </View>
            <View style={styles.vaultChip}>
              <Feather name="mic" size={13} color={colors.textSecondary} />
              <Text style={styles.vaultChipText}>{stats.voiceMemos || 0} Voice</Text>
            </View>
            <View style={styles.vaultChip}>
              <Feather name="lock" size={13} color={colors.textSecondary} />
              <Text style={styles.vaultChipText}>{stats.passwords || 0} Passwords</Text>
            </View>
            <View style={styles.vaultChip}>
              <Feather name="link-2" size={13} color={colors.textSecondary} />
              <Text style={styles.vaultChipText}>{stats.links || 0} Links</Text>
            </View>
            <View style={styles.vaultChip}>
              <Feather name="bookmark" size={13} color={colors.textSecondary} />
              <Text style={styles.vaultChipText}>{stats.pinned || 0} Pinned</Text>
            </View>
          </View>

          {stats.tasksTotal > 0 && (
            <View style={styles.taskSummary}>
              <View style={styles.catRowTop}>
                <Text style={styles.catName}>Checklist Completion</Text>
                <Text style={styles.catAmount}>
                  {stats.tasksDone}/{stats.tasksTotal} ({taskPct}%)
                </Text>
              </View>
              <View style={styles.catBarTrack}>
                <View style={[styles.catBarFill, { width: `${taskPct}%` }]} />
              </View>
            </View>
          )}
        </View>
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
      paddingBottom: 90
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
    periodBtnInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4
    },
    periodBtnActive: {
      backgroundColor: colors.surfaceElevated
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
      marginBottom: 5
    },
    statVal: {
      fontSize: 18,
      fontWeight: '800',
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
      borderRadius: 16,
      padding: 16,
      marginBottom: 14
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10
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
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 7,
      marginBottom: 14
    },
    dayFocusTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary
    },
    dayFocusNums: {
      fontSize: 11.5,
      color: colors.textSecondary,
      fontWeight: '500'
    },
    chartArea: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      height: 120,
      gap: 8
    },
    barCol: {
      flex: 1,
      alignItems: 'center',
      height: '100%'
    },
    barTrack: {
      flex: 1,
      width: '100%',
      maxWidth: 26,
      justifyContent: 'flex-end',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 6,
      overflow: 'hidden',
      marginBottom: 6
    },
    barFill: {
      width: '100%',
      backgroundColor: colors.textMuted,
      borderTopLeftRadius: 4,
      borderTopRightRadius: 4
    },
    barSelected: {
      backgroundColor: colors.textPrimary
    },
    barEmpty: {
      backgroundColor: colors.border
    },
    barDayLabel: {
      fontSize: 10,
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
      marginTop: 10
    },
    catRowTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6
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
      marginTop: 10
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
    taskSummary: {
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border
    }
  });
