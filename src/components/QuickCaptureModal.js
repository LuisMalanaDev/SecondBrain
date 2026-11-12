// ============================================================================
// src/components/QuickCaptureModal.js — Modern Minimalist Capture Sheet
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
  { id: 'NOTE', label: 'Note' },
  { id: 'SNIPPET', label: 'Code' },
  { id: 'PASSWORD', label: 'Password' },
  { id: 'CHECKLIST', label: 'Tasks' },
  { id: 'LINK', label: 'Link' }
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
      setError('Title is required');
      return;
    }
    if (draft.type === 'PASSWORD' && !draft.secretPassword) {
      setError('Password is required');
      return;
    }
    if (draft.type === 'LINK' && !draft.websiteUrl.trim()) {
      setError('Valid URL is required');
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

  const strength = passwordStrength(draft.secretPassword);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{isEdit ? 'Edit Item' : 'New Item'}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={10}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Type Segmented Control */}
            <View style={styles.segmentContainer}>
              {TYPES.map((t) => {
                const active = draft.type === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    disabled={isEdit}
                    onPress={() => set({ type: t.id, isLocked: t.id === 'PASSWORD' ? true : draft.isLocked })}
                    style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Title */}
            <Text style={styles.label}>TITLE</Text>
            <TextInput
              style={styles.input}
              placeholder={
                draft.type === 'PASSWORD'
                  ? 'Service name (e.g. GitHub, Bank)'
                  : draft.type === 'SNIPPET'
                  ? 'Snippet title'
                  : draft.type === 'CHECKLIST'
                  ? 'Checklist title'
                  : draft.type === 'LINK'
                  ? 'Bookmark title'
                  : 'Note title'
              }
              placeholderTextColor={COLORS.textMuted}
              value={draft.title}
              onChangeText={(v) => {
                set({ title: v });
                setError('');
              }}
            />

            {/* SNIPPET */}
            {draft.type === 'SNIPPET' && (
              <>
                <Text style={styles.label}>LANGUAGE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.langScroll}>
                  {LANGUAGES.map((l) => {
                    const active = draft.language === l;
                    return (
                      <TouchableOpacity
                        key={l}
                        onPress={() => set({ language: l })}
                        style={[styles.langChip, active && styles.langChipActive]}
                      >
                        <Text style={[styles.langChipText, active && styles.langChipTextActive]}>
                          {l}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <Text style={styles.label}>CODE</Text>
                <TextInput
                  style={[styles.input, styles.codeInput]}
                  placeholder="// Paste or write code snippet..."
                  placeholderTextColor={COLORS.textMuted}
                  value={draft.content}
                  onChangeText={(v) => set({ content: v })}
                  multiline
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </>
            )}

            {/* PASSWORD */}
            {draft.type === 'PASSWORD' && (
              <>
                <Text style={styles.label}>USERNAME / EMAIL</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Username or email address"
                  placeholderTextColor={COLORS.textMuted}
                  value={draft.username}
                  onChangeText={(v) => set({ username: v })}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={styles.label}>PASSWORD</Text>
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    placeholder="Enter or generate password"
                    placeholderTextColor={COLORS.textMuted}
                    value={draft.secretPassword}
                    onChangeText={(v) => {
                      set({ secretPassword: v });
                      setError('');
                    }}
                    secureTextEntry={!showPw}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity style={styles.iconBtn} onPress={() => setShowPw((s) => !s)}>
                    <Text style={styles.iconBtnText}>{showPw ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.iconBtn, styles.iconBtnPrimary]}
                    onPress={() => {
                      set({ secretPassword: generatePassword(16) });
                      setShowPw(true);
                      setError('');
                    }}
                  >
                    <Text style={styles.iconBtnTextPrimary}>Generate</Text>
                  </TouchableOpacity>
                </View>

                {draft.secretPassword ? (
                  <View style={styles.strengthWrap}>
                    <View style={styles.strengthTrack}>
                      <View
                        style={[
                          styles.strengthBar,
                          { width: `${strength.pct}%`, backgroundColor: strength.color }
                        ]}
                      />
                    </View>
                    <Text style={[styles.strengthText, { color: strength.color }]}>
                      {strength.label}
                    </Text>
                  </View>
                ) : (
                  <View style={{ height: 10 }} />
                )}

                <Text style={styles.label}>WEBSITE (OPTIONAL)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. github.com"
                  placeholderTextColor={COLORS.textMuted}
                  value={draft.websiteUrl}
                  onChangeText={(v) => set({ websiteUrl: v })}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </>
            )}

            {/* LINK */}
            {draft.type === 'LINK' && (
              <>
                <Text style={styles.label}>URL</Text>
                <TextInput
                  style={styles.input}
                  placeholder="https://example.com"
                  placeholderTextColor={COLORS.textMuted}
                  value={draft.websiteUrl}
                  onChangeText={(v) => {
                    set({ websiteUrl: v });
                    setError('');
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </>
            )}

            {/* CHECKLIST */}
            {draft.type === 'CHECKLIST' && (
              <>
                <Text style={styles.label}>TASKS</Text>
                {draft.checklist.map((c) => (
                  <View key={c.id} style={styles.taskRow}>
                    <TouchableOpacity
                      onPress={() =>
                        set({
                          checklist: draft.checklist.map((x) =>
                            x.id === c.id ? { ...x, done: !x.done } : x
                          )
                        })
                      }
                      style={[styles.checkbox, c.done && styles.checkboxDone]}
                    >
                      {c.done && <Text style={styles.checkDoneText}>✓</Text>}
                    </TouchableOpacity>
                    <Text style={[styles.taskText, c.done && styles.taskDone]} numberOfLines={2}>
                      {c.text}
                    </Text>
                    <TouchableOpacity
                      onPress={() => set({ checklist: draft.checklist.filter((x) => x.id !== c.id) })}
                      hitSlop={8}
                    >
                      <Text style={styles.taskDeleteText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={[styles.row, { marginBottom: 14 }]}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    placeholder="Add task and press Add..."
                    placeholderTextColor={COLORS.textMuted}
                    value={newTask}
                    onChangeText={setNewTask}
                    onSubmitEditing={addTask}
                    blurOnSubmit={false}
                    returnKeyType="done"
                  />
                  <TouchableOpacity style={[styles.iconBtn, styles.iconBtnPrimary]} onPress={addTask}>
                    <Text style={styles.iconBtnTextPrimary}>Add</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Body (for NOTE, LINK, or PASSWORD note) */}
            {draft.type !== 'SNIPPET' && (
              <>
                <Text style={styles.label}>{draft.type === 'NOTE' ? 'NOTE' : 'NOTES (OPTIONAL)'}</Text>
                <TextInput
                  style={[styles.input, styles.multiInput]}
                  placeholder={draft.type === 'NOTE' ? 'Write your thoughts...' : 'Additional notes...'}
                  placeholderTextColor={COLORS.textMuted}
                  value={draft.content}
                  onChangeText={(v) => set({ content: v })}
                  multiline
                />
              </>
            )}

            {/* Tags */}
            <Text style={styles.label}>TAGS</Text>
            <View style={styles.tagWrap}>
              {allTags.map((t) => {
                const on = draft.tags.includes(t);
                return (
                  <TouchableOpacity
                    key={t}
                    onPress={() => toggleTag(t)}
                    style={[styles.tagChip, on && styles.tagChipActive]}
                  >
                    <Text style={[styles.tagChipText, on && styles.tagChipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={[styles.row, { marginBottom: 14 }]}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="#tag"
                placeholderTextColor={COLORS.textMuted}
                value={newTag}
                onChangeText={setNewTag}
                onSubmitEditing={addCustomTag}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.iconBtn} onPress={addCustomTag}>
                <Text style={styles.iconBtnText}>+ Tag</Text>
              </TouchableOpacity>
            </View>

            {/* Toggles */}
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggle, draft.isPinned && styles.toggleOn]}
                onPress={() => set({ isPinned: !draft.isPinned })}
              >
                <Text style={[styles.toggleText, draft.isPinned && styles.toggleTextOn]}>
                  {draft.isPinned ? '📌 Pinned to top' : 'Pin to top'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggle, draft.isLocked && styles.toggleOn]}
                onPress={() => set({ isLocked: !draft.isLocked })}
              >
                <Text style={[styles.toggleText, draft.isLocked && styles.toggleTextOn]}>
                  {draft.isLocked ? '🔒 PIN Protected' : 'Protect with PIN'}
                </Text>
              </TouchableOpacity>
            </View>
            {draft.isLocked && !hasPin && (
              <Text style={styles.warn}>Set a master PIN in Settings to lock this item.</Text>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {/* Save */}
            <TouchableOpacity style={styles.saveBtn} onPress={save} activeOpacity={0.85}>
              <Text style={styles.saveText}>{isEdit ? 'Save Changes' : 'Create Item'}</Text>
            </TouchableOpacity>
            <View style={{ height: 28 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
    maxHeight: '92%',
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 18,
    paddingTop: 16
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700'
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600'
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 7
  },
  segmentBtnActive: {
    backgroundColor: COLORS.surfaceSubtle
  },
  segmentText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600'
  },
  segmentTextActive: {
    color: COLORS.textPrimary,
    fontWeight: '700'
  },
  label: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6
  },
  input: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    color: COLORS.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 14
  },
  multiInput: {
    minHeight: 85,
    textAlignVertical: 'top'
  },
  codeInput: {
    minHeight: 120,
    textAlignVertical: 'top',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12.5,
    backgroundColor: COLORS.codeBg,
    color: '#D4D4D8'
  },
  langScroll: {
    marginBottom: 12
  },
  langChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceElevated,
    marginRight: 6
  },
  langChipActive: {
    borderColor: COLORS.textPrimary,
    backgroundColor: COLORS.surfaceSubtle
  },
  langChipText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600'
  },
  langChipTextActive: {
    color: COLORS.textPrimary,
    fontWeight: '700'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  iconBtn: {
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconBtnText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600'
  },
  iconBtnPrimary: {
    backgroundColor: COLORS.surfaceSubtle,
    borderColor: COLORS.borderHover
  },
  iconBtnTextPrimary: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '700'
  },
  strengthWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
    marginBottom: 14
  },
  strengthTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    overflow: 'hidden'
  },
  strengthBar: {
    height: 4,
    borderRadius: 2
  },
  strengthText: {
    fontSize: 11,
    fontWeight: '700',
    width: 48,
    textAlign: 'right'
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceElevated,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: COLORS.borderHover,
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkboxDone: {
    backgroundColor: COLORS.textPrimary,
    borderColor: COLORS.textPrimary
  },
  checkDoneText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '900'
  },
  taskText: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 13
  },
  taskDone: {
    color: COLORS.textMuted,
    textDecorationLine: 'line-through'
  },
  taskDeleteText: {
    color: COLORS.textMuted,
    fontSize: 12,
    paddingHorizontal: 4
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10
  },
  tagChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceElevated
  },
  tagChipActive: {
    borderColor: COLORS.textPrimary,
    backgroundColor: COLORS.surfaceSubtle
  },
  tagChipText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600'
  },
  tagChipTextActive: {
    color: COLORS.textPrimary,
    fontWeight: '700'
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8
  },
  toggle: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center'
  },
  toggleOn: {
    borderColor: COLORS.borderHover,
    backgroundColor: COLORS.surfaceSubtle
  },
  toggleText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600'
  },
  toggleTextOn: {
    color: COLORS.textPrimary,
    fontWeight: '700'
  },
  warn: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginBottom: 8
  },
  error: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8
  },
  saveBtn: {
    backgroundColor: COLORS.textPrimary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 6
  },
  saveText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700'
  }
});
