// ============================================================================
// src/components/CalendarSection.js
// Calendar & Milestones: Birthdays, Monthsaries, Anniversaries & Alerts
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Share,
  Linking
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/colors';
import {
  makeId,
  nowIso,
  toLocalDateKey,
  MONTH_NAMES,
  MONTH_SHORT,
  daysInMonth,
  computeEventStats,
  formatEventDateLabel,
  eventOccursOnDay,
  hapticTap,
  hapticNotify
} from '../utils/helpers';
import {
  ensureNotificationChannelAndPermission,
  sendTestReminderNotification,
  getScheduledEventAlertsSummary,
  parseNotifyTime
} from '../utils/eventNotifications';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const EVENT_TYPES = [
  { id: 'ANNIVERSARY', label: 'Anniversary', icon: 'heart' },
  { id: 'MONTHSARY', label: 'Monthsary', icon: 'calendar' },
  { id: 'BIRTHDAY', label: 'Birthday', icon: 'gift' },
  { id: 'IMPORTANT', label: 'Important', icon: 'star' }
];

const FILTERS = [
  { id: 'ALL', label: 'All' },
  { id: 'SOON', label: 'Coming Soon' },
  { id: 'ANNIVERSARY', label: 'Anniversaries' },
  { id: 'MONTHSARY', label: 'Monthsaries' },
  { id: 'BIRTHDAY', label: 'Birthdays' },
  { id: 'IMPORTANT', label: 'Important' }
];

const LEAD_OPTIONS = [
  { val: -1, label: 'Off' },
  { val: 0, label: 'Day of' },
  { val: 1, label: '1d before' },
  { val: 3, label: '3d before' },
  { val: 7, label: '7d before' }
];

export default function CalendarSection({
  events = [],
  onSaveEvent,
  onDeleteEvent,
  notificationsEnabled = true,
  onToggleNotifications,
  externalAddTrigger = null,
  onExternalTriggerHandled,
  onShowToast
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const now = new Date();
  const todayKey = toLocalDateKey(now);

  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1); // 1..12
  const [selectedDay, setSelectedDay] = useState(null); // 1..31 or null
  const [filterType, setFilterType] = useState('ALL');

  // Add / Edit Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [evType, setEvType] = useState('ANNIVERSARY');
  const [title, setTitle] = useState('');
  const [monthVal, setMonthVal] = useState(now.getMonth() + 1); // 1..12 or null for recurring monthsary
  const [dayInput, setDayInput] = useState(String(now.getDate()));
  const [yearInput, setYearInput] = useState(String(now.getFullYear()));
  const [repeatYearly, setRepeatYearly] = useState(true);
  const [notifyLeadDays, setNotifyLeadDays] = useState(1);
  const [notifyTime, setNotifyTime] = useState('09:00');
  const [queuedCount, setQueuedCount] = useState(0);
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState('');

  React.useEffect(() => {
    const t = setTimeout(() => {
      getScheduledEventAlertsSummary().then((list) => setQueuedCount(list.length));
    }, 350);
    return () => clearTimeout(t);
  }, [events, notificationsEnabled]);

  React.useEffect(() => {
    if (!externalAddTrigger) return;
    openAddModal(externalAddTrigger);
    onExternalTriggerHandled && onExternalTriggerHandled();
  }, [externalAddTrigger]);

  function openAddModal(type = 'ANNIVERSARY', presetDay = null) {
    hapticTap('light');
    setEditingId(null);
    setEvType(type);
    setTitle('');
    setMonthVal(type === 'MONTHSARY' ? null : viewMonth);
    setDayInput(presetDay ? String(presetDay) : String(now.getDate()));
    setYearInput(type === 'MONTHSARY' ? '' : String(viewYear));
    setRepeatYearly(true);
    setNotifyLeadDays(1);
    setNotifyTime('09:00');
    setNote('');
    setFormError('');
    setModalOpen(true);
  }

  function openEditModal(ev) {
    hapticTap('light');
    setEditingId(ev.id);
    setEvType(ev.type || 'IMPORTANT');
    setTitle(ev.title || '');
    setMonthVal(ev.month != null ? Number(ev.month) : null);
    setDayInput(ev.day != null ? String(ev.day) : '');
    setYearInput(ev.year != null ? String(ev.year) : '');
    setRepeatYearly(Boolean(ev.repeatYearly));
    setNotifyLeadDays(ev.notifyLeadDays != null ? Number(ev.notifyLeadDays) : 1);
    setNotifyTime(ev.notifyTime || '09:00');
    setNote(ev.note || '');
    setFormError('');
    setModalOpen(true);
  }

  function handleSelectModalType(t) {
    hapticTap('light');
    setEvType(t);
    if (t === 'MONTHSARY' && !editingId) {
      setMonthVal(null);
      setYearInput('');
    } else if (t !== 'MONTHSARY' && monthVal == null) {
      setMonthVal(viewMonth);
    }
    if (t === 'BIRTHDAY' && !editingId && !yearInput) {
      setYearInput('2003');
    }
  }

  function shiftMonth(delta) {
    hapticTap('light');
    let nextM = viewMonth + delta;
    let nextY = viewYear;
    if (nextM < 1) {
      nextM = 12;
      nextY -= 1;
    } else if (nextM > 12) {
      nextM = 1;
      nextY += 1;
    }
    setViewMonth(nextM);
    setViewYear(nextY);
    setSelectedDay(null);
  }

  // Build calendar cells for viewYear + viewMonth
  const calendarCells = useMemo(() => {
    const firstDow = new Date(viewYear, viewMonth - 1, 1).getDay();
    const totalDays = daysInMonth(viewYear, viewMonth);
    const list = [];
    for (let i = 0; i < firstDow; i++) list.push(null);
    for (let d = 1; d <= totalDays; d++) {
      const mStr = String(viewMonth).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      const key = `${viewYear}-${mStr}-${dStr}`;
      const dayEvents = events.filter((ev) => eventOccursOnDay(ev, viewYear, viewMonth, d));
      list.push({ day: d, key, dayEvents });
    }
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [events, viewYear, viewMonth]);

  // Compute stats for all events & sort upcoming soonest first
  const enrichedEvents = useMemo(() => {
    return events
      .map((ev) => ({ ...ev, stats: computeEventStats(ev, now) }))
      .sort((a, b) => {
        const da = a.stats.daysUntil ?? 99999;
        const db = b.stats.daysUntil ?? 99999;
        if (da !== db) return da - db;
        return (a.title || '').localeCompare(b.title || '');
      });
  }, [events]);

  const upcomingBannerEvents = useMemo(
    () => enrichedEvents.filter((e) => e.stats.daysUntil !== null && e.stats.daysUntil <= 7),
    [enrichedEvents]
  );

  const visibleEvents = useMemo(() => {
    let base = enrichedEvents;
    if (selectedDay !== null) {
      base = base.filter((ev) => eventOccursOnDay(ev, viewYear, viewMonth, selectedDay));
    }
    if (filterType === 'SOON') {
      return base.filter((e) => e.stats.daysUntil !== null && e.stats.daysUntil <= 30);
    }
    if (filterType !== 'ALL') {
      return base.filter((e) => e.type === filterType);
    }
    return base;
  }, [enrichedEvents, selectedDay, viewYear, viewMonth, filterType]);

  // Live preview in Add/Edit Modal
  const liveDraft = useMemo(() => {
    const dNum = dayInput.trim() ? Number(dayInput.trim()) : null;
    const yNum = yearInput.trim() ? Number(yearInput.trim()) : null;
    const validD = dNum && dNum >= 1 && dNum <= 31 ? dNum : null;
    const validY = yNum && yNum >= 1900 && yNum <= 2150 ? yNum : null;
    const ev = {
      type: evType,
      title: title.trim() || 'Preview',
      month: monthVal,
      day: validD,
      year: validY,
      repeatYearly
    };
    return {
      ev,
      stats: computeEventStats(ev, now),
      label: formatEventDateLabel(ev)
    };
  }, [evType, title, monthVal, dayInput, yearInput, repeatYearly]);

  async function handleSaveForm() {
    const cleanTitle =
      title.trim() ||
      (evType === 'ANNIVERSARY'
        ? 'Our Anniversary'
        : evType === 'MONTHSARY'
        ? 'Our Monthsary'
        : evType === 'BIRTHDAY'
        ? 'Birthday'
        : 'Important Date');

    const dRaw = dayInput.trim();
    const yRaw = yearInput.trim();
    const dNum = dRaw ? Number(dRaw) : null;
    const yNum = yRaw ? Number(yRaw) : null;

    if (dRaw && (!Number.isInteger(dNum) || dNum < 1 || dNum > 31)) {
      setFormError('Day must be between 1 and 31 (or leave blank).');
      return;
    }
    if (yRaw && (!Number.isInteger(yNum) || yNum < 1900 || yNum > 2150)) {
      setFormError('Year must be 4 digits (e.g. 2003, 2023, 2026).');
      return;
    }
    if (evType === 'MONTHSARY' && !dNum) {
      setFormError('Enter the day of the month (e.g. 28) for your Monthsary.');
      return;
    }
    if (evType !== 'MONTHSARY' && !monthVal) {
      setFormError('Select a month.');
      return;
    }
    if (evType === 'IMPORTANT' && (!monthVal || !dNum || !yNum)) {
      setFormError('Important Dates need Month, Day, and Year.');
      return;
    }

    if (notifyLeadDays >= 0) {
      await ensureNotificationChannelAndPermission(true);
    }

    const { hour, minute } = parseNotifyTime(notifyTime);
    const cleanTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

    const ts = nowIso();
    const existing = editingId ? events.find((x) => x.id === editingId) : null;
    const saved = {
      id: editingId || makeId('ev'),
      title: cleanTitle,
      type: evType,
      month: monthVal || null,
      day: dNum || null,
      year: yNum || null,
      repeatYearly:
        evType === 'BIRTHDAY' || evType === 'ANNIVERSARY' ? true : Boolean(repeatYearly),
      notifyLeadDays,
      notifyTime: cleanTime,
      note: note.trim(),
      createdAt: existing?.createdAt || ts,
      updatedAt: ts
    };

    hapticNotify('success');
    await onSaveEvent?.(saved);
    setModalOpen(false);
  }

  function confirmDelete(ev) {
    hapticTap('medium');
    Alert.alert('Delete Date', `Remove "${ev.title}" from your Calendar?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDeleteEvent?.(ev.id) }
    ]);
  }

  async function handleTestAlert() {
    hapticTap('medium');
    const res = await sendTestReminderNotification();
    if (res?.ok) {
      hapticNotify('success');
      onShowToast && onShowToast('Notification sent — check your top status bar!');
    } else {
      Alert.alert(
        'Allow Notifications',
        `${res?.error || 'Could not display notification.'}\n\nTap "Open Settings" → Notifications → toggle ON.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => {}) }
        ]
      );
    }
  }

  async function handleShareEvent(ev) {
    hapticTap('light');
    const lines = [
      ev.title,
      formatEventDateLabel(ev),
      ev.stats.primaryHeadline,
      ev.stats.secondaryDetail,
      ev.note
    ].filter(Boolean);
    try {
      await Share.share({ message: lines.join('\n') });
    } catch {}
  }

  function getTypeIcon(t) {
    if (t === 'ANNIVERSARY') return 'heart';
    if (t === 'MONTHSARY') return 'calendar';
    if (t === 'BIRTHDAY') return 'gift';
    return 'star';
  }

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Action + Notification Beep Control */}
        <View style={styles.topRow}>
          <TouchableOpacity
            style={styles.bellChip}
            onPress={() => {
              hapticTap('light');
              if (!notificationsEnabled) {
                ensureNotificationChannelAndPermission(true).then(() =>
                  onToggleNotifications?.(true)
                );
              } else {
                onToggleNotifications?.(false);
              }
            }}
          >
            <Feather
              name={notificationsEnabled ? 'bell' : 'bell-off'}
              size={13}
              color={notificationsEnabled ? colors.success : colors.textMuted}
            />
            <Text style={styles.bellChipText}>
              {notificationsEnabled
                ? `Alerts On${queuedCount > 0 ? ` (${queuedCount})` : ''}`
                : 'Muted'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.testChip} onPress={handleTestAlert}>
            <Feather name="volume-2" size={13} color={colors.textSecondary} />
            <Text style={styles.testChipText}>Test Beep</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => openAddModal('ANNIVERSARY', selectedDay)}
          >
            <Feather name="plus" size={14} color={colors.solidBtnText} />
            <Text style={styles.addBtnText}>Add Date</Text>
          </TouchableOpacity>
        </View>

        {/* Coming Soon Alert Card */}
        {upcomingBannerEvents.length > 0 && (
          <View style={styles.alertBanner}>
            <View style={styles.alertLeft}>
              <Feather name="bell" size={15} color={colors.warning} />
              <View style={{ flex: 1 }}>
                <Text style={styles.alertTitle}>
                  {upcomingBannerEvents[0].stats.daysUntil === 0
                    ? `Today: ${upcomingBannerEvents[0].title}!`
                    : `Coming Soon: ${upcomingBannerEvents[0].title} (${upcomingBannerEvents[0].stats.countdownLabel})`}
                </Text>
                <Text style={styles.alertSub}>
                  {upcomingBannerEvents[0].stats.primaryHeadline}
                  {upcomingBannerEvents.length > 1
                    ? ` · +${upcomingBannerEvents.length - 1} more this week`
                    : ''}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Monthly Calendar Grid */}
        <View style={styles.calendarCard}>
          <View style={styles.monthHeader}>
            <TouchableOpacity onPress={() => shiftMonth(-1)} style={styles.navBtn} hitSlop={8}>
              <Feather name="chevron-left" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                hapticTap('light');
                setViewYear(now.getFullYear());
                setViewMonth(now.getMonth() + 1);
                setSelectedDay(null);
              }}
            >
              <Text style={styles.monthTitle}>
                {MONTH_NAMES[viewMonth - 1]} {viewYear}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => shiftMonth(1)} style={styles.navBtn} hitSlop={8}>
              <Feather name="chevron-right" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map((w) => (
              <Text key={w} style={styles.weekLabel}>
                {w}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {calendarCells.map((cell, idx) => {
              if (!cell) return <View key={`e_${idx}`} style={styles.dayCell} />;
              const isToday = cell.key === todayKey;
              const isSelected = selectedDay === cell.day;
              const hasEvents = cell.dayEvents.length > 0;
              return (
                <TouchableOpacity
                  key={cell.key}
                  style={[
                    styles.dayCell,
                    isToday && styles.dayCellToday,
                    isSelected && styles.dayCellSelected
                  ]}
                  onPress={() => {
                    hapticTap('light');
                    setSelectedDay(isSelected ? null : cell.day);
                  }}
                >
                  <Text
                    style={[
                      styles.dayNum,
                      isSelected && styles.dayNumSelected,
                      !isSelected && isToday && { fontWeight: '800', color: colors.textPrimary }
                    ]}
                  >
                    {cell.day}
                  </Text>
                  {hasEvents && (
                    <View
                      style={[
                        styles.eventDot,
                        isSelected && { backgroundColor: colors.solidBtnText }
                      ]}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {selectedDay !== null && (
            <View style={styles.selectedBar}>
              <Text style={styles.selectedBarText}>
                {MONTH_SHORT[viewMonth - 1]} {selectedDay}, {viewYear} ({visibleEvents.length})
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={() => openAddModal('IMPORTANT', selectedDay)}>
                  <Text style={styles.selectedAction}>+ Add on day {selectedDay}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setSelectedDay(null)}>
                  <Text style={styles.selectedClear}>Show all</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, marginBottom: 12 }}
        >
          {FILTERS.map((f) => {
            const active = filterType === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => {
                  hapticTap('light');
                  setFilterType(f.id);
                }}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Event Milestone List */}
        {visibleEvents.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconBox}>
              <Feather name="calendar" size={24} color={colors.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>
              {events.length === 0
                ? 'Save Your Important Dates'
                : 'No Events Match This Filter'}
            </Text>
            <Text style={styles.emptySub}>
              Save birthdays, your monthly monthsary (e.g. every 28th), or anniversary (e.g. April 28, 2023) to track exact years, months & days and get reminder alerts.
            </Text>
            <View style={styles.quickPresets}>
              {EVENT_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={styles.presetBtn}
                  onPress={() => openAddModal(t.id, selectedDay)}
                >
                  <Feather name={t.icon} size={13} color={colors.textPrimary} />
                  <Text style={styles.presetText}>+ {t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {visibleEvents.map((ev) => (
              <TouchableOpacity
                key={ev.id}
                activeOpacity={0.8}
                style={[
                  styles.evCard,
                  ev.stats.daysUntil === 0 && { borderColor: colors.warning }
                ]}
                onPress={() => openEditModal(ev)}
              >
                <View style={styles.evTopRow}>
                  <View style={styles.evIconBox}>
                    <Feather name={getTypeIcon(ev.type)} size={15} color={colors.textPrimary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.evTitle}>{ev.title}</Text>
                    <Text style={styles.evDateLabel}>
                      {formatEventDateLabel(ev)}
                      {ev.notifyLeadDays >= 0
                        ? ` · Alert ${ev.notifyLeadDays === 0 ? 'day of' : `${ev.notifyLeadDays}d before`}`
                        : ' · Muted'}
                    </Text>
                  </View>
                  {ev.stats.countdownLabel ? (
                    <View
                      style={[
                        styles.badgePill,
                        ev.stats.daysUntil <= 3 && { backgroundColor: colors.solidBtnBg }
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          ev.stats.daysUntil <= 3 && { color: colors.solidBtnText }
                        ]}
                      >
                        {ev.stats.countdownLabel}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Elapsed Years / Months / Days Readout */}
                <Text style={styles.evHeadline}>{ev.stats.primaryHeadline}</Text>
                {ev.stats.secondaryDetail ? (
                  <Text style={styles.evSubDetail}>{ev.stats.secondaryDetail}</Text>
                ) : null}
                {ev.note ? <Text style={styles.evNote}>{ev.note}</Text> : null}

                <View style={styles.evActions}>
                  <TouchableOpacity style={styles.evActionBtn} onPress={() => handleShareEvent(ev)}>
                    <Feather name="share-2" size={12} color={colors.textSecondary} />
                    <Text style={styles.evActionText}>Share</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.evActionBtn} onPress={() => openEditModal(ev)}>
                    <Feather name="edit-2" size={12} color={colors.textSecondary} />
                    <Text style={styles.evActionText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.evActionBtn} onPress={() => confirmDelete(ev)}>
                    <Feather name="trash-2" size={12} color={colors.danger} />
                    <Text style={[styles.evActionText, { color: colors.danger }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add / Edit Milestone Modal */}
      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {editingId ? 'Edit Calendar Date' : 'Save Important Date'}
              </Text>
              <TouchableOpacity onPress={() => setModalOpen(false)} hitSlop={8}>
                <Feather name="x" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {/* Type */}
              <Text style={styles.label}>EVENT TYPE</Text>
              <View style={styles.typeGrid}>
                {EVENT_TYPES.map((t) => {
                  const active = evType === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.typeBtn, active && styles.typeBtnActive]}
                      onPress={() => handleSelectModalType(t.id)}
                    >
                      <Feather
                        name={t.icon}
                        size={13}
                        color={active ? colors.solidBtnText : colors.textSecondary}
                      />
                      <Text style={[styles.typeBtnText, active && styles.typeBtnTextActive]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Title */}
              <Text style={styles.label}>TITLE / PERSON</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={
                  evType === 'ANNIVERSARY'
                    ? 'e.g. Our Anniversary'
                    : evType === 'MONTHSARY'
                    ? 'e.g. Our Monthsary'
                    : evType === 'BIRTHDAY'
                    ? "e.g. My Birthday, GF's Birthday"
                    : 'e.g. Graduation, Flight, Exam'
                }
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />

              {/* Month Picker */}
              <Text style={styles.label}>
                {evType === 'MONTHSARY'
                  ? 'START MONTH (PICK + ADD YEAR TO COUNT 1ST, 2ND, 49TH...)'
                  : 'MONTH'}
              </Text>
              <View style={styles.monthGrid}>
                {evType === 'MONTHSARY' && (
                  <TouchableOpacity
                    style={[styles.mChip, monthVal === null && styles.mChipActive, { width: '100%' }]}
                    onPress={() => {
                      hapticTap('light');
                      setMonthVal(null);
                      setYearInput('');
                    }}
                  >
                    <Text style={[styles.mChipText, monthVal === null && styles.mChipTextActive]}>
                      Monthly Only (e.g. Every 28th)
                    </Text>
                  </TouchableOpacity>
                )}
                {MONTH_SHORT.map((mName, i) => {
                  const mNum = i + 1;
                  const active = monthVal === mNum;
                  return (
                    <TouchableOpacity
                      key={mName}
                      style={[styles.mChip, active && styles.mChipActive]}
                      onPress={() => {
                        hapticTap('light');
                        setMonthVal(mNum);
                      }}
                    >
                      <Text style={[styles.mChipText, active && styles.mChipTextActive]}>
                        {mName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Day + Year Row */}
              <View style={styles.dyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>
                    DAY {evType === 'BIRTHDAY' ? '(OPTIONAL)' : '(1-31)'}
                  </Text>
                  <TextInput
                    value={dayInput}
                    onChangeText={setDayInput}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder={evType === 'BIRTHDAY' ? 'Blank = month only' : 'e.g. 28'}
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>
                    YEAR {evType === 'IMPORTANT' ? '(REQUIRED)' : '(FOR AGE / DURATION)'}
                  </Text>
                  <TextInput
                    value={yearInput}
                    onChangeText={setYearInput}
                    keyboardType="number-pad"
                    maxLength={4}
                    placeholder={evType === 'BIRTHDAY' ? 'e.g. 2003' : 'e.g. 2023'}
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
                  />
                </View>
              </View>

              {evType === 'IMPORTANT' && (
                <TouchableOpacity
                  style={styles.repeatRow}
                  onPress={() => {
                    hapticTap('light');
                    setRepeatYearly((r) => !r);
                  }}
                >
                  <Feather
                    name={repeatYearly ? 'check-square' : 'square'}
                    size={16}
                    color={colors.textPrimary}
                  />
                  <Text style={styles.repeatText}>Repeat every year</Text>
                </TouchableOpacity>
              )}

              {/* Live Calculated Preview */}
              <View style={styles.previewBox}>
                <Text style={styles.previewLabel}>LIVE CALCULATION</Text>
                <Text style={styles.previewMain}>
                  {liveDraft.stats.primaryHeadline || 'Pick a month & day/year above'}
                </Text>
                {liveDraft.stats.secondaryDetail ? (
                  <Text style={styles.previewSub}>{liveDraft.stats.secondaryDetail}</Text>
                ) : null}
              </View>

              {/* Notification Reminder Lead */}
              <Text style={styles.label}>NOTIFICATION & BEEP ALERT</Text>
              <View style={styles.leadRow}>
                {LEAD_OPTIONS.map((opt) => {
                  const active = notifyLeadDays === opt.val;
                  return (
                    <TouchableOpacity
                      key={opt.val}
                      style={[styles.leadChip, active && styles.leadChipActive]}
                      onPress={() => {
                        hapticTap('light');
                        setNotifyLeadDays(opt.val);
                      }}
                    >
                      <Text style={[styles.leadText, active && styles.leadTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {notifyLeadDays >= 0 && (
                <>
                  <Text style={styles.label}>ALERT TIME (24H HH:MM)</Text>
                  <View style={styles.leadRow}>
                    {[
                      { t: '09:00', lbl: '9 AM' },
                      { t: '12:00', lbl: '12 PM' },
                      { t: '18:00', lbl: '6 PM' },
                      { t: '20:00', lbl: '8 PM' }
                    ].map((p) => {
                      const active = notifyTime === p.t;
                      return (
                        <TouchableOpacity
                          key={p.t}
                          style={[styles.leadChip, active && styles.leadChipActive]}
                          onPress={() => {
                            hapticTap('light');
                            setNotifyTime(p.t);
                          }}
                        >
                          <Text style={[styles.leadText, active && styles.leadTextActive]}>
                            {p.lbl}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                    <TextInput
                      value={notifyTime}
                      onChangeText={setNotifyTime}
                      placeholder="09:00"
                      placeholderTextColor={colors.textMuted}
                      maxLength={5}
                      style={[
                        styles.input,
                        { width: 72, marginBottom: 0, paddingVertical: 5, textAlign: 'center', fontSize: 12 }
                      ]}
                    />
                  </View>
                </>
              )}

              {/* Optional Note */}
              <Text style={styles.label}>NOTE / GIFT IDEA (OPTIONAL)</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="e.g. Dinner plan, gift idea..."
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />

              {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveForm}>
                <Text style={styles.saveBtnText}>
                  {editingId ? 'Update Calendar Date' : 'Save to Calendar'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    content: { padding: 14, paddingBottom: 96 },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    bellChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 11,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface
    },
    bellChipText: { color: colors.textPrimary, fontSize: 12, fontWeight: '700' },
    testChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 11,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface
    },
    testChipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
    addBtn: {
      marginLeft: 'auto',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.solidBtnBg,
      paddingHorizontal: 13,
      paddingVertical: 8,
      borderRadius: 10
    },
    addBtnText: { color: colors.solidBtnText, fontSize: 12, fontWeight: '700' },
    alertBanner: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.warning,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12
    },
    alertLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    alertTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
    alertSub: { color: colors.textSecondary, fontSize: 11.5, marginTop: 2 },
    calendarCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 12,
      marginBottom: 12
    },
    monthHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10
    },
    navBtn: {
      width: 30,
      height: 30,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceElevated
    },
    monthTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
    weekRow: { flexDirection: 'row', marginBottom: 4 },
    weekLabel: {
      flex: 1,
      textAlign: 'center',
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700'
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    dayCell: {
      width: '14.285%',
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 9,
      position: 'relative'
    },
    dayCellToday: {
      borderWidth: 1,
      borderColor: colors.borderHover,
      backgroundColor: colors.surfaceElevated
    },
    dayCellSelected: { backgroundColor: colors.solidBtnBg },
    dayNum: { color: colors.textSecondary, fontSize: 12.5, fontWeight: '600' },
    dayNumSelected: { color: colors.solidBtnText, fontWeight: '800' },
    eventDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: colors.textPrimary,
      position: 'absolute',
      bottom: 3
    },
    selectedBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border
    },
    selectedBarText: { color: colors.textPrimary, fontSize: 12, fontWeight: '700' },
    selectedAction: { color: colors.textPrimary, fontSize: 12, fontWeight: '700' },
    selectedClear: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
    filterChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface
    },
    filterChipActive: { backgroundColor: colors.solidBtnBg, borderColor: colors.solidBtnBg },
    filterText: { color: colors.textSecondary, fontSize: 11.5, fontWeight: '700' },
    filterTextActive: { color: colors.solidBtnText },
    evCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 15,
      padding: 14
    },
    evTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    evIconBox: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center'
    },
    evTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
    evDateLabel: { color: colors.textMuted, fontSize: 11, marginTop: 1 },
    badgePill: {
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border
    },
    badgeText: { color: colors.textPrimary, fontSize: 11, fontWeight: '800' },
    evHeadline: {
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: '800',
      marginTop: 10
    },
    evSubDetail: { color: colors.textSecondary, fontSize: 12, marginTop: 3 },
    evNote: { color: colors.textMuted, fontSize: 12, marginTop: 6, fontStyle: 'italic' },
    evActions: {
      flexDirection: 'row',
      gap: 14,
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border
    },
    evActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    evActionText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
    emptyCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 22,
      alignItems: 'center'
    },
    emptyIconBox: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12
    },
    emptyTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
    emptySub: {
      color: colors.textSecondary,
      fontSize: 12,
      textAlign: 'center',
      lineHeight: 18,
      marginTop: 6,
      marginBottom: 14
    },
    quickPresets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
    presetBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.borderHover,
      paddingHorizontal: 11,
      paddingVertical: 8,
      borderRadius: 9
    },
    presetText: { color: colors.textPrimary, fontSize: 12, fontWeight: '700' },
    backdrop: { flex: 1, backgroundColor: colors.backdrop, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
      maxHeight: '90%'
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12
    },
    sheetTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
    label: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.7,
      marginTop: 6,
      marginBottom: 6
    },
    typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
    typeBtn: {
      width: '48.8%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 10,
      paddingVertical: 9,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated
    },
    typeBtnActive: { backgroundColor: colors.solidBtnBg, borderColor: colors.solidBtnBg },
    typeBtnText: { color: colors.textSecondary, fontSize: 12.5, fontWeight: '700' },
    typeBtnTextActive: { color: colors.solidBtnText },
    input: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.textPrimary,
      fontSize: 13.5,
      marginBottom: 10
    },
    monthGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 10
    },
    mChip: {
      width: '23.5%',
      paddingVertical: 7,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center'
    },
    mChipActive: { backgroundColor: colors.solidBtnBg, borderColor: colors.solidBtnBg },
    mChipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
    mChipTextActive: { color: colors.solidBtnText },
    dyRow: { flexDirection: 'row', gap: 10 },
    repeatRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    repeatText: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
    previewBox: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.borderHover,
      borderRadius: 12,
      padding: 12,
      marginBottom: 10
    },
    previewLabel: {
      color: colors.textMuted,
      fontSize: 9.5,
      fontWeight: '700',
      letterSpacing: 0.7
    },
    previewMain: { color: colors.textPrimary, fontSize: 15, fontWeight: '800', marginTop: 3 },
    previewSub: { color: colors.textSecondary, fontSize: 11.5, marginTop: 2 },
    leadRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
    leadChip: {
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated
    },
    leadChipActive: { backgroundColor: colors.solidBtnBg, borderColor: colors.solidBtnBg },
    leadText: { color: colors.textSecondary, fontSize: 11.5, fontWeight: '700' },
    leadTextActive: { color: colors.solidBtnText },
    errorText: { color: colors.danger, fontSize: 12, fontWeight: '600', marginBottom: 8 },
    saveBtn: {
      backgroundColor: colors.solidBtnBg,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 4,
      marginBottom: 16
    },
    saveBtnText: { color: colors.solidBtnText, fontSize: 14, fontWeight: '700' }
  });
