// ============================================================================
// src/components/VaultItemCard.js — Specialized card renderer per item type
// ============================================================================

import React, { useState, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Linking, Alert } from 'react-native';
import { COLORS } from '../theme/colors';
import { formatDate } from '../utils/helpers';

const TYPE_META = {
  NOTE: { icon: '💡', label: 'Note', color: COLORS.note },
  SNIPPET: { icon: '💻', label: 'Snippet', color: COLORS.snippet },
  PASSWORD: { icon: '🔐', label: 'Password', color: COLORS.password },
  CHECKLIST: { icon: '✅', label: 'Checklist', color: COLORS.checklist },
  LINK: { icon: '🔗', label: 'Link', color: COLORS.link }
};

function VaultItemCard({
  item,
  hasPin,
  sessionUnlocked,
  onRequestUnlock,
  onToggleTask,
  onTogglePin,
  onEdit,
  onDelete,
  onCopy
}) {
  const [revealPw, setRevealPw] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const meta = TYPE_META[item.type] || TYPE_META.NOTE;
  const gated = item.isLocked && hasPin && !sessionUnlocked;

  // Run an action only after the PIN is verified (if this item is gated)
  const withUnlock = (fn) => () => (gated ? onRequestUnlock(fn) : fn());

  const confirmDelete = () =>
    Alert.alert('Delete item?', `"${item.title}" will be removed from your vault.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(item.id) }
    ]);

  const checklist = item.checklist || [];
  const doneCount = checklist.filter((c) => c.done).length;
  const pct = checklist.length ? Math.round((doneCount / checklist.length) * 100) : 0;

  const longText = (item.content || '').length > 220;
  const bodyText = expanded || !longText ? item.content : `${item.content.slice(0, 220)}…`;

  return (
    <View style={[styles.card, { borderLeftColor: meta.color }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={[styles.typeBadge, { backgroundColor: `${meta.color}1F` }]}>
          <Text style={[styles.typeBadgeText, { color: meta.color }]}>
            {meta.icon} {item.type === 'SNIPPET' && item.language ? item.language.toUpperCase() : meta.label}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {item.isLocked && <Text style={styles.lockMark}>{gated ? '🔒' : '🔓'}</Text>}
          <TouchableOpacity onPress={() => onTogglePin(item.id)} hitSlop={8}>
            <Text style={[styles.pinIcon, !item.isPinned && { opacity: 0.3 }]}>📌</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {item.title}
      </Text>

      {/* Gated body */}
      {gated && item.type !== 'PASSWORD' ? (
        <TouchableOpacity style={styles.lockedBox} onPress={() => onRequestUnlock()}>
          <Text style={styles.lockedText}>🔒 Locked — tap to unlock with PIN</Text>
        </TouchableOpacity>
      ) : (
        <>
          {/* SNIPPET */}
          {item.type === 'SNIPPET' && (
            <View style={styles.codeBox}>
              <Text style={styles.codeText} numberOfLines={expanded ? undefined : 10} selectable>
                {item.content || '// empty snippet'}
              </Text>
            </View>
          )}

          {/* PASSWORD */}
          {item.type === 'PASSWORD' && (
            <View style={styles.pwBox}>
              {item.username ? (
                <View style={styles.pwRow}>
                  <Text style={styles.pwLabel}>User</Text>
                  <Text style={styles.pwValue} numberOfLines={1}>
                    {item.username}
                  </Text>
                  <TouchableOpacity onPress={() => onCopy(item.username, 'Username')} hitSlop={6}>
                    <Text style={styles.smallAction}>📋</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              <View style={styles.pwRow}>
                <Text style={styles.pwLabel}>Pass</Text>
                <Text style={[styles.pwValue, styles.mono]} numberOfLines={1} selectable={revealPw}>
                  {revealPw && !gated ? item.secretPassword : '••••••••••••'}
                </Text>
                <TouchableOpacity
                  onPress={revealPw ? () => setRevealPw(false) : withUnlock(() => setRevealPw(true))}
                  hitSlop={6}
                >
                  <Text style={styles.smallAction}>{revealPw ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={withUnlock(() => onCopy(item.secretPassword, 'Password'))}
                  hitSlop={6}
                >
                  <Text style={styles.smallAction}>📋</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* CHECKLIST */}
          {item.type === 'CHECKLIST' && checklist.length > 0 && (
            <View style={{ marginTop: 8 }}>
              <View style={styles.progressRow}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressBar, { width: `${pct}%` }]} />
                </View>
                <Text style={styles.progressText}>
                  {doneCount}/{checklist.length} • {pct}%
                </Text>
              </View>
              {(expanded ? checklist : checklist.slice(0, 5)).map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.taskRow}
                  onPress={() => onToggleTask(item.id, c.id)}
                  activeOpacity={0.6}
                >
                  <Text style={{ fontSize: 15 }}>{c.done ? '✅' : '⬜'}</Text>
                  <Text style={[styles.taskText, c.done && styles.taskDone]} numberOfLines={2}>
                    {c.text}
                  </Text>
                </TouchableOpacity>
              ))}
              {!expanded && checklist.length > 5 && (
                <TouchableOpacity onPress={() => setExpanded(true)}>
                  <Text style={styles.moreText}>+ {checklist.length - 5} more</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* LINK */}
          {item.type === 'LINK' && item.websiteUrl ? (
            <TouchableOpacity onPress={() => Linking.openURL(item.websiteUrl).catch(() => {})}>
              <Text style={styles.linkText} numberOfLines={1}>
                {item.websiteUrl}
              </Text>
            </TouchableOpacity>
          ) : null}

          {/* Body text (all types except snippet) */}
          {item.type !== 'SNIPPET' && item.content ? (
            <Text style={styles.body} selectable>
              {bodyText}
            </Text>
          ) : null}

          {(longText || (item.type === 'SNIPPET' && (item.content || '').split('\n').length > 10)) && (
            <TouchableOpacity onPress={() => setExpanded((e) => !e)}>
              <Text style={styles.moreText}>{expanded ? 'Show less' : 'Show more'}</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {/* Tags */}
      {(item.tags || []).length > 0 && (
        <View style={styles.tagRow}>
          {item.tags.map((t) => (
            <Text key={t} style={styles.tag}>
              {t}
            </Text>
          ))}
        </View>
      )}

      {/* Footer actions */}
      <View style={styles.footer}>
        <Text style={styles.date}>{formatDate(item.updatedAt)}</Text>
        <View style={styles.footerActions}>
          {item.type === 'SNIPPET' && (
            <TouchableOpacity
              style={[styles.actionPill, { borderColor: COLORS.snippet }]}
              onPress={withUnlock(() => onCopy(item.content, 'Code'))}
            >
              <Text style={[styles.actionText, { color: COLORS.snippet }]}>📋 Copy</Text>
            </TouchableOpacity>
          )}
          {item.type === 'LINK' && (
            <>
              <TouchableOpacity
                style={styles.actionPill}
                onPress={() => onCopy(item.websiteUrl, 'Link')}
              >
                <Text style={styles.actionText}>📋</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionPill, { borderColor: COLORS.link }]}
                onPress={() => Linking.openURL(item.websiteUrl).catch(() => {})}
              >
                <Text style={[styles.actionText, { color: COLORS.link }]}>🌐 Open</Text>
              </TouchableOpacity>
            </>
          )}
          {item.type === 'NOTE' && item.content ? (
            <TouchableOpacity
              style={styles.actionPill}
              onPress={withUnlock(() => onCopy(item.content, 'Note'))}
            >
              <Text style={styles.actionText}>📋</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.actionPill} onPress={withUnlock(() => onEdit(item))}>
            <Text style={styles.actionText}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionPill} onPress={withUnlock(confirmDelete)}>
            <Text style={styles.actionText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default memo(VaultItemCard);

const mono = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 3,
    padding: 14,
    marginBottom: 12
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typeBadge: { paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999 },
  typeBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lockMark: { fontSize: 13 },
  pinIcon: { fontSize: 15 },
  title: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800', marginTop: 9 },
  body: { color: COLORS.textSecondary, fontSize: 13.5, lineHeight: 19, marginTop: 6 },
  lockedBox: {
    marginTop: 9,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    alignItems: 'center'
  },
  lockedText: { color: COLORS.textMuted, fontSize: 13, fontWeight: '700' },
  codeBox: {
    marginTop: 9,
    backgroundColor: '#09090D',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E1B2E',
    padding: 12
  },
  codeText: { color: '#E9D5FF', fontFamily: mono, fontSize: 12, lineHeight: 17 },
  pwBox: {
    marginTop: 9,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 12,
    padding: 10,
    gap: 6
  },
  pwRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pwLabel: { color: COLORS.textMuted, fontSize: 11, fontWeight: '800', width: 34 },
  pwValue: { flex: 1, color: COLORS.textPrimary, fontSize: 13.5 },
  mono: { fontFamily: mono },
  smallAction: { fontSize: 15 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  progressTrack: { flex: 1, height: 5, borderRadius: 3, backgroundColor: COLORS.border, overflow: 'hidden' },
  progressBar: { height: 5, borderRadius: 3, backgroundColor: COLORS.checklist },
  progressText: { color: COLORS.checklist, fontSize: 11.5, fontWeight: '800' },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 5 },
  taskText: { flex: 1, color: COLORS.textPrimary, fontSize: 13.5 },
  taskDone: { color: COLORS.textMuted, textDecorationLine: 'line-through' },
  linkText: { color: COLORS.link, fontSize: 13, marginTop: 7, textDecorationLine: 'underline' },
  moreText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 6 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: COLORS.surfaceElevated,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    overflow: 'hidden'
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border
  },
  date: { color: COLORS.textMuted, fontSize: 11 },
  footerActions: { flexDirection: 'row', gap: 6 },
  actionPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  actionText: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '700' }
});
