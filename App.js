// ============================================================================
// App.js — SecondBrain Vault
// Standalone Offline Vault: Home Guide, Expenses & Cash, Notes, Voice, Passwords, Tasks & Links
// ============================================================================

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  StatusBar as RNStatusBar,
  Platform,
  Animated,
  AppState
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

import { COLORS, VAULT_SECTIONS } from './src/theme/colors';
import {
  loadVaultState,
  upsertVaultItem,
  deleteVaultItemById,
  replaceAllVaultItems,
  addExpenseEntry,
  deleteExpenseEntryById,
  replaceAllExpenses,
  clearAllExpenses,
  deleteMediaFile,
  clearAllMediaFiles,
  saveVaultPin,
  saveVaultSettings
} from './src/storage/vaultStorage';
import {
  filterItems,
  computeStats,
  computeExpenseStats,
  hapticTap
} from './src/utils/helpers';

import SectionDropdown from './src/components/SectionDropdown';
import HomeSection from './src/components/HomeSection';
import ExpensesSection from './src/components/ExpensesSection';
import VaultItemCard from './src/components/VaultItemCard';
import QuickCaptureModal from './src/components/QuickCaptureModal';
import PinLockModal from './src/components/PinLockModal';
import SettingsModal from './src/components/SettingsModal';
import ItemDetailModal from './src/components/ItemDetailModal';

export default function App() {
  // Vault & Expenses Data
  const [items, setItems] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [pinCode, setPinCode] = useState(null);
  const [settings, setSettings] = useState({
    lockOnAppOpen: false,
    biometricEnabled: false,
    autoLockOnBackground: true,
    autoClearClipboard: true
  });
  const [isLoaded, setIsLoaded] = useState(false);

  // Security / App Lock State
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [sessionUnlocked, setSessionUnlocked] = useState(false);
  const [privacyShield, setPrivacyShield] = useState(false);

  // Navigation & Search (Defaults to HOME)
  const [activeSection, setActiveSection] = useState('HOME');
  const [searchQuery, setSearchQuery] = useState('');
  const [expenseModalTrigger, setExpenseModalTrigger] = useState(null);

  // Modals
  const [captureVisible, setCaptureVisible] = useState(false);
  const [captureItem, setCaptureItem] = useState(null);
  const [captureType, setCaptureType] = useState('NOTE');
  const [detailItemId, setDetailItemId] = useState(null);
  const [settingsVisible, setSettingsVisible] = useState(false);

  // PIN Modal State
  const [pinModal, setPinModal] = useState({
    visible: false,
    mode: 'verify',
    title: '',
    subtitle: '',
    onSuccess: null,
    fullScreen: false
  });

  // Toast & Timers
  const [toastText, setToastText] = useState(null);
  const toastFade = useRef(new Animated.Value(0)).current;
  const toastTimeoutRef = useRef(null);
  const clipboardTimerRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  const showToast = useCallback(
    (msg) => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      setToastText(msg);
      Animated.timing(toastFade, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true
      }).start();

      toastTimeoutRef.current = setTimeout(() => {
        Animated.timing(toastFade, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true
        }).start(() => setToastText(null));
      }, 2200);
    },
    [toastFade]
  );

  // Initial Load from SQLite + SecureStore
  useEffect(() => {
    (async () => {
      const state = await loadVaultState();
      const cleanItems = (state.items || []).filter(
        (i) => i && !i.id?.startsWith('seed_') && i.type !== 'SNIPPET'
      );
      setItems(cleanItems);
      setExpenses(state.expenses || []);
      setPinCode(state.pinCode);
      setSettings(state.settings);

      if (state.settings?.lockOnAppOpen && state.pinCode) {
        setIsAppLocked(true);
      }
      setIsLoaded(true);
    })();
  }, []);

  // AppState Privacy Curtain & Auto-Lock on Background
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      const modalBusy = captureVisible || settingsVisible || pinModal.visible;

      if (nextState === 'inactive' || nextState === 'background') {
        if (pinCode && settings.autoLockOnBackground && !modalBusy) {
          setPrivacyShield(true);
        }
      } else if (nextState === 'active') {
        setPrivacyShield(false);
        if (
          (prev === 'background' || prev === 'inactive') &&
          pinCode &&
          settings.autoLockOnBackground &&
          !modalBusy
        ) {
          setSessionUnlocked(false);
          if (settings.lockOnAppOpen) {
            setIsAppLocked(true);
          }
        }
      }
    });

    return () => sub.remove();
  }, [
    pinCode,
    settings.autoLockOnBackground,
    settings.lockOnAppOpen,
    captureVisible,
    settingsVisible,
    pinModal.visible
  ]);

  // Computed Data
  const filteredList = useMemo(() => {
    return filterItems(items, {
      query: searchQuery,
      category: activeSection
    });
  }, [items, searchQuery, activeSection]);

  const stats = useMemo(() => computeStats(items), [items]);
  const expenseStats = useMemo(() => computeExpenseStats(expenses), [expenses]);

  const activeDetailItem = useMemo(
    () => (detailItemId ? items.find((i) => i.id === detailItemId) || null : null),
    [detailItemId, items]
  );

  // Clear search automatically when changing section
  const handleSelectSection = useCallback((sectionId) => {
    setSearchQuery('');
    setActiveSection(sectionId);
  }, []);

  // Vault Item Mutations
  const handleSaveItem = useCallback(
    async (savedItem) => {
      setItems((prev) => {
        const idx = prev.findIndex((i) => i.id === savedItem.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = savedItem;
          return next;
        }
        return [savedItem, ...prev];
      });
      await upsertVaultItem(savedItem);
      setCaptureVisible(false);
      setCaptureItem(null);
      showToast(savedItem.title ? `Saved "${savedItem.title}"` : 'Item saved');
    },
    [showToast]
  );

  const handleDeleteItem = useCallback(
    async (id) => {
      const target = items.find((i) => i.id === id);
      if (target) {
        if (target.audioUri) deleteMediaFile(target.audioUri);
        (target.attachments || []).forEach((uri) => deleteMediaFile(uri));
      }
      setItems((prev) => prev.filter((i) => i.id !== id));
      if (detailItemId === id) setDetailItemId(null);
      await deleteVaultItemById(id);
      showToast('Item deleted');
    },
    [items, detailItemId, showToast]
  );

  const handleTogglePin = useCallback(async (id) => {
    let updatedItem = null;
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        updatedItem = { ...i, isPinned: !i.isPinned };
        return updatedItem;
      })
    );
    if (updatedItem) {
      await upsertVaultItem(updatedItem);
    }
  }, []);

  const handleToggleTask = useCallback(async (itemId, taskId) => {
    let updatedItem = null;
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const nextChecklist = (item.checklist || []).map((t) =>
          t.id === taskId ? { ...t, done: !t.done } : t
        );
        updatedItem = {
          ...item,
          checklist: nextChecklist,
          updatedAt: new Date().toISOString()
        };
        return updatedItem;
      })
    );
    if (updatedItem) {
      await upsertVaultItem(updatedItem);
    }
  }, []);

  // Expense Mutations
  const handleAddExpense = useCallback(
    async (entry) => {
      setExpenses((prev) => [entry, ...prev]);
      await addExpenseEntry(entry);
      showToast(
        entry.kind === 'CASH_IN'
          ? `Added ₱${entry.amount} cash`
          : `Deducted ₱${entry.amount} (${entry.title})`
      );
    },
    [showToast]
  );

  const handleDeleteExpense = useCallback(
    async (id) => {
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      await deleteExpenseEntryById(id);
      showToast('Record removed');
    },
    [showToast]
  );

  const handleClearExpenses = useCallback(async () => {
    setExpenses([]);
    await clearAllExpenses();
    showToast('Expenses reset');
  }, [showToast]);

  const handleCopy = useCallback(
    async (text, label = 'Copied', isSecret = false) => {
      if (!text) return;
      try {
        await Clipboard.setStringAsync(String(text));
        hapticTap('light');
        if (isSecret && settings.autoClearClipboard) {
          if (clipboardTimerRef.current) clearTimeout(clipboardTimerRef.current);
          clipboardTimerRef.current = setTimeout(() => {
            Clipboard.setStringAsync('').catch(() => {});
          }, 30000);
          showToast(`${label} copied (clears in 30s)`);
        } else {
          showToast(`${label} copied`);
        }
      } catch (e) {
        showToast('Copy failed');
      }
    },
    [settings.autoClearClipboard, showToast]
  );

  // PIN Gating & Unlock
  const requestUnlock = useCallback(
    (actionCallback) => {
      if (!pinCode || sessionUnlocked) {
        actionCallback && actionCallback();
        return;
      }
      setPinModal({
        visible: true,
        mode: 'verify',
        title: 'Master PIN',
        subtitle: 'Enter passcode to access protected item',
        fullScreen: false,
        onSuccess: () => {
          setPinModal((p) => ({ ...p, visible: false }));
          setSessionUnlocked(true);
          showToast('Unlocked');
          actionCallback && actionCallback();
        }
      });
    },
    [pinCode, sessionUnlocked, showToast]
  );

  const toggleSessionLock = () => {
    hapticTap('light');
    if (!pinCode) {
      promptSetPin();
      return;
    }
    if (sessionUnlocked) {
      setSessionUnlocked(false);
      showToast('Locked');
    } else {
      setPinModal({
        visible: true,
        mode: 'verify',
        title: 'Unlock Session',
        subtitle: 'Enter PIN to unlock passwords & locked notes',
        fullScreen: false,
        onSuccess: () => {
          setPinModal((p) => ({ ...p, visible: false }));
          setSessionUnlocked(true);
          showToast('Unlocked');
        }
      });
    }
  };

  const promptSetPin = () => {
    setSettingsVisible(false);
    setPinModal({
      visible: true,
      mode: 'set',
      title: 'Create Passcode',
      subtitle: 'Protects passwords, private photos, and locked notes',
      fullScreen: false,
      onSuccess: async (newPin) => {
        setPinCode(newPin);
        await saveVaultPin(newPin);
        setPinModal((p) => ({ ...p, visible: false }));
        setSessionUnlocked(true);
        showToast('Passcode saved securely');
      }
    });
  };

  const promptRemovePin = () => {
    setSettingsVisible(false);
    setPinModal({
      visible: true,
      mode: 'verify',
      title: 'Remove Passcode',
      subtitle: 'Enter current PIN to confirm',
      fullScreen: false,
      onSuccess: async () => {
        setPinCode(null);
        await saveVaultPin(null);
        const nextSettings = {
          ...settings,
          lockOnAppOpen: false,
          autoLockOnBackground: false
        };
        setSettings(nextSettings);
        await saveVaultSettings(nextSettings);
        setSessionUnlocked(false);
        setPinModal((p) => ({ ...p, visible: false }));
        showToast('Passcode removed');
      }
    });
  };

  const handleUpdateSettings = async (nextSettings) => {
    setSettings(nextSettings);
    await saveVaultSettings(nextSettings);
  };

  const handleRestoreBackup = async (restoredItems, restoredExpenses = []) => {
    setItems(restoredItems);
    await replaceAllVaultItems(restoredItems);
    if (Array.isArray(restoredExpenses)) {
      setExpenses(restoredExpenses);
      await replaceAllExpenses(restoredExpenses);
    }
  };

  const handleClearAllItems = async () => {
    setItems([]);
    setExpenses([]);
    setDetailItemId(null);
    clearAllMediaFiles();
    await replaceAllVaultItems([]);
    await clearAllExpenses();
  };

  const openQuickCapture = (type = 'NOTE') => {
    hapticTap('medium');
    setCaptureItem(null);
    setCaptureType(type);
    setCaptureVisible(true);
  };

  const openEdit = (item) => {
    setCaptureItem(item);
    setCaptureType(item.type);
    setCaptureVisible(true);
  };

  const handleFabPress = () => {
    if (activeSection === 'EXPENSES') {
      hapticTap('medium');
      setExpenseModalTrigger('EXPENSE');
      return;
    }
    const defaultType =
      activeSection !== 'HOME' && activeSection !== 'PINNED' ? activeSection : 'NOTE';
    openQuickCapture(defaultType);
  };

  const activeSectionMeta =
    VAULT_SECTIONS.find((s) => s.id === activeSection) || VAULT_SECTIONS[0];
  const isItemSection = activeSection !== 'HOME' && activeSection !== 'EXPENSES';

  if (!isLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="light" />
        <Text style={styles.loadingText}>Opening Vault...</Text>
      </View>
    );
  }

  // App Locked on Launch Screen
  if (isAppLocked && pinCode) {
    return (
      <SafeAreaView style={styles.appLockedContainer}>
        <StatusBar style="light" />
        <PinLockModal
          visible={true}
          mode="verify"
          correctPin={pinCode}
          biometricEnabled={Boolean(settings.biometricEnabled)}
          title="Vault Locked"
          subtitle="Enter passcode to continue"
          fullScreen={true}
          onSuccess={() => {
            setIsAppLocked(false);
            setSessionUnlocked(true);
            showToast('Unlocked');
          }}
          onCancel={() => {}}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>SecondBrain</Text>
          {pinCode ? (
            <TouchableOpacity
              onPress={toggleSessionLock}
              hitSlop={8}
              style={styles.lockStatusPill}
            >
              <Feather
                name={sessionUnlocked ? 'unlock' : 'lock'}
                size={11}
                color={COLORS.textSecondary}
              />
              <Text style={styles.lockStatusText}>
                {sessionUnlocked ? 'Unlocked' : 'Locked'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => {
            hapticTap('light');
            setSettingsVisible(true);
          }}
          activeOpacity={0.7}
          hitSlop={8}
        >
          <Feather name="settings" size={17} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Dropdown Section Switcher */}
      <SectionDropdown
        activeSection={activeSection}
        onSelectSection={handleSelectSection}
        stats={stats}
        expenseBalance={expenseStats.balance}
      />

      {/* HOME SECTION */}
      {activeSection === 'HOME' && (
        <HomeSection
          stats={stats}
          expenseStats={expenseStats}
          hasPin={Boolean(pinCode)}
          onSelectSection={handleSelectSection}
          onOpenSettings={() => setSettingsVisible(true)}
        />
      )}

      {/* EXPENSES SECTION */}
      {activeSection === 'EXPENSES' && (
        <ExpensesSection
          expenses={expenses}
          onAddEntry={handleAddExpense}
          onDeleteEntry={handleDeleteExpense}
          onClearAll={handleClearExpenses}
          externalModalTrigger={expenseModalTrigger}
          onExternalTriggerHandled={() => setExpenseModalTrigger(null)}
        />
      )}

      {/* VAULT ITEM SECTIONS (Notes, Voice, Passwords, Tasks, Links, Pinned) */}
      {isItemSection && (
        <>
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
                placeholder={`Search ${activeSectionMeta.label.toLowerCase()}...`}
                placeholderTextColor={COLORS.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
                  <Feather name="x" size={15} color={COLORS.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <FlatList
            data={filteredList}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <VaultItemCard
                item={item}
                hasPin={Boolean(pinCode)}
                sessionUnlocked={sessionUnlocked}
                onRequestUnlock={requestUnlock}
                onOpenDetail={(it) => setDetailItemId(it.id)}
                onToggleTask={handleToggleTask}
                onTogglePin={handleTogglePin}
                onEdit={openEdit}
                onDelete={handleDeleteItem}
                onCopy={handleCopy}
              />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconBox}>
                  <Feather
                    name={searchQuery ? 'search' : activeSectionMeta.icon}
                    size={22}
                    color={COLORS.textMuted}
                  />
                </View>
                <Text style={styles.emptyTitle}>
                  {searchQuery
                    ? 'No matching results'
                    : `No ${activeSectionMeta.label.toLowerCase()} yet`}
                </Text>
                <Text style={styles.emptySub}>
                  {searchQuery
                    ? 'Try a different search term.'
                    : activeSection === 'PINNED'
                    ? 'Bookmark any item to pin it here for quick access.'
                    : `Tap + New to create your first ${activeSectionMeta.label.toLowerCase()} entry.`}
                </Text>

                {!searchQuery && activeSection !== 'PINNED' && (
                  <TouchableOpacity
                    style={styles.emptyAddBtn}
                    onPress={() => openQuickCapture(activeSection)}
                    activeOpacity={0.8}
                  >
                    <Feather name="plus" size={14} color={COLORS.textPrimary} />
                    <Text style={styles.emptyAddBtnText}>
                      Add {activeSectionMeta.label}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        </>
      )}

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} onPress={handleFabPress} activeOpacity={0.85}>
        <Feather name="plus" size={16} color="#000000" />
        <Text style={styles.fabText}>
          {activeSection === 'EXPENSES' ? 'Expense' : 'New'}
        </Text>
      </TouchableOpacity>

      {/* Toast */}
      {toastText && (
        <Animated.View style={[styles.toastContainer, { opacity: toastFade }]}>
          <Text style={styles.toastText}>{toastText}</Text>
        </Animated.View>
      )}

      {/* Privacy Curtain Overlay */}
      {privacyShield && (
        <View style={styles.privacyCurtain}>
          <Feather name="shield" size={32} color={COLORS.textPrimary} />
          <Text style={styles.privacyCurtainText}>SecondBrain Vault</Text>
        </View>
      )}

      {/* Full-Screen Item Detail Modal */}
      <ItemDetailModal
        visible={Boolean(activeDetailItem)}
        item={activeDetailItem}
        hasPin={Boolean(pinCode)}
        sessionUnlocked={sessionUnlocked}
        onClose={() => setDetailItemId(null)}
        onEdit={openEdit}
        onDelete={handleDeleteItem}
        onTogglePin={handleTogglePin}
        onToggleTask={handleToggleTask}
        onRequestUnlock={requestUnlock}
        onCopy={handleCopy}
      />

      {/* Quick Capture / Edit Modal */}
      <QuickCaptureModal
        visible={captureVisible}
        initialItem={captureItem}
        initialType={captureType}
        hasPin={Boolean(pinCode)}
        onSave={handleSaveItem}
        onClose={() => {
          setCaptureVisible(false);
          setCaptureItem(null);
        }}
      />

      {/* PIN Modal */}
      <PinLockModal
        visible={pinModal.visible}
        mode={pinModal.mode}
        correctPin={pinCode}
        biometricEnabled={Boolean(settings.biometricEnabled)}
        title={pinModal.title}
        subtitle={pinModal.subtitle}
        fullScreen={pinModal.fullScreen}
        onSuccess={pinModal.onSuccess}
        onCancel={() => setPinModal((p) => ({ ...p, visible: false }))}
      />

      {/* Settings Modal */}
      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        pinCode={pinCode}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onRequestSetPin={promptSetPin}
        onRequestRemovePin={promptRemovePin}
        items={items}
        expenses={expenses}
        onRestoreBackup={handleRestoreBackup}
        onClearAllItems={handleClearAllItems}
        onShowToast={showToast}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight || 20 : 0
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textMuted
  },
  appLockedContainer: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.5
  },
  lockStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  lockStatusText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center'
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
    fontSize: 14
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 100
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 24
  },
  emptyIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6
  },
  emptySub: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
    maxWidth: 270
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.borderHover,
    borderRadius: 9,
    paddingHorizontal: 16,
    paddingVertical: 9
  },
  emptyAddBtnText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '600'
  },
  fab: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 36 : 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingVertical: 11,
    paddingHorizontal: 18,
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4
  },
  fabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000'
  },
  toastContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 88 : 76,
    alignSelf: 'center',
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.borderHover,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  toastText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '600'
  },
  privacyCurtain: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    zIndex: 999
  },
  privacyCurtainText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5
  }
});
