// ============================================================================
// src/components/ExpensesSection.js — Minimalist Cash & Expense Tracker
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
import { COLORS } from '../theme/colors';
import {
  makeId,
  nowIso,
  formatDate,
  formatPeso,
  computeExpenseStats,
  hapticTap,
  hapticNotify
} from '../utils/helpers';

const EXPENSE_CATEGORIES = ['Transpo', 'Food', 'Bills', 'Load', 'Shopping', 'Other'];
const CASH_PRESETS = [100, 500, 1000, 2000, 5000];

export default function ExpensesSection({
  expenses = [],
  onAddEntry,
  onDeleteEntry,
  onClearAll,
  externalModalTrigger,
  onExternalTriggerHandled
}) {
  const [modalVisible, setModalVisible] = useState(false);
  const [kind, setKind] = useState('EXPENSE'); // 'CASH_IN' | 'EXPENSE'
  const [amountText, setAmountText] = useState('');
  const [titleText, setTitleText] = useState('');
  const [category, setCategory] = useState('Transpo');
  const [error, setError] = useState('');

  const stats = useMemo(() => computeExpenseStats(expenses), [expenses]);

  const openModal = (targetKind = 'EXPENSE') => {
    hapticTap('light');
    setKind(targetKind);
    setAmountText('');
    setTitleText('');
    setCategory('Transpo');
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
    // Allow digits and at most one decimal dot
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
      createdAt: nowIso()
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
      ? stats.balance + parsedInput
      : stats.balance - parsedInput;

  const remainingRatio =
    stats.totalCashIn > 0
      ? Math.max(0, Math.min(100, Math.round((stats.balance / stats.totalCashIn) * 100)))
      : 0;

  return (
    <View style={styles.container}>
      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {/* Hero Balance Card */}
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>CURRENT CASH / SAVINGS</Text>
              <Text
                style={[
                  styles.balanceAmount,
                  stats.balance < 0 && { color: COLORS.danger }
                ]}
              >
                {formatPeso(stats.balance)}
              </Text>

              {stats.totalCashIn > 0 && (
                <View style={styles.progressTrack}>
                  <View
                    style={[styles.progressFill, { width: `${remainingRatio}%` }]}
                  />
                </View>
              )}

              <View style={styles.metricsRow}>
                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>CASH ADDED</Text>
                  <Text style={styles.metricValue}>
                    {formatPeso(stats.totalCashIn)}
                  </Text>
                </View>

                <View style={styles.metricDivider} />

                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>TOTAL SPENT</Text>
                  <Text style={styles.metricValue}>
                    {formatPeso(stats.totalSpent)}
                  </Text>
                </View>
              </View>

              {/* Primary Action Buttons */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.cashBtn}
                  onPress={() => openModal('CASH_IN')}
                  activeOpacity={0.75}
                >
                  <Feather name="plus" size={15} color={COLORS.textPrimary} />
                  <Text style={styles.cashBtnText}>Add Cash</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.expenseBtn}
                  onPress={() => openModal('EXPENSE')}
                  activeOpacity={0.85}
                >
                  <Feather name="minus" size={15} color="#000000" />
                  <Text style={styles.expenseBtnText}>Add Expense</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Transactions Header */}
            {expenses.length > 0 && (
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeaderText}>HISTORY</Text>
                <TouchableOpacity onPress={confirmReset} hitSlop={8}>
                  <Text style={styles.resetText}>Reset</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        }
        renderItem={({ item }) => {
          const isCashIn = item.kind === 'CASH_IN';
          return (
            <View style={styles.txRow}>
              <View
                style={[
                  styles.txIconBox,
                  isCashIn && styles.txIconBoxCash
                ]}
              >
                <Feather
                  name={isCashIn ? 'arrow-down-left' : 'arrow-up-right'}
                  size={15}
                  color={isCashIn ? COLORS.success : COLORS.textSecondary}
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

              <Text
                style={[
                  styles.txAmount,
                  isCashIn && { color: COLORS.success }
                ]}
              >
                {isCashIn ? '+' : '-'}
                {formatPeso(item.amount)}
              </Text>

              <TouchableOpacity
                onPress={() => confirmDelete(item)}
                style={styles.txDeleteBtn}
                hitSlop={8}
              >
                <Feather name="trash-2" size={13} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Feather name="credit-card" size={24} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>No cash or expenses yet</Text>
            <Text style={styles.emptySub}>
              Tap "Add Cash" to enter your current cash (e.g. ₱2,000), then add expenses
              like ₱20 pamasahe to automatically deduct.
            </Text>
          </View>
        }
      />

      {/* Add Cash / Expense Modal */}
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
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {kind === 'CASH_IN' ? 'Add Cash' : 'Log Expense'}
              </Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.modalCloseBtn}
                hitSlop={10}
              >
                <Feather name="x" size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {/* Toggle Cash In vs Expense */}
              <View style={styles.segment}>
                <TouchableOpacity
                  style={[styles.segBtn, kind === 'CASH_IN' && styles.segBtnActive]}
                  onPress={() => {
                    hapticTap('light');
                    setKind('CASH_IN');
                    setError('');
                  }}
                >
                  <Text
                    style={[styles.segText, kind === 'CASH_IN' && styles.segTextActive]}
                  >
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
                  <Text
                    style={[styles.segText, kind === 'EXPENSE' && styles.segTextActive]}
                  >
                    - Expense
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Amount Input */}
              <Text style={styles.inputLabel}>AMOUNT (PESOS)</Text>
              <View style={styles.amountInputWrap}>
                <Text style={styles.pesoPrefix}>₱</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="decimal-pad"
                  value={amountText}
                  onChangeText={handleAmountChange}
                  autoFocus
                />
              </View>

              {/* Cash Presets */}
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

              {/* Expense Category Pills */}
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
                          <Text
                            style={[
                              styles.catChipText,
                              active && styles.catChipTextActive
                            ]}
                          >
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              {/* Description */}
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
                placeholderTextColor={COLORS.textMuted}
                value={titleText}
                onChangeText={setTitleText}
              />

              {/* Live Balance Preview */}
              {parsedInput > 0 && (
                <View style={styles.previewBox}>
                  <Text style={styles.previewLabel}>Updated cash balance:</Text>
                  <Text
                    style={[
                      styles.previewVal,
                      previewBalance < 0 && { color: COLORS.danger }
                    ]}
                  >
                    {formatPeso(previewBalance)}
                  </Text>
                </View>
              )}

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSave}
                activeOpacity={0.85}
              >
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
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 100
  },
  balanceCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 18,
    marginBottom: 18
  },
  balanceLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.9,
    marginBottom: 6
  },
  balanceAmount: {
    fontSize: 34,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.8,
    marginBottom: 12
  },
  progressTrack: {
    height: 4,
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 14
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.textPrimary,
    borderRadius: 2
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    backgroundColor: COLORS.border
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.6,
    marginBottom: 2
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary
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
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.borderHover,
    borderRadius: 10,
    paddingVertical: 11
  },
  cashBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary
  },
  expenseBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.textPrimary,
    borderRadius: 10,
    paddingVertical: 11
  },
  expenseBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000'
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
    color: COLORS.textMuted,
    letterSpacing: 0.8
  },
  resetText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  txIconBoxCash: {
    borderColor: 'rgba(48, 164, 108, 0.35)'
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 2
  },
  txMeta: {
    fontSize: 11,
    color: COLORS.textMuted
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary
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
    color: COLORS.textPrimary,
    marginTop: 4
  },
  emptySub: {
    fontSize: 12.5,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 270
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end'
  },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 18,
    paddingTop: 16,
    maxHeight: '88%'
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
    color: COLORS.textPrimary
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center'
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    backgroundColor: COLORS.surfaceSubtle
  },
  segText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted
  },
  segTextActive: {
    color: COLORS.textPrimary,
    fontWeight: '700'
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    marginBottom: 6
  },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12
  },
  pesoPrefix: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginRight: 8
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary
  },
  chipsScroll: {
    marginBottom: 14
  },
  presetChip: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 14
  },
  catChip: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 6
  },
  catChipActive: {
    borderColor: COLORS.textPrimary,
    backgroundColor: COLORS.surfaceSubtle
  },
  catChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted
  },
  catChipTextActive: {
    color: COLORS.textPrimary,
    fontWeight: '700'
  },
  textInput: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    color: COLORS.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 14
  },
  previewBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12
  },
  previewLabel: {
    fontSize: 12,
    color: COLORS.textSecondary
  },
  previewVal: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8
  },
  saveBtn: {
    backgroundColor: COLORS.textPrimary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center'
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000'
  }
});
