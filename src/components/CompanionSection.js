// ============================================================================
// src/components/CompanionSection.js
// Monochrome Companion (Focus Orb & Vault Tree) + Focus Timer + Daily Quests + Vault Quiz
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
import {
  computeCompanionProgress,
  generateVaultQuizQuestion
} from '../utils/companionEngine';
import { hapticTap, hapticNotify } from '../utils/helpers';
import PulseDot from './PulseDot';

const FOCUS_PRESETS = [5, 15, 25];

function formatTimer(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function CompanionSection({
  items = [],
  expenses = [],
  events = [],
  hasPin = false,
  companionState,
  onNurtureDaily,
  onClaimDailyClear,
  onCompleteFocusSession,
  onQuizSolved,
  onToggleTask,
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

  // Focus Timer State
  const [focusMinutes, setFocusMinutes] = useState(15);
  const [focusActive, setFocusActive] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const [focusRemainingSec, setFocusRemainingSec] = useState(15 * 60);
  const [selectedTaskIdx, setSelectedTaskIdx] = useState(0);
  const [completedTaskPrompt, setCompletedTaskPrompt] = useState(null);

  // Vault Memory Spark Mini-Quiz State
  const [quizQuestion, setQuizQuestion] = useState(() =>
    generateVaultQuizQuestion({ items, expenses, events })
  );
  const [selectedChoiceIdx, setSelectedChoiceIdx] = useState(null);

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

  // Focus countdown interval
  const activeLinkedTask =
    progress.openTasksList.length > 0
      ? progress.openTasksList[selectedTaskIdx % progress.openTasksList.length]
      : null;

  useEffect(() => {
    if (!focusActive || focusPaused) return;
    const id = setInterval(() => {
      setFocusRemainingSec((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          setFocusActive(false);
          setFocusPaused(false);
          hapticNotify('success');
          onCompleteFocusSession?.(focusMinutes);
          if (activeLinkedTask) {
            setCompletedTaskPrompt(activeLinkedTask);
          }
          setTapHint(`+${25} Focus XP!`);
          setTimeout(() => setTapHint(''), 2600);
          return focusMinutes * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [focusActive, focusPaused, focusMinutes, activeLinkedTask, onCompleteFocusSession]);

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
        focusActive
          ? 'Focus session running...'
          : progress.hasTodayCelebration
          ? 'Celebrating your special day!'
          : `${progress.activeSectionsCount}/${progress.totalSectionsCount} sections feeding XP`
      );
    }
    setTimeout(() => setTapHint(''), 2200);
  }

  function handleStartFocus() {
    hapticTap('medium');
    setCompletedTaskPrompt(null);
    setFocusRemainingSec(focusMinutes * 60);
    setFocusPaused(false);
    setFocusActive(true);
  }

  function handleStopFocus() {
    hapticTap('light');
    setFocusActive(false);
    setFocusPaused(false);
    setFocusRemainingSec(focusMinutes * 60);
  }

  function handlePickChoice(idx) {
    if (selectedChoiceIdx !== null) return;
    setSelectedChoiceIdx(idx);
    const chosen = quizQuestion.choices[idx];
    if (chosen?.isCorrect) {
      hapticNotify('success');
      onQuizSolved?.();
    } else {
      hapticNotify('warning');
    }
  }

  function handleNextQuestion() {
    hapticTap('light');
    setSelectedChoiceIdx(null);
    setQuizQuestion(
      generateVaultQuizQuestion({
        items,
        expenses,
        events,
        prevQuestionKey: quizQuestion?.key || ''
      })
    );
  }

  const maxSourceXp = Math.max(1, ...progress.sources.map((s) => s.xp));
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
      {/* Top Form Toggle + Streak Header */}
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
          <PulseDot
            color={focusActive || progress.checkedInToday ? colors.success : colors.warning}
            size={6}
          />
          <Text style={styles.streakPillText}>{progress.streak}d Streak</Text>
        </View>
      </View>

      {/* Special Calendar Milestone Multiplier Banner */}
      {progress.hasTodayCelebration && (
        <View style={styles.celebrationBanner}>
          <PulseDot color={colors.warning} size={7} />
          <View style={{ flex: 1 }}>
            <Text style={styles.celebrationTitle}>Special Day Celebration Boost!</Text>
            <Text style={styles.celebrationSub}>
              {progress.todayEvents[0]?.title || 'Milestone'} today — +25% & bonus XP active.
            </Text>
          </View>
        </View>
      )}

      {/* Interactive Companion Stage + Focus Timer */}
      <View style={styles.stageCard}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleInteractiveTap}
          style={styles.stageTouch}
        >
          <Animated.View style={[styles.visualWrap, { transform: [{ scale: tapScale }] }]}>
            {progress.form === 'ORB' ? (
              <View style={styles.orbCanvas}>
                <Animated.View
                  style={[
                    styles.orbOuterRing,
                    {
                      borderColor: focusActive
                        ? colors.textPrimary
                        : progress.hasTodayCelebration
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
                        <View
                          style={[
                            styles.satelliteDot,
                            { backgroundColor: colors.textSecondary }
                          ]}
                        />
                      </View>
                    ))}
                  </Animated.View>
                )}

                <View
                  style={[
                    styles.orbCore,
                    progress.hasTodayCelebration && {
                      borderColor: colors.warning,
                      backgroundColor: colors.warningTint
                    },
                    focusActive && { width: 76, height: 76, borderRadius: 38 }
                  ]}
                >
                  <Text style={styles.coreLevelText}>
                    {focusActive ? formatTimer(focusRemainingSec) : `LV ${progress.level}`}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.treeCanvas}>
                {progress.level >= 3 && (
                  <View style={{ marginBottom: 4 }}>
                    <PulseDot
                      color={progress.hasTodayCelebration ? colors.warning : colors.textPrimary}
                      size={6}
                    />
                  </View>
                )}

                {Array.from({ length: canopyTiers }).map((_, i) => {
                  const width = 46 + i * 26;
                  const height = 22 + i * 4;
                  const activeBorder = progress.hasTodayCelebration
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
                          backgroundColor: i === 0 ? colors.surfaceElevated : colors.surface,
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

                <View style={styles.treeTrunk} />
                <View style={styles.treeGround} />
                {focusActive && (
                  <Text style={styles.treeTimerLabel}>{formatTimer(focusRemainingSec)}</Text>
                )}
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
          {progress.nextRank
            ? ` (${progress.xpToNext} XP to Lv ${progress.nextRank.level})`
            : ' (Max Rank)'}
        </Text>

        <View style={styles.xpTrack}>
          <View style={[styles.xpFill, { width: `${progress.levelProgressPct}%` }]} />
        </View>

        {/* Daily Check-In Button */}
        <TouchableOpacity
          style={[styles.nurtureBtn, progress.checkedInToday && styles.nurtureBtnDone]}
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

        {/* Focus Session Controls */}
        <View style={styles.focusBox}>
          <View style={styles.focusHeaderRow}>
            <Text style={styles.focusHeaderLabel}>FOCUS TIMER (+25 XP)</Text>
            {progress.focusMinutesTotal > 0 && (
              <Text style={styles.focusHeaderStat}>
                {progress.focusSessionsCount}x • {progress.focusMinutesTotal}m total
              </Text>
            )}
          </View>

          {activeLinkedTask && (
            <TouchableOpacity
              style={styles.taskTargetChip}
              onPress={() => {
                if (!focusActive) {
                  hapticTap('light');
                  setSelectedTaskIdx((i) => i + 1);
                }
              }}
              activeOpacity={0.75}
            >
              <Feather name="target" size={12} color={colors.textSecondary} />
              <Text style={styles.taskTargetText} numberOfLines={1}>
                Focus task: {activeLinkedTask.text}
              </Text>
              {!focusActive && progress.openTasksList.length > 1 && (
                <Text style={styles.taskCycleHint}>Switch ↻</Text>
              )}
            </TouchableOpacity>
          )}

          {completedTaskPrompt && (
            <TouchableOpacity
              style={styles.completeTaskPromptBtn}
              onPress={() => {
                hapticNotify('success');
                onToggleTask?.(completedTaskPrompt.itemId, completedTaskPrompt.taskId);
                setCompletedTaskPrompt(null);
              }}
            >
              <Feather name="check-circle" size={13} color={colors.success} />
              <Text style={styles.completeTaskPromptText} numberOfLines={1}>
                Mark "{completedTaskPrompt.text}" done? Tap ✓
              </Text>
            </TouchableOpacity>
          )}

          {!focusActive ? (
            <View style={styles.focusControlsRow}>
              <View style={styles.presetRow}>
                {FOCUS_PRESETS.map((mins) => {
                  const selected = focusMinutes === mins;
                  return (
                    <TouchableOpacity
                      key={mins}
                      style={[styles.presetBtn, selected && styles.presetBtnActive]}
                      onPress={() => {
                        hapticTap('light');
                        setFocusMinutes(mins);
                        setFocusRemainingSec(mins * 60);
                      }}
                    >
                      <Text
                        style={[styles.presetText, selected && styles.presetTextActive]}
                      >
                        {mins}m
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity style={styles.focusStartBtn} onPress={handleStartFocus}>
                <Feather name="play" size={13} color={colors.solidBtnText} />
                <Text style={styles.focusStartText}>Focus {focusMinutes}m</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.focusControlsRow}>
              <TouchableOpacity
                style={styles.focusSecondaryBtn}
                onPress={() => {
                  hapticTap('light');
                  setFocusPaused((p) => !p);
                }}
              >
                <Feather name={focusPaused ? 'play' : 'pause'} size={13} color={colors.textPrimary} />
                <Text style={styles.focusSecondaryText}>
                  {focusPaused ? 'Resume' : 'Pause'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.focusSecondaryBtn} onPress={handleStopFocus}>
                <Feather name="square" size={12} color={colors.textSecondary} />
                <Text style={[styles.focusSecondaryText, { color: colors.textSecondary }]}>
                  End Early
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* 3 Live Daily Quests */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeading}>
          DAILY QUESTS ({progress.dailyQuestsDone}/{progress.dailyQuests.length})
        </Text>
        <Text style={styles.sectionHint}>
          {progress.dailyClearClaimed ? 'Daily Clear Claimed ✓' : '+40 XP for 3/3'}
        </Text>
      </View>

      <View style={styles.questsCard}>
        {progress.dailyQuests.map((q, idx) => (
          <TouchableOpacity
            key={q.id}
            style={[styles.questRow, idx > 0 && styles.sourceRowBorder]}
            onPress={() => {
              if (q.done) return;
              hapticTap('light');
              if (q.id === 'checkin') {
                onNurtureDaily?.();
              } else if (q.targetSection) {
                onSelectSection?.(q.targetSection);
              }
            }}
            activeOpacity={q.done ? 1 : 0.75}
          >
            <View style={[styles.questCheck, q.done && styles.questCheckDone]}>
              {q.done && <Feather name="check" size={12} color={colors.solidBtnText} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.questLabel, q.done && styles.questLabelDone]}>
                {q.label}
              </Text>
              <Text style={styles.questHint}>{q.hint}</Text>
            </View>
            {!q.done && q.targetSection && (
              <Feather name="chevron-right" size={14} color={colors.textMuted} />
            )}
          </TouchableOpacity>
        ))}

        {progress.canClaimDailyClear && (
          <TouchableOpacity
            style={styles.claimClearBtn}
            onPress={() => {
              hapticNotify('success');
              onClaimDailyClear?.();
            }}
          >
            <Feather name="award" size={14} color={colors.solidBtnText} />
            <Text style={styles.claimClearText}>Claim 3/3 Daily Clear (+40 XP)</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Vault Memory Spark Mini-Quiz */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeading}>VAULT MEMORY SPARK (+15 XP)</Text>
        <Text style={styles.sectionHint}>Solved: {progress.quizSolvedCount}</Text>
      </View>

      <View style={styles.quizCard}>
        <View style={styles.quizTopRow}>
          <View style={styles.quizSectionTag}>
            <Text style={styles.quizSectionTagText}>{quizQuestion.section}</Text>
          </View>
          <TouchableOpacity onPress={handleNextQuestion} hitSlop={8}>
            <Text style={styles.quizSkipText}>Next Question ↻</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.quizPrompt}>{quizQuestion.prompt}</Text>

        <View style={{ gap: 7 }}>
          {quizQuestion.choices.map((ch, idx) => {
            const answered = selectedChoiceIdx !== null;
            const isPicked = selectedChoiceIdx === idx;
            const showCorrect = answered && ch.isCorrect;
            const showWrong = answered && isPicked && !ch.isCorrect;
            return (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.quizOptionBtn,
                  showCorrect && styles.quizOptionCorrect,
                  showWrong && styles.quizOptionWrong
                ]}
                onPress={() => handlePickChoice(idx)}
                activeOpacity={answered ? 1 : 0.75}
              >
                <Text
                  style={[
                    styles.quizOptionText,
                    (showCorrect || showWrong) && { color: colors.textPrimary, fontWeight: '700' }
                  ]}
                >
                  {ch.label}
                </Text>
                {showCorrect && <Feather name="check" size={14} color={colors.success} />}
                {showWrong && <Feather name="x" size={14} color={colors.danger} />}
              </TouchableOpacity>
            );
          })}
        </View>
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
      minHeight: 162,
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
      fontSize: 13,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: 0.6,
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
      height: 22,
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
    treeTimerLabel: {
      marginTop: 6,
      fontSize: 13,
      fontWeight: '800',
      color: colors.textPrimary,
      fontVariant: ['tabular-nums']
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
      paddingVertical: 11,
      marginBottom: 14
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
    focusBox: {
      width: '100%',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 12,
      gap: 9
    },
    focusHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    focusHeaderLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.7
    },
    focusHeaderStat: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
      fontVariant: ['tabular-nums']
    },
    taskTargetChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 9,
      paddingHorizontal: 10,
      paddingVertical: 8
    },
    taskTargetText: {
      flex: 1,
      fontSize: 12,
      fontWeight: '600',
      color: colors.textPrimary
    },
    taskCycleHint: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted
    },
    completeTaskPromptBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      backgroundColor: colors.successTint,
      borderWidth: 1,
      borderColor: 'rgba(48, 164, 108, 0.35)',
      borderRadius: 9,
      paddingHorizontal: 10,
      paddingVertical: 8
    },
    completeTaskPromptText: {
      flex: 1,
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary
    },
    focusControlsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8
    },
    presetRow: {
      flexDirection: 'row',
      gap: 6
    },
    presetBtn: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated
    },
    presetBtnActive: {
      borderColor: colors.textPrimary,
      backgroundColor: colors.surfaceSubtle
    },
    presetText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      fontVariant: ['tabular-nums']
    },
    presetTextActive: {
      color: colors.textPrimary,
      fontWeight: '700'
    },
    focusStartBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.solidBtnBg,
      borderRadius: 9,
      paddingVertical: 9
    },
    focusStartText: {
      fontSize: 12.5,
      fontWeight: '700',
      color: colors.solidBtnText
    },
    focusSecondaryBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 9,
      paddingVertical: 9
    },
    focusSecondaryText: {
      fontSize: 12.5,
      fontWeight: '700',
      color: colors.textPrimary
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
    questsCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      overflow: 'hidden',
      marginBottom: 18
    },
    questRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 11
    },
    questCheck: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: colors.borderHover,
      alignItems: 'center',
      justifyContent: 'center'
    },
    questCheckDone: {
      backgroundColor: colors.solidBtnBg,
      borderColor: colors.solidBtnBg
    },
    questLabel: {
      fontSize: 13.5,
      fontWeight: '700',
      color: colors.textPrimary
    },
    questLabelDone: {
      color: colors.textSecondary
    },
    questHint: {
      fontSize: 11.5,
      color: colors.textMuted,
      marginTop: 1
    },
    claimClearBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      margin: 12,
      marginTop: 4,
      backgroundColor: colors.solidBtnBg,
      borderRadius: 10,
      paddingVertical: 10
    },
    claimClearText: {
      fontSize: 12.5,
      fontWeight: '800',
      color: colors.solidBtnText
    },
    quizCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 14,
      marginBottom: 18
    },
    quizTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10
    },
    quizSectionTag: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3
    },
    quizSectionTagText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6
    },
    quizSkipText: {
      fontSize: 11.5,
      fontWeight: '700',
      color: colors.textSecondary
    },
    quizPrompt: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
      lineHeight: 20,
      marginBottom: 12
    },
    quizOptionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10
    },
    quizOptionCorrect: {
      backgroundColor: colors.successTint,
      borderColor: 'rgba(48, 164, 108, 0.45)'
    },
    quizOptionWrong: {
      borderColor: colors.danger
    },
    quizOptionText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      flex: 1,
      marginRight: 8
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
