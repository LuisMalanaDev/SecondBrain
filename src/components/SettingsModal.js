// ============================================================================
// src/components/SettingsModal.js — Modern Minimalist Settings & Portability
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
      Alert.alert('PIN Required', 'Please set a 4-digit master PIN first before enabling Lock on App Launch.', [
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
      onShowToast && onShowToast(`Copied ${items.length} items to clipboard`);
      Alert.alert(
        'Backup Exported',
        `Successfully exported ${items.length} items to your clipboard.\n\nYou can now paste and save it safely in a private file.`
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
        setImportError('Clipboard is empty');
      }
    } catch (e) {
      setImportError('Could not read from clipboard');
    }
  }

  function handleExecuteRestore() {
    if (!importText.trim()) {
      setImportError('Please paste your backup JSON first');
      return;
    }
    try {
      const parsed = JSON.parse(importText.trim());
      if (!isValidBackup(parsed)) {
        setImportError('Invalid backup structure. The JSON must contain a valid items array.');
        return;
      }

      Alert.alert(
        'Confirm Restore',
        `Found ${parsed.items.length} items. This will restore and update your vault. Continue?`,
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
              onShowToast && onShowToast(`Restored ${parsed.items.length} items`);
            }
          }
        ]
      );
    } catch (e) {
      setImportError('Invalid JSON format. Check brackets and quotes.');
    }
  }

  function handleAddNewTag() {
    const t = normalizeTag(newTagInput);
    if (!t) return;
    if (allTags.includes(t)) {
      Alert.alert('Tag Exists', `The tag "${t}" already exists.`);
      return;
    }
    onAddTag && onAddTag(t);
    setNewTagInput('');
    onShowToast && onShowToast(`Added tag ${t}`);
  }

  function confirmClearAll() {
    Alert.alert(
      'Wipe Vault Data',
      'Are you sure you want to permanently delete ALL vault items? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
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
            <Text style={styles.headerTitle}>Settings</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={10}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
            {/* Section: Security */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>SECURITY</Text>

              <View style={styles.rowCard}>
                <View style={styles.rowCardLeft}>
                  <Text style={styles.rowCardTitle}>Master PIN</Text>
                  <Text style={styles.rowCardSub}>
                    {pinCode ? 'Active (4-digit passcode set)' : 'Not configured'}
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
                  <Text style={styles.rowCardSub}>Require authentication on opening app</Text>
                </View>
                <Switch
                  value={Boolean(settings.lockOnAppOpen)}
                  onValueChange={handleToggleLockOnOpen}
                  trackColor={{ false: COLORS.border, true: COLORS.textPrimary }}
                  thumbColor={settings.lockOnAppOpen ? '#000000' : '#8E8E93'}
                />
              </View>

              <View style={styles.rowCard}>
                <View style={styles.rowCardLeft}>
                  <Text style={styles.rowCardTitle}>Biometric Authentication</Text>
                  <Text style={styles.rowCardSub}>Fingerprint or Face ID unlock</Text>
                </View>
                <Switch
                  value={Boolean(settings.biometricEnabled)}
                  onValueChange={handleToggleBiometric}
                  trackColor={{ false: COLORS.border, true: COLORS.textPrimary }}
                  thumbColor={settings.biometricEnabled ? '#000000' : '#8E8E93'}
                />
              </View>
            </View>

            {/* Section: Backup */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>DATA & BACKUP</Text>

              <TouchableOpacity style={styles.actionRow} onPress={handleExportVault} activeOpacity={0.7}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTitle}>Export Backup (JSON)</Text>
                  <Text style={styles.actionSub}>Copy all {items.length} vault items to clipboard</Text>
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
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTitle}>Restore from JSON</Text>
                  <Text style={styles.actionSub}>Import and restore notes, passwords & code</Text>
                </View>
                <Text style={styles.chevron}>{showImport ? '⌄' : '›'}</Text>
              </TouchableOpacity>

              {/* Import Drawer */}
              {showImport && (
                <View style={styles.importBox}>
                  <View style={styles.importHeaderRow}>
                    <Text style={styles.importLabel}>Paste backup JSON</Text>
                    <TouchableOpacity onPress={handlePasteFromClipboard} style={styles.pasteBtn}>
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
                  <TouchableOpacity style={styles.restoreBtn} onPress={handleExecuteRestore}>
                    <Text style={styles.restoreBtnText}>Restore Vault</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Section: Tags */}
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
                      <Text style={styles.tagDeleteText}>×</Text>
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

            {/* Section: Danger Zone */}
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: COLORS.danger }]}>DANGER ZONE</Text>
              <TouchableOpacity style={styles.dangerRow} onPress={confirmClearAll} activeOpacity={0.7}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dangerTitle}>Clear All Data</Text>
                  <Text style={styles.dangerSub}>Permanently delete all {items.length} items</Text>
                </View>
                <View style={styles.dangerBtn}>
                  <Text style={styles.dangerBtnText}>Delete All</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Minimal About */}
            <View style={styles.aboutBox}>
              <Text style={styles.aboutSub}>SecondBrain Vault • 100% Offline</Text>
              <Text style={styles.aboutMuted}>Stored locally in device memory.</Text>
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
  closeBtnText: {
    color: COLORS.textSecondary,
    fontSize: 14,
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
  chevron: {
    fontSize: 18,
    color: COLORS.textMuted,
    marginLeft: 10
  },
  importBox: {
    backgroundColor: COLORS.codeBg,
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
  tagDeleteText: {
    fontSize: 13,
    color: COLORS.textMuted,
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
    marginBottom: 2
  },
  aboutMuted: {
    fontSize: 11,
    color: COLORS.textMuted
  }
});
