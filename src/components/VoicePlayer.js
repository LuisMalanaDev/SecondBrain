// ============================================================================
// src/components/VoicePlayer.js — Clean Monochrome Offline Voice Memo Player
// ============================================================================

import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { COLORS } from '../theme/colors';
import { formatDuration, hapticTap } from '../utils/helpers';

export default function VoicePlayer({ uri, durationMs = 0, compact = false }) {
  const player = useAudioPlayer(uri ? { uri } : null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    // Reset to start when playback completes
    if (status?.didJustFinish) {
      player.seekTo(0).catch(() => {});
    }
  }, [status?.didJustFinish, player]);

  async function togglePlay() {
    if (!uri) return;
    hapticTap('light');
    try {
      if (status?.playing) {
        player.pause();
      } else {
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true
        });
        if (
          status?.duration > 0 &&
          status?.currentTime >= status.duration - 0.15
        ) {
          await player.seekTo(0);
        }
        player.play();
      }
    } catch (e) {}
  }

  const totalSec = status?.duration > 0 ? status.duration : durationMs / 1000;
  const currentSec = status?.currentTime || 0;
  const pct = totalSec > 0 ? Math.min(100, Math.round((currentSec / totalSec) * 100)) : 0;

  return (
    <View style={[styles.container, compact && styles.compactContainer]}>
      <TouchableOpacity onPress={togglePlay} style={styles.playBtn} activeOpacity={0.75}>
        <Feather
          name={status?.playing ? 'pause' : 'play'}
          size={14}
          color="#000000"
          style={!status?.playing && { marginLeft: 1.5 }}
        />
      </TouchableOpacity>

      <View style={styles.trackArea}>
        <View style={styles.trackBg}>
          <View style={[styles.trackFill, { width: `${pct}%` }]} />
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatDuration(currentSec * 1000)}</Text>
          <Text style={styles.timeText}>{formatDuration(totalSec * 1000)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginVertical: 6,
    gap: 12
  },
  compactContainer: {
    paddingVertical: 9
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.textPrimary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  trackArea: {
    flex: 1
  },
  trackBg: {
    height: 3,
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 5
  },
  trackFill: {
    height: '100%',
    backgroundColor: COLORS.textPrimary,
    borderRadius: 2
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  timeText: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600'
  }
});
