// ============================================================================
// src/components/VaultItemCard.js — Modern Minimalist Card Renderer
// Apple Monochrome / Minimalist Design
// ============================================================================

import React, { useState, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Linking, Alert } from 'react-native';
import { COLORS } from '../theme/colors';
import { formatDate } from '../utils/helpers';

const TYPE_LABELS = {
  NOTE: 'Note',
  SNIPPET: 'Code',
  PASSWORD: 'Password',
  CHECKLIST: 'Tasks',
  LINK: 'Link'
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
  const gated = item.isLocked && hasPin && !sessionUnlocked;

  const withUnlock = (fn) => () => (gated ? onRequestUnlock(fn) : fn());

  const confirmDelete = () =>
    Alert.alert('Delete item', `Are you sure you want to remove "${item.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(item.id) }
    ]);

  const checklist = item.checklist || [];
  const doneCount = checklist.filter((c) => c.done).length;
  const pct = checklist.length ? Math.round((doneCount / checklist.length) * 100) : 0;

  const longText = (item.content || '').length > 200;
  const bodyText = expanded || !longText ? item.content : `${item.content.slice(0, 200)}…`;

  const badgeText =
    item.type === 'SNIPPET' && item.language
      ? `CODE • ${item.language.toUpperCase()}`
      : TYPE_LABELS[item.type] || 'Note';

  return (
    <View style={styles.card}>
      {/* Top Header */}
      <View style={styles.headerRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeText}</Text>
        </View>

        <View style={styles.headerRight}>
          {item.isLocked && (
            <View style={styles.lockBadge}>
              <Text style={styles.lockBadgeText}>{gated ? 'Locked' : 'Unlocked'}</Text>
            </View>
          )}
          <TouchableOpacity
            onPress={() => onTogglePin(item.id)}
            hitSlop={8}
            style={[styles.pinBtn, item.isPinned && styles.pinBtnActive]}
          >
            <Text style={[styles.pinText, !item.isPinned && styles.pinTextInactive]}>
              {item.isPinned ? '📌' : '•'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Title */}
      <Text style={styles.title} numberOfLines={2}>
        {item.title}
      </Text>

      {/* Body Content */}
      {gated && item.type !== 'PASSWORD' ? (
        <TouchableOpacity style={styles.lockedBox} onPress={() => onRequestUnlock()} activeOpacity={0.7}>
          <Text style={styles.lockedText}>Tap to unlock with PIN</Text>
        </TouchableOpacity>
      ) : (
        <>
          {/* CODE SNIPPET */}
          {item.type === 'SNIPPET' && (
            <View style={styles.codeBox}>
              <Text style={styles.codeText} numberOfLines={expanded ? undefined : 8} selectable>
                {item.content || '// empty code snippet'}
              </Text>
            </View>
          )}

          {/* PASSWORD */}
          {item.type === 'PASSWORD' && (
            <View style={styles.pwContainer}>
              {item.username ? (
                <View style={styles.pwRow}>
                  <Text style={styles.pwKey}>User</Text>
                  <Text style={styles.pwVal} numberOfLines={1}>
                    {item.username}
                  </Text>
                  <TouchableOpacity
                    onPress={() => onCopy(item.username, 'Username')}
                    hitSlop={6}
                    style={styles.copySmallBtn}
                  >
                    <Text style={styles.copySmallText}>Copy</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              <View style={[styles.pwRow, item.username && styles.pwRowBorder]}>
                <Text style={styles.pwKey}>Pass</Text>
                <Text style={[styles.pwVal, styles.mono]} numberOfLines={1} selectable={revealPw}>
                  {revealPw && !gated ? item.secretPassword : '••••••••••••'}
                </Text>
                <TouchableOpacity
                  onPress={revealPw ? () => setRevealPw(false) : withUnlock(() => setRevealPw(true))}
                  hitSlop={6}
                  style={styles.copySmallBtn}
                >
                  <Text style={styles.copySmallText}>{revealPw ? 'Hide' : 'Reveal'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={withUnlock(() => onCopy(item.secretPassword, 'Password'))}
                  hitSlop={6}
                  style={styles.copySmallBtn}
                >
                  <Text style={styles.copySmallText}>Copy</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* CHECKLIST */}
          {item.type === 'CHECKLIST' && checklist.length > 0 && (
            <View style={styles.checklistContainer}>
              <View style={styles.progressRow}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressBar, { width: `${pct}%` }]} />
                </View>
                <Text style={styles.progressNumber}>
                  {doneCount}/{checklist.length}
                </Text>
              </View>

              {(expanded ? checklist : checklist.slice(0, 4)).map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.taskRow}
                  onPress={() => onToggleTask(item.id, c.id)}
                  activeOpacity={0.6}
                >
                  <View style={[styles.checkbox, c.done && styles.checkboxDone]}>
                    {c.done && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={[styles.taskLabel, c.done && styles.taskLabelDone]} numberOfLines={2}>
                    {c.text}
                  </Text>
                </TouchableOpacity>
              ))}

              {!expanded && checklist.length > 4 && (
                <TouchableOpacity onPress={() => setExpanded(true)} style={styles.expandMoreBtn}>
                  <Text style={styles.expandMoreText}>+{checklist.length - 4} more tasks</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* LINK */}
          {item.type === 'LINK' && item.websiteUrl ? (
            <TouchableOpacity
              onPress={() => Linking.openURL(item.websiteUrl).catch(() => {})}
              style={styles.linkBox}
              activeOpacity={0.7}
            >
              <Text style={styles.linkUrl} numberOfLines={1}>
                {item.websiteUrl}
              </Text>
              <Text style={styles.linkArrow}>↗</Text>
            </TouchableOpacity>
          ) : null}

          {/* Note Body */}
          {item.type !== 'SNIPPET' && item.content ? (
            <Text style={styles.bodyText} selectable>
              {bodyText}
            </Text>
          ) : null}

          {longText && (
            <TouchableOpacity onPress={() => setExpanded((e) => !e)} style={styles.expandBtn}>
              <Text style={styles.expandText}>{expanded ? 'Show less' : 'Read more'}</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {/* Tags */}
      {(item.tags || []).length > 0 && (
        <View style={styles.tagWrap}>
          {item.tags.map((t) => (
            <View key={t} style={styles.tagPill}>
              <Text style={styles.tagPillText}>{t}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Footer */}
      <View style={styles.footerRow}>
        <Text style={styles.dateText}>{formatDate(item.updatedAt)}</Text>

        <View style={styles.actions}>
          {item.type === 'SNIPPET' && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={withUnlock(() => onCopy(item.content, 'Code'))}
            >
              <Text style={styles.actionBtnText}>Copy Code</Text>
            </TouchableOpacity>
          )}

          {item.type === 'LINK' && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => onCopy(item.websiteUrl, 'Link')}
            >
              <Text style={styles.actionBtnText}>Copy URL</Text>
            </TouchableOpacity>
          )}

          {item.type === 'NOTE' && item.content ? (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={withUnlock(() => onCopy(item.content, 'Note'))}
            >
              <Text style={styles.actionBtnText}>Copy</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={styles.iconBtn} onPress={withUnlock(() => onEdit(item))}>
            <Text style={styles.iconBtnText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconBtn} onPress={withUnlock(confirmDelete)}>
            <Text style={[styles.iconBtnText, { color: COLORS.danger }]}>Delete</Text>
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 12
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  badge: {
    backgroundColor: COLORS.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.badgeText,
    letterSpacing: 0.8,
    textTransform: 'uppercase'
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  lockBadge: {
    backgroundColor: COLORS.surfaceSubtle,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  lockBadgeText: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600'
  },
  pinBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2
  },
  pinBtnActive: {
    opacity: 1
  },
  pinText: {
    fontSize: 12,
    color: COLORS.textPrimary
  },
  pinTextInactive: {
    color: COLORS.textMuted,
    fontSize: 16
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    lineHeight: 22,
    marginBottom: 8
  },
  bodyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 8
  },
  expandBtn: {
    paddingVertical: 4,
    marginBottom: 6
  },
  expandText: {
    fontSize: 12,
    color: COLORS.textPrimary,
    fontWeight: '600'
  },
  codeBox: {
    backgroundColor: COLORS.codeBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginVertical: 6
  },
  codeText: {
    fontFamily: mono,
    fontSize: 12,
    color: '#D4D4D8',
    lineHeight: 18
  },
  pwContainer: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    marginVertical: 6
  },
  pwRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10
  },
  pwRowBorder: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border
  },
  pwKey: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    width: 44
  },
  pwVal: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textPrimary,
    marginRight: 8
  },
  mono: {
    fontFamily: mono,
    letterSpacing: 1
  },
  copySmallBtn: {
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 6
  },
  copySmallText: {
    fontSize: 11,
    color: COLORS.textPrimary,
    fontWeight: '600'
  },
  checklistContainer: {
    marginVertical: 6
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 2,
    overflow: 'hidden',
    marginRight: 10
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.textPrimary,
    borderRadius: 2
  },
  progressNumber: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600'
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: COLORS.borderHover,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  checkboxDone: {
    backgroundColor: COLORS.textPrimary,
    borderColor: COLORS.textPrimary
  },
  checkmark: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 12
  },
  taskLabel: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 18
  },
  taskLabelDone: {
    color: COLORS.textMuted,
    textDecorationLine: 'line-through'
  },
  expandMoreBtn: {
    paddingVertical: 6
  },
  expandMoreText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600'
  },
  linkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginVertical: 6
  },
  linkUrl: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginRight: 8
  },
  linkArrow: {
    fontSize: 14,
    color: COLORS.textMuted
  },
  lockedBox: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginVertical: 6
  },
  lockedText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600'
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    marginBottom: 4
  },
  tagPill: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  tagPillText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500'
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border
  },
  dateText: {
    fontSize: 11,
    color: COLORS.textMuted
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  actionBtn: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textPrimary
  },
  iconBtn: {
    paddingHorizontal: 4,
    paddingVertical: 4
  },
  iconBtnText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500'
  }
});
