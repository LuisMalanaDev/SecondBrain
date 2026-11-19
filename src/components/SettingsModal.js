// ============================================================================
// src/components/SettingsModal.js — Settings, Appearance, Security & File Backups
// ============================================================================

import React, { useState, useMemo } from 'react';
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
import { useTheme } from '../theme/colors';
import { isValidBackup, hapticTap, hapticNotify } from '../utils/helpers';
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
  items = [],
  expenses = [],
  events = [],
  onRestoreBackup,
  onClearAllItems,
  onShowToast
}) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [showPasteImport, setShowPasteImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');

  function handleSetTheme(mode) {
    hapticTap('light');
    onUpdateSettings({ ...settings, themeMode: mode });
  }

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
      await exportVaultBackupFile(items, expenses, events);
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
          version: 4,
          exportedAt: new Date().toISOString(),
          itemCount: items.length,
          expenseCount: expenses.length,
          eventCount: events.length,
          items,
          expenses,
          events
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
      const restoredExpenses = Array.isArray(parsed.expenses) ? parsed.expenses : [];
      const restoredEvents = Array.isArray(parsed.events) ? parsed.events : [];
      Alert.alert(
        'Confirm Restore',
        `Found ${cleanItems.length} vault items${
          restoredExpenses.length ? `, ${restoredExpenses.length} expenses` : ''
        }${restoredEvents.length ? `, and ${restoredEvents.length} calendar dates` : ''}. Replace current data?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: () => {
              onRestoreBackup && onRestoreBackup(cleanItems, restoredExpenses, restoredEvents);
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

  function confirmClearAll() {
    hapticTap('heavy');
    Alert.alert(
      'Wipe Vault Data',
      'Permanently delete ALL notes, voice memos, photos, passwords, checklists, links, and expenses?',
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
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Settings</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={10}>
              <Feather name="x" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {/* APPEARANCE */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>APPEARANCE</Text>

              <View style={styles.rowCard}>
                <View style={styles.rowCardLeft}>
                  <Text style={styles.rowCardTitle}>Theme</Text>
                  <Text style={styles.rowCardSub}>
                    {isDark ? 'OLED Dark (Default)' : 'Clean Monochrome Light'}
                  </Text>
                </View>

                <View style={styles.themeToggle}>
                  <TouchableOpacity
                    style={[styles.themeBtn, isDark && styles.themeBtnActive]}
                    onPress={() => handleSetTheme('dark')}
                    activeOpacity={0.75}
                  >
                    <Feather
                      name="moon"
                      size={12}
                      color={isDark ? colors.solidBtnText : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.themeBtnText,
                        isDark && styles.themeBtnTextActive
                      ]}
                    >
                      Dark
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.themeBtn, !isDark && styles.themeBtnActive]}
                    onPress={() => handleSetTheme('light')}
                    activeOpacity={0.75}
                  >
                    <Feather
                      name="sun"
                      size={12}
                      color={!isDark ? colors.solidBtnText : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.themeBtnText,
                        !isDark && styles.themeBtnTextActive
                      ]}
                    >
                      Light
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

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
                      <Text style={[styles.smallBtnText, { color: colors.danger }]}>Remove</Text>
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
                  trackColor={{
                    false: colors.switchTrackFalse,
                    true: colors.switchTrackTrue
                  }}
                  thumbColor={
                    settings.lockOnAppOpen ? colors.switchThumbTrue : colors.switchThumbFalse
                  }
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
                  trackColor={{
                    false: colors.switchTrackFalse,
                    true: colors.switchTrackTrue
                  }}
                  thumbColor={
                    settings.autoLockOnBackground
                      ? colors.switchThumbTrue
                      : colors.switchThumbFalse
                  }
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
                  trackColor={{
                    false: colors.switchTrackFalse,
                    true: colors.switchTrackTrue
                  }}
                  thumbColor={
                    settings.biometricEnabled ? colors.switchThumbTrue : colors.switchThumbFalse
                  }
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
                  trackColor={{
                    false: colors.switchTrackFalse,
                    true: colors.switchTrackTrue
                  }}
                  thumbColor={
                    settings.autoClearClipboard
                      ? colors.switchThumbTrue
                      : colors.switchThumbFalse
                  }
                />
              </View>
            </View>

            {/* DATA & BACKUP */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>LOCAL BACKUP & PORTABILITY</Text>

              <TouchableOpacity style={styles.actionRow} onPress={handleExportFile} activeOpacity={0.7}>
                <Feather name="upload" size={16} color={colors.textPrimary} style={styles.actionIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTitle}>Export Backup File (.json)</Text>
                  <Text style={styles.actionSub}>
                    Save or share {items.length} items & {expenses.length} expenses
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionRow} onPress={handleImportFile} activeOpacity={0.7}>
                <Feather name="download" size={16} color={colors.textPrimary} style={styles.actionIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTitle}>Import Backup File (.json)</Text>
                  <Text style={styles.actionSub}>Pick a .json backup file from your phone</Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionRow}
                onPress={handleCopyJsonClipboard}
                activeOpacity={0.7}
              >
                <Feather name="clipboard" size={16} color={colors.textSecondary} style={styles.actionIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTitle}>Copy JSON to Clipboard</Text>
                  <Text style={styles.actionSub}>Quick text copy of vault items</Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => {
                  setShowPasteImport(!showPasteImport);
                  setImportError('');
                }}
                activeOpacity={0.7}
              >
                <Feather name="file-text" size={16} color={colors.textSecondary} style={styles.actionIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTitle}>Restore from Pasted JSON</Text>
                  <Text style={styles.actionSub}>Paste JSON text backup directly</Text>
                </View>
                <Feather
                  name={showPasteImport ? 'chevron-down' : 'chevron-right'}
                  size={16}
                  color={colors.textMuted}
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
                    placeholderTextColor={colors.textMuted}
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

            {/* DANGER ZONE */}
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: colors.danger }]}>DANGER ZONE</Text>
              <TouchableOpacity style={styles.dangerRow} onPress={confirmClearAll} activeOpacity={0.7}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dangerTitle}>Clear All Data</Text>
                  <Text style={styles.dangerSub}>
                    Delete all {items.length} items, expenses & stored media
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

const makeStyles = (colors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.backdrop,
      justifyContent: 'flex-end'
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
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
      borderBottomColor: colors.border
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surfaceElevated,
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
      color: colors.textMuted,
      letterSpacing: 0.8,
      marginBottom: 10
    },
    rowCard: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
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
      color: colors.textPrimary,
      marginBottom: 2
    },
    rowCardSub: {
      fontSize: 12,
      color: colors.textMuted
    },
    themeToggle: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 2,
      gap: 2
    },
    themeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6
    },
    themeBtnActive: {
      backgroundColor: colors.solidBtnBg
    },
    themeBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted
    },
    themeBtnTextActive: {
      color: colors.solidBtnText,
      fontWeight: '700'
    },
    btnRow: {
      flexDirection: 'row',
      alignItems: 'center'
    },
    smallBtn: {
      borderWidth: 1,
      borderColor: colors.borderHover,
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 5
    },
    smallBtnText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '600'
    },
    primarySmallBtn: {
      backgroundColor: colors.solidBtnBg,
      borderRadius: 6,
      paddingHorizontal: 12,
      paddingVertical: 6
    },
    primarySmallBtnText: {
      color: colors.solidBtnText,
      fontSize: 12,
      fontWeight: '700'
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 8
    },
    actionIcon: {
      marginRight: 12
    },
    actionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 2
    },
    actionSub: {
      fontSize: 12,
      color: colors.textMuted
    },
    importBox: {
      backgroundColor: colors.background,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
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
      color: colors.textMuted
    },
    pasteBtn: {
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: 4,
      backgroundColor: colors.surfaceSubtle
    },
    pasteBtnText: {
      fontSize: 11,
      color: colors.textPrimary,
      fontWeight: '600'
    },
    importInput: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 10,
      color: colors.textPrimary,
      fontSize: 12,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      minHeight: 70,
      textAlignVertical: 'top',
      marginBottom: 8
    },
    errorText: {
      color: colors.danger,
      fontSize: 12,
      marginBottom: 8
    },
    restoreBtn: {
      backgroundColor: colors.solidBtnBg,
      borderRadius: 8,
      paddingVertical: 9,
      alignItems: 'center'
    },
    restoreBtnText: {
      color: colors.solidBtnText,
      fontSize: 12,
      fontWeight: '700'
    },
    dangerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14
    },
    dangerTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.danger,
      marginBottom: 2
    },
    dangerSub: {
      fontSize: 12,
      color: colors.textMuted
    },
    dangerBtn: {
      backgroundColor: 'rgba(229, 72, 77, 0.12)',
      borderWidth: 1,
      borderColor: colors.danger,
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 6
    },
    dangerBtnText: {
      color: colors.danger,
      fontSize: 12,
      fontWeight: '700'
    },
    aboutBox: {
      alignItems: 'center',
      paddingVertical: 16,
      marginTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border
    },
    aboutSub: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '600',
      marginBottom: 4
    },
    aboutMuted: {
      fontSize: 11,
      color: colors.textMuted,
      textAlign: 'center'
    }
  });
