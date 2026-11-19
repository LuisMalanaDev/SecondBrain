// ============================================================================
// src/components/ExpensesSection.js — Cash & Expense Tracker with Date Filters
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/colors';
import {
  makeId,
  toLocalDateKey,
  dateKeyToIso,
  addDaysToDateKey,
  formatShortDate,
  formatDate,
  formatPeso,
  computeExpenseStats,
  hapticTap,
  hapticNotify
} from '../utils/helpers';
import DatePickerModal from './DatePickerModal';

const EXPENSE_CATEGORIES = ['Transpo', 'Food', 'Bills', 'Load', 'Shopping', 'Other'];
const CASH_PRESETS = [100, 500, 1000, 2000, 5000];

const DATE_FILTERS = [
  { id: 'ALL', label: 'All Dates' },
  { id: 'TODAY', label: 'Today' },
  { id: 'WEEK', label: 'This Week' },
  { id: 'MONTH', label: 'This Month' },
  { id: 'CUSTOM', label: 'Pick Date' }
];

const KIND_FILTERS = [
  { id: 'ALL', label: 'All' },
  { id: 'CASH_IN', label: 'Cash Added' },
  { id: 'EXPENSE', label: 'Expenses' }
];

export default function ExpensesSection({
  expenses = [],
  onAddEntry,
  onDeleteEntry,
  onClearAll,
  externalModalTrigger,
  onExternalTriggerHandled
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [dateFilter, setDateFilter] = useState('ALL');
  const [customFilterDate, setCustomFilterDate] = useState(toLocalDateKey(new Date()));
  const [filterCalendarOpen, setFilterCalendarOpen] = useState(false);
  const [kindFilter, setKindFilter] = useState('ALL');

  const [modalVisible, setModalVisible] = useState(false);
  const [kind, setKind] = useState('EXPENSE');
  const [amountText, setAmountText] = useState('');
  const [titleText, setTitleText] = useState('');
  const [category, setCategory] = useState('Transpo');
  const [entryDateKey, setEntryDateKey] = useState(toLocalDateKey(new Date()));
  const [entryCalendarOpen, setEntryCalendarOpen] = useState(false);
  const [error, setError] = useState('');

  const overallStats = useMemo(() => computeExpenseStats(expenses), [expenses]);

  const markedDateKeys = useMemo(
    () => Array.from(new Set(expenses.map((e) => toLocalDateKey(e.createdAt)))),
    [expenses]
  );

  const filteredExpenses = useMemo(() => {
    const todayKey = toLocalDateKey(new Date());
    const weekStartKey = addDaysToDateKey(todayKey, -6);
    const monthPrefix = todayKey.slice(0, 7);

    return [...expenses]
      .filter((item) => {
        if (kindFilter !== 'ALL' && item.kind !== kindFilter) return false;
        const itemKey = toLocalDateKey(item.createdAt);
        if (dateFilter === 'TODAY') return itemKey === todayKey;
        if (dateFilter === 'WEEK') return itemKey >= weekStartKey && itemKey <= todayKey;
        if (dateFilter === 'MONTH') return itemKey.startsWith(monthPrefix);
        if (dateFilter === 'CUSTOM') return itemKey === customFilterDate;
        return true;
      })
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [expenses, kindFilter, dateFilter, customFilterDate]);

  const filteredStats = useMemo(
    () => computeExpenseStats(filteredExpenses),
    [filteredExpenses]
  );

  const dayTotals = useMemo(() => {
    const map = {};
    for (const e of filteredExpenses) {
      const k = toLocalDateKey(e.createdAt);
      if (!k) continue;
      if (!map[k]) map[k] = { cashIn: 0, spent: 0 };
      if (e.kind === 'CASH_IN') map[k].cashIn += Number(e.amount) || 0;
      else map[k].spent += Number(e.amount) || 0;
    }
    return map;
  }, [filteredExpenses]);

  const openModal = (targetKind = 'EXPENSE') => {
    hapticTap('light');
    setKind(targetKind);
    setAmountText('');
    setTitleText('');
    setCategory('Transpo');
    setEntryDateKey(dateFilter === 'CUSTOM' ? customFilterDate : toLocalDateKey(new Date()));
    setError('');
    setModalVisible(true);
  };

  useEffect(() => {
    if (externalModalTrigger) {
      openModal(externalModalTrigger === 'CASH_IN' ? 'CASH_IN' : 'EXPENSE');
      onExternalTriggerHandled && onExternalTriggerHandled();
    }
  }, [externalModalTrigger, onExternalTriggerHandled]);

  function handleAmountChange(raw) {
    const cleaned = raw.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const normalized =
      parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned;
    setAmountText(normalized);
    setError('');
  }

  function handleSave() {
    const num = parseFloat(amountText);
    if (!amountText || Number.isNaN(num) || num <= 0) {
      hapticNotify('error');
      setError('Enter an amount greater than 0');
      return;
    }

    const label =
      titleText.trim() ||
      (kind === 'CASH_IN' ? 'Cash on hand' : category || 'Expense');

    hapticNotify('success');
    onAddEntry({
      id: makeId('exp'),
      kind,
      amount: Math.round(num * 100) / 100,
      title: label,
      category: kind === 'CASH_IN' ? 'Cash' : category,
      createdAt: dateKeyToIso(entryDateKey)
    });

    setModalVisible(false);
  }

  function confirmDelete(entry) {
    hapticTap('light');
    Alert.alert(
      'Delete record',
      `Remove "${entry.title}" (${formatPeso(entry.amount)})? Your cash balance will update automatically.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDeleteEntry(entry.id)
        }
      ]
    );
  }

  function confirmReset() {
    hapticTap('heavy');
    Alert.alert(
      'Reset Expenses',
      'Clear all cash and expense history? Current cash will reset to ₱0.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: () => onClearAll() }
      ]
    );
  }

  const parsedInput = parseFloat(amountText) || 0;
  const previewBalance =
    kind === 'CASH_IN'
      ? overallStats.balance + parsedInput
      : overallStats.balance - parsedInput;

  const remainingRatio =
    overallStats.totalCashIn > 0
      ? Math.max(
          0,
          Math.min(100, Math.round((overallStats.balance / overallStats.totalCashIn) * 100))
        )
      : 0;

  const todayKey = toLocalDateKey(new Date());
  const yestKey = addDaysToDateKey(todayKey, -1);
  const hasActiveFilter = dateFilter !== 'ALL' || kindFilter !== 'ALL';

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredExpenses}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>CURRENT CASH / SAVINGS</Text>
              <Text
                style={[
                  styles.balanceAmount,
                  overallStats.balance < 0 && { color: colors.danger }
                ]}
              >
                {formatPeso(overallStats.balance)}
              </Text>

              {overallStats.totalCashIn > 0 && (
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${remainingRatio}%` }]} />
                </View>
              )}

              <View style={styles.metricsRow}>
                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>CASH ADDED</Text>
                  <Text style={styles.metricValue}>
                    {formatPeso(overallStats.totalCashIn)}
                  </Text>
                </View>

                <View style={styles.metricDivider} />

                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>TOTAL SPENT</Text>
                  <Text style={styles.metricValue}>
                    {formatPeso(overallStats.totalSpent)}
                  </Text>
                </View>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.cashBtn}
                  onPress={() => openModal('CASH_IN')}
                  activeOpacity={0.75}
                >
                  <Feather name="plus" size={15} color={colors.textPrimary} />
                  <Text style={styles.cashBtnText}>Add Cash</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.expenseBtn}
                  onPress={() => openModal('EXPENSE')}
                  activeOpacity={0.85}
                >
                  <Feather name="minus" size={15} color={colors.solidBtnText} />
                  <Text style={styles.expenseBtnText}>Add Expense</Text>
                </TouchableOpacity>
              </View>
            </View>

            {expenses.length > 0 && (
              <View style={styles.filtersWrap}>
                <View style={styles.kindRow}>
                  {KIND_FILTERS.map((kf) => {
                    const active = kindFilter === kf.id;
                    return (
                      <TouchableOpacity
                        key={kf.id}
                        style={[styles.kindPill, active && styles.kindPillActive]}
                        onPress={() => {
                          hapticTap('light');
                          setKindFilter(kf.id);
                        }}
                      >
                        <Text
                          style={[
                            styles.kindPillText,
                            active && styles.kindPillTextActive
                          ]}
                        >
                          {kf.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.dateFilterScroll}
                >
                  {DATE_FILTERS.map((df) => {
                    const active = dateFilter === df.id;
                    const label =
                      df.id === 'CUSTOM' && active
                        ? formatShortDate(customFilterDate)
                        : df.label;
                    return (
                      <TouchableOpacity
                        key={df.id}
                        style={[styles.datePill, active && styles.datePillActive]}
                        onPress={() => {
                          hapticTap('light');
                          if (df.id === 'CUSTOM') {
                            setFilterCalendarOpen(true);
                          } else {
                            setDateFilter(df.id);
                          }
                        }}
                      >
                        {df.id === 'CUSTOM' && (
                          <Feather
                            name="calendar"
                            size={11}
                            color={active ? colors.solidBtnText : colors.textMuted}
                          />
                        )}
                        <Text
                          style={[
                            styles.datePillText,
                            active && styles.datePillTextActive
                          ]}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {hasActiveFilter && (
                  <View style={styles.filteredStrip}>
                    <Text style={styles.filteredStripText}>
                      {filteredExpenses.length}{' '}
                      {filteredExpenses.length === 1 ? 'record' : 'records'}
                      {kindFilter !== 'EXPENSE'
                        ? ` • +${formatPeso(filteredStats.totalCashIn)} cash`
                        : ''}
                      {kindFilter !== 'CASH_IN'
                        ? ` • -${formatPeso(filteredStats.totalSpent)} spent`
                        : ''}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setDateFilter('ALL');
                        setKindFilter('ALL');
                      }}
                      hitSlop={6}
                    >
                      <Text style={styles.clearFilterText}>Reset</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionHeaderText}>HISTORY</Text>
                  <TouchableOpacity onPress={confirmReset} hitSlop={8}>
                    <Text style={styles.resetText}>Clear All</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        }
        renderItem={({ item, index }) => {
          const isCashIn = item.kind === 'CASH_IN';
          const itemDayKey = toLocalDateKey(item.createdAt);
          const prevDayKey =
            index > 0 ? toLocalDateKey(filteredExpenses[index - 1]?.createdAt) : null;
          const showDayHeader = index === 0 || itemDayKey !== prevDayKey;
          const dayInfo = dayTotals[itemDayKey] || { cashIn: 0, spent: 0 };
          const dayLabel =
            itemDayKey === todayKey
              ? 'TODAY'
              : itemDayKey === yestKey
              ? 'YESTERDAY'
              : formatShortDate(itemDayKey).toUpperCase();

          return (
            <View>
              {showDayHeader && (
                <View style={[styles.dayGroupHeader, index > 0 && { marginTop: 10 }]}>
                  <Text style={styles.dayGroupLabel}>{dayLabel}</Text>
                  <Text style={styles.dayGroupSummary}>
                    {dayInfo.cashIn > 0 ? `+${formatPeso(dayInfo.cashIn)}` : ''}
                    {dayInfo.cashIn > 0 && dayInfo.spent > 0 ? '  •  ' : ''}
                    {dayInfo.spent > 0 ? `-${formatPeso(dayInfo.spent)}` : ''}
                  </Text>
                </View>
              )}

              <View style={styles.txRow}>
                <View style={[styles.txIconBox, isCashIn && styles.txIconBoxCash]}>
                  <Feather
                    name={isCashIn ? 'arrow-down-left' : 'arrow-up-right'}
                    size={15}
                    color={isCashIn ? colors.success : colors.textSecondary}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.txTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.txMeta}>
                    {item.category ? `${item.category} • ` : ''}
                    {formatDate(item.createdAt)}
                  </Text>
                </View>

                <Text style={[styles.txAmount, isCashIn && { color: colors.success }]}>
                  {isCashIn ? '+' : '-'}
                  {formatPeso(item.amount)}
                </Text>

                <TouchableOpacity
                  onPress={() => confirmDelete(item)}
                  style={styles.txDeleteBtn}
                  hitSlop={8}
                >
                  <Feather name="trash-2" size={13} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Feather
              name={hasActiveFilter ? 'calendar' : 'credit-card'}
              size={24}
              color={colors.textMuted}
            />
            <Text style={styles.emptyTitle}>
              {hasActiveFilter ? 'No matching records' : 'No cash or expenses yet'}
            </Text>
            <Text style={styles.emptySub}>
              {hasActiveFilter
                ? 'Try selecting All Dates or switching between Cash Added and Expenses.'
                : 'Tap "Add Cash" to enter your current cash (e.g. ₱2,000), then add expenses like ₱20 pamasahe to automatically deduct.'}
            </Text>
          </View>
        }
      />

      <DatePickerModal
        visible={filterCalendarOpen}
        selectedDateKey={customFilterDate}
        markedDateKeys={markedDateKeys}
        title="Filter by Date"
        onSelect={(key) => {
          setCustomFilterDate(key);
          setDateFilter('CUSTOM');
          setFilterCalendarOpen(false);
        }}
        onClose={() => setFilterCalendarOpen(false)}
      />

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalSheet, { paddingBottom: Math.max(18, insets.bottom + 8) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {kind === 'CASH_IN' ? 'Add Cash' : 'Log Expense'}
              </Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.modalCloseBtn}
                hitSlop={10}
              >
                <Feather name="x" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.segment}>
                <TouchableOpacity
                  style={[styles.segBtn, kind === 'CASH_IN' && styles.segBtnActive]}
                  onPress={() => {
                    hapticTap('light');
                    setKind('CASH_IN');
                    setError('');
                  }}
                >
                  <Text style={[styles.segText, kind === 'CASH_IN' && styles.segTextActive]}>
                    + Add Cash
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segBtn, kind === 'EXPENSE' && styles.segBtnActive]}
                  onPress={() => {
                    hapticTap('light');
                    setKind('EXPENSE');
                    setError('');
                  }}
                >
                  <Text style={[styles.segText, kind === 'EXPENSE' && styles.segTextActive]}>
                    - Expense
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>AMOUNT (PESOS)</Text>
              <View style={styles.amountInputWrap}>
                <Text style={styles.pesoPrefix}>₱</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  value={amountText}
                  onChangeText={handleAmountChange}
                  autoFocus
                />
              </View>

              {kind === 'CASH_IN' && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chipsScroll}
                >
                  {CASH_PRESETS.map((val) => (
                    <TouchableOpacity
                      key={val}
                      style={styles.presetChip}
                      onPress={() => {
                        hapticTap('light');
                        setAmountText(String(val));
                        setError('');
                      }}
                    >
                      <Text style={styles.presetChipText}>{formatPeso(val)}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {kind === 'EXPENSE' && (
                <>
                  <Text style={styles.inputLabel}>CATEGORY</Text>
                  <View style={styles.catGrid}>
                    {EXPENSE_CATEGORIES.map((cat) => {
                      const active = category === cat;
                      return (
                        <TouchableOpacity
                          key={cat}
                          style={[styles.catChip, active && styles.catChipActive]}
                          onPress={() => {
                            hapticTap('light');
                            setCategory(cat);
                          }}
                        >
                          <Text style={[styles.catChipText, active && styles.catChipTextActive]}>
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              <Text style={styles.inputLabel}>DATE</Text>
              <View style={styles.entryDateRow}>
                <TouchableOpacity
                  style={[
                    styles.entryDateChip,
                    entryDateKey === todayKey && styles.entryDateChipActive
                  ]}
                  onPress={() => {
                    hapticTap('light');
                    setEntryDateKey(todayKey);
                  }}
                >
                  <Text
                    style={[
                      styles.entryDateChipText,
                      entryDateKey === todayKey && styles.entryDateChipTextActive
                    ]}
                  >
                    Today
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.entryDateChip,
                    entryDateKey === yestKey && styles.entryDateChipActive
                  ]}
                  onPress={() => {
                    hapticTap('light');
                    setEntryDateKey(yestKey);
                  }}
                >
                  <Text
                    style={[
                      styles.entryDateChipText,
                      entryDateKey === yestKey && styles.entryDateChipTextActive
                    ]}
                  >
                    Yesterday
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.entryDateChip,
                    { flex: 1, justifyContent: 'center' },
                    entryDateKey !== todayKey &&
                      entryDateKey !== yestKey &&
                      styles.entryDateChipActive
                  ]}
                  onPress={() => {
                    hapticTap('light');
                    setEntryCalendarOpen(true);
                  }}
                >
                  <Feather
                    name="calendar"
                    size={12}
                    color={
                      entryDateKey !== todayKey && entryDateKey !== yestKey
                        ? colors.textPrimary
                        : colors.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.entryDateChipText,
                      entryDateKey !== todayKey &&
                        entryDateKey !== yestKey &&
                        styles.entryDateChipTextActive
                    ]}
                    numberOfLines={1}
                  >
                    {formatShortDate(entryDateKey)}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>
                {kind === 'CASH_IN' ? 'SOURCE / NOTE (OPTIONAL)' : 'WHAT FOR? (E.G. PAMASAHE)'}
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder={
                  kind === 'CASH_IN'
                    ? 'e.g. Current cash on hand, Allowance'
                    : 'e.g. Pamasahe, Lunch, Load'
                }
                placeholderTextColor={colors.textMuted}
                value={titleText}
                onChangeText={setTitleText}
              />

              {parsedInput > 0 && (
                <View style={styles.previewBox}>
                  <Text style={styles.previewLabel}>Updated cash balance:</Text>
                  <Text
                    style={[
                      styles.previewVal,
                      previewBalance < 0 && { color: colors.danger }
                    ]}
                  >
                    {formatPeso(previewBalance)}
                  </Text>
                </View>
              )}

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
                <Text style={styles.saveBtnText}>
                  {kind === 'CASH_IN'
                    ? parsedInput > 0
                      ? `Add ${formatPeso(parsedInput)} Cash`
                      : 'Add Cash'
                    : parsedInput > 0
                    ? `Deduct ${formatPeso(parsedInput)}`
                    : 'Save Expense'}
                </Text>
              </TouchableOpacity>
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>

        <DatePickerModal
          visible={entryCalendarOpen}
          selectedDateKey={entryDateKey}
          markedDateKeys={markedDateKeys}
          title="Select Entry Date"
          onSelect={(key) => {
            setEntryDateKey(key);
            setEntryCalendarOpen(false);
          }}
          onClose={() => setEntryCalendarOpen(false)}
        />
      </Modal>
    </View>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1
    },
    listContent: {
      paddingHorizontal: 20,
      paddingTop: 6,
      paddingBottom: 28
    },
    balanceCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 18,
      marginBottom: 14
    },
    balanceLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.9,
      marginBottom: 6
    },
    balanceAmount: {
      fontSize: 34,
      fontWeight: '800',
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
      letterSpacing: -1,
      marginBottom: 12
    },
    progressTrack: {
      height: 4,
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 2,
      overflow: 'hidden',
      marginBottom: 14
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.textPrimary,
      borderRadius: 2
    },
    metricsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 10,
      marginBottom: 14
    },
    metricBox: {
      flex: 1,
      alignItems: 'center'
    },
    metricDivider: {
      width: 1,
      height: 24,
      backgroundColor: colors.border
    },
    metricLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.6,
      marginBottom: 2
    },
    metricValue: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
      fontVariant: ['tabular-nums']
    },
    actionRow: {
      flexDirection: 'row',
      gap: 10
    },
    cashBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.borderHover,
      borderRadius: 10,
      paddingVertical: 11
    },
    cashBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary
    },
    expenseBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.solidBtnBg,
      borderRadius: 10,
      paddingVertical: 11
    },
    expenseBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.solidBtnText
    },
    filtersWrap: {
      marginBottom: 6
    },
    kindRow: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 3,
      marginBottom: 10
    },
    kindPill: {
      flex: 1,
      paddingVertical: 7,
      borderRadius: 7,
      alignItems: 'center'
    },
    kindPillActive: {
      backgroundColor: colors.surfaceElevated
    },
    kindPillText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted
    },
    kindPillTextActive: {
      color: colors.textPrimary,
      fontWeight: '700'
    },
    dateFilterScroll: {
      gap: 7,
      paddingBottom: 10
    },
    datePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 11,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border
    },
    datePillActive: {
      backgroundColor: colors.solidBtnBg,
      borderColor: colors.solidBtnBg
    },
    datePillText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary
    },
    datePillTextActive: {
      color: colors.solidBtnText,
      fontWeight: '700'
    },
    filteredStrip: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 9,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 12
    },
    filteredStripText: {
      fontSize: 11.5,
      color: colors.textSecondary,
      fontWeight: '600'
    },
    clearFilterText: {
      fontSize: 11.5,
      color: colors.textPrimary,
      fontWeight: '700'
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10
    },
    sectionHeaderText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.8
    },
    resetText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted
    },
    dayGroupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 2,
      marginBottom: 7
    },
    dayGroupLabel: {
      fontSize: 10.5,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.7
    },
    dayGroupSummary: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary
    },
    txRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      marginBottom: 8,
      gap: 10
    },
    txIconBox: {
      width: 34,
      height: 34,
      borderRadius: 9,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center'
    },
    txIconBoxCash: {
      backgroundColor: colors.successTint,
      borderColor: 'rgba(48, 164, 108, 0.35)'
    },
    txTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 2
    },
    txMeta: {
      fontSize: 11,
      color: colors.textMuted
    },
    txAmount: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
      fontVariant: ['tabular-nums']
    },
    txDeleteBtn: {
      padding: 4,
      marginLeft: 2
    },
    emptyBox: {
      alignItems: 'center',
      paddingVertical: 40,
      paddingHorizontal: 20,
      gap: 8
    },
    emptyTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 4
    },
    emptySub: {
      fontSize: 12.5,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 18,
      maxWidth: 270
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: colors.backdrop,
      justifyContent: 'flex-end'
    },
    modalSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 18,
      paddingTop: 16,
      maxHeight: '90%'
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary
    },
    modalCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center'
    },
    segment: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 3,
      marginBottom: 16
    },
    segBtn: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      borderRadius: 7
    },
    segBtnActive: {
      backgroundColor: colors.surface
    },
    segText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted
    },
    segTextActive: {
      color: colors.textPrimary,
      fontWeight: '700'
    },
    inputLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.8,
      marginBottom: 6
    },
    amountInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 12
    },
    pesoPrefix: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.textMuted,
      marginRight: 8
    },
    amountInput: {
      flex: 1,
      fontSize: 28,
      fontWeight: '800',
      color: colors.textPrimary
    },
    chipsScroll: {
      marginBottom: 14
    },
    presetChip: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      marginRight: 8
    },
    presetChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary
    },
    catGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
      marginBottom: 14
    },
    catChip: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 11,
      paddingVertical: 6
    },
    catChipActive: {
      borderColor: colors.textPrimary,
      backgroundColor: colors.surfaceSubtle
    },
    catChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted
    },
    catChipTextActive: {
      color: colors.textPrimary,
      fontWeight: '700'
    },
    entryDateRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 14
    },
    entryDateChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 9,
      paddingHorizontal: 12,
      paddingVertical: 9
    },
    entryDateChipActive: {
      borderColor: colors.textPrimary,
      backgroundColor: colors.surfaceSubtle
    },
    entryDateChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted
    },
    entryDateChipTextActive: {
      color: colors.textPrimary,
      fontWeight: '700'
    },
    textInput: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      color: colors.textPrimary,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      marginBottom: 14
    },
    previewBox: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 12
    },
    previewLabel: {
      fontSize: 12,
      color: colors.textSecondary
    },
    previewVal: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary
    },
    errorText: {
      color: colors.danger,
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 8
    },
    saveBtn: {
      backgroundColor: colors.solidBtnBg,
      borderRadius: 12,
      paddingVertical: 13,
      alignItems: 'center'
    },
    saveBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.solidBtnText
    }
  });
