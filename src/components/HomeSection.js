// ============================================================================
// src/components/HomeSection.js — App Introduction, Overview & Section Guide
// ============================================================================

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { formatPeso, hapticTap } from '../utils/helpers';

const FEATURE_GUIDE = [
  {
    id: 'EXPENSES',
    title: 'Expenses & Cash',
    icon: 'credit-card',
    summary:
      'Add your current cash on hand (e.g. ₱2,000) and log daily spending like ₱20 pamasahe — automatically deducted from your savings.'
  },
  {
    id: 'NOTE',
    title: 'Notes & Private Photos',
    icon: 'file-text',
    summary:
      'Write personal notes, ideas, or reminders and store sensitive ID photos or receipts privately outside your public gallery.'
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
      'Keep logins masked behind your hardware-backed 4-digit PIN & biometrics, with a strong password generator built in.'
  },
  {
    id: 'CHECKLIST',
    title: 'Tasks & Checklists',
    icon: 'check-square',
    summary:
      'Track daily errands, grocery runs, or personal goals with interactive checkboxes and live completion progress.'
  },
  {
    id: 'LINK',
    title: 'Saved Links',
    icon: 'link-2',
    summary:
      'Save Facebook videos, TikToks, YouTube tutorials, or articles to watch and read later instead of messaging yourself.'
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
  stats,
  expenseStats,
  hasPin,
  onSelectSection,
  onOpenSettings
}) {
  function getCountLabel(id) {
    if (id === 'EXPENSES') return formatPeso(expenseStats.balance);
    if (id === 'NOTE') return `${stats.notes || 0}`;
    if (id === 'VOICE') return `${stats.voiceMemos || 0}`;
    if (id === 'PASSWORD') return `${stats.passwords || 0}`;
    if (id === 'CHECKLIST') return `${stats.checklists || 0}`;
    if (id === 'LINK') return `${stats.links || 0}`;
    if (id === 'PINNED') return `${stats.pinned || 0}`;
    return '';
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero Intro Card */}
      <View style={styles.heroCard}>
        <View style={styles.heroTag}>
          <Feather name="shield" size={11} color={COLORS.textSecondary} />
          <Text style={styles.heroTagText}>100% OFFLINE • STANDALONE</Text>
        </View>

        <Text style={styles.heroTitle}>Welcome to SecondBrain Vault</Text>
        <Text style={styles.heroBody}>
          Your private personal space on your phone — built so you never have to message
          yourself links, notes, or reminders again. Everything stays offline in local device
          storage with zero cloud tracking.
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
          Saved locally via SQLite & SecureStore. Use the Sections dropdown above anytime to
          switch views.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 100
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
