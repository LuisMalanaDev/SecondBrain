// ============================================================================
// src/components/SettingsModal.js — Vault Settings, Security & Backup Management
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
import * as Clipboard from 'expo-clipboard';
import * as LocalAuthentication from 'expo-local-authentication';
import { COLORS } from '../theme/colors';
import { isValidBackup, normalizeTag } from '../utils/helpers';

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
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [newTagInput, setNewTagInput] = useState('');

  async function handleToggleBiometric(val) {
    if (val) {
      try {
        const hasHw = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (!hasHw || !enrolled) {
          Alert.alert(
            'Biometrics Unavailable',
            'No fingerprint or face authentication hardware/enrollment found on this device.'
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

  function handleToggleLockOnOpen(val) {
    if (val && !pinCode) {
      Alert.alert('PIN Required', 'Please set a 4-digit Master PIN first before enabling Lock on App Launch.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Set PIN', onPress: () => onRequestSetPin && onRequestSetPin() }
      ]);
      return;
    }
    onUpdateSettings({ ...settings, lockOnAppOpen: val });
  }

  async function handleExportVault() {
    try {
      const backupData = {
        app: 'SecondBrainVault',
        version: 1,
        exportedAt: new Date().toISOString(),
        itemCount: items.length,
        items,
        tags: allTags
      };
      const json = JSON.stringify(backupData, null, 2);
      await Clipboard.setStringAsync(json);
      onShowToast && onShowToast(`Copied ${items.length} items to clipboard! 📋`);
      Alert.alert(
        'Backup Exported',
        `Successfully exported ${items.length} vault items to your clipboard.\n\nYou can now paste and save it securely in a safe document or messaging yourself.`
      );
    } catch (e) {
      Alert.alert('Export Failed', 'Could not copy backup data to clipboard.');
    }
  }

  async function handlePasteFromClipboard() {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        setImportText(text);
        setImportError('');
      } else {
        setImportError('Clipboard is empty.');
      }
    } catch (e) {
      setImportError('Could not read from clipboard.');
    }
  }

  function handleExecuteRestore() {
    if (!importText.trim()) {
      setImportError('Please paste your backup JSON first.');
      return;
    }
    try {
      const parsed = JSON.parse(importText.trim());
      if (!isValidBackup(parsed)) {
        setImportError('Invalid backup structure. The JSON must contain a valid "items" array.');
        return;
      }

      Alert.alert(
        'Confirm Restore',
        `Found ${parsed.items.length} items in backup. This will replace or update your current vault items. Continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore Now',
            style: 'destructive',
            onPress: () => {
              onRestoreBackup && onRestoreBackup(parsed.items, parsed.tags || allTags);
              setShowImport(false);
              setImportText('');
              setImportError('');
              onShowToast && onShowToast(`Restored ${parsed.items.length} items! ✅`);
            }
          }
        ]
      );
    } catch (e) {
      setImportError('Invalid JSON format. Check for missing brackets or quotes.');
    }
  }

  function handleAddNewTag() {
    const t = normalizeTag(newTagInput);
    if (!t) return;
    if (allTags.includes(t)) {
      Alert.alert('Tag Exists', `The tag "${t}" is already in your vault.`);
      return;
    }
    onAddTag && onAddTag(t);
    setNewTagInput('');
    onShowToast && onShowToast(`Added tag ${t}`);
  }

  function confirmClearAll() {
    Alert.alert(
      '⚠️ Wipe Vault Data',
      'Are you sure you want to delete ALL notes, snippets, passwords, checklists, and links? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: () => {
            onClearAllItems && onClearAllItems();
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
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerIcon}>⚙️</Text>
              <Text style={styles.headerTitle}>Vault Settings</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={10}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
            {/* Section: Security */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>🔒 SECURITY & PIN LOCK</Text>

              <View style={styles.rowCard}>
                <View style={styles.rowCardLeft}>
                  <Text style={styles.rowCardTitle}>Master 4-Digit PIN</Text>
                  <Text style={styles.rowCardSub}>
                    {pinCode ? 'Active • Passwords & locked notes protected' : 'Not set • Tap to secure your vault'}
                  </Text>
                </View>
                {pinCode ? (
                  <View style={styles.btnRow}>
                    <TouchableOpacity
                      style={[styles.smallBtn, { borderColor: COLORS.accentPrimary }]}
                      onPress={onRequestSetPin}
                    >
                      <Text style={styles.smallBtnText}>Change</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.smallBtn, { borderColor: COLORS.password, marginLeft: 8 }]}
                      onPress={onRequestRemovePin}
                    >
                      <Text style={[styles.smallBtnText, { color: COLORS.password }]}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.primarySmallBtn} onPress={onRequestSetPin}>
                    <Text style={styles.primarySmallBtnText}>+ Set PIN</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.rowCard}>
                <View style={styles.rowCardLeft}>
                  <Text style={styles.rowCardTitle}>Lock on App Launch</Text>
                  <Text style={styles.rowCardSub}>Require PIN/Biometric every time the app opens</Text>
                </View>
                <Switch
                  value={Boolean(settings.lockOnAppOpen)}
                  onValueChange={handleToggleLockOnOpen}
                  trackColor={{ false: COLORS.border, true: '#10B981' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.rowCard}>
                <View style={styles.rowCardLeft}>
                  <Text style={styles.rowCardTitle}>Biometric Unlock</Text>
                  <Text style={styles.rowCardSub}>Use Fingerprint or Face ID to unlock instantly</Text>
                </View>
                <Switch
                  value={Boolean(settings.biometricEnabled)}
                  onValueChange={handleToggleBiometric}
                  trackColor={{ false: COLORS.border, true: '#10B981' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            {/* Section: Backup & Data Portability */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>📦 DATA PORTABILITY & BACKUP</Text>

              <TouchableOpacity style={styles.actionRow} onPress={handleExportVault} activeOpacity={0.7}>
                <View style={[styles.actionIconBox, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                  <Text style={{ fontSize: 18 }}>📋</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTitle}>Export Vault Backup (JSON)</Text>
                  <Text style={styles.actionSub}>Copies all {items.length} items to clipboard to store safely</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => {
                  setShowImport(!showImport);
                  setImportError('');
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                  <Text style={{ fontSize: 18 }}>📥</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTitle}>Restore Vault from JSON</Text>
                  <Text style={styles.actionSub}>Import and restore notes, passwords & snippets</Text>
                </View>
                <Text style={styles.chevron}>{showImport ? '⌄' : '›'}</Text>
              </TouchableOpacity>

              {/* Import Drawer */}
              {showImport && (
                <View style={styles.importBox}>
                  <View style={styles.importHeaderRow}>
                    <Text style={styles.importLabel}>Paste Vault Backup JSON:</Text>
                    <TouchableOpacity onPress={handlePasteFromClipboard} style={styles.pasteBtn}>
                      <Text style={styles.pasteBtnText}>📋 Paste from Clipboard</Text>
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
                  <TouchableOpacity style={styles.restoreBtn} onPress={handleExecuteRestore}>
                    <Text style={styles.restoreBtnText}>⚡ Validate & Restore Vault</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Section: Tag Management */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>🏷️ TAG MANAGEMENT</Text>
              <View style={styles.tagsContainer}>
                {allTags.map((t) => (
                  <View key={t} style={styles.tagPill}>
                    <Text style={styles.tagText}>{t}</Text>
                    <TouchableOpacity
                      onPress={() => onDeleteTag && onDeleteTag(t)}
                      style={styles.tagDeleteBtn}
                      hitSlop={6}
                    >
                      <Text style={styles.tagDeleteText}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <View style={styles.newTagRow}>
                <TextInput
                  style={styles.newTagInput}
                  placeholder="#add-tag (e.g. #finance, #travel)"
                  placeholderTextColor={COLORS.textMuted}
                  value={newTagInput}
                  onChangeText={setNewTagInput}
                  autoCapitalize="none"
                  onSubmitEditing={handleAddNewTag}
                />
                <TouchableOpacity style={styles.addTagBtn} onPress={handleAddNewTag}>
                  <Text style={styles.addTagBtnText}>+ Add</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Section: Danger Zone */}
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: COLORS.password }]}>⚠️ DANGER ZONE</Text>
              <TouchableOpacity style={styles.dangerRow} onPress={confirmClearAll} activeOpacity={0.7}>
                <View>
                  <Text style={styles.dangerTitle}>Clear All Vault Data</Text>
                  <Text style={styles.dangerSub}>Permanently delete all {items.length} vault items</Text>
                </View>
                <View style={styles.dangerBtn}>
                  <Text style={styles.dangerBtnText}>Delete All</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Footer / About */}
            <View style={styles.aboutBox}>
              <Text style={styles.aboutLogo}>🧠 SECONDBRAIN VAULT</Text>
              <Text style={styles.aboutSub}>v1.0.0 • 100% Offline-First • Zero Cloud Sync</Text>
              <Text style={styles.aboutMuted}>
                Your data stays exclusively in local flash storage on this device.
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  headerIcon: {
    fontSize: 20,
    marginRight: 10
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeBtnText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '600'
  },
  body: {
    paddingHorizontal: 20
  },
  bodyContent: {
    paddingTop: 16,
    paddingBottom: 24
  },
  section: {
    marginBottom: 26
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 1,
    marginBottom: 10
  },
  rowCard: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  rowCardLeft: {
    flex: 1,
    marginRight: 12
  },
  rowCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 2
  },
  rowCardSub: {
    fontSize: 12,
    color: COLORS.textSecondary
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  smallBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  smallBtnText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '600'
  },
  primarySmallBtn: {
    backgroundColor: COLORS.accentPrimary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 10
  },
  actionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 2
  },
  actionSub: {
    fontSize: 12,
    color: COLORS.textSecondary
  },
  chevron: {
    fontSize: 20,
    color: COLORS.textMuted,
    marginLeft: 10
  },
  importBox: {
    backgroundColor: '#09090D',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 10
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
    color: COLORS.textSecondary
  },
  pasteBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: COLORS.surfaceElevated
  },
  pasteBtnText: {
    fontSize: 11,
    color: COLORS.note,
    fontWeight: '600'
  },
  importInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 10,
    color: COLORS.textPrimary,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 10
  },
  errorText: {
    color: COLORS.password,
    fontSize: 12,
    marginBottom: 8
  },
  restoreBtn: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center'
  },
  restoreBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700'
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  tagText: {
    fontSize: 12,
    color: COLORS.textPrimary,
    marginRight: 6
  },
  tagDeleteBtn: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  tagDeleteText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 14
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
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: COLORS.textPrimary,
    fontSize: 13,
    marginRight: 8
  },
  addTagBtn: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.accentPrimary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9
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
    backgroundColor: 'rgba(244, 63, 94, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
    borderRadius: 16,
    padding: 14
  },
  dangerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.password,
    marginBottom: 2
  },
  dangerSub: {
    fontSize: 12,
    color: COLORS.textSecondary
  },
  dangerBtn: {
    backgroundColor: COLORS.password,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  dangerBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  aboutBox: {
    alignItems: 'center',
    paddingVertical: 18,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border
  },
  aboutLogo: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: 2,
    marginBottom: 4
  },
  aboutSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 4
  },
  aboutMuted: {
    fontSize: 10,
    color: COLORS.textMuted,
    textAlign: 'center'
  }
});
