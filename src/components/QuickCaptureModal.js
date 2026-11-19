// ============================================================================
// src/components/QuickCaptureModal.js — Modern Minimalist Capture Sheet
// Types: NOTE | VOICE | PASSWORD | CHECKLIST | LINK
// ============================================================================

import React, { useEffect, useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync
} from 'expo-audio';
import { useTheme } from '../theme/colors';
import {
  makeId,
  nowIso,
  generatePassword,
  passwordStrength,
  formatDuration,
  extractDomain,
  isLikelyUrl,
  hapticTap,
  hapticNotify
} from '../utils/helpers';
import { saveMediaFile } from '../storage/vaultStorage';
import VoicePlayer from './VoicePlayer';

const TYPES = [
  { id: 'NOTE', label: 'Note' },
  { id: 'VOICE', label: 'Voice' },
  { id: 'PASSWORD', label: 'Password' },
  { id: 'CHECKLIST', label: 'Tasks' },
  { id: 'LINK', label: 'Link' }
];

const blankDraft = (type = 'NOTE') => ({
  type,
  title: '',
  content: '',
  username: '',
  secretPassword: '',
  websiteUrl: '',
  checklist: [],
  attachments: [],
  audioUri: null,
  audioDurationMs: 0,
  isPinned: false,
  isLocked: type === 'PASSWORD'
});

export default function QuickCaptureModal({
  visible,
  initialItem,
  initialType = 'NOTE',
  hasPin = false,
  onSave,
  onClose
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [draft, setDraft] = useState(blankDraft(initialType));
  const [newTask, setNewTask] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [detectedUrl, setDetectedUrl] = useState(null);
  const [error, setError] = useState('');

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);

  useEffect(() => {
    if (!visible) return;
    setDraft(
      initialItem
        ? { ...blankDraft(initialItem.type), ...initialItem }
        : blankDraft(initialType)
    );
    setNewTask('');
    setShowPw(false);
    setError('');
    setDetectedUrl(null);

    if (!initialItem) {
      Clipboard.getStringAsync()
        .then((clip) => {
          if (clip && isLikelyUrl(clip)) {
            setDetectedUrl(clip.trim());
          }
        })
        .catch(() => {});
    }
  }, [visible, initialItem, initialType]);

  useEffect(() => {
    if (!visible && recorderState?.isRecording) {
      recorder.stop().catch(() => {});
    }
  }, [visible, recorderState?.isRecording, recorder]);

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const isEdit = Boolean(initialItem);

  function addTask() {
    const text = newTask.trim();
    if (!text) return;
    hapticTap('light');
    set({ checklist: [...draft.checklist, { id: makeId('c'), text, done: false }] });
    setNewTask('');
  }

  async function startVoiceRecording() {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Microphone Permission',
          'Allow microphone access in your device settings to record offline voice memos.'
        );
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      hapticTap('medium');
      setError('');
    } catch (e) {
      Alert.alert('Recording Error', 'Could not start audio recording on this device.');
    }
  }

  async function stopVoiceRecording() {
    try {
      const durationMs = recorderState?.durationMillis || 0;
      await recorder.stop();
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true
      });
      if (recorder.uri) {
        const storedUri = await saveMediaFile(recorder.uri, 'voice', '.m4a');
        set({ audioUri: storedUri, audioDurationMs: durationMs });
        hapticNotify('success');
      }
    } catch (e) {
      Alert.alert('Error', 'Could not save the voice recording.');
    }
  }

  async function pickPhoto(useCamera = false) {
    try {
      if (useCamera) {
        const camPerm = await ImagePicker.requestCameraPermissionsAsync();
        if (!camPerm.granted) {
          Alert.alert('Camera Permission', 'Allow camera access to capture private photos.');
          return;
        }
      } else {
        const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!libPerm.granted) {
          Alert.alert('Gallery Permission', 'Allow photo access to import private images.');
          return;
        }
      }

      const res = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.85
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: true,
            quality: 0.85
          });

      if (res.canceled || !res.assets || res.assets.length === 0) return;

      const savedUris = [];
      for (const asset of res.assets) {
        const savedUri = await saveMediaFile(asset.uri, 'img', '.jpg');
        if (savedUri) savedUris.push(savedUri);
      }

      if (savedUris.length > 0) {
        hapticNotify('success');
        set({ attachments: [...(draft.attachments || []), ...savedUris] });
      }
    } catch (e) {
      Alert.alert('Attachment Error', 'Could not attach the selected image.');
    }
  }

  function removeAttachment(idx) {
    hapticTap('light');
    set({
      attachments: (draft.attachments || []).filter((_, i) => i !== idx)
    });
  }

  function applyDetectedLink() {
    if (!detectedUrl) return;
    hapticTap('light');
    const domain = extractDomain(detectedUrl);
    set({
      type: 'LINK',
      websiteUrl: detectedUrl,
      title: draft.title.trim() ? draft.title : `Saved from ${domain}`
    });
    setDetectedUrl(null);
  }

  async function save() {
    if (recorderState?.isRecording) {
      await stopVoiceRecording();
    }

    let title = draft.title.trim();
    if (!title && draft.type === 'VOICE' && draft.audioUri) {
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      title = `Voice Memo • ${time}`;
    }

    if (!title) {
      hapticNotify('error');
      setError('Title is required');
      return;
    }
    if (draft.type === 'VOICE' && !draft.audioUri) {
      hapticNotify('error');
      setError('Record a voice memo first');
      return;
    }
    if (draft.type === 'PASSWORD' && !draft.secretPassword) {
      hapticNotify('error');
      setError('Password is required');
      return;
    }
    if (draft.type === 'LINK' && !draft.websiteUrl.trim()) {
      hapticNotify('error');
      setError('Valid URL is required');
      return;
    }

    let url = draft.websiteUrl.trim();
    if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;

    const ts = nowIso();
    hapticNotify('success');
    onSave({
      ...draft,
      title,
      websiteUrl: url,
      id: draft.id || makeId('item'),
      createdAt: draft.createdAt || ts,
      updatedAt: ts
    });
  }

  const strength = passwordStrength(draft.secretPassword, colors);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.sheet, { paddingBottom: Math.max(18, insets.bottom + 8) }]}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{isEdit ? 'Edit Item' : 'New Item'}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={10}>
              <Feather name="x" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {!isEdit && detectedUrl && (
              <TouchableOpacity
                style={styles.clipboardBanner}
                onPress={applyDetectedLink}
                activeOpacity={0.75}
              >
                <Feather name="link-2" size={14} color={colors.textPrimary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.clipboardTitle}>
                    Link in clipboard ({extractDomain(detectedUrl)})
                  </Text>
                  <Text style={styles.clipboardSub} numberOfLines={1}>
                    Tap to save as Link bookmark
                  </Text>
                </View>
                <Text style={styles.clipboardAction}>Fill</Text>
              </TouchableOpacity>
            )}

            <View style={styles.segmentContainer}>
              {TYPES.map((t) => {
                const active = draft.type === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    disabled={isEdit}
                    onPress={() => {
                      hapticTap('light');
                      set({
                        type: t.id,
                        isLocked: t.id === 'PASSWORD' ? true : draft.isLocked
                      });
                      setError('');
                    }}
                    style={[
                      styles.segmentBtn,
                      active && styles.segmentBtnActive,
                      isEdit && !active && { opacity: 0.4 }
                    ]}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>
              {draft.type === 'VOICE' ? 'TITLE (OPTIONAL)' : 'TITLE'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={
                draft.type === 'PASSWORD'
                  ? 'Service name (e.g. GitHub, GCash, Gmail)'
                  : draft.type === 'VOICE'
                  ? 'Auto-named if left blank'
                  : draft.type === 'CHECKLIST'
                  ? 'Checklist title'
                  : draft.type === 'LINK'
                  ? 'Video, article, or product title'
                  : 'Note title'
              }
              placeholderTextColor={colors.textMuted}
              value={draft.title}
              onChangeText={(v) => {
                set({ title: v });
                setError('');
              }}
            />

            {(draft.type === 'VOICE' || draft.type === 'NOTE') && (
              <View style={styles.sectionBlock}>
                <Text style={styles.label}>
                  {draft.type === 'VOICE' ? 'VOICE RECORDING' : 'VOICE MEMO (OPTIONAL)'}
                </Text>

                {recorderState?.isRecording ? (
                  <View style={styles.recordingBar}>
                    <View style={styles.recDot} />
                    <Text style={styles.recStatusText}>
                      Recording • {formatDuration(recorderState.durationMillis || 0)}
                    </Text>
                    <TouchableOpacity style={styles.stopBtn} onPress={stopVoiceRecording}>
                      <Feather name="square" size={12} color="#FFFFFF" />
                      <Text style={styles.stopBtnText}>Stop</Text>
                    </TouchableOpacity>
                  </View>
                ) : draft.audioUri ? (
                  <View>
                    <VoicePlayer uri={draft.audioUri} durationMs={draft.audioDurationMs} />
                    <View style={styles.audioActions}>
                      <TouchableOpacity
                        style={styles.smallOutlineBtn}
                        onPress={startVoiceRecording}
                      >
                        <Feather name="mic" size={12} color={colors.textSecondary} />
                        <Text style={styles.smallOutlineText}>Re-record</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.smallOutlineBtn}
                        onPress={() => set({ audioUri: null, audioDurationMs: 0 })}
                      >
                        <Feather name="trash-2" size={12} color={colors.danger} />
                        <Text style={[styles.smallOutlineText, { color: colors.danger }]}>
                          Remove Audio
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.recordTriggerBtn}
                    onPress={startVoiceRecording}
                    activeOpacity={0.75}
                  >
                    <Feather name="mic" size={15} color={colors.textPrimary} />
                    <Text style={styles.recordTriggerText}>Tap to Record Voice Memo</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {draft.type === 'PASSWORD' && (
              <>
                <Text style={styles.label}>USERNAME / EMAIL</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Username or email address"
                  placeholderTextColor={colors.textMuted}
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
                    placeholderTextColor={colors.textMuted}
                    value={draft.secretPassword}
                    onChangeText={(v) => {
                      set({ secretPassword: v });
                      setError('');
                    }}
                    secureTextEntry={!showPw}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => {
                      hapticTap('light');
                      setShowPw((s) => !s);
                    }}
                  >
                    <Feather
                      name={showPw ? 'eye-off' : 'eye'}
                      size={15}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.iconBtn, styles.iconBtnPrimary]}
                    onPress={() => {
                      hapticTap('medium');
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
                  <View style={{ height: 12 }} />
                )}

                <Text style={styles.label}>WEBSITE (OPTIONAL)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. github.com"
                  placeholderTextColor={colors.textMuted}
                  value={draft.websiteUrl}
                  onChangeText={(v) => set({ websiteUrl: v })}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </>
            )}

            {draft.type === 'LINK' && (
              <>
                <Text style={styles.label}>URL (FACEBOOK / YOUTUBE / TIKTOK / WEB)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="https://..."
                  placeholderTextColor={colors.textMuted}
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

            {draft.type === 'CHECKLIST' && (
              <>
                <Text style={styles.label}>TASKS</Text>
                {draft.checklist.map((c) => (
                  <View key={c.id} style={styles.taskRow}>
                    <TouchableOpacity
                      onPress={() => {
                        hapticTap('light');
                        set({
                          checklist: draft.checklist.map((x) =>
                            x.id === c.id ? { ...x, done: !x.done } : x
                          )
                        });
                      }}
                      style={[styles.checkbox, c.done && styles.checkboxDone]}
                    >
                      {c.done && <Feather name="check" size={11} color={colors.solidBtnText} />}
                    </TouchableOpacity>
                    <Text style={[styles.taskText, c.done && styles.taskDone]} numberOfLines={2}>
                      {c.text}
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        set({ checklist: draft.checklist.filter((x) => x.id !== c.id) })
                      }
                      hitSlop={8}
                    >
                      <Feather name="x" size={14} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={[styles.row, { marginBottom: 14 }]}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    placeholder="Add task and tap Add..."
                    placeholderTextColor={colors.textMuted}
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

            <Text style={styles.label}>
              {draft.type === 'NOTE' ? 'NOTE' : 'NOTES (OPTIONAL)'}
            </Text>
            <TextInput
              style={[styles.input, styles.multiInput]}
              placeholder={
                draft.type === 'NOTE'
                  ? 'Write your thoughts...'
                  : 'Extra details, recovery codes, or reminder...'
              }
              placeholderTextColor={colors.textMuted}
              value={draft.content}
              onChangeText={(v) => set({ content: v })}
              multiline
            />

            {(draft.type === 'NOTE' || draft.type === 'VOICE' || draft.type === 'PASSWORD') && (
              <View style={styles.sectionBlock}>
                <Text style={styles.label}>PRIVATE PHOTOS / IDs (OPTIONAL)</Text>
                {(draft.attachments || []).length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginBottom: 10 }}
                  >
                    {draft.attachments.map((uri, idx) => (
                      <View key={`${uri}_${idx}`} style={styles.attachWrap}>
                        <Image source={{ uri }} style={styles.attachThumb} />
                        <TouchableOpacity
                          style={styles.attachRemove}
                          onPress={() => removeAttachment(idx)}
                        >
                          <Feather name="x" size={11} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                )}

                <View style={styles.row}>
                  <TouchableOpacity
                    style={[styles.attachBtn, { flex: 1 }]}
                    onPress={() => pickPhoto(true)}
                  >
                    <Feather name="camera" size={14} color={colors.textSecondary} />
                    <Text style={styles.attachBtnText}>Camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.attachBtn, { flex: 1 }]}
                    onPress={() => pickPhoto(false)}
                  >
                    <Feather name="image" size={14} color={colors.textSecondary} />
                    <Text style={styles.attachBtnText}>Gallery</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggle, draft.isPinned && styles.toggleOn]}
                onPress={() => {
                  hapticTap('light');
                  set({ isPinned: !draft.isPinned });
                }}
              >
                <Feather
                  name="bookmark"
                  size={13}
                  color={draft.isPinned ? colors.textPrimary : colors.textMuted}
                />
                <Text style={[styles.toggleText, draft.isPinned && styles.toggleTextOn]}>
                  {draft.isPinned ? 'Pinned' : 'Pin to top'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toggle, draft.isLocked && styles.toggleOn]}
                onPress={() => {
                  hapticTap('light');
                  set({ isLocked: !draft.isLocked });
                }}
              >
                <Feather
                  name="lock"
                  size={13}
                  color={draft.isLocked ? colors.textPrimary : colors.textMuted}
                />
                <Text style={[styles.toggleText, draft.isLocked && styles.toggleTextOn]}>
                  {draft.isLocked ? 'PIN Protected' : 'Lock with PIN'}
                </Text>
              </TouchableOpacity>
            </View>

            {draft.isLocked && !hasPin && (
              <Text style={styles.warn}>Set a Master PIN in Settings to enforce locking.</Text>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity style={styles.saveBtn} onPress={save} activeOpacity={0.85}>
              <Text style={styles.saveText}>{isEdit ? 'Save Changes' : 'Save to Vault'}</Text>
            </TouchableOpacity>
            <View style={{ height: 28 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
      maxHeight: '92%',
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 18,
      paddingTop: 16
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14
    },
    headerTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: '700'
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center'
    },
    clipboardBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.borderHover,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 14
    },
    clipboardTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary
    },
    clipboardSub: {
      fontSize: 11,
      color: colors.textMuted
    },
    clipboardAction: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.solidBtnText,
      backgroundColor: colors.solidBtnBg,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6
    },
    segmentContainer: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 10,
      padding: 3,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border
    },
    segmentBtn: {
      flex: 1,
      paddingVertical: 7,
      alignItems: 'center',
      borderRadius: 7
    },
    segmentBtnActive: {
      backgroundColor: colors.surface
    },
    segmentText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600'
    },
    segmentTextActive: {
      color: colors.textPrimary,
      fontWeight: '700'
    },
    label: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.8,
      marginBottom: 6
    },
    input: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      color: colors.textPrimary,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      marginBottom: 14
    },
    multiInput: {
      minHeight: 82,
      textAlignVertical: 'top'
    },
    sectionBlock: {
      marginBottom: 14
    },
    recordTriggerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.borderHover,
      borderRadius: 10,
      paddingVertical: 13
    },
    recordTriggerText: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '600'
    },
    recordingBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.danger,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 10
    },
    recDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.danger
    },
    recStatusText: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '600'
    },
    stopBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.danger,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 7
    },
    stopBtnText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700'
    },
    audioActions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 4
    },
    smallOutlineBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated,
      borderRadius: 7,
      paddingHorizontal: 10,
      paddingVertical: 6
    },
    smallOutlineText: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '600'
    },
    attachWrap: {
      position: 'relative',
      marginRight: 10
    },
    attachThumb: {
      width: 68,
      height: 68,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border
    },
    attachRemove: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: 'rgba(0,0,0,0.75)',
      alignItems: 'center',
      justifyContent: 'center'
    },
    attachBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingVertical: 10
    },
    attachBtnText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '600'
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
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center'
    },
    iconBtnText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '600'
    },
    iconBtnPrimary: {
      backgroundColor: colors.surfaceSubtle,
      borderColor: colors.borderHover
    },
    iconBtnTextPrimary: {
      color: colors.textPrimary,
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
      backgroundColor: colors.border,
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
      backgroundColor: colors.surfaceElevated,
      marginBottom: 6,
      borderWidth: 1,
      borderColor: colors.border
    },
    checkbox: {
      width: 18,
      height: 18,
      borderRadius: 4,
      borderWidth: 1.5,
      borderColor: colors.borderHover,
      alignItems: 'center',
      justifyContent: 'center'
    },
    checkboxDone: {
      backgroundColor: colors.solidBtnBg,
      borderColor: colors.solidBtnBg
    },
    taskText: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 13
    },
    taskDone: {
      color: colors.textMuted,
      textDecorationLine: 'line-through'
    },
    toggleRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 8
    },
    toggle: {
      flex: 1,
      flexDirection: 'row',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center'
    },
    toggleOn: {
      borderColor: colors.borderHover,
      backgroundColor: colors.surfaceSubtle
    },
    toggleText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600'
    },
    toggleTextOn: {
      color: colors.textPrimary,
      fontWeight: '700'
    },
    warn: {
      color: colors.textMuted,
      fontSize: 11,
      marginBottom: 8
    },
    error: {
      color: colors.danger,
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 8
    },
    saveBtn: {
      backgroundColor: colors.solidBtnBg,
      borderRadius: 12,
      paddingVertical: 13,
      alignItems: 'center',
      marginTop: 6
    },
    saveText: {
      color: colors.solidBtnText,
      fontSize: 14,
      fontWeight: '700'
    }
  });
