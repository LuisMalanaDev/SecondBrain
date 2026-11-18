// ============================================================================
// src/components/SettingsModal.js — Modern Settings, Security & File Backups
// ============================================================================

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
  Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as LocalAuthentication from 'expo-local-authentication';
import { COLORS } from '../theme/colors';
import { isValidBackup, normalizeTag, hapticTap, hapticNotify } from '../utils/helpers';
import {
  exportVaultBackupFile,
  pickAndReadBackupFile
} from '../storage/vaultStorage';

export default function SettingsModal({
  visible,
  onClose,
  pinCode,
  settings = {},
  onUpdateSettings,
  onRequestSetPin,
  onRequestRemovePin,
  allTags = [],
  onDeleteTag,
  onAddTag,
  items = [],
  onRestoreBackup,
  onClearAllItems,
  onShowToast
}) {
  const [showPasteImport, setShowPasteImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [newTagInput, setNewTagInput] = useState('');

  async function handleToggleBiometric(val) {
    hapticTap('light');
    if (val) {
      try {
        const hasHw = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (!hasHw || !enrolled) {
          Alert.alert(
            'Biometrics Unavailable',
            'No fingerprint or face authentication enrollment found on this device.'
          );
          return;
        }
      } catch (e) {
        Alert.alert('Error', 'Could not check biometric availability.');
        return;
      }
    }
    onUpdateSettings({ ...settings, biometricEnabled: val });
  }

  function handleTogglePinSetting(key, val) {
    hapticTap('light');
    if (val && !pinCode) {
      Alert.alert(
        'PIN Required',
        'Please set a 4-digit Master PIN first before enabling this lock setting.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Set PIN', onPress: () => onRequestSetPin && onRequestSetPin() }
        ]
      );
      return;
    }
    onUpdateSettings({ ...settings, [key]: val });
  }

  async function handleExportFile() {
    hapticTap('medium');
    try {
      await exportVaultBackupFile(items, allTags);
      onShowToast && onShowToast('Backup file ready');
    } catch (e) {
      Alert.alert('Export Error', e?.message || 'Could not share backup file.');
    }
  }

  async function handleImportFile() {
    hapticTap('medium');
    try {
      const text = await pickAndReadBackupFile();
      if (!text) return;
      validateAndConfirmRestore(text);
    } catch (e) {
      Alert.alert('Import Error', 'Could not read the selected file.');
    }
  }

  async function handleCopyJsonClipboard() {
    hapticTap('light');
    try {
      const payload = JSON.stringify(
        {
          app: 'SecondBrainVault',
          version: 2,
          exportedAt: new Date().toISOString(),
          itemCount: items.length,
          items,
          tags: allTags
        },
        null,
        2
      );
      await Clipboard.setStringAsync(payload);
      onShowToast && onShowToast(`Copied ${items.length} items to clipboard`);
    } catch (e) {
      Alert.alert('Error', 'Could not copy backup text.');
    }
  }

  function validateAndConfirmRestore(rawText) {
    try {
      const parsed = JSON.parse(rawText.trim());
      if (!isValidBackup(parsed)) {
        hapticNotify('error');
        Alert.alert('Invalid Backup', 'This file does not contain a valid SecondBrain Vault backup.');
        return;
      }
      const cleanItems = parsed.items.filter((i) => i.type !== 'SNIPPET');
      Alert.alert(
        'Confirm Restore',
        `Found ${cleanItems.length} items in this backup. Replace your current vault items with this backup?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: () => {
              onRestoreBackup && onRestoreBackup(cleanItems, parsed.tags || allTags);
              setShowPasteImport(false);
              setImportText('');
              setImportError('');
              hapticNotify('success');
              onShowToast && onShowToast(`Restored ${cleanItems.length} items`);
            }
          }
        ]
      );
    } catch (e) {
      hapticNotify('error');
      setImportError('Invalid JSON format. Check brackets and quotes.');
    }
  }

  async function handlePasteClipboard() {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        setImportText(text);
        setImportError('');
      } else {
        setImportError('Clipboard is empty');
      }
    } catch (e) {
      setImportError('Could not read clipboard');
    }
  }

  function handleAddNewTag() {
    const t = normalizeTag(newTagInput);
    if (!t) return;
    if (allTags.includes(t)) {
      Alert.alert('Tag Exists', `The tag "${t}" already exists.`);
      return;
    }
    hapticTap('light');
    onAddTag && onAddTag(t);
    setNewTagInput('');
    onShowToast && onShowToast(`Added tag ${t}`);
  }

  function confirmClearAll() {
    hapticTap('heavy');
    Alert.alert(
      'Wipe Vault Data',
      'Permanently delete ALL notes, voice memos, photos, passwords, checklists, and links?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: () => {
            onClearAllItems && onClearAllItems();
            hapticNotify('success');
            onShowToast && onShowToast('Vault cleared');
          }
        }
      ]
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Settings</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={10}>
              <Feather name="x" size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {/* SECURITY */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>SECURITY</Text>

              <View style={styles.rowCard}>
                <View style={styles.rowCardLeft}>
                  <Text style={styles.rowCardTitle}>Master PIN (SecureStore)</Text>
                  <Text style={styles.rowCardSub}>
                    {pinCode ? 'Active (hardware-backed 4-digit PIN)' : 'Not configured'}
                  </Text>
                </View>
                {pinCode ? (
                  <View style={styles.btnRow}>
                    <TouchableOpacity style={styles.smallBtn} onPress={onRequestSetPin}>
                      <Text style={styles.smallBtnText}>Change</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.smallBtn, { marginLeft: 8 }]}
                      onPress={onRequestRemovePin}
                    >
                      <Text style={[styles.smallBtnText, { color: COLORS.danger }]}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.primarySmallBtn} onPress={onRequestSetPin}>
                    <Text style={styles.primarySmallBtnText}>Set PIN</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.rowCard}>
                <View style={styles.rowCardLeft}>
                  <Text style={styles.rowCardTitle}>Lock on App Launch</Text>
                  <Text style={styles.rowCardSub}>Require authentication when opening</Text>
                </View>
                <Switch
                  value={Boolean(settings.lockOnAppOpen)}
                  onValueChange={(v) => handleTogglePinSetting('lockOnAppOpen', v)}
                  trackColor={{ false: COLORS.border, true: COLORS.textPrimary }}
                  thumbColor={settings.lockOnAppOpen ? '#000000' : '#8E8E93'}
                />
              </View>

              <View style={styles.rowCard}>
                <View style={styles.rowCardLeft}>
                  <Text style={styles.rowCardTitle}>Auto-Lock on App Switch</Text>
                  <Text style={styles.rowCardSub}>Hide & re-lock vault when leaving app</Text>
                </View>
                <Switch
                  value={Boolean(settings.autoLockOnBackground)}
                  onValueChange={(v) => handleTogglePinSetting('autoLockOnBackground', v)}
                  trackColor={{ false: COLORS.border, true: COLORS.textPrimary }}
                  thumbColor={settings.autoLockOnBackground ? '#000000' : '#8E8E93'}
                />
              </View>

              <View style={styles.rowCard}>
                <View style={styles.rowCardLeft}>
                  <Text style={styles.rowCardTitle}>Biometric Unlock</Text>
                  <Text style={styles.rowCardSub}>Fingerprint or Face ID authentication</Text>
                </View>
                <Switch
                  value={Boolean(settings.biometricEnabled)}
                  onValueChange={handleToggleBiometric}
                  trackColor={{ false: COLORS.border, true: COLORS.textPrimary }}
                  thumbColor={settings.biometricEnabled ? '#000000' : '#8E8E93'}
                />
              </View>

              <View style={styles.rowCard}>
                <View style={styles.rowCardLeft}>
                  <Text style={styles.rowCardTitle}>Auto-Clear Clipboard (30s)</Text>
                  <Text style={styles.rowCardSub}>Wipe copied passwords automatically</Text>
                </View>
                <Switch
                  value={Boolean(settings.autoClearClipboard)}
                  onValueChange={(v) => {
                    hapticTap('light');
                    onUpdateSettings({ ...settings, autoClearClipboard: v });
                  }}
                  trackColor={{ false: COLORS.border, true: COLORS.textPrimary }}
                  thumbColor={settings.autoClearClipboard ? '#000000' : '#8E8E93'}
                />
              </View>
            </View>

            {/* DATA & BACKUP */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>LOCAL BACKUP & PORTABILITY</Text>

              <TouchableOpacity style={styles.actionRow} onPress={handleExportFile} activeOpacity={0.7}>
                <Feather name="upload" size={16} color={COLORS.textPrimary} style={styles.actionIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTitle}>Export Backup File (.json)</Text>
                  <Text style={styles.actionSub}>Save or share {items.length} items to Files / Drive</Text>
                </View>
                <Feather name="chevron-right" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionRow} onPress={handleImportFile} activeOpacity={0.7}>
                <Feather name="download" size={16} color={COLORS.textPrimary} style={styles.actionIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTitle}>Import Backup File (.json)</Text>
                  <Text style={styles.actionSub}>Pick a .json backup file from your phone</Text>
                </View>
                <Feather name="chevron-right" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionRow}
                onPress={handleCopyJsonClipboard}
                activeOpacity={0.7}
              >
                <Feather name="clipboard" size={16} color={COLORS.textSecondary} style={styles.actionIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTitle}>Copy JSON to Clipboard</Text>
                  <Text style={styles.actionSub}>Quick text copy of vault items</Text>
                </View>
                <Feather name="chevron-right" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => {
                  setShowPasteImport(!showPasteImport);
                  setImportError('');
                }}
                activeOpacity={0.7}
              >
                <Feather name="file-text" size={16} color={COLORS.textSecondary} style={styles.actionIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTitle}>Restore from Pasted JSON</Text>
                  <Text style={styles.actionSub}>Paste JSON text backup directly</Text>
                </View>
                <Feather
                  name={showPasteImport ? 'chevron-down' : 'chevron-right'}
                  size={16}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>

              {showPasteImport && (
                <View style={styles.importBox}>
                  <View style={styles.importHeaderRow}>
                    <Text style={styles.importLabel}>Paste backup JSON</Text>
                    <TouchableOpacity onPress={handlePasteClipboard} style={styles.pasteBtn}>
                      <Text style={styles.pasteBtnText}>Paste</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.importInput}
                    multiline
                    numberOfLines={4}
                    placeholder='{"app":"SecondBrainVault","items":[...]}'
                    placeholderTextColor={COLORS.textMuted}
                    value={importText}
                    onChangeText={(t) => {
                      setImportText(t);
                      setImportError('');
                    }}
                  />
                  {importError ? <Text style={styles.errorText}>{importError}</Text> : null}
                  <TouchableOpacity
                    style={styles.restoreBtn}
                    onPress={() => validateAndConfirmRestore(importText)}
                  >
                    <Text style={styles.restoreBtnText}>Restore Vault</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* TAGS */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>TAGS</Text>
              <View style={styles.tagsContainer}>
                {allTags.map((t) => (
                  <View key={t} style={styles.tagPill}>
                    <Text style={styles.tagText}>{t}</Text>
                    <TouchableOpacity
                      onPress={() => onDeleteTag && onDeleteTag(t)}
                      style={styles.tagDeleteBtn}
                      hitSlop={6}
                    >
                      <Feather name="x" size={12} color={COLORS.textMuted} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <View style={styles.newTagRow}>
                <TextInput
                  style={styles.newTagInput}
                  placeholder="#new-tag"
                  placeholderTextColor={COLORS.textMuted}
                  value={newTagInput}
                  onChangeText={setNewTagInput}
                  autoCapitalize="none"
                  onSubmitEditing={handleAddNewTag}
                />
                <TouchableOpacity style={styles.addTagBtn} onPress={handleAddNewTag}>
                  <Text style={styles.addTagBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* DANGER ZONE */}
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: COLORS.danger }]}>DANGER ZONE</Text>
              <TouchableOpacity style={styles.dangerRow} onPress={confirmClearAll} activeOpacity={0.7}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dangerTitle}>Clear All Data</Text>
                  <Text style={styles.dangerSub}>
                    Delete all {items.length} items & stored local media
                  </Text>
                </View>
                <View style={styles.dangerBtn}>
                  <Text style={styles.dangerBtnText}>Delete All</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* ABOUT */}
            <View style={styles.aboutBox}>
              <Text style={styles.aboutSub}>SecondBrain Vault • Standalone SQLite</Text>
              <Text style={styles.aboutMuted}>
                100% offline on-device database, SecureStore & private sandbox media.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end'
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center'
  },
  body: {
    paddingHorizontal: 20
  },
  bodyContent: {
    paddingTop: 16,
    paddingBottom: 24
  },
  section: {
    marginBottom: 24
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    marginBottom: 10
  },
  rowCard: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  rowCardLeft: {
    flex: 1,
    marginRight: 12
  },
  rowCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 2
  },
  rowCardSub: {
    fontSize: 12,
    color: COLORS.textMuted
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  smallBtn: {
    borderWidth: 1,
    borderColor: COLORS.borderHover,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  smallBtnText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600'
  },
  primarySmallBtn: {
    backgroundColor: COLORS.textPrimary,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  primarySmallBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700'
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 8
  },
  actionIcon: {
    marginRight: 12
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 2
  },
  actionSub: {
    fontSize: 12,
    color: COLORS.textMuted
  },
  importBox: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 8
  },
  importHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  importLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted
  },
  pasteBtn: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: COLORS.surfaceSubtle
  },
  pasteBtnText: {
    fontSize: 11,
    color: COLORS.textPrimary,
    fontWeight: '600'
  },
  importInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 10,
    color: COLORS.textPrimary,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: 8
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 12,
    marginBottom: 8
  },
  restoreBtn: {
    backgroundColor: COLORS.textPrimary,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center'
  },
  restoreBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700'
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  tagText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginRight: 6
  },
  tagDeleteBtn: {
    paddingHorizontal: 2
  },
  newTagRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  newTagInput: {
    flex: 1,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: COLORS.textPrimary,
    fontSize: 13,
    marginRight: 8
  },
  addTagBtn: {
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.borderHover,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  addTagBtnText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '600'
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14
  },
  dangerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.danger,
    marginBottom: 2
  },
  dangerSub: {
    fontSize: 12,
    color: COLORS.textMuted
  },
  dangerBtn: {
    backgroundColor: 'rgba(229, 72, 77, 0.15)',
    borderWidth: 1,
    borderColor: COLORS.danger,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  dangerBtnText: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '700'
  },
  aboutBox: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border
  },
  aboutSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginBottom: 4
  },
  aboutMuted: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center'
  }
});
