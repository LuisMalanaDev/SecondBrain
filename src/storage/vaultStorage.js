// ============================================================================
// src/storage/vaultStorage.js — 100% Offline-First AsyncStorage Engine
// Supports: PIN Lock, Notes, Code Snippets, Passwords, Checklists & Links
// ============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  VAULT_ITEMS: 'sbv_items_v1',
  VAULT_PIN: 'sbv_pin_v1',
  VAULT_TAGS: 'sbv_tags_v1',
  VAULT_SETTINGS: 'sbv_settings_v1'
};

export async function loadVaultState() {
  try {
    const [rawItems, rawPin, rawTags, rawSettings] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.VAULT_ITEMS),
      AsyncStorage.getItem(STORAGE_KEYS.VAULT_PIN),
      AsyncStorage.getItem(STORAGE_KEYS.VAULT_TAGS),
      AsyncStorage.getItem(STORAGE_KEYS.VAULT_SETTINGS)
    ]);

    return {
      items: rawItems ? JSON.parse(rawItems) : [],
      pinCode: rawPin || null, // null means user hasn't set a PIN yet (or unlocked)
      tags: rawTags
        ? JSON.parse(rawTags)
        : ['#dev', '#ideas', '#passwords', '#goals', '#school', '#work'],
      settings: {
        lockOnAppOpen: false,
        biometricEnabled: false,
        ...(rawSettings ? JSON.parse(rawSettings) : {})
      }
    };
  } catch (e) {
    return {
      items: [],
      pinCode: null,
      tags: ['#dev', '#ideas', '#passwords', '#goals'],
      settings: { lockOnAppOpen: false, biometricEnabled: false }
    };
  }
}

export async function saveVaultItems(items) {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.VAULT_ITEMS, JSON.stringify(items));
  } catch (e) {}
}

export async function saveVaultPin(pinCode) {
  try {
    if (!pinCode) {
      await AsyncStorage.removeItem(STORAGE_KEYS.VAULT_PIN);
    } else {
      await AsyncStorage.setItem(STORAGE_KEYS.VAULT_PIN, String(pinCode));
    }
  } catch (e) {}
}

export async function saveVaultSettings(settings) {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.VAULT_SETTINGS, JSON.stringify(settings));
  } catch (e) {}
}

export async function saveVaultTags(tags) {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.VAULT_TAGS, JSON.stringify(tags));
  } catch (e) {}
}

/**
 * Item Schema Reference for Next Model:
 * {
 *   id: 'item_1700000000',
 *   type: 'NOTE' | 'SNIPPET' | 'PASSWORD' | 'CHECKLIST' | 'LINK',
 *   title: string,
 *   content: string,          // Markdown note, code block, or general description
 *   language: string,         // For SNIPPET: 'javascript' | 'typescript' | 'python' | 'bash' | 'sql'
 *   username: string,         // For PASSWORD: email/username
 *   secretPassword: string,   // For PASSWORD: hidden by default until eye-toggle or PIN verified
 *   websiteUrl: string,       // For LINK or PASSWORD
 *   checklist: [              // For CHECKLIST: array of { id, text, done }
 *     { id: 'c1', text: 'Push to GitHub', done: false }
 *   ],
 *   tags: ['#dev', '#ideas'],
 *   isPinned: boolean,
 *   isLocked: boolean,        // Requires 4-digit PIN to view/reveal
 *   createdAt: string,
 *   updatedAt: string
 * }
 */
