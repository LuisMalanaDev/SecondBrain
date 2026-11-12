// ============================================================================
// src/components/QuickCaptureModal.js — Create / edit any vault item type
// Types: NOTE | SNIPPET | PASSWORD | CHECKLIST | LINK
// ============================================================================

import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { COLORS } from '../theme/colors';
import {
  makeId,
  nowIso,
  generatePassword,
  passwordStrength,
  normalizeTag
} from '../utils/helpers';

const TYPES = [
  { id: 'NOTE', label: '💡 Note', color: COLORS.note },
  { id: 'SNIPPET', label: '💻 Snippet', color: COLORS.snippet },
  { id: 'PASSWORD', label: '🔐 Password', color: COLORS.password },
  { id: 'CHECKLIST', label: '✅ Checklist', color: COLORS.checklist },
  { id: 'LINK', label: '🔗 Link', color: COLORS.link }
];

const LANGUAGES = ['javascript', 'typescript', 'python', 'bash', 'sql', 'html', 'css', 'json', 'other'];

const blankDraft = (type = 'NOTE') => ({
  type,
  title: '',
  content: '',
  language: 'javascript',
  username: '',
  secretPassword: '',
  websiteUrl: '',
  checklist: [],
  tags: [],
  isPinned: false,
  isLocked: type === 'PASSWORD'
});

export default function QuickCaptureModal({
  visible,
  initialItem,
  initialType = 'NOTE',
  allTags = [],
  hasPin = false,
  onSave,
  onClose,
  onAddTag
}) {
  const [draft, setDraft] = useState(blankDraft(initialType));
  const [newTask, setNewTask] = useState('');
  const [newTag, setNewTag] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setDraft(initialItem ? { ...blankDraft(initialItem.type), ...initialItem } : blankDraft(initialType));
    setNewTask('');
    setNewTag('');
    setShowPw(false);
    setError('');
  }, [visible, initialItem, initialType]);

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const isEdit = Boolean(initialItem);

  function toggleTag(tag) {
    set({
      tags: draft.tags.includes(tag) ? draft.tags.filter((t) => t !== tag) : [...draft.tags, tag]
    });
  }

  function addCustomTag() {
    const t = normalizeTag(newTag);
    if (!t) return;
    if (!allTags.includes(t)) onAddTag && onAddTag(t);
    if (!draft.tags.includes(t)) set({ tags: [...draft.tags, t] });
    setNewTag('');
  }

  function addTask() {
    const text = newTask.trim();
    if (!text) return;
    set({ checklist: [...draft.checklist, { id: makeId('c'), text, done: false }] });
    setNewTask('');
  }

  function save() {
    const title = draft.title.trim();
    if (!title) {
      setError('Give it a title first.');
      return;
    }
    if (draft.type === 'PASSWORD' && !draft.secretPassword) {
      setError('Enter or generate a password.');
      return;
    }
    if (draft.type === 'LINK' && !draft.websiteUrl.trim()) {
      setError('Paste the link URL.');
      return;
    }
    let url = draft.websiteUrl.trim();
    if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;

    const ts = nowIso();
    onSave({
      ...draft,
      title,
      websiteUrl: url,
      id: draft.id || makeId('item'),
      createdAt: draft.createdAt || ts,
      updatedAt: ts
    });
  }

  const typeMeta = TYPES.find((t) => t.id === draft.type) || TYPES[0];
  const strength = passwordStrength(draft.secretPassword);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{isEdit ? 'Edit Item' : 'Quick Capture'}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Type selector (locked while editing) */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              {TYPES.map((t) => {
                const active = draft.type === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    disabled={isEdit}
                    onPress={() => set({ type: t.id, isLocked: t.id === 'PASSWORD' ? true : draft.isLocked })}
                    style={[
                      styles.typeChip,
                      active && { borderColor: t.color, backgroundColor: `${t.color}22` },
                      isEdit && !active && { opacity: 0.35 }
                    ]}
                  >
                    <Text style={[styles.typeChipText, active && { color: t.color }]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              placeholder={
                draft.type === 'PASSWORD'
                  ? 'e.g. GitHub, GCash, Gmail'
                  : draft.type === 'SNIPPET'
                  ? 'e.g. Fetch with timeout'
                  : draft.type === 'CHECKLIST'
                  ? 'e.g. CraveNav v1.2 tasks'
                  : draft.type === 'LINK'
                  ? 'e.g. Expo EAS docs'
                  : 'e.g. App idea: SafeCircle'
              }
              placeholderTextColor={COLORS.textMuted}
              value={draft.title}
              onChangeText={(v) => set({ title: v })}
            />

            {/* ---------- SNIPPET ---------- */}
            {draft.type === 'SNIPPET' && (
              <>
                <Text style={styles.label}>Language</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                  {LANGUAGES.map((l) => (
                    <TouchableOpacity
                      key={l}
                      onPress={() => set({ language: l })}
                      style={[styles.miniChip, draft.language === l && styles.miniChipActive]}
                    >
                      <Text style={[styles.miniChipText, draft.language === l && styles.miniChipTextActive]}>
                        {l}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <Text style={styles.label}>Code</Text>
                <TextInput
                  style={[styles.input, styles.codeInput]}
                  placeholder="Paste your code here..."
                  placeholderTextColor={COLORS.textMuted}
                  value={draft.content}
                  onChangeText={(v) => set({ content: v })}
                  multiline
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </>
            )}

            {/* ---------- PASSWORD ---------- */}
            {draft.type === 'PASSWORD' && (
              <>
                <Text style={styles.label}>Username / Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@email.com"
                  placeholderTextColor={COLORS.textMuted}
                  value={draft.username}
                  onChangeText={(v) => set({ username: v })}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={styles.label}>Password</Text>
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    placeholder="Enter or generate"
                    placeholderTextColor={COLORS.textMuted}
                    value={draft.secretPassword}
                    onChangeText={(v) => set({ secretPassword: v })}
                    secureTextEntry={!showPw}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity style={styles.iconBtn} onPress={() => setShowPw((s) => !s)}>
                    <Text style={{ fontSize: 16 }}>{showPw ? '🙈' : '👁️'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.iconBtn, { borderColor: COLORS.password }]}
                    onPress={() => {
                      set({ secretPassword: generatePassword(16) });
                      setShowPw(true);
                    }}
                  >
                    <Text style={{ fontSize: 16 }}>🎲</Text>
                  </TouchableOpacity>
                </View>
                {draft.secretPassword ? (
                  <View style={styles.strengthWrap}>
                    <View style={styles.strengthTrack}>
                      <View
                        style={[styles.strengthBar, { width: `${strength.pct}%`, backgroundColor: strength.color }]}
                      />
                    </View>
                    <Text style={[styles.strengthText, { color: strength.color }]}>{strength.label}</Text>
                  </View>
                ) : (
                  <View style={{ height: 12 }} />
                )}
                <Text style={styles.label}>Website (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="github.com"
                  placeholderTextColor={COLORS.textMuted}
                  value={draft.websiteUrl}
                  onChangeText={(v) => set({ websiteUrl: v })}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </>
            )}

            {/* ---------- LINK ---------- */}
            {draft.type === 'LINK' && (
              <>
                <Text style={styles.label}>URL</Text>
                <TextInput
                  style={styles.input}
                  placeholder="https://..."
                  placeholderTextColor={COLORS.textMuted}
                  value={draft.websiteUrl}
                  onChangeText={(v) => set({ websiteUrl: v })}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </>
            )}

            {/* ---------- CHECKLIST ---------- */}
            {draft.type === 'CHECKLIST' && (
              <>
                <Text style={styles.label}>Tasks</Text>
                {draft.checklist.map((c) => (
                  <View key={c.id} style={styles.taskRow}>
                    <TouchableOpacity
                      onPress={() =>
                        set({
                          checklist: draft.checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x))
                        })
                      }
                    >
                      <Text style={{ fontSize: 16 }}>{c.done ? '✅' : '⬜'}</Text>
                    </TouchableOpacity>
                    <Text style={[styles.taskText, c.done && styles.taskDone]} numberOfLines={2}>
                      {c.text}
                    </Text>
                    <TouchableOpacity
                      onPress={() => set({ checklist: draft.checklist.filter((x) => x.id !== c.id) })}
                    >
                      <Text style={{ color: COLORS.textMuted, fontSize: 14 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={[styles.row, { marginBottom: 12 }]}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    placeholder="Add a task and press +"
                    placeholderTextColor={COLORS.textMuted}
                    value={newTask}
                    onChangeText={setNewTask}
                    onSubmitEditing={addTask}
                    blurOnSubmit={false}
                    returnKeyType="done"
                  />
                  <TouchableOpacity style={[styles.iconBtn, { borderColor: COLORS.checklist }]} onPress={addTask}>
                    <Text style={{ color: COLORS.checklist, fontSize: 18, fontWeight: '800' }}>+</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* ---------- Notes body (all types except SNIPPET) ---------- */}
            {draft.type !== 'SNIPPET' && (
              <>
                <Text style={styles.label}>
                  {draft.type === 'NOTE' ? 'Note' : 'Notes (optional)'}
                  {'  '}
                  <Text style={styles.hint}>🎙️ tip: tap your keyboard mic to dictate</Text>
                </Text>
                <TextInput
                  style={[styles.input, styles.multiInput]}
                  placeholder={draft.type === 'NOTE' ? 'Write or dictate your idea...' : 'Extra details...'}
                  placeholderTextColor={COLORS.textMuted}
                  value={draft.content}
                  onChangeText={(v) => set({ content: v })}
                  multiline
                />
              </>
            )}

            {/* ---------- Tags ---------- */}
            <Text style={styles.label}>Tags</Text>
            <View style={styles.tagWrap}>
              {allTags.map((t) => {
                const on = draft.tags.includes(t);
                return (
                  <TouchableOpacity
                    key={t}
                    onPress={() => toggleTag(t)}
                    style={[styles.tagChip, on && { borderColor: typeMeta.color, backgroundColor: `${typeMeta.color}22` }]}
                  >
                    <Text style={[styles.tagChipText, on && { color: typeMeta.color }]}>{t}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={[styles.row, { marginBottom: 14 }]}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="#new-tag"
                placeholderTextColor={COLORS.textMuted}
                value={newTag}
                onChangeText={setNewTag}
                onSubmitEditing={addCustomTag}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.iconBtn} onPress={addCustomTag}>
                <Text style={{ color: COLORS.textPrimary, fontSize: 18, fontWeight: '800' }}>+</Text>
              </TouchableOpacity>
            </View>

            {/* ---------- Toggles ---------- */}
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggle, draft.isPinned && styles.toggleOn]}
                onPress={() => set({ isPinned: !draft.isPinned })}
              >
                <Text style={[styles.toggleText, draft.isPinned && styles.toggleTextOn]}>
                  📌 {draft.isPinned ? 'Pinned' : 'Pin to top'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggle, draft.isLocked && styles.toggleOn]}
                onPress={() => set({ isLocked: !draft.isLocked })}
              >
                <Text style={[styles.toggleText, draft.isLocked && styles.toggleTextOn]}>
                  🔒 {draft.isLocked ? 'PIN Locked' : 'Lock with PIN'}
                </Text>
              </TouchableOpacity>
            </View>
            {draft.isLocked && !hasPin && (
              <Text style={styles.warn}>No PIN set yet — set one in ⚙️ Settings to protect this item.</Text>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity style={styles.saveBtn} onPress={save} activeOpacity={0.85}>
              <Text style={styles.saveText}>{isEdit ? 'Save Changes' : 'Save to Vault'}</Text>
            </TouchableOpacity>
            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '92%',
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 18,
    paddingTop: 16
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 19, fontWeight: '800' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '800' },
  typeChip: {
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8
  },
  typeChipText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '700' },
  label: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6, letterSpacing: 0.3 },
  hint: { color: COLORS.textMuted, fontSize: 11, fontWeight: '500' },
  input: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    color: COLORS.textPrimary,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14,
    marginBottom: 12
  },
  multiInput: { minHeight: 90, textAlignVertical: 'top' },
  codeInput: {
    minHeight: 140,
    textAlignVertical: 'top',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12.5,
    backgroundColor: '#09090D',
    color: '#E9D5FF'
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center'
  },
  strengthWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, marginBottom: 12 },
  strengthTrack: { flex: 1, height: 5, borderRadius: 3, backgroundColor: COLORS.border, overflow: 'hidden' },
  strengthBar: { height: 5, borderRadius: 3 },
  strengthText: { fontSize: 12, fontWeight: '800', width: 52, textAlign: 'right' },
  miniChip: {
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 6
  },
  miniChipActive: { borderColor: COLORS.snippet, backgroundColor: `${COLORS.snippet}22` },
  miniChipText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700' },
  miniChipTextActive: { color: COLORS.snippet },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceElevated,
    marginBottom: 6
  },
  taskText: { flex: 1, color: COLORS.textPrimary, fontSize: 14 },
  taskDone: { color: COLORS.textMuted, textDecorationLine: 'line-through' },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 10 },
  tagChip: {
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  tagChipText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700' },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  toggle: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center'
  },
  toggleOn: { borderColor: COLORS.textPrimary, backgroundColor: COLORS.surfaceElevated },
  toggleText: { color: COLORS.textMuted, fontSize: 13, fontWeight: '700' },
  toggleTextOn: { color: COLORS.textPrimary },
  warn: { color: COLORS.link, fontSize: 12, marginBottom: 8 },
  error: { color: COLORS.password, fontSize: 13, fontWeight: '700', marginTop: 4, marginBottom: 4 },
  saveBtn: {
    backgroundColor: COLORS.accentPrimary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8
  },
  saveText: { color: '#000', fontSize: 15, fontWeight: '800' }
});
