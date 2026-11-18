// ============================================================================
// src/components/DatePickerModal.js — Clean Minimal Monochrome Calendar Picker
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { toLocalDateKey, hapticTap } from '../utils/helpers';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function DatePickerModal({
  visible,
  selectedDateKey,
  markedDateKeys = [],
  title = 'Select Date',
  onSelect,
  onClose
}) {
  const todayKey = toLocalDateKey(new Date());
  const initialKey = selectedDateKey || todayKey;

  const [viewYear, setViewYear] = useState(Number(initialKey.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(Number(initialKey.slice(5, 7)) - 1);

  useEffect(() => {
    if (!visible) return;
    const refKey = selectedDateKey || toLocalDateKey(new Date());
    setViewYear(Number(refKey.slice(0, 4)));
    setViewMonth(Number(refKey.slice(5, 7)) - 1);
  }, [visible, selectedDateKey]);

  const markedSet = useMemo(() => new Set(markedDateKeys), [markedDateKeys]);

  const cells = useMemo(() => {
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const list = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      list.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const m = String(viewMonth + 1).padStart(2, '0');
      const d = String(day).padStart(2, '0');
      list.push({ day, key: `${viewYear}-${m}-${d}` });
    }
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [viewYear, viewMonth]);

  function shiftMonth(delta) {
    hapticTap('light');
    let nextMonth = viewMonth + delta;
    let nextYear = viewYear;
    if (nextMonth < 0) {
      nextMonth = 11;
      nextYear -= 1;
    } else if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    }
    setViewMonth(nextMonth);
    setViewYear(nextYear);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Feather name="x" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Month Switcher */}
          <View style={styles.monthRow}>
            <TouchableOpacity onPress={() => shiftMonth(-1)} style={styles.navBtn} hitSlop={8}>
              <Feather name="chevron-left" size={18} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>
              {MONTHS[viewMonth]} {viewYear}
            </Text>
            <TouchableOpacity onPress={() => shiftMonth(1)} style={styles.navBtn} hitSlop={8}>
              <Feather name="chevron-right" size={18} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Weekday Labels */}
          <View style={styles.weekRow}>
            {WEEKDAYS.map((w) => (
              <Text key={w} style={styles.weekLabel}>
                {w}
              </Text>
            ))}
          </View>

          {/* Calendar Grid */}
          <View style={styles.grid}>
            {cells.map((cell, idx) => {
              if (!cell) {
                return <View key={`empty_${idx}`} style={styles.cell} />;
              }
              const isSelected = cell.key === selectedDateKey;
              const isToday = cell.key === todayKey;
              const isMarked = markedSet.has(cell.key);
              return (
                <TouchableOpacity
                  key={cell.key}
                  style={[
                    styles.cell,
                    isToday && !isSelected && styles.cellToday,
                    isSelected && styles.cellSelected
                  ]}
                  onPress={() => {
                    hapticTap('light');
                    onSelect(cell.key);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.cellText,
                      isSelected && styles.cellTextSelected
                    ]}
                  >
                    {cell.day}
                  </Text>
                  {isMarked && (
                    <View
                      style={[
                        styles.dot,
                        isSelected && { backgroundColor: '#000000' }
                      ]}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Quick Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.todayBtn}
              onPress={() => {
                hapticTap('light');
                onSelect(todayKey);
              }}
            >
              <Text style={styles.todayBtnText}>Jump to Today</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    paddingHorizontal: 20
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.borderHover,
    padding: 16
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary
  },
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  monthTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 6
  },
  weekLabel: {
    width: '14.285%',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  cell: {
    width: '14.285%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10
  },
  cellToday: {
    borderWidth: 1,
    borderColor: COLORS.borderHover
  },
  cellSelected: {
    backgroundColor: COLORS.textPrimary
  },
  cellText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary
  },
  cellTextSelected: {
    color: '#000000',
    fontWeight: '800'
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.textSecondary,
    marginTop: 2
  },
  footer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: 'center'
  },
  todayBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  todayBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary
  }
});
