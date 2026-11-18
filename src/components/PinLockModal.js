// ============================================================================
// src/components/PinLockModal.js — 4-digit PIN pad (set / confirm / verify)
// mode: 'verify' | 'set'
// ============================================================================

import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { COLORS } from '../theme/colors';
import { hapticTap, hapticNotify } from '../utils/helpers';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'del'];

export default function PinLockModal({
  visible,
  mode = 'verify',
  correctPin,
  biometricEnabled = false,
  title,
  subtitle,
  fullScreen = false,
  onSuccess,
  onCancel
}) {
  const [entry, setEntry] = useState('');
  const [firstPin, setFirstPin] = useState(null);
  const [error, setError] = useState('');
  const [bioAvailable, setBioAvailable] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setEntry('');
    setFirstPin(null);
    setError('');
    if (mode === 'verify' && biometricEnabled) {
      (async () => {
        try {
          const hasHw = await LocalAuthentication.hasHardwareAsync();
          const enrolled = await LocalAuthentication.isEnrolledAsync();
          setBioAvailable(hasHw && enrolled);
          if (hasHw && enrolled) tryBiometric();
        } catch (e) {
          setBioAvailable(false);
        }
      })();
    } else {
      setBioAvailable(false);
    }
  }, [visible, mode, biometricEnabled]);

  async function tryBiometric() {
    try {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock SecondBrain Vault',
        cancelLabel: 'Use PIN',
        disableDeviceFallback: true
      });
      if (res.success) {
        hapticNotify('success');
        onSuccess && onSuccess();
      }
    } catch (e) {}
  }

  function handleComplete(pin) {
    if (mode === 'verify') {
      if (pin === String(correctPin)) {
        hapticNotify('success');
        onSuccess && onSuccess();
      } else {
        hapticNotify('error');
        setError('Wrong PIN. Try again.');
        setEntry('');
      }
      return;
    }
    // mode === 'set'
    if (!firstPin) {
      hapticTap('medium');
      setFirstPin(pin);
      setEntry('');
      setError('');
      return;
    }
    if (pin === firstPin) {
      hapticNotify('success');
      onSuccess && onSuccess(pin);
    } else {
      hapticNotify('error');
      setError("PINs didn't match. Start again.");
      setFirstPin(null);
      setEntry('');
    }
  }

  function pressKey(k) {
    hapticTap('light');
    if (k === 'bio') {
      if (bioAvailable) tryBiometric();
      return;
    }
    if (k === 'del') {
      setEntry((e) => e.slice(0, -1));
      return;
    }
    if (entry.length >= 4) return;
    const next = entry + k;
    setEntry(next);
    setError('');
    if (next.length === 4) setTimeout(() => handleComplete(next), 100);
  }

  const heading =
    title ||
    (mode === 'set' ? (firstPin ? 'Confirm your PIN' : 'Create a 4-digit PIN') : 'Enter PIN');
  const sub =
    subtitle ||
    (mode === 'set'
      ? firstPin
        ? 'Type the same 4 digits again'
        : 'Protects your passwords and locked notes'
      : 'Your vault is locked');

  return (
    <Modal visible={visible} transparent={!fullScreen} animationType="fade" onRequestClose={onCancel}>
      <View style={[styles.backdrop, fullScreen && styles.backdropFull]}>
        <View style={styles.card}>
          <View style={styles.lockIconBox}>
            <Feather name="lock" size={20} color={COLORS.textPrimary} />
          </View>
          <Text style={styles.title}>{heading}</Text>
          <Text style={styles.sub}>{sub}</Text>

          <View style={styles.dotsRow}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.dot, i < entry.length && styles.dotFilled]} />
            ))}
          </View>
          <Text style={styles.error}>{error}</Text>

          <View style={styles.pad}>
            {KEYS.map((k) => {
              const isBio = k === 'bio';
              const isDel = k === 'del';
              const hidden = isBio && !bioAvailable;
              return (
                <TouchableOpacity
                  key={k}
                  style={[styles.key, (isBio || isDel) && styles.keyGhost, hidden && { opacity: 0 }]}
                  disabled={hidden}
                  activeOpacity={0.6}
                  onPress={() => pressKey(k)}
                >
                  {isBio ? (
                    <Ionicons name="finger-print-outline" size={26} color={COLORS.textPrimary} />
                  ) : isDel ? (
                    <Feather name="delete" size={22} color={COLORS.textSecondary} />
                  ) : (
                    <Text style={styles.keyText}>{k}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {onCancel && !fullScreen && (
            <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  backdropFull: { backgroundColor: COLORS.background },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 28,
    paddingHorizontal: 22,
    alignItems: 'center'
  },
  lockIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12
  },
  title: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
  sub: { color: COLORS.textMuted, fontSize: 13, marginTop: 4, textAlign: 'center' },
  dotsRow: { flexDirection: 'row', gap: 16, marginTop: 22 },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLORS.borderHover
  },
  dotFilled: { backgroundColor: COLORS.textPrimary, borderColor: COLORS.textPrimary },
  error: { color: COLORS.danger, fontSize: 12, fontWeight: '600', height: 18, marginTop: 10 },
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: 264,
    marginTop: 6
  },
  key: {
    width: 72,
    height: 72,
    borderRadius: 36,
    margin: 8,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  keyGhost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  keyText: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '600' },
  cancelBtn: { marginTop: 10, padding: 8 },
  cancelText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '700' }
});
