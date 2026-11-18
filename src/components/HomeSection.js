// ============================================================================
// src/components/HomeSection.js — App Guide + Instant Global Search
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import {
  formatPeso,
  formatDate,
  filterItems,
  hapticTap
} from '../utils/helpers';
import VaultItemCard from './VaultItemCard';

const FEATURE_GUIDE = [
  {
    id: 'EXPENSES',
    title: 'Expenses & Cash',
    icon: 'credit-card',
    summary:
      'Add your current cash on hand (e.g. ₱2,000) and log daily spending like ₱20 pamasahe with automatic deduction and date tracking.'
  },
  {
    id: 'ANALYTICS',
    title: 'Spending Analytics',
    icon: 'bar-chart-2',
    summary:
      'Visual breakdown of your cash flow, daily spending trends, top categories, and vault usage across 7 days, 30 days, or any picked date.'
  },
  {
    id: 'NOTE',
    title: 'Notes & Private Photos',
    icon: 'file-text',
    summary:
      'Write personal notes or store sensitive ID photos and receipts privately, with 1-tap sharing to Messenger/Viber.'
  },
  {
    id: 'VOICE',
    title: 'Offline Voice Memos',
    icon: 'mic',
    summary:
      'Record quick voice notes in one tap whenever typing is inconvenient, stored offline directly on your phone.'
  },
  {
    id: 'PASSWORD',
    title: 'Password Vault',
    icon: 'lock',
    summary:
      'Keep logins masked behind your hardware-backed 4-digit PIN & biometrics, with a built-in password generator.'
  },
  {
    id: 'CHECKLIST',
    title: 'Tasks & Checklists',
    icon: 'check-square',
    summary:
      'Track daily errands, grocery runs, or goals with live progress bars and 1-tap list sharing.'
  },
  {
    id: 'LINK',
    title: 'Saved Links',
    icon: 'link-2',
    summary:
      'Save Facebook videos, TikToks, YouTube tutorials, or articles to watch and read later — plus 1-tap sharing.'
  },
  {
    id: 'PINNED',
    title: 'Pinned',
    icon: 'bookmark',
    summary:
      'Quick access to all items you bookmarked across Notes, Passwords, Tasks, Voice, and Links.'
  }
];

export default function HomeSection({
  items = [],
  expenses = [],
  stats,
  expenseStats,
  hasPin,
  sessionUnlocked,
  onSelectSection,
  onOpenSettings,
  onRequestUnlock,
  onOpenDetail,
  onToggleTask,
  onTogglePin,
  onEdit,
  onDelete,
  onCopy,
  onShare
}) {
  const [globalQuery, setGlobalQuery] = useState('');

  const matchingItems = useMemo(() => {
    if (!globalQuery.trim()) return [];
    return filterItems(items, { query: globalQuery, category: 'HOME' });
  }, [items, globalQuery]);

  const matchingExpenses = useMemo(() => {
    const q = globalQuery.trim().toLowerCase();
    if (!q) return [];
    return expenses.filter((e) => {
      const hay = `${e.title} ${e.category}`.toLowerCase();
      return q.split(/\s+/).every((w) => hay.includes(w));
    });
  }, [expenses, globalQuery]);

  function getCountLabel(id) {
    if (id === 'EXPENSES') return formatPeso(expenseStats.balance);
    if (id === 'ANALYTICS') return formatPeso(expenseStats.totalSpent);
    if (id === 'NOTE') return `${stats.notes || 0}`;
    if (id === 'VOICE') return `${stats.voiceMemos || 0}`;
    if (id === 'PASSWORD') return `${stats.passwords || 0}`;
    if (id === 'CHECKLIST') return `${stats.checklists || 0}`;
    if (id === 'LINK') return `${stats.links || 0}`;
    if (id === 'PINNED') return `${stats.pinned || 0}`;
    return '';
  }

  const isSearching = globalQuery.trim().length > 0;

  return (
    <View style={styles.container}>
      {/* Global Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Feather
            name="search"
            size={15}
            color={COLORS.textMuted}
            style={{ marginRight: 8 }}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Global search (notes, passwords, links, expenses)..."
            placeholderTextColor={COLORS.textMuted}
            value={globalQuery}
            onChangeText={setGlobalQuery}
            returnKeyType="search"
          />
          {isSearching && (
            <TouchableOpacity onPress={() => setGlobalQuery('')} hitSlop={8}>
              <Feather name="x" size={15} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {isSearching ? (
          <>
            <View style={styles.resultsHeader}>
              <Text style={styles.sectionHeading}>
                GLOBAL RESULTS ({matchingItems.length + matchingExpenses.length})
              </Text>
              <TouchableOpacity onPress={() => setGlobalQuery('')}>
                <Text style={styles.clearLink}>Clear</Text>
              </TouchableOpacity>
            </View>

            {matchingItems.length === 0 && matchingExpenses.length === 0 ? (
              <View style={styles.noResultsBox}>
                <Feather name="search" size={22} color={COLORS.textMuted} />
                <Text style={styles.noResultsTitle}>Nothing matched "{globalQuery}"</Text>
                <Text style={styles.noResultsSub}>
                  Try another keyword across your notes, links, tasks, passwords, or expenses.
                </Text>
              </View>
            ) : (
              <>
                {matchingItems.map((item) => (
                  <VaultItemCard
                    key={item.id}
                    item={item}
                    hasPin={hasPin}
                    sessionUnlocked={sessionUnlocked}
                    onRequestUnlock={onRequestUnlock}
                    onOpenDetail={onOpenDetail}
                    onToggleTask={onToggleTask}
                    onTogglePin={onTogglePin}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onCopy={onCopy}
                    onShare={onShare}
                  />
                ))}

                {matchingExpenses.length > 0 && (
                  <View style={{ marginTop: 6 }}>
                    <Text style={styles.sectionHeading}>MATCHING EXPENSES & CASH</Text>
                    {matchingExpenses.map((exp) => {
                      const isCashIn = exp.kind === 'CASH_IN';
                      return (
                        <TouchableOpacity
                          key={exp.id}
                          style={styles.expResultRow}
                          onPress={() => onSelectSection('EXPENSES')}
                          activeOpacity={0.75}
                        >
                          <View style={styles.expIconBox}>
                            <Feather
                              name={isCashIn ? 'arrow-down-left' : 'arrow-up-right'}
                              size={14}
                              color={isCashIn ? COLORS.success : COLORS.textSecondary}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.expTitle}>{exp.title}</Text>
                            <Text style={styles.expMeta}>
                              {exp.category ? `${exp.category} • ` : ''}
                              {formatDate(exp.createdAt)}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.expAmount,
                              isCashIn && { color: COLORS.success }
                            ]}
                          >
                            {isCashIn ? '+' : '-'}
                            {formatPeso(exp.amount)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </>
            )}
          </>
        ) : (
          <>
            {/* Hero Intro Card */}
            <View style={styles.heroCard}>
              <View style={styles.heroTag}>
                <Feather name="shield" size={11} color={COLORS.textSecondary} />
                <Text style={styles.heroTagText}>100% OFFLINE • STANDALONE</Text>
              </View>

              <Text style={styles.heroTitle}>Welcome to SecondBrain Vault</Text>
              <Text style={styles.heroBody}>
                Your private personal space on your phone — built so you never have to
                message yourself links, notes, or reminders again. Everything stays offline
                in local device storage with zero cloud tracking.
              </Text>
            </View>

            {/* Quick Snapshot Cards */}
            <View style={styles.snapshotRow}>
              <TouchableOpacity
                style={styles.snapshotCard}
                onPress={() => {
                  hapticTap('light');
                  onSelectSection('EXPENSES');
                }}
                activeOpacity={0.75}
              >
                <Text style={styles.snapshotLabel}>CASH ON HAND</Text>
                <Text
                  style={[
                    styles.snapshotValue,
                    expenseStats.balance < 0 && { color: COLORS.danger }
                  ]}
                  numberOfLines={1}
                >
                  {formatPeso(expenseStats.balance)}
                </Text>
                <Text style={styles.snapshotHint}>Open Expenses ›</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.snapshotCard}
                onPress={() => {
                  hapticTap('light');
                  onOpenSettings();
                }}
                activeOpacity={0.75}
              >
                <Text style={styles.snapshotLabel}>VAULT STATUS</Text>
                <Text style={styles.snapshotValue}>{stats.total} Saved</Text>
                <Text style={styles.snapshotHint}>
                  {hasPin ? 'PIN Protected ›' : 'Set 4-Digit PIN ›'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Feature Guide */}
            <Text style={styles.sectionHeading}>WHAT THIS APP CAN DO</Text>

            <View style={styles.guideList}>
              {FEATURE_GUIDE.map((item, idx) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.guideRow, idx > 0 && styles.guideRowBorder]}
                  onPress={() => {
                    hapticTap('light');
                    onSelectSection(item.id);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.guideIconBox}>
                    <Feather name={item.icon} size={16} color={COLORS.textPrimary} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.guideTitleRow}>
                      <Text style={styles.guideTitle}>{item.title}</Text>
                      <Text style={styles.guideCount}>{getCountLabel(item.id)}</Text>
                    </View>
                    <Text style={styles.guideSummary}>{item.summary}</Text>
                  </View>

                  <Feather name="chevron-right" size={16} color={COLORS.textMuted} />
                </TouchableOpacity>
              ))}
            </View>

            {/* Footer Note */}
            <View style={styles.footerNote}>
              <Feather name="database" size={13} color={COLORS.textMuted} />
              <Text style={styles.footerNoteText}>
                Saved locally via SQLite & SecureStore. Use Global Search above or the
                Sections dropdown to jump anywhere.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingTop: 2,
    paddingBottom: 8
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 13.5
  },
  scroll: {
    flex: 1
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 100
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  clearLink: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginBottom: 10
  },
  noResultsBox: {
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
    gap: 8
  },
  noResultsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary
  },
  noResultsSub: {
    fontSize: 12.5,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18
  },
  expResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 10
  },
  expIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  expTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary
  },
  expMeta: {
    fontSize: 11,
    color: COLORS.textMuted
  },
  expAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary
  },
  heroCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14
  },
  heroTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 12
  },
  heroTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 0.7
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
    marginBottom: 8
  },
  heroBody: {
    fontSize: 13.5,
    color: COLORS.textSecondary,
    lineHeight: 20
  },
  snapshotRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 22
  },
  snapshotCard: {
    flex: 1,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14
  },
  snapshotLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.7,
    marginBottom: 5
  },
  snapshotValue: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4
  },
  snapshotHint: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600'
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    marginBottom: 10
  },
  guideList: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 18
  },
  guideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12
  },
  guideRowBorder: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border
  },
  guideIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginTop: 2
  },
  guideTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3
  },
  guideTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary
  },
  guideCount: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted
  },
  guideSummary: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    lineHeight: 18
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 6
  },
  footerNoteText: {
    flex: 1,
    fontSize: 11.5,
    color: COLORS.textMuted,
    lineHeight: 16
  }
});
