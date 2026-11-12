// ============================================================================
// App.js — SecondBrain Vault
// Modern Minimalist Offline Knowledge & Security Vault
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
  Vibration,
  Animated
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';

import { COLORS, VAULT_CATEGORIES } from './src/theme/colors';
import {
  loadVaultState,
  saveVaultItems,
  saveVaultPin,
  saveVaultSettings,
  saveVaultTags
} from './src/storage/vaultStorage';
import {
  filterItems,
  computeStats
} from './src/utils/helpers';

import VaultItemCard from './src/components/VaultItemCard';
import QuickCaptureModal from './src/components/QuickCaptureModal';
import PinLockModal from './src/components/PinLockModal';
import SettingsModal from './src/components/SettingsModal';

export default function App() {
  // Vault Data
  const [items, setItems] = useState([]);
  const [pinCode, setPinCode] = useState(null);
  const [tags, setTags] = useState([]);
  const [settings, setSettings] = useState({ lockOnAppOpen: false, biometricEnabled: false });
  const [isLoaded, setIsLoaded] = useState(false);

  // Security / App Lock State
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [sessionUnlocked, setSessionUnlocked] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedTag, setSelectedTag] = useState(null);

  // Modals
  const [captureVisible, setCaptureVisible] = useState(false);
  const [captureItem, setCaptureItem] = useState(null);
  const [captureType, setCaptureType] = useState('NOTE');
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

  // Toast
  const [toastText, setToastText] = useState(null);
  const toastFade = useRef(new Animated.Value(0)).current;
  const toastTimeoutRef = useRef(null);

  const showToast = useCallback((msg) => {
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
  }, [toastFade]);

  // Initial Load (Filters out any previous dummy seed items)
  useEffect(() => {
    (async () => {
      const state = await loadVaultState();
      // Ensure no seed/dummy items linger
      const cleanItems = (state.items || []).filter((i) => !i.id?.startsWith('seed_'));
      setItems(cleanItems);
      if (cleanItems.length !== (state.items || []).length) {
        await saveVaultItems(cleanItems);
      }

      setPinCode(state.pinCode);
      setTags(state.tags || ['#work', '#personal', '#code', '#ideas']);
      setSettings(state.settings);

      // Lock on launch if enabled
      if (state.settings?.lockOnAppOpen && state.pinCode) {
        setIsAppLocked(true);
      }
      setIsLoaded(true);
    })();
  }, []);

  // Filtered Items Memo
  const filteredList = useMemo(() => {
    return filterItems(items, {
      query: searchQuery,
      category: selectedCategory,
      tag: selectedTag
    });
  }, [items, searchQuery, selectedCategory, selectedTag]);

  // Stats Memo
  const stats = useMemo(() => computeStats(items), [items]);

  // Mutations
  const updateItems = useCallback((newItems) => {
    setItems(newItems);
    saveVaultItems(newItems);
  }, []);

  const handleSaveItem = useCallback((savedItem) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === savedItem.id);
      let updated;
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = savedItem;
      } else {
        updated = [savedItem, ...prev];
      }
      saveVaultItems(updated);
      return updated;
    });
    setCaptureVisible(false);
    setCaptureItem(null);
    showToast(savedItem.title ? `Saved "${savedItem.title}"` : 'Item saved');
  }, [showToast]);

  const handleDeleteItem = useCallback((id) => {
    setItems((prev) => {
      const updated = prev.filter((i) => i.id !== id);
      saveVaultItems(updated);
      return updated;
    });
    showToast('Item deleted');
  }, [showToast]);

  const handleTogglePin = useCallback((id) => {
    setItems((prev) => {
      const updated = prev.map((i) => (i.id === id ? { ...i, isPinned: !i.isPinned } : i));
      saveVaultItems(updated);
      return updated;
    });
  }, []);

  const handleToggleTask = useCallback((itemId, taskId) => {
    setItems((prev) => {
      const updated = prev.map((item) => {
        if (item.id !== itemId) return item;
        const nextChecklist = (item.checklist || []).map((t) =>
          t.id === taskId ? { ...t, done: !t.done } : t
        );
        return { ...item, checklist: nextChecklist, updatedAt: new Date().toISOString() };
      });
      saveVaultItems(updated);
      return updated;
    });
  }, []);

  const handleCopy = useCallback(async (text, label = 'Copied') => {
    if (!text) return;
    try {
      await Clipboard.setStringAsync(String(text));
      Vibration.vibrate(40);
      showToast(`${label} copied`);
    } catch (e) {
      showToast('Copy failed');
    }
  }, [showToast]);

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
        subtitle: 'Enter PIN to unlock passwords',
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
      subtitle: 'Protects passwords and locked notes',
      fullScreen: false,
      onSuccess: async (newPin) => {
        setPinCode(newPin);
        await saveVaultPin(newPin);
        setPinModal((p) => ({ ...p, visible: false }));
        setSessionUnlocked(true);
        showToast('Passcode set');
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
        const nextSettings = { ...settings, lockOnAppOpen: false };
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

  const handleRestoreBackup = (restoredItems, restoredTags) => {
    updateItems(restoredItems);
    if (Array.isArray(restoredTags) && restoredTags.length > 0) {
      setTags(restoredTags);
      saveVaultTags(restoredTags);
    }
  };

  const handleClearAllItems = () => {
    updateItems([]);
  };

  const openQuickCapture = (type = 'NOTE') => {
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
        <Text style={styles.loadingText}>Loading...</Text>
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

      {/* Modern Minimalist Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Vault</Text>
          {pinCode ? (
            <TouchableOpacity onPress={toggleSessionLock} hitSlop={8} style={styles.lockStatusPill}>
              <Text style={styles.lockStatusText}>{sessionUnlocked ? 'Unlocked' : 'Locked'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => setSettingsVisible(true)}
          activeOpacity={0.7}
          hitSlop={8}
        >
          <Text style={styles.settingsIcon}>⚙</Text>
        </TouchableOpacity>
      </View>

      {/* Summary Indicator */}
      {items.length > 0 && (
        <View style={styles.summaryBar}>
          <Text style={styles.summaryText}>
            {stats.total} {stats.total === 1 ? 'item' : 'items'}
            {stats.pinned > 0 ? ` • ${stats.pinned} pinned` : ''}
            {stats.tasksTotal > 0 ? ` • ${stats.tasksDone}/${stats.tasksTotal} tasks` : ''}
          </Text>
        </View>
      )}

      {/* Minimal Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search notes, passwords, code..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
              <Text style={styles.clearSearchText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Clean Category Tabs */}
      <View style={styles.categoryBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          {VAULT_CATEGORIES.map((cat) => {
            const active = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryPill, active && styles.categoryPillActive]}
                onPress={() => setSelectedCategory(cat.id)}
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

      {/* Clean Tag Bar */}
      {tags.length > 0 && (
        <View style={styles.tagsBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagsScroll}>
            <TouchableOpacity
              style={[styles.tagFilterPill, selectedTag === null && styles.tagFilterPillActive]}
              onPress={() => setSelectedTag(null)}
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
                  onPress={() => setSelectedTag(active ? null : t)}
                >
                  <Text style={[styles.tagFilterText, active && styles.tagFilterTextActive]}>{t}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Main Vault List */}
      <FlatList
        data={filteredList}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <VaultItemCard
            item={item}
            hasPin={Boolean(pinCode)}
            sessionUnlocked={sessionUnlocked}
            onRequestUnlock={requestUnlock}
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
            <Text style={styles.emptyTitle}>
              {searchQuery || selectedCategory !== 'ALL' || selectedTag
                ? 'No matching results'
                : 'No items in vault'}
            </Text>
            <Text style={styles.emptySub}>
              {searchQuery || selectedCategory !== 'ALL' || selectedTag
                ? 'Try a different search query or clear the active filter.'
                : 'Tap + to write a note, save a code snippet, or store a password.'}
            </Text>

            {(!searchQuery && selectedCategory === 'ALL' && !selectedTag) && (
              <TouchableOpacity
                style={styles.emptyAddBtn}
                onPress={() => openQuickCapture('NOTE')}
                activeOpacity={0.8}
              >
                <Text style={styles.emptyAddBtnText}>+ New Item</Text>
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
        <Text style={styles.fabText}>+ New</Text>
      </TouchableOpacity>

      {/* Minimal Toast */}
      {toastText && (
        <Animated.View style={[styles.toastContainer, { opacity: toastFade }]}>
          <Text style={styles.toastText}>{toastText}</Text>
        </Animated.View>
      )}

      {/* Modals */}
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
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
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
  settingsIcon: {
    fontSize: 16,
    color: COLORS.textSecondary
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
  clearSearchText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 4
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
    paddingBottom: 90
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24
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
    lineHeight: 18,
    marginBottom: 20,
    maxWidth: 260
  },
  emptyAddBtn: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.borderHover,
    borderRadius: 8,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 10,
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
  }
});
