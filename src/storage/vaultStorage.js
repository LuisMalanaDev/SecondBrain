// ============================================================================
// src/storage/vaultStorage.js
// 100% Standalone Local Storage Engine:
// - SQLite (expo-sqlite) for Vault Items, Cash/Expenses & Settings
// - Hardware SecureStore (expo-secure-store) for Master PIN
// - Local Sandbox FileSystem (expo-file-system) for Voice Memos, Photos & Backups
// ============================================================================

import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Paths, File, Directory } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

const LEGACY_KEYS = {
  VAULT_ITEMS: 'sbv_items_v1',
  VAULT_PIN: 'sbv_pin_v1',
  VAULT_SETTINGS: 'sbv_settings_v1'
};

const SECURE_PIN_KEY = 'sbv_master_pin_v2';
const DB_NAME = 'secondbrain_vault.db';

const DEFAULT_SETTINGS = {
  lockOnAppOpen: false,
  biometricEnabled: false,
  autoLockOnBackground: true,
  autoClearClipboard: true,
  notificationsEnabled: true,
  themeMode: 'dark'
};

let dbInitPromise = null;

async function getDb() {
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS vault_items (
          id TEXT PRIMARY KEY NOT NULL,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          content TEXT,
          username TEXT,
          secretPassword TEXT,
          websiteUrl TEXT,
          checklist TEXT,
          tags TEXT,
          attachments TEXT,
          audioUri TEXT,
          audioDurationMs INTEGER DEFAULT 0,
          isPinned INTEGER DEFAULT 0,
          isLocked INTEGER DEFAULT 0,
          createdAt TEXT,
          updatedAt TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_items_updated ON vault_items(updatedAt DESC);
        CREATE INDEX IF NOT EXISTS idx_items_type ON vault_items(type);

        CREATE TABLE IF NOT EXISTS vault_expenses (
          id TEXT PRIMARY KEY NOT NULL,
          kind TEXT NOT NULL,
          amount REAL NOT NULL,
          title TEXT NOT NULL,
          category TEXT,
          createdAt TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_expenses_created ON vault_expenses(createdAt DESC);

        CREATE TABLE IF NOT EXISTS vault_events (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          type TEXT NOT NULL,
          month INTEGER,
          day INTEGER,
          year INTEGER,
          repeatYearly INTEGER DEFAULT 1,
          notifyLeadDays INTEGER DEFAULT 1,
          note TEXT,
          createdAt TEXT,
          updatedAt TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_events_updated ON vault_events(updatedAt DESC);

        CREATE TABLE IF NOT EXISTS vault_meta (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT
        );
      `);
      return db;
    })();
  }
  return dbInitPromise;
}

function rowToItem(row) {
  let checklist = [];
  let attachments = [];
  try {
    checklist = row.checklist ? JSON.parse(row.checklist) : [];
  } catch (e) {}
  try {
    attachments = row.attachments ? JSON.parse(row.attachments) : [];
  } catch (e) {}

  return {
    id: row.id,
    type: row.type,
    title: row.title || '',
    content: row.content || '',
    username: row.username || '',
    secretPassword: row.secretPassword || '',
    websiteUrl: row.websiteUrl || '',
    checklist,
    attachments,
    audioUri: row.audioUri || null,
    audioDurationMs: Number(row.audioDurationMs || 0),
    isPinned: Boolean(row.isPinned),
    isLocked: Boolean(row.isLocked),
    createdAt: row.createdAt || '',
    updatedAt: row.updatedAt || ''
  };
}

function rowToExpense(row) {
  return {
    id: row.id,
    kind: row.kind === 'CASH_IN' ? 'CASH_IN' : 'EXPENSE',
    amount: Number(row.amount || 0),
    title: row.title || '',
    category: row.category || '',
    createdAt: row.createdAt || ''
  };
}

function rowToEvent(row) {
  return {
    id: row.id,
    title: row.title || '',
    type: row.type || 'IMPORTANT',
    month: row.month != null ? Number(row.month) : null,
    day: row.day != null ? Number(row.day) : null,
    year: row.year != null ? Number(row.year) : null,
    repeatYearly: Boolean(row.repeatYearly),
    notifyLeadDays: row.notifyLeadDays != null ? Number(row.notifyLeadDays) : 1,
    note: row.note || '',
    createdAt: row.createdAt || '',
    updatedAt: row.updatedAt || ''
  };
}

async function getPinFromSecureStore() {
  try {
    const val = await SecureStore.getItemAsync(SECURE_PIN_KEY);
    return val || null;
  } catch (e) {
    return null;
  }
}

export async function saveVaultPin(pinCode) {
  try {
    if (!pinCode) {
      await SecureStore.deleteItemAsync(SECURE_PIN_KEY);
    } else {
      await SecureStore.setItemAsync(SECURE_PIN_KEY, String(pinCode));
    }
    await AsyncStorage.removeItem(LEGACY_KEYS.VAULT_PIN).catch(() => {});
  } catch (e) {}
}

async function migrateLegacyAsyncStorageIfNeeded(db) {
  try {
    const migratedFlag = await db.getFirstAsync(
      'SELECT value FROM vault_meta WHERE key = ?',
      'migrated_from_async_v1'
    );
    if (migratedFlag?.value === '1') return;

    const [rawItems, rawPin, rawSettings] = await Promise.all([
      AsyncStorage.getItem(LEGACY_KEYS.VAULT_ITEMS),
      AsyncStorage.getItem(LEGACY_KEYS.VAULT_PIN),
      AsyncStorage.getItem(LEGACY_KEYS.VAULT_SETTINGS)
    ]);

    if (rawPin) {
      await saveVaultPin(rawPin);
    }
    if (rawSettings) {
      await db.runAsync(
        'INSERT OR REPLACE INTO vault_meta (key, value) VALUES (?, ?)',
        'settings',
        rawSettings
      );
    }
    if (rawItems) {
      const parsed = JSON.parse(rawItems);
      if (Array.isArray(parsed)) {
        const clean = parsed.filter(
          (i) => i && typeof i.id === 'string' && !i.id.startsWith('seed_') && i.type !== 'SNIPPET'
        );
        for (const item of clean) {
          await upsertVaultItem(item);
        }
      }
    }

    await db.runAsync(
      'INSERT OR REPLACE INTO vault_meta (key, value) VALUES (?, ?)',
      'migrated_from_async_v1',
      '1'
    );
  } catch (e) {}
}

export async function loadVaultState() {
  try {
    const db = await getDb();
    await migrateLegacyAsyncStorageIfNeeded(db);

    const [rows, expenseRows, eventRows, metaSettings, pinCode] = await Promise.all([
      db.getAllAsync('SELECT * FROM vault_items ORDER BY isPinned DESC, updatedAt DESC'),
      db.getAllAsync('SELECT * FROM vault_expenses ORDER BY createdAt DESC'),
      db.getAllAsync('SELECT * FROM vault_events ORDER BY updatedAt DESC'),
      db.getFirstAsync('SELECT value FROM vault_meta WHERE key = ?', 'settings'),
      getPinFromSecureStore()
    ]);

    const items = (rows || []).map(rowToItem);
    const expenses = (expenseRows || []).map(rowToExpense);
    const events = (eventRows || []).map(rowToEvent);

    let settings = { ...DEFAULT_SETTINGS };
    if (metaSettings?.value) {
      try {
        settings = { ...DEFAULT_SETTINGS, ...JSON.parse(metaSettings.value) };
      } catch (e) {}
    }

    return { items, expenses, events, pinCode, settings };
  } catch (e) {
    return {
      items: [],
      expenses: [],
      events: [],
      pinCode: null,
      settings: { ...DEFAULT_SETTINGS }
    };
  }
}

export async function upsertVaultItem(item) {
  try {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO vault_items (
        id, type, title, content, username, secretPassword, websiteUrl,
        checklist, tags, attachments, audioUri, audioDurationMs,
        isPinned, isLocked, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      item.id,
      item.type || 'NOTE',
      item.title || '',
      item.content || '',
      item.username || '',
      item.secretPassword || '',
      item.websiteUrl || '',
      JSON.stringify(item.checklist || []),
      '[]',
      JSON.stringify(item.attachments || []),
      item.audioUri || null,
      Number(item.audioDurationMs || 0),
      item.isPinned ? 1 : 0,
      item.isLocked ? 1 : 0,
      item.createdAt || new Date().toISOString(),
      item.updatedAt || new Date().toISOString()
    );
  } catch (e) {}
}

export async function deleteVaultItemById(id) {
  try {
    const db = await getDb();
    await db.runAsync('DELETE FROM vault_items WHERE id = ?', id);
  } catch (e) {}
}

export async function replaceAllVaultItems(items = []) {
  try {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM vault_items');
      for (const item of items) {
        await db.runAsync(
          `INSERT OR REPLACE INTO vault_items (
            id, type, title, content, username, secretPassword, websiteUrl,
            checklist, tags, attachments, audioUri, audioDurationMs,
            isPinned, isLocked, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          item.id,
          item.type || 'NOTE',
          item.title || '',
          item.content || '',
          item.username || '',
          item.secretPassword || '',
          item.websiteUrl || '',
          JSON.stringify(item.checklist || []),
          '[]',
          JSON.stringify(item.attachments || []),
          item.audioUri || null,
          Number(item.audioDurationMs || 0),
          item.isPinned ? 1 : 0,
          item.isLocked ? 1 : 0,
          item.createdAt || new Date().toISOString(),
          item.updatedAt || new Date().toISOString()
        );
      }
    });
  } catch (e) {}
}

// ============================================================================
// Expenses & Cash Ledger SQLite CRUD
// ============================================================================

export async function addExpenseEntry(entry) {
  try {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO vault_expenses (id, kind, amount, title, category, createdAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      entry.id,
      entry.kind === 'CASH_IN' ? 'CASH_IN' : 'EXPENSE',
      Number(entry.amount || 0),
      entry.title || '',
      entry.category || '',
      entry.createdAt || new Date().toISOString()
    );
  } catch (e) {}
}

export async function deleteExpenseEntryById(id) {
  try {
    const db = await getDb();
    await db.runAsync('DELETE FROM vault_expenses WHERE id = ?', id);
  } catch (e) {}
}

export async function replaceAllExpenses(expenses = []) {
  try {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM vault_expenses');
      for (const e of expenses) {
        await db.runAsync(
          `INSERT OR REPLACE INTO vault_expenses (id, kind, amount, title, category, createdAt)
           VALUES (?, ?, ?, ?, ?, ?)`,
          e.id,
          e.kind === 'CASH_IN' ? 'CASH_IN' : 'EXPENSE',
          Number(e.amount || 0),
          e.title || '',
          e.category || '',
          e.createdAt || new Date().toISOString()
        );
      }
    });
  } catch (e) {}
}

export async function clearAllExpenses() {
  try {
    const db = await getDb();
    await db.runAsync('DELETE FROM vault_expenses');
  } catch (e) {}
}

// ============================================================================
// Calendar & Milestone Events SQLite CRUD
// ============================================================================

export async function upsertVaultEvent(ev) {
  try {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO vault_events (
        id, title, type, month, day, year, repeatYearly, notifyLeadDays, note, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ev.id,
      ev.title || '',
      ev.type || 'IMPORTANT',
      ev.month != null ? Number(ev.month) : null,
      ev.day != null ? Number(ev.day) : null,
      ev.year != null ? Number(ev.year) : null,
      ev.repeatYearly ? 1 : 0,
      ev.notifyLeadDays != null ? Number(ev.notifyLeadDays) : 1,
      ev.note || '',
      ev.createdAt || new Date().toISOString(),
      ev.updatedAt || new Date().toISOString()
    );
  } catch (e) {}
}

export async function deleteVaultEventById(id) {
  try {
    const db = await getDb();
    await db.runAsync('DELETE FROM vault_events WHERE id = ?', id);
  } catch (e) {}
}

export async function replaceAllVaultEvents(events = []) {
  try {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM vault_events');
      for (const ev of events) {
        await db.runAsync(
          `INSERT OR REPLACE INTO vault_events (
            id, title, type, month, day, year, repeatYearly, notifyLeadDays, note, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ev.id,
          ev.title || '',
          ev.type || 'IMPORTANT',
          ev.month != null ? Number(ev.month) : null,
          ev.day != null ? Number(ev.day) : null,
          ev.year != null ? Number(ev.year) : null,
          ev.repeatYearly ? 1 : 0,
          ev.notifyLeadDays != null ? Number(ev.notifyLeadDays) : 1,
          ev.note || '',
          ev.createdAt || new Date().toISOString(),
          ev.updatedAt || new Date().toISOString()
        );
      }
    });
  } catch (e) {}
}

export async function clearAllVaultEvents() {
  try {
    const db = await getDb();
    await db.runAsync('DELETE FROM vault_events');
  } catch (e) {}
}

export async function saveVaultSettings(settings) {
  try {
    const db = await getDb();
    await db.runAsync(
      'INSERT OR REPLACE INTO vault_meta (key, value) VALUES (?, ?)',
      'settings',
      JSON.stringify(settings)
    );
  } catch (e) {}
}

// ============================================================================
// Private Sandbox Media Storage (Voice Memos & Photos/IDs)
// ============================================================================

function getMediaDir() {
  const dir = new Directory(Paths.document, 'vault_media');
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

export async function saveMediaFile(sourceUri, prefix = 'media', defaultExt = '.dat') {
  if (!sourceUri) return null;
  try {
    const mediaDir = getMediaDir();
    if (sourceUri.startsWith(mediaDir.uri)) {
      return sourceUri;
    }
    const cleanPath = sourceUri.split('?')[0];
    const match = cleanPath.match(/\.[a-zA-Z0-9]+$/);
    const ext = match ? match[0].toLowerCase() : defaultExt;
    const filename = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}${ext}`;

    const srcFile = new File(sourceUri);
    const destFile = new File(mediaDir, filename);
    srcFile.copySync(destFile);
    return destFile.uri;
  } catch (e) {
    return sourceUri;
  }
}

export function deleteMediaFile(uri) {
  if (!uri) return;
  try {
    const mediaDir = getMediaDir();
    if (!uri.startsWith(mediaDir.uri)) return;
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch (e) {}
}

export function clearAllMediaFiles() {
  try {
    const dir = new Directory(Paths.document, 'vault_media');
    if (dir.exists) {
      dir.delete();
    }
  } catch (e) {}
}

// ============================================================================
// File Export / Import (JSON Backup File via Share Sheet & Document Picker)
// ============================================================================

export async function exportVaultBackupFile(items = [], expenses = [], events = []) {
  const dateTag = new Date().toISOString().slice(0, 10);
  const fileName = `SecondBrainVault_${dateTag}.json`;
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

  const backupFile = new File(Paths.cache, fileName);
  if (backupFile.exists) {
    backupFile.delete();
  }
  backupFile.create({ intermediates: true, overwrite: true });
  await backupFile.write(payload);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('File sharing is not available on this device.');
  }
  await Sharing.shareAsync(backupFile.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Export SecondBrain Vault Backup',
    UTI: 'public.json'
  });
}

export async function pickAndReadBackupFile() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
    multiple: false
  });
  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }
  const asset = result.assets[0];
  const file = new File(asset.uri);
  const text = await file.text();
  return text;
}
