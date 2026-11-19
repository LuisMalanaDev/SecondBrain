// ============================================================================
// src/components/CompanionSection.js
// Minimalist Monochrome Companion (Focus Orb & Vault Tree) Grown by All Sections
// ============================================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  StyleSheet
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/colors';
import { computeCompanionProgress } from '../utils/companionEngine';
import { hapticTap, hapticNotify } from '../utils/helpers';
import PulseDot from './PulseDot';

export default function CompanionSection({
  items = [],
  expenses = [],
  events = [],
  hasPin = false,
  companionState,
  onNurtureDaily,
  onChangeForm,
  onSelectSection
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const progress = useMemo(
    () =>
      computeCompanionProgress({
        items,
        expenses,
        events,
        hasPin,
        companionState
      }),
    [items, expenses, events, hasPin, companionState]
  );

  // Calm continuous orbital motion
  const spinAnim = useRef(new Animated.Value(0)).current;
  const spinRevAnim = useRef(new Animated.Value(0)).current;
  const tapScale = useRef(new Animated.Value(1)).current;
  const [tapHint, setTapHint] = useState('');

  useEffect(() => {
    const loop1 = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 16000,
        easing: Easing.linear,
        useNativeDriver: true
      })
    );
    const loop2 = Animated.loop(
      Animated.timing(spinRevAnim, {
        toValue: 1,
        duration: 24000,
        easing: Easing.linear,
        useNativeDriver: true
      })
    );
    loop1.start();
    loop2.start();
    return () => {
      loop1.stop();
      loop2.stop();
    };
  }, [spinAnim, spinRevAnim]);

  const rotateCw = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });
  const rotateCcw = spinRevAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg']
  });

  function handleInteractiveTap() {
    Animated.sequence([
      Animated.spring(tapScale, {
        toValue: 0.93,
        friction: 4,
        useNativeDriver: true
      }),
      Animated.spring(tapScale, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true
      })
    ]).start();

    if (!progress.checkedInToday && onNurtureDaily) {
      hapticNotify('success');
      onNurtureDaily();
      setTapHint('+30 Daily XP & Streak!');
    } else {
      hapticTap('light');
      setTapHint(
        progress.hasTodayCelebration
          ? 'Celebrating your special day!'
          : `${progress.activeSectionsCount}/${progress.totalSectionsCount} sections feeding XP`
      );
    }
    setTimeout(() => setTapHint(''), 2200);
  }

  const maxSourceXp = Math.max(
    1,
    ...progress.sources.map((s) => s.xp)
  );

  // Visual tier sizes for Orb & Tree
  const canopyTiers = Math.min(4, Math.max(1, Math.ceil(progress.level / 1.5)));
  const satelliteAngles = Array.from({ length: Math.min(6, progress.level) }, (_, i) =>
    Math.round((360 / Math.min(6, progress.level)) * i)
  );

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Top Form Toggle + Level Header */}
      <View style={styles.topRow}>
        <View style={styles.formToggle}>
          {[
            { id: 'ORB', label: 'Focus Orb' },
            { id: 'TREE', label: 'Vault Tree' }
          ].map((opt) => {
            const active = progress.form === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[styles.formPill, active && styles.formPillActive]}
                onPress={() => {
                  hapticTap('light');
                  onChangeForm?.(opt.id);
                }}
              >
                <Text style={[styles.formPillText, active && styles.formPillTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.streakPill}>
          <PulseDot color={progress.checkedInToday ? colors.success : colors.warning} size={6} />
          <Text style={styles.streakPillText}>
            {progress.streak}d Streak
          </Text>
        </View>
      </View>

      {/* Special Calendar Milestone Multiplier Banner */}
      {progress.hasTodayCelebration && (
        <View style={styles.celebrationBanner}>
          <PulseDot color={colors.warning} size={7} />
          <View style={{ flex: 1 }}>
            <Text style={styles.celebrationTitle}>
              Special Day Celebration Boost!
            </Text>
            <Text style={styles.celebrationSub}>
              {progress.todayEvents[0]?.title || 'Milestone'} today — your companion glows brighter (+25% & bonus XP).
            </Text>
          </View>
        </View>
      )}

      {/* Interactive Companion Stage */}
      <View style={styles.stageCard}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleInteractiveTap}
          style={styles.stageTouch}
        >
          <Animated.View style={[styles.visualWrap, { transform: [{ scale: tapScale }] }]}>
            {progress.form === 'ORB' ? (
              <View style={styles.orbCanvas}>
                {/* Outer Ring (rotates CW) */}
                <Animated.View
                  style={[
                    styles.orbOuterRing,
                    {
                      borderColor: progress.hasTodayCelebration
                        ? colors.warningBorder
                        : colors.borderHover,
                      transform: [{ rotate: rotateCw }]
                    }
                  ]}
                >
                  {satelliteAngles.slice(0, 3).map((deg, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.satelliteHolder,
                        { transform: [{ rotate: `${deg}deg` }] }
                      ]}
                    >
                      <View
                        style={[
                          styles.satelliteDot,
                          {
                            backgroundColor: progress.hasTodayCelebration
                              ? colors.warning
                              : colors.textPrimary
                          }
                        ]}
                      />
                    </View>
                  ))}
                </Animated.View>

                {/* Inner Ring (rotates CCW when Lv >= 2) */}
                {progress.level >= 2 && (
                  <Animated.View
                    style={[
                      styles.orbMidRing,
                      {
                        borderColor: colors.borderLight,
                        transform: [{ rotate: rotateCcw }]
                      }
                    ]}
                  >
                    {satelliteAngles.slice(3).map((deg, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.satelliteHolderInner,
                          { transform: [{ rotate: `${deg}deg` }] }
                        ]}
                      >
                        <View style={[styles.satelliteDot, { backgroundColor: colors.textSecondary }]} />
                      </View>
                    ))}
                  </Animated.View>
                )}

                {/* Living Core */}
                <View
                  style={[
                    styles.orbCore,
                    progress.hasTodayCelebration && {
                      borderColor: colors.warning,
                      backgroundColor: colors.warningTint
                    }
                  ]}
                >
                  <Text style={styles.coreLevelText}>LV {progress.level}</Text>
                </View>
              </View>
            ) : (
              /* Geometric Monochrome Vault Tree */
              <View style={styles.treeCanvas}>
                {/* Star Spark at Crown when Lv >= 3 */}
                {progress.level >= 3 && (
                  <View style={{ marginBottom: 4 }}>
                    <PulseDot
                      color={progress.hasTodayCelebration ? colors.warning : colors.textPrimary}
                      size={6}
                    />
                  </View>
                )}

                {/* Minimal Layered Canopy Tiers */}
                {Array.from({ length: canopyTiers }).map((_, i) => {
                  const width = 46 + i * 26;
                  const height = 22 + i * 4;
                  const activeBorder =
                    progress.hasTodayCelebration
                      ? colors.warningBorder
                      : i === 0
                      ? colors.textPrimary
                      : colors.borderHover;
                  return (
                    <View
                      key={i}
                      style={[
                        styles.treeCanopyLayer,
                        {
                          width,
                          height,
                          borderRadius: height / 2,
                          borderColor: activeBorder,
                          backgroundColor:
                            i === 0 ? colors.surfaceElevated : colors.surface,
                          marginTop: i === 0 ? 0 : -6
                        }
                      ]}
                    >
                      <View style={styles.treeNodeRow}>
                        {Array.from({ length: Math.min(3, i + 1) }).map((__, dotIdx) => (
                          <View
                            key={dotIdx}
                            style={[
                              styles.treeLeafDot,
                              {
                                backgroundColor: progress.hasTodayCelebration
                                  ? colors.warning
                                  : colors.textSecondary
                              }
                            ]}
                          />
                        ))}
                      </View>
                    </View>
                  );
                })}

                {/* Trunk & Roots Base */}
                <View style={styles.treeTrunk} />
                <View style={styles.treeGround} />
              </View>
            )}
          </Animated.View>

          {tapHint ? (
            <View style={styles.tapHintPill}>
              <Text style={styles.tapHintText}>{tapHint}</Text>
            </View>
          ) : null}
        </TouchableOpacity>

        {/* Rank, XP & Progress Bar */}
        <Text style={styles.rankTitle}>{progress.rankTitle}</Text>
        <Text style={styles.rankSub}>
          Level {progress.level} • {progress.totalXp} XP
          {progress.nextRank ? ` (${progress.xpToNext} XP to Lv ${progress.nextRank.level})` : ' (Max Rank)'}
        </Text>

        <View style={styles.xpTrack}>
          <View style={[styles.xpFill, { width: `${progress.levelProgressPct}%` }]} />
        </View>

        {/* Daily Check-In Button */}
        <TouchableOpacity
          style={[
            styles.nurtureBtn,
            progress.checkedInToday && styles.nurtureBtnDone
          ]}
          onPress={() => {
            if (!progress.checkedInToday && onNurtureDaily) {
              hapticNotify('success');
              onNurtureDaily();
              setTapHint('+30 Daily XP!');
              setTimeout(() => setTapHint(''), 2000);
            } else {
              handleInteractiveTap();
            }
          }}
          activeOpacity={0.8}
        >
          <Feather
            name={progress.checkedInToday ? 'check' : 'zap'}
            size={14}
            color={progress.checkedInToday ? colors.textSecondary : colors.solidBtnText}
          />
          <Text
            style={[
              styles.nurtureBtnText,
              progress.checkedInToday && { color: colors.textSecondary }
            ]}
          >
            {progress.checkedInToday
              ? `Nurtured Today • Best Streak: ${progress.bestStreak}d`
              : 'Nurture Companion Today (+30 XP)'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Section Power Connections */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeading}>
          CONNECTED SECTIONS ({progress.activeSectionsCount}/{progress.totalSectionsCount})
        </Text>
        <Text style={styles.sectionHint}>Tap any row to grow XP</Text>
      </View>

      <View style={styles.sourcesCard}>
        {progress.sources.map((src, idx) => {
          const pct = src.xp > 0 ? Math.max(8, Math.round((src.xp / maxSourceXp) * 100)) : 0;
          return (
            <TouchableOpacity
              key={src.id}
              style={[styles.sourceRow, idx > 0 && styles.sourceRowBorder]}
              onPress={() => {
                hapticTap('light');
                onSelectSection?.(src.id);
              }}
              activeOpacity={0.75}
            >
              <View style={[styles.sourceIcon, src.xp > 0 && styles.sourceIconActive]}>
                <Feather
                  name={src.icon}
                  size={14}
                  color={src.xp > 0 ? colors.textPrimary : colors.textMuted}
                />
              </View>

              <View style={{ flex: 1 }}>
                <View style={styles.sourceTop}>
                  <Text style={styles.sourceLabel}>{src.label}</Text>
                  <Text style={[styles.sourceXp, src.xp > 0 && { color: colors.textPrimary }]}>
                    {src.xp > 0 ? `+${src.xp} XP` : '0 XP'}
                  </Text>
                </View>
                <Text style={styles.sourceDetail}>{src.detail}</Text>
                <View style={styles.sourceTrack}>
                  <View style={[styles.sourceFill, { width: `${pct}%` }]} />
                </View>
              </View>

              <Feather name="chevron-right" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Monochrome Badges */}
      <Text style={[styles.sectionHeading, { marginBottom: 10 }]}>MILESTONE BADGES</Text>
      <View style={styles.badgeGrid}>
        {progress.badges.map((b) => (
          <View
            key={b.id}
            style={[styles.badgeItem, b.unlocked && styles.badgeItemUnlocked]}
          >
            <Feather
              name={b.unlocked ? b.icon : 'lock'}
              size={14}
              color={b.unlocked ? colors.textPrimary : colors.textMuted}
            />
            <Text
              style={[
                styles.badgeLabel,
                b.unlocked && { color: colors.textPrimary, fontWeight: '700' }
              ]}
              numberOfLines={1}
            >
              {b.label}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 6,
      paddingBottom: 28
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12
    },
    formToggle: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 3
    },
    formPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 7
    },
    formPillActive: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.borderHover
    },
    formPillText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted
    },
    formPillTextActive: {
      color: colors.textPrimary,
      fontWeight: '700'
    },
    streakPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 10,
      paddingVertical: 6
    },
    streakPillText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
      fontVariant: ['tabular-nums']
    },
    celebrationBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.warningTint,
      borderWidth: 1,
      borderColor: colors.warningBorder,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12
    },
    celebrationTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary
    },
    celebrationSub: {
      fontSize: 11.5,
      color: colors.textSecondary,
      marginTop: 2
    },
    stageCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 18,
      alignItems: 'center',
      marginBottom: 18
    },
    stageTouch: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 166,
      width: '100%'
    },
    visualWrap: {
      alignItems: 'center',
      justifyContent: 'center'
    },
    orbCanvas: {
      width: 150,
      height: 150,
      alignItems: 'center',
      justifyContent: 'center'
    },
    orbOuterRing: {
      position: 'absolute',
      width: 144,
      height: 144,
      borderRadius: 72,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center'
    },
    orbMidRing: {
      position: 'absolute',
      width: 104,
      height: 104,
      borderRadius: 52,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center'
    },
    satelliteHolder: {
      position: 'absolute',
      width: 144,
      height: 144,
      alignItems: 'center'
    },
    satelliteHolderInner: {
      position: 'absolute',
      width: 104,
      height: 104,
      alignItems: 'center'
    },
    satelliteDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginTop: -4
    },
    orbCore: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1.5,
      borderColor: colors.textPrimary,
      alignItems: 'center',
      justifyContent: 'center'
    },
    coreLevelText: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: 0.8,
      fontVariant: ['tabular-nums']
    },
    treeCanvas: {
      height: 150,
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingBottom: 6
    },
    treeCanopyLayer: {
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center'
    },
    treeNodeRow: {
      flexDirection: 'row',
      gap: 10
    },
    treeLeafDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5
    },
    treeTrunk: {
      width: 10,
      height: 24,
      backgroundColor: colors.surfaceElevated,
      borderLeftWidth: 1.5,
      borderRightWidth: 1.5,
      borderColor: colors.borderHover,
      marginTop: -2
    },
    treeGround: {
      width: 72,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: colors.borderHover
    },
    tapHintPill: {
      position: 'absolute',
      bottom: 2,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.borderHover,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 4
    },
    tapHintText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textPrimary
    },
    rankTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.textPrimary,
      marginTop: 6
    },
    rankSub: {
      fontSize: 12,
      color: colors.textSecondary,
      fontVariant: ['tabular-nums'],
      marginTop: 3,
      marginBottom: 12
    },
    xpTrack: {
      width: '100%',
      height: 5,
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 3,
      overflow: 'hidden',
      marginBottom: 14
    },
    xpFill: {
      height: '100%',
      backgroundColor: colors.textPrimary,
      borderRadius: 3
    },
    nurtureBtn: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      backgroundColor: colors.solidBtnBg,
      borderRadius: 11,
      paddingVertical: 11
    },
    nurtureBtnDone: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border
    },
    nurtureBtnText: {
      fontSize: 12.5,
      fontWeight: '700',
      color: colors.solidBtnText
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10
    },
    sectionHeading: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.8
    },
    sectionHint: {
      fontSize: 11,
      color: colors.textMuted
    },
    sourcesCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      overflow: 'hidden',
      marginBottom: 20
    },
    sourceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 11
    },
    sourceRowBorder: {
      borderTopWidth: 1,
      borderTopColor: colors.border
    },
    sourceIcon: {
      width: 32,
      height: 32,
      borderRadius: 9,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center'
    },
    sourceIconActive: {
      borderColor: colors.borderHover
    },
    sourceTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 2
    },
    sourceLabel: {
      fontSize: 13.5,
      fontWeight: '700',
      color: colors.textPrimary
    },
    sourceXp: {
      fontSize: 11.5,
      fontWeight: '700',
      color: colors.textMuted,
      fontVariant: ['tabular-nums']
    },
    sourceDetail: {
      fontSize: 11.5,
      color: colors.textSecondary,
      marginBottom: 6
    },
    sourceTrack: {
      height: 3,
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 1.5,
      overflow: 'hidden'
    },
    sourceFill: {
      height: '100%',
      backgroundColor: colors.textPrimary,
      borderRadius: 1.5
    },
    badgeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8
    },
    badgeItem: {
      width: '48.5%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 11,
      paddingHorizontal: 11,
      paddingVertical: 10
    },
    badgeItemUnlocked: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.borderHover
    },
    badgeLabel: {
      flex: 1,
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted
    }
  });
