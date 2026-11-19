// ============================================================================
// src/components/ItemDetailModal.js — Full-Screen Distraction-Free Reader
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  Platform,
  Linking,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/colors';
import { formatDate, extractDomain, hapticTap } from '../utils/helpers';
import VoicePlayer from './VoicePlayer';

const TYPE_INFO = {
  NOTE: { label: 'Note', icon: 'file-text' },
  VOICE: { label: 'Voice Memo', icon: 'mic' },
  PASSWORD: { label: 'Password', icon: 'lock' },
  CHECKLIST: { label: 'Tasks', icon: 'check-square' },
  LINK: { label: 'Saved Link', icon: 'link-2' }
};

export default function ItemDetailModal({
  visible,
  item,
  hasPin,
  sessionUnlocked,
  onClose,
  onEdit,
  onDelete,
  onTogglePin,
  onToggleTask,
  onRequestUnlock,
  onCopy,
  onShare
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [revealPw, setRevealPw] = useState(false);
  const [zoomUri, setZoomUri] = useState(null);

  if (!item) return null;

  const meta = TYPE_INFO[item.type] || TYPE_INFO.NOTE;
  const gated = item.isLocked && hasPin && !sessionUnlocked;
  const withUnlock = (fn) => () => (gated ? onRequestUnlock(fn) : fn());

  const checklist = item.checklist || [];
  const attachments = item.attachments || [];
  const doneCount = checklist.filter((c) => c.done).length;
  const pct = checklist.length ? Math.round((doneCount / checklist.length) * 100) : 0;

  const confirmDelete = () => {
    Alert.alert('Delete item', `Remove "${item.title}" from your vault?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          onClose();
          onDelete(item.id);
        }
      }
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.safeArea}>
        {/* Top Navigation Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} style={styles.navBtn} hitSlop={10}>
            <Feather name="chevron-left" size={22} color={colors.textPrimary} />
            <Text style={styles.navBackText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.topActions}>
            {(item.type === 'NOTE' || item.type === 'CHECKLIST' || item.type === 'LINK') && onShare ? (
              <TouchableOpacity
                onPress={withUnlock(() => onShare(item))}
                style={styles.iconBtn}
                hitSlop={8}
              >
                <Feather name="share-2" size={17} color={colors.textPrimary} />
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              onPress={() => {
                hapticTap('light');
                onTogglePin(item.id);
              }}
              style={styles.iconBtn}
              hitSlop={8}
            >
              <Feather
                name="bookmark"
                size={18}
                color={item.isPinned ? colors.textPrimary : colors.textMuted}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={withUnlock(() => {
                onClose();
                onEdit(item);
              })}
              style={styles.iconBtn}
              hitSlop={8}
            >
              <Feather name="edit-2" size={18} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity onPress={withUnlock(confirmDelete)} style={styles.iconBtn} hitSlop={8}>
              <Feather name="trash-2" size={18} color={colors.danger} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Metadata Row */}
          <View style={styles.metaRow}>
            <View style={styles.typePill}>
              <Feather name={meta.icon} size={11} color={colors.textSecondary} />
              <Text style={styles.typePillText}>{meta.label}</Text>
            </View>
            {item.isLocked && (
              <View style={styles.typePill}>
                <Feather
                  name={gated ? 'lock' : 'unlock'}
                  size={11}
                  color={colors.textMuted}
                />
                <Text style={styles.typePillText}>{gated ? 'Locked' : 'Unlocked'}</Text>
              </View>
            )}
            <Text style={styles.dateText}>{formatDate(item.updatedAt)}</Text>
          </View>

          <Text style={styles.title}>{item.title}</Text>

          {gated ? (
            <TouchableOpacity
              style={styles.lockedCard}
              onPress={() => onRequestUnlock()}
              activeOpacity={0.75}
            >
              <Feather name="lock" size={22} color={colors.textSecondary} />
              <Text style={styles.lockedTitle}>Protected Item</Text>
              <Text style={styles.lockedSub}>Tap to unlock with your 4-digit PIN</Text>
            </TouchableOpacity>
          ) : (
            <>
              {item.audioUri ? (
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionLabel}>VOICE RECORDING</Text>
                  <VoicePlayer uri={item.audioUri} durationMs={item.audioDurationMs} />
                </View>
              ) : null}

              {item.type === 'LINK' && item.websiteUrl ? (
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionLabel}>SAVED URL</Text>
                  <TouchableOpacity
                    style={styles.linkCard}
                    onPress={() => Linking.openURL(item.websiteUrl).catch(() => {})}
                    activeOpacity={0.75}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.linkDomain}>{extractDomain(item.websiteUrl)}</Text>
                      <Text style={styles.linkFull} selectable>
                        {item.websiteUrl}
                      </Text>
                    </View>
                    <Feather name="external-link" size={18} color={colors.textPrimary} />
                  </TouchableOpacity>
                  <View style={styles.linkActions}>
                    <TouchableOpacity
                      style={styles.pillAction}
                      onPress={() => Linking.openURL(item.websiteUrl).catch(() => {})}
                    >
                      <Feather name="external-link" size={13} color={colors.textPrimary} />
                      <Text style={styles.pillActionText}>Open Link</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.pillAction}
                      onPress={() => onCopy(item.websiteUrl, 'Link')}
                    >
                      <Feather name="copy" size={13} color={colors.textPrimary} />
                      <Text style={styles.pillActionText}>Copy URL</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {item.type === 'PASSWORD' && (
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionLabel}>CREDENTIALS</Text>
                  <View style={styles.credBox}>
                    {item.username ? (
                      <View style={styles.credRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.credKey}>USERNAME / EMAIL</Text>
                          <Text style={styles.credVal} selectable>
                            {item.username}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.smallBtn}
                          onPress={() => onCopy(item.username, 'Username')}
                        >
                          <Feather name="copy" size={14} color={colors.textPrimary} />
                        </TouchableOpacity>
                      </View>
                    ) : null}

                    <View style={[styles.credRow, item.username && styles.credBorder]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.credKey}>PASSWORD</Text>
                        <Text style={[styles.credVal, styles.mono]} selectable={revealPw}>
                          {revealPw ? item.secretPassword : '••••••••••••'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.smallBtn}
                        onPress={() => {
                          hapticTap('light');
                          setRevealPw((r) => !r);
                        }}
                      >
                        <Feather
                          name={revealPw ? 'eye-off' : 'eye'}
                          size={14}
                          color={colors.textPrimary}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.smallBtn, { marginLeft: 8 }]}
                        onPress={() => onCopy(item.secretPassword, 'Password', true)}
                      >
                        <Feather name="copy" size={14} color={colors.textPrimary} />
                      </TouchableOpacity>
                    </View>

                    {item.websiteUrl ? (
                      <TouchableOpacity
                        style={[styles.credRow, styles.credBorder]}
                        onPress={() => Linking.openURL(item.websiteUrl).catch(() => {})}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.credKey}>WEBSITE</Text>
                          <Text style={styles.credVal}>{item.websiteUrl}</Text>
                        </View>
                        <Feather name="external-link" size={14} color={colors.textMuted} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              )}

              {item.type === 'CHECKLIST' && checklist.length > 0 && (
                <View style={styles.sectionBlock}>
                  <View style={styles.checkHeader}>
                    <Text style={styles.sectionLabel}>TASKS</Text>
                    <Text style={styles.checkCount}>
                      {doneCount}/{checklist.length} ({pct}%)
                    </Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressBar, { width: `${pct}%` }]} />
                  </View>
                  {checklist.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={styles.taskRow}
                      onPress={() => {
                        hapticTap('light');
                        onToggleTask(item.id, c.id);
                      }}
                      activeOpacity={0.65}
                    >
                      <View style={[styles.checkbox, c.done && styles.checkboxDone]}>
                        {c.done && <Feather name="check" size={12} color={colors.solidBtnText} />}
                      </View>
                      <Text style={[styles.taskText, c.done && styles.taskDone]}>{c.text}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {item.content ? (
                <View style={styles.sectionBlock}>
                  <View style={styles.bodyHeader}>
                    <Text style={styles.sectionLabel}>
                      {item.type === 'NOTE' ? 'NOTE' : 'NOTES'}
                    </Text>
                    <TouchableOpacity
                      onPress={() => onCopy(item.content, 'Note')}
                      style={styles.inlineCopy}
                    >
                      <Feather name="copy" size={12} color={colors.textSecondary} />
                      <Text style={styles.inlineCopyText}>Copy</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.bodyText} selectable>
                    {item.content}
                  </Text>
                </View>
              ) : null}

              {attachments.length > 0 && (
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionLabel}>
                    PRIVATE PHOTOS & DOCUMENTS ({attachments.length})
                  </Text>
                  <View style={styles.galleryGrid}>
                    {attachments.map((uri, idx) => (
                      <TouchableOpacity
                        key={`${uri}_${idx}`}
                        onPress={() => setZoomUri(uri)}
                        activeOpacity={0.8}
                        style={styles.galleryTile}
                      >
                        <Image source={{ uri }} style={styles.galleryImage} resizeMode="cover" />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>

        <Modal
          visible={Boolean(zoomUri)}
          transparent
          animationType="fade"
          onRequestClose={() => setZoomUri(null)}
        >
          <View style={styles.lightboxBackdrop}>
            <TouchableOpacity
              style={styles.lightboxClose}
              onPress={() => setZoomUri(null)}
              hitSlop={12}
            >
              <Feather name="x" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            {zoomUri && (
              <Image source={{ uri: zoomUri }} style={styles.lightboxImage} resizeMode="contain" />
            )}
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}

const mono = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

const makeStyles = (colors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    navBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2
    },
    navBackText: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '600'
    },
    topActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10
    },
    iconBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center'
    },
    scroll: {
      flex: 1
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 48
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12
    },
    typePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3
    },
    typePillText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary
    },
    dateText: {
      fontSize: 11,
      color: colors.textMuted,
      marginLeft: 'auto'
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.textPrimary,
      lineHeight: 28,
      marginBottom: 16
    },
    lockedCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 32,
      alignItems: 'center',
      marginTop: 12,
      gap: 8
    },
    lockedTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary
    },
    lockedSub: {
      fontSize: 12,
      color: colors.textMuted
    },
    sectionBlock: {
      marginBottom: 22
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.8,
      marginBottom: 8
    },
    bodyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8
    },
    inlineCopy: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4
    },
    inlineCopyText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '600'
    },
    bodyText: {
      fontSize: 15,
      color: colors.textPrimary,
      lineHeight: 23
    },
    linkCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      gap: 12
    },
    linkDomain: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      marginBottom: 3
    },
    linkFull: {
      fontSize: 13,
      color: colors.textSecondary
    },
    linkActions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 10
    },
    pillAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 8
    },
    pillActionText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textPrimary
    },
    credBox: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14
    },
    credRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12
    },
    credBorder: {
      borderTopWidth: 1,
      borderTopColor: colors.border
    },
    credKey: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.6,
      marginBottom: 3
    },
    credVal: {
      fontSize: 14,
      color: colors.textPrimary
    },
    mono: {
      fontFamily: mono,
      letterSpacing: 1
    },
    smallBtn: {
      width: 34,
      height: 34,
      borderRadius: 8,
      backgroundColor: colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center'
    },
    checkHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    checkCount: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '600',
      marginBottom: 8
    },
    progressTrack: {
      height: 4,
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 2,
      overflow: 'hidden',
      marginBottom: 12
    },
    progressBar: {
      height: '100%',
      backgroundColor: colors.textPrimary
    },
    taskRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 12
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: colors.borderHover,
      alignItems: 'center',
      justifyContent: 'center'
    },
    checkboxDone: {
      backgroundColor: colors.solidBtnBg,
      borderColor: colors.solidBtnBg
    },
    taskText: {
      flex: 1,
      fontSize: 14,
      color: colors.textPrimary,
      lineHeight: 20
    },
    taskDone: {
      color: colors.textMuted,
      textDecorationLine: 'line-through'
    },
    galleryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10
    },
    galleryTile: {
      width: '48%',
      aspectRatio: 1.2,
      borderRadius: 10,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated
    },
    galleryImage: {
      width: '100%',
      height: '100%'
    },
    lightboxBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.96)',
      alignItems: 'center',
      justifyContent: 'center'
    },
    lightboxClose: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 54 : 28,
      right: 20,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10
    },
    lightboxImage: {
      width: '100%',
      height: '82%'
    }
  });
