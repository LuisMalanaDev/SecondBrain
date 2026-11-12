// ============================================================================
// App.js — SecondBrain Vault (100% Offline Personal Knowledge & Security Vault)
// Apple Monochrome / Cyber Obsidian Theme
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
  makeId,
  nowIso,
  filterItems,
  computeStats
} from './src/utils/helpers';

import VaultItemCard from './src/components/VaultItemCard';
import QuickCaptureModal from './src/components/QuickCaptureModal';
import PinLockModal from './src/components/PinLockModal';
import SettingsModal from './src/components/SettingsModal';

const SEED_ITEMS = [
  {
    id: 'seed_note_1',
    type: 'NOTE',
    title: '🧠 Welcome to SecondBrain Vault',
    content:
      'Everything here is 100% offline and stored in local flash memory on your phone. No cloud sync, no tracking, and zero ads.\n\nTap the gear icon ⚙️ at the top right to set your 4-digit Master PIN and enable biometric unlock!',
    tags: ['#ideas', '#dev'],
    isPinned: true,
    isLocked: false,
    createdAt: nowIso(),
    updatedAt: nowIso()
  },
  {
    id: 'seed_snippet_1',
    type: 'SNIPPET',
    title: '⚡ Offline AsyncStorage Hook',
    content: `// Reusable React Native state with offline persistence
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useVault = (key) => {
  const [data, setData] = useState(null);
  useEffect(() => {
    AsyncStorage.getItem(key).then(val => {
      if (val) setData(JSON.parse(val));
    });
  }, [key]);
  return [data, setData];
};`,
    language: 'javascript',
    tags: ['#dev', '#snippets'],
    isPinned: true,
    isLocked: false,
    createdAt: nowIso(),
    updatedAt: nowIso()
  },
  {
    id: 'seed_checklist_1',
    type: 'CHECKLIST',
    title: '🚀 Getting Started Checklist',
    content: 'Quick setup to test all vault features:',
    checklist: [
      { id: 't1', text: 'Set a 4-Digit Master PIN in Settings ⚙️', done: false },
      { id: 't2', text: 'Create a test Password & verify the eye-reveal 👁️', done: false },
      { id: 't3', text: 'Save a Code Snippet and tap 📋 Copy Code', done: false },
      { id: 't4', text: 'Export a JSON backup to Clipboard', done: false }
    ],
    tags: ['#goals'],
    isPinned: false,
    isLocked: false,
    createdAt: nowIso(),
    updatedAt: nowIso()
  }
];

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

  // Sleek Toast
  const [toastText, setToastText] = useState(null);
  const toastFade = useRef(new Animated.Value(0)).current;
  const toastTimeoutRef = useRef(null);

  const showToast = useCallback((msg) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastText(msg);
    Animated.timing(toastFade, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true
    }).start();

    toastTimeoutRef.current = setTimeout(() => {
      Animated.timing(toastFade, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true
      }).start(() => setToastText(null));
    }, 2400);
  }, [toastFade]);

  // Initial Load from AsyncStorage
  useEffect(() => {
    (async () => {
      const state = await loadVaultState();
      let initItems = state.items;
      if (!initItems || initItems.length === 0) {
        initItems = SEED_ITEMS;
        await saveVaultItems(initItems);
      }
      setItems(initItems);
      setPinCode(state.pinCode);
      setTags(state.tags || ['#dev', '#ideas', '#passwords', '#goals', '#school', '#work']);
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

  // Item Mutations
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
    showToast(savedItem.title ? `Saved "${savedItem.title}"` : 'Vault item saved');
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
        return { ...item, checklist: nextChecklist, updatedAt: nowIso() };
      });
      saveVaultItems(updated);
      return updated;
    });
  }, []);

  const handleCopy = useCallback(async (text, label = 'Copied') => {
    if (!text) return;
    try {
      await Clipboard.setStringAsync(String(text));
      Vibration.vibrate(50);
      showToast(`${label} copied to clipboard! 📋`);
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
        title: 'Enter Master PIN',
        subtitle: 'Authorize access to protected item',
        fullScreen: false,
        onSuccess: () => {
          setPinModal((p) => ({ ...p, visible: false }));
          setSessionUnlocked(true);
          showToast('Session unlocked 🔓');
          actionCallback && actionCallback();
        }
      });
    },
    [pinCode, sessionUnlocked, showToast]
  );

  const toggleSessionLock = () => {
    if (!pinCode) {
      // Prompt user to set PIN
      promptSetPin();
      return;
    }
    if (sessionUnlocked) {
      setSessionUnlocked(false);
      showToast('Vault locked 🔒');
    } else {
      setPinModal({
        visible: true,
        mode: 'verify',
        title: 'Unlock Session',
        subtitle: 'Enter PIN to reveal all passwords',
        fullScreen: false,
        onSuccess: () => {
          setPinModal((p) => ({ ...p, visible: false }));
          setSessionUnlocked(true);
          showToast('Session unlocked 🔓');
        }
      });
    }
  };

  const promptSetPin = () => {
    setSettingsVisible(false);
    setPinModal({
      visible: true,
      mode: 'set',
      title: 'Create 4-Digit PIN',
      subtitle: 'Protects passwords and locked notes',
      fullScreen: false,
      onSuccess: async (newPin) => {
        setPinCode(newPin);
        await saveVaultPin(newPin);
        setPinModal((p) => ({ ...p, visible: false }));
        setSessionUnlocked(true);
        showToast('Master PIN set successfully! 🔐');
      }
    });
  };

  const promptRemovePin = () => {
    setSettingsVisible(false);
    setPinModal({
      visible: true,
      mode: 'verify',
      title: 'Remove Master PIN',
      subtitle: 'Enter current PIN to confirm removal',
      fullScreen: false,
      onSuccess: async () => {
        setPinCode(null);
        await saveVaultPin(null);
        // Also disable lockOnAppOpen if PIN is removed
        const nextSettings = { ...settings, lockOnAppOpen: false };
        setSettings(nextSettings);
        await saveVaultSettings(nextSettings);
        setSessionUnlocked(false);
        setPinModal((p) => ({ ...p, visible: false }));
        showToast('PIN removed. Vault is unlocked.');
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
    showToast(`Removed tag ${tagToDelete}`);
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
        <Text style={styles.loadingLogo}>🧠</Text>
        <Text style={styles.loadingText}>Opening SecondBrain Vault...</Text>
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
          title="SecondBrain Locked"
          subtitle="Enter 4-digit PIN or use Biometrics"
          fullScreen={true}
          onSuccess={() => {
            setIsAppLocked(false);
            setSessionUnlocked(true);
            showToast('Welcome back! 🔓');
          }}
          onCancel={() => {}}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerBrand}>
          <Text style={styles.headerIcon}>🧠</Text>
          <View>
            <Text style={styles.headerTitle}>SECONDBRAIN</Text>
            <Text style={styles.headerSubtitle}>
              {pinCode ? (sessionUnlocked ? 'UNLOCKED • DEV VAULT' : 'LOCKED • DEV VAULT') : '100% OFFLINE VAULT'}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          {pinCode && (
            <TouchableOpacity
              style={[styles.headerBtn, sessionUnlocked && styles.headerBtnActive]}
              onPress={toggleSessionLock}
              activeOpacity={0.7}
              hitSlop={8}
            >
              <Text style={styles.headerBtnText}>{sessionUnlocked ? '🔓' : '🔒'}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setSettingsVisible(true)}
            activeOpacity={0.7}
            hitSlop={8}
          >
            <Text style={styles.headerBtnText}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Hero Bar */}
      <View style={styles.statsBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsScroll}>
          <View style={styles.statPill}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Items</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statPill}>
            <Text style={[styles.statValue, { color: '#FBBF24' }]}>{stats.pinned}</Text>
            <Text style={styles.statLabel}>Pinned</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statPill}>
            <Text style={[styles.statValue, { color: COLORS.snippet }]}>{stats.snippets}</Text>
            <Text style={styles.statLabel}>Snippets</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statPill}>
            <Text style={[styles.statValue, { color: COLORS.password }]}>{stats.passwords}</Text>
            <Text style={styles.statLabel}>Keys</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statPill}>
            <Text style={[styles.statValue, { color: COLORS.checklist }]}>
              {stats.tasksDone}/{stats.tasksTotal}
            </Text>
            <Text style={styles.statLabel}>Tasks Done</Text>
          </View>
        </ScrollView>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search vault, tags, code..."
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

      {/* Category Tabs */}
      <View style={styles.categoryBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          {VAULT_CATEGORIES.map((cat) => {
            const active = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryPill,
                  active && styles.categoryPillActive,
                  active && { borderColor: cat.color || COLORS.accentPrimary }
                ]}
                onPress={() => setSelectedCategory(cat.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    active && styles.categoryPillTextActive,
                    active && { color: cat.color || '#FFFFFF' }
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Tag Filter Bar */}
      <View style={styles.tagsBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagsScroll}>
          <TouchableOpacity
            style={[styles.tagFilterPill, selectedTag === null && styles.tagFilterPillActive]}
            onPress={() => setSelectedTag(null)}
          >
            <Text style={[styles.tagFilterText, selectedTag === null && styles.tagFilterTextActive]}>
              All Tags
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
            <Text style={styles.emptyIcon}>
              {searchQuery || selectedCategory !== 'ALL' || selectedTag ? '🔎' : '📂'}
            </Text>
            <Text style={styles.emptyTitle}>
              {searchQuery || selectedCategory !== 'ALL' || selectedTag
                ? 'No matching vault items'
                : 'Your Vault is Empty'}
            </Text>
            <Text style={styles.emptySub}>
              {searchQuery || selectedCategory !== 'ALL' || selectedTag
                ? 'Try tweaking your search term, clearing your tag filter, or picking another category.'
                : 'Store your project ideas, reusable code snippets, private passwords, and checklists offline.'}
            </Text>

            {/* Quick Action Suggestions */}
            <View style={styles.emptyActionsGrid}>
              <TouchableOpacity
                style={[styles.emptyActionCard, { borderColor: COLORS.note }]}
                onPress={() => openQuickCapture('NOTE')}
              >
                <Text style={styles.emptyActionIcon}>💡</Text>
                <Text style={styles.emptyActionText}>+ New Note</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.emptyActionCard, { borderColor: COLORS.snippet }]}
                onPress={() => openQuickCapture('SNIPPET')}
              >
                <Text style={styles.emptyActionIcon}>💻</Text>
                <Text style={styles.emptyActionText}>+ Add Code</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.emptyActionCard, { borderColor: COLORS.password }]}
                onPress={() => openQuickCapture('PASSWORD')}
              >
                <Text style={styles.emptyActionIcon}>🔐</Text>
                <Text style={styles.emptyActionText}>+ Password</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.emptyActionCard, { borderColor: COLORS.checklist }]}
                onPress={() => openQuickCapture('CHECKLIST')}
              >
                <Text style={styles.emptyActionIcon}>✅</Text>
                <Text style={styles.emptyActionText}>+ Checklist</Text>
              </TouchableOpacity>
            </View>
          </View>
        }
      />

      {/* Floating Action Button (FAB) */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => openQuickCapture(selectedCategory !== 'ALL' && selectedCategory !== 'PINNED' ? selectedCategory : 'NOTE')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabPlus}>+</Text>
        <Text style={styles.fabText}>Capture</Text>
      </TouchableOpacity>

      {/* Sleek Bottom Toast Notification */}
      {toastText && (
        <Animated.View style={[styles.toastContainer, { opacity: toastFade }]}>
          <Text style={styles.toastText}>{toastText}</Text>
        </Animated.View>
      )}

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

      {/* PIN Lock Modal */}
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
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight || 24 : 0
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  loadingLogo: {
    fontSize: 48,
    marginBottom: 16
  },
  loadingText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    fontWeight: '600'
  },
  appLockedContainer: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)'
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  headerIcon: {
    fontSize: 28,
    marginRight: 10
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 1.5
  },
  headerSubtitle: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 1
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerBtnActive: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.12)'
  },
  headerBtnText: {
    fontSize: 16
  },
  statsBar: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)'
  },
  statsScroll: {
    paddingHorizontal: 18,
    alignItems: 'center',
    flexDirection: 'row'
  },
  statPill: {
    alignItems: 'center',
    paddingHorizontal: 8
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary
  },
  statLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 2
  },
  statDivider: {
    width: 1,
    height: 22,
    backgroundColor: COLORS.border,
    marginHorizontal: 10
  },
  searchContainer: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 6
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
    opacity: 0.6
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 14
  },
  clearSearchText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 4
  },
  categoryBar: {
    paddingVertical: 6
  },
  categoryScroll: {
    paddingHorizontal: 18,
    gap: 8,
    flexDirection: 'row'
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  categoryPillActive: {
    backgroundColor: COLORS.surfaceElevated
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary
  },
  categoryPillTextActive: {
    fontWeight: '800'
  },
  tagsBar: {
    paddingBottom: 8
  },
  tagsScroll: {
    paddingHorizontal: 18,
    gap: 6,
    flexDirection: 'row'
  },
  tagFilterPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'transparent'
  },
  tagFilterPillActive: {
    borderColor: COLORS.accentPrimary,
    backgroundColor: COLORS.surfaceElevated
  },
  tagFilterText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600'
  },
  tagFilterTextActive: {
    color: COLORS.textPrimary,
    fontWeight: '700'
  },
  listContent: {
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 90
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: 12
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6
  },
  emptySub: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
    maxWidth: 280
  },
  emptyActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    maxWidth: 320
  },
  emptyActionCard: {
    width: 140,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center'
  },
  emptyActionIcon: {
    fontSize: 22,
    marginBottom: 6
  },
  emptyActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary
  },
  fab: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 36 : 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accentPrimary,
    borderRadius: 26,
    paddingVertical: 12,
    paddingHorizontal: 18,
    elevation: 8,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8
  },
  fabPlus: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000000',
    marginRight: 6,
    lineHeight: 22
  },
  fabText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.5
  },
  toastContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 96 : 84,
    alignSelf: 'center',
    backgroundColor: '#1C1C24',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    elevation: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600'
  }
});
