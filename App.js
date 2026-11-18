// ============================================================================
// App.js — SecondBrain Vault
// Standalone Offline Knowledge, Voice, Photo, Link & Password Vault
// Local SQLite + Hardware SecureStore + Private Sandbox Media
// ============================================================================

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  StatusBar as RNStatusBar,
  Platform,
  Animated,
  AppState
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

import { COLORS, VAULT_CATEGORIES } from './src/theme/colors';
import {
  loadVaultState,
  upsertVaultItem,
  deleteVaultItemById,
  replaceAllVaultItems,
  deleteMediaFile,
  clearAllMediaFiles,
  saveVaultPin,
  saveVaultSettings,
  saveVaultTags
} from './src/storage/vaultStorage';
import {
  filterItems,
  computeStats,
  hapticTap
} from './src/utils/helpers';

import VaultItemCard from './src/components/VaultItemCard';
import QuickCaptureModal from './src/components/QuickCaptureModal';
import PinLockModal from './src/components/PinLockModal';
import SettingsModal from './src/components/SettingsModal';
import ItemDetailModal from './src/components/ItemDetailModal';

export default function App() {
  // Vault Data
  const [items, setItems] = useState([]);
  const [pinCode, setPinCode] = useState(null);
  const [tags, setTags] = useState([]);
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

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedTag, setSelectedTag] = useState(null);

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
      setPinCode(state.pinCode);
      setTags(state.tags || ['#personal', '#work', '#ideas', '#watchlater', '#passwords']);
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

      // Avoid auto-locking while native pickers/biometric/share sheets are open
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

  // Filtered Items & Stats
  const filteredList = useMemo(() => {
    return filterItems(items, {
      query: searchQuery,
      category: selectedCategory,
      tag: selectedTag
    });
  }, [items, searchQuery, selectedCategory, selectedTag]);

  const stats = useMemo(() => computeStats(items), [items]);

  const activeDetailItem = useMemo(
    () => (detailItemId ? items.find((i) => i.id === detailItemId) || null : null),
    [detailItemId, items]
  );

  // Mutations (SQLite row-level updates)
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

  const handleAddTag = async (newTag) => {
    if (!tags.includes(newTag)) {
      const updated = [...tags, newTag];
      setTags(updated);
      await saveVaultTags(updated);
    }
  };

  const handleDeleteTag = async (tagToDelete) => {
    const updated = tags.filter((t) => t !== tagToDelete);
    setTags(updated);
    if (selectedTag === tagToDelete) setSelectedTag(null);
    await saveVaultTags(updated);
    showToast(`Removed ${tagToDelete}`);
  };

  const handleRestoreBackup = async (restoredItems, restoredTags) => {
    setItems(restoredItems);
    await replaceAllVaultItems(restoredItems);
    if (Array.isArray(restoredTags) && restoredTags.length > 0) {
      setTags(restoredTags);
      await saveVaultTags(restoredTags);
    }
  };

  const handleClearAllItems = async () => {
    setItems([]);
    setDetailItemId(null);
    clearAllMediaFiles();
    await replaceAllVaultItems([]);
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
          <Text style={styles.headerTitle}>Vault</Text>
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

      {/* Summary Bar */}
      {items.length > 0 && (
        <View style={styles.summaryBar}>
          <Text style={styles.summaryText}>
            {stats.total} {stats.total === 1 ? 'item' : 'items'}
            {stats.pinned > 0 ? ` • ${stats.pinned} pinned` : ''}
            {stats.voiceMemos > 0 ? ` • ${stats.voiceMemos} voice` : ''}
            {stats.tasksTotal > 0 ? ` • ${stats.tasksDone}/${stats.tasksTotal} tasks` : ''}
          </Text>
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Feather name="search" size={15} color={COLORS.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search notes, links, passwords..."
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

      {/* Category Tabs */}
      <View style={styles.categoryBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {VAULT_CATEGORIES.map((cat) => {
            const active = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryPill, active && styles.categoryPillActive]}
                onPress={() => {
                  hapticTap('light');
                  setSelectedCategory(cat.id);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.categoryPillText, active && styles.categoryPillTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Tag Bar */}
      {tags.length > 0 && (
        <View style={styles.tagsBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagsScroll}
          >
            <TouchableOpacity
              style={[styles.tagFilterPill, selectedTag === null && styles.tagFilterPillActive]}
              onPress={() => {
                hapticTap('light');
                setSelectedTag(null);
              }}
            >
              <Text style={[styles.tagFilterText, selectedTag === null && styles.tagFilterTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            {tags.map((t) => {
              const active = selectedTag === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.tagFilterPill, active && styles.tagFilterPillActive]}
                  onPress={() => {
                    hapticTap('light');
                    setSelectedTag(active ? null : t);
                  }}
                >
                  <Text style={[styles.tagFilterText, active && styles.tagFilterTextActive]}>{t}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Main List */}
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
                name={searchQuery || selectedCategory !== 'ALL' || selectedTag ? 'search' : 'layers'}
                size={22}
                color={COLORS.textMuted}
              />
            </View>
            <Text style={styles.emptyTitle}>
              {searchQuery || selectedCategory !== 'ALL' || selectedTag
                ? 'No matching results'
                : 'No items in vault'}
            </Text>
            <Text style={styles.emptySub}>
              {searchQuery || selectedCategory !== 'ALL' || selectedTag
                ? 'Try a different search query or clear the active filter.'
                : 'Tap + New to save notes, voice memos, private photos, links, or passwords offline.'}
            </Text>

            {!searchQuery && selectedCategory === 'ALL' && !selectedTag && (
              <TouchableOpacity
                style={styles.emptyAddBtn}
                onPress={() => openQuickCapture('NOTE')}
                activeOpacity={0.8}
              >
                <Feather name="plus" size={14} color={COLORS.textPrimary} />
                <Text style={styles.emptyAddBtnText}>New Item</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() =>
          openQuickCapture(
            selectedCategory !== 'ALL' && selectedCategory !== 'PINNED' ? selectedCategory : 'NOTE'
          )
        }
        activeOpacity={0.85}
      >
        <Feather name="plus" size={16} color="#000000" />
        <Text style={styles.fabText}>New</Text>
      </TouchableOpacity>

      {/* Toast */}
      {toastText && (
        <Animated.View style={[styles.toastContainer, { opacity: toastFade }]}>
          <Text style={styles.toastText}>{toastText}</Text>
        </Animated.View>
      )}

      {/* Privacy Curtain Overlay (Hides sensitive data in recent apps switcher) */}
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
        allTags={tags}
        hasPin={Boolean(pinCode)}
        onSave={handleSaveItem}
        onClose={() => {
          setCaptureVisible(false);
          setCaptureItem(null);
        }}
        onAddTag={handleAddTag}
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
        allTags={tags}
        onDeleteTag={handleDeleteTag}
        onAddTag={handleAddTag}
        items={items}
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
    fontSize: 24,
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
  summaryBar: {
    paddingHorizontal: 20,
    paddingBottom: 8
  },
  summaryText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500'
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 6
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
  categoryBar: {
    paddingVertical: 8
  },
  categoryScroll: {
    paddingHorizontal: 20,
    gap: 8,
    flexDirection: 'row'
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  categoryPillActive: {
    backgroundColor: COLORS.surfaceElevated,
    borderColor: COLORS.borderHover
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textSecondary
  },
  categoryPillTextActive: {
    color: COLORS.textPrimary,
    fontWeight: '700'
  },
  tagsBar: {
    paddingBottom: 8
  },
  tagsScroll: {
    paddingHorizontal: 20,
    gap: 6,
    flexDirection: 'row'
  },
  tagFilterPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: COLORS.surfaceSubtle
  },
  tagFilterPillActive: {
    backgroundColor: COLORS.borderHover
  },
  tagFilterText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500'
  },
  tagFilterTextActive: {
    color: COLORS.textPrimary,
    fontWeight: '600'
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 96
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
