// ============================================================================
// src/components/VaultItemCard.js — Modern Minimalist Card Renderer
// Crisp Monochrome Icons, Voice Player, Private Photo Previews & Haptics
// ============================================================================

import React, { useState, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Platform,
  Linking,
  Alert
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { formatDate, extractDomain, hapticTap } from '../utils/helpers';
import VoicePlayer from './VoicePlayer';

const TYPE_META = {
  NOTE: { label: 'Note', icon: 'file-text' },
  VOICE: { label: 'Voice', icon: 'mic' },
  PASSWORD: { label: 'Password', icon: 'lock' },
  CHECKLIST: { label: 'Tasks', icon: 'check-square' },
  LINK: { label: 'Link', icon: 'bookmark' }
};

function VaultItemCard({
  item,
  hasPin,
  sessionUnlocked,
  onRequestUnlock,
  onOpenDetail,
  onToggleTask,
  onTogglePin,
  onEdit,
  onDelete,
  onCopy
}) {
  const [revealPw, setRevealPw] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const gated = item.isLocked && hasPin && !sessionUnlocked;
  const meta = TYPE_META[item.type] || TYPE_META.NOTE;

  const withUnlock = (fn) => () => (gated ? onRequestUnlock(fn) : fn());

  const confirmDelete = () =>
    Alert.alert('Delete item', `Remove "${item.title}" from your vault?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(item.id) }
    ]);

  const checklist = item.checklist || [];
  const attachments = item.attachments || [];
  const doneCount = checklist.filter((c) => c.done).length;
  const pct = checklist.length ? Math.round((doneCount / checklist.length) * 100) : 0;

  const longText = (item.content || '').length > 180;
  const bodyText = expanded || !longText ? item.content : `${item.content.slice(0, 180)}…`;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.88}
      onPress={withUnlock(() => {
        hapticTap('light');
        onOpenDetail && onOpenDetail(item);
      })}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.badge}>
          <Feather name={meta.icon} size={11} color={COLORS.badgeText} />
          <Text style={styles.badgeText}>{meta.label}</Text>
        </View>

        <View style={styles.headerRight}>
          {attachments.length > 0 && (
            <View style={styles.metaChip}>
              <Feather name="image" size={11} color={COLORS.textMuted} />
              <Text style={styles.metaChipText}>{attachments.length}</Text>
            </View>
          )}
          {item.isLocked && (
            <View style={styles.metaChip}>
              <Feather
                name={gated ? 'lock' : 'unlock'}
                size={11}
                color={COLORS.textMuted}
              />
            </View>
          )}
          <TouchableOpacity
            onPress={() => {
              hapticTap('light');
              onTogglePin(item.id);
            }}
            hitSlop={10}
            style={styles.pinBtn}
          >
            <Feather
              name="bookmark"
              size={14}
              color={item.isPinned ? COLORS.textPrimary : COLORS.textMuted}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Title */}
      <Text style={styles.title} numberOfLines={2}>
        {item.title}
      </Text>

      {/* Body */}
      {gated && item.type !== 'PASSWORD' ? (
        <TouchableOpacity
          style={styles.lockedBox}
          onPress={() => onRequestUnlock(() => onOpenDetail && onOpenDetail(item))}
          activeOpacity={0.7}
        >
          <Feather name="lock" size={13} color={COLORS.textMuted} />
          <Text style={styles.lockedText}>Locked — tap to unlock with PIN</Text>
        </TouchableOpacity>
      ) : (
        <>
          {/* VOICE MEMO */}
          {item.audioUri ? (
            <VoicePlayer uri={item.audioUri} durationMs={item.audioDurationMs} compact />
          ) : null}

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
                    onPress={() => onCopy(item.username, 'Username', false)}
                    hitSlop={6}
                    style={styles.copySmallBtn}
                  >
                    <Feather name="copy" size={12} color={COLORS.textPrimary} />
                  </TouchableOpacity>
                </View>
              ) : null}

              <View style={[styles.pwRow, item.username && styles.pwRowBorder]}>
                <Text style={styles.pwKey}>Pass</Text>
                <Text style={[styles.pwVal, styles.mono]} numberOfLines={1} selectable={revealPw}>
                  {revealPw && !gated ? item.secretPassword : '••••••••••••'}
                </Text>
                <TouchableOpacity
                  onPress={
                    revealPw
                      ? () => {
                          hapticTap('light');
                          setRevealPw(false);
                        }
                      : withUnlock(() => {
                          hapticTap('light');
                          setRevealPw(true);
                        })
                  }
                  hitSlop={6}
                  style={styles.copySmallBtn}
                >
                  <Feather
                    name={revealPw ? 'eye-off' : 'eye'}
                    size={12}
                    color={COLORS.textPrimary}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={withUnlock(() => onCopy(item.secretPassword, 'Password', true))}
                  hitSlop={6}
                  style={styles.copySmallBtn}
                >
                  <Feather name="copy" size={12} color={COLORS.textPrimary} />
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
                  onPress={() => {
                    hapticTap('light');
                    onToggleTask(item.id, c.id);
                  }}
                  activeOpacity={0.6}
                >
                  <View style={[styles.checkbox, c.done && styles.checkboxDone]}>
                    {c.done && <Feather name="check" size={11} color="#000000" />}
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
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.linkDomain}>{extractDomain(item.websiteUrl)}</Text>
                <Text style={styles.linkUrl} numberOfLines={1}>
                  {item.websiteUrl}
                </Text>
              </View>
              <Feather name="external-link" size={14} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ) : null}

          {/* Body Text */}
          {item.content ? (
            <Text style={styles.bodyText} selectable>
              {bodyText}
            </Text>
          ) : null}

          {/* Private Photo Thumbnails */}
          {attachments.length > 0 && (
            <View style={styles.thumbRow}>
              {attachments.slice(0, 4).map((uri, idx) => (
                <Image key={`${uri}_${idx}`} source={{ uri }} style={styles.thumbImg} />
              ))}
              {attachments.length > 4 && (
                <View style={styles.thumbMore}>
                  <Text style={styles.thumbMoreText}>+{attachments.length - 4}</Text>
                </View>
              )}
            </View>
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
          {item.type === 'LINK' && item.websiteUrl ? (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => onCopy(item.websiteUrl, 'Link', false)}
              hitSlop={6}
            >
              <Feather name="copy" size={12} color={COLORS.textPrimary} />
              <Text style={styles.actionBtnText}>Copy</Text>
            </TouchableOpacity>
          ) : null}

          {item.type === 'NOTE' && item.content ? (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={withUnlock(() => onCopy(item.content, 'Note', false))}
              hitSlop={6}
            >
              <Feather name="copy" size={12} color={COLORS.textPrimary} />
              <Text style={styles.actionBtnText}>Copy</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.iconActionBtn}
            onPress={withUnlock(() => onEdit(item))}
            hitSlop={6}
          >
            <Feather name="edit-2" size={13} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconActionBtn}
            onPress={withUnlock(confirmDelete)}
            hitSlop={6}
          >
            <Feather name="trash-2" size={13} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
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
    letterSpacing: 0.7,
    textTransform: 'uppercase'
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceSubtle,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5
  },
  metaChipText: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600'
  },
  pinBtn: {
    padding: 2
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    lineHeight: 22,
    marginBottom: 6
  },
  bodyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginTop: 4,
    marginBottom: 4
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
    paddingVertical: 9
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
    width: 42
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
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6
  },
  checklistContainer: {
    marginVertical: 6
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
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
    paddingVertical: 5
  },
  checkbox: {
    width: 17,
    height: 17,
    borderRadius: 4,
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
    paddingVertical: 4
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
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginVertical: 6
  },
  linkDomain: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2
  },
  linkUrl: {
    fontSize: 13,
    color: COLORS.textSecondary
  },
  thumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8
  },
  thumbImg: {
    width: 52,
    height: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceElevated
  },
  thumbMore: {
    width: 52,
    height: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center'
  },
  thumbMoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary
  },
  lockedBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginTop: 10,
    marginBottom: 2
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
    marginTop: 10,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textPrimary
  },
  iconActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
