// ============================================================================
// src/components/SectionDropdown.js — Modern Section Switcher Dropdown
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Pressable
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme, VAULT_SECTIONS } from '../theme/colors';
import { formatPeso, hapticTap } from '../utils/helpers';

export default function SectionDropdown({
  activeSection,
  onSelectSection,
  stats,
  expenseBalance = 0,
  eventCount = 0,
  compact = false
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [open, setOpen] = useState(false);

  const current = VAULT_SECTIONS.find((s) => s.id === activeSection) || VAULT_SECTIONS[0];

  function getRightBadge(sectionId) {
    if (sectionId === 'HOME' || sectionId === 'ANALYTICS') return null;
    if (sectionId === 'EXPENSES') return formatPeso(expenseBalance);
    if (sectionId === 'CALENDAR') return String(eventCount || 0);
    if (sectionId === 'NOTE') return String(stats.notes || 0);
    if (sectionId === 'VOICE') return String(stats.voiceMemos || 0);
    if (sectionId === 'PASSWORD') return String(stats.passwords || 0);
    if (sectionId === 'CHECKLIST') return String(stats.checklists || 0);
    if (sectionId === 'LINK') return String(stats.links || 0);
    if (sectionId === 'PINNED') return String(stats.pinned || 0);
    return null;
  }

  const activeBadge = getRightBadge(activeSection);

  return (
    <>
      {compact ? (
        <TouchableOpacity
          style={styles.compactTriggerBtn}
          onPress={() => {
            hapticTap('light');
            setOpen(true);
          }}
          activeOpacity={0.75}
          hitSlop={6}
        >
          <Feather name={current.icon} size={13} color={colors.textPrimary} />
          <Text style={styles.compactTriggerLabel} numberOfLines={1}>
            {current.label}
          </Text>
          <Feather name="chevron-down" size={14} color={colors.textSecondary} />
        </TouchableOpacity>
      ) : (
        <View style={styles.triggerWrap}>
          <TouchableOpacity
            style={styles.triggerBtn}
            onPress={() => {
              hapticTap('light');
              setOpen(true);
            }}
            activeOpacity={0.75}
          >
            <View style={styles.triggerLeft}>
              <View style={styles.triggerIconBox}>
                <Feather name={current.icon} size={14} color={colors.textPrimary} />
              </View>
              <View>
                <Text style={styles.triggerLabel}>{current.label}</Text>
                <Text style={styles.triggerSub}>{current.description}</Text>
              </View>
            </View>

            <View style={styles.triggerRight}>
              {activeBadge !== null && (
                <View style={styles.countPill}>
                  <Text style={styles.countPillText}>{activeBadge}</Text>
                </View>
              )}
              <Feather name="chevron-down" size={16} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>
      )}

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.menuCard} onPress={() => {}}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuHeaderTitle}>SECTIONS</Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={8}>
                <Feather name="x" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
              {VAULT_SECTIONS.map((sec, idx) => {
                const isSelected = sec.id === activeSection;
                const badge = getRightBadge(sec.id);
                return (
                  <TouchableOpacity
                    key={sec.id}
                    style={[
                      styles.menuItem,
                      isSelected && styles.menuItemActive,
                      idx > 0 && styles.menuItemBorder
                    ]}
                    onPress={() => {
                      hapticTap('light');
                      setOpen(false);
                      onSelectSection(sec.id);
                    }}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.menuIconBox,
                        isSelected && styles.menuIconBoxActive
                      ]}
                    >
                      <Feather
                        name={sec.icon}
                        size={15}
                        color={isSelected ? colors.solidBtnText : colors.textSecondary}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.menuLabel,
                          isSelected && styles.menuLabelActive
                        ]}
                      >
                        {sec.label}
                      </Text>
                      <Text style={styles.menuDesc}>{sec.description}</Text>
                    </View>

                    {badge !== null && <Text style={styles.menuBadge}>{badge}</Text>}

                    {isSelected && (
                      <Feather
                        name="check"
                        size={15}
                        color={colors.textPrimary}
                        style={{ marginLeft: 8 }}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    compactTriggerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      paddingHorizontal: 11,
      paddingVertical: 7,
      maxWidth: 138
    },
    compactTriggerLabel: {
      fontSize: 12.5,
      fontWeight: '700',
      color: colors.textPrimary,
      flexShrink: 1
    },
    triggerWrap: {
      paddingHorizontal: 20,
      paddingTop: 4,
      paddingBottom: 8
    },
    triggerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10
    },
    triggerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1
    },
    triggerIconBox: {
      width: 30,
      height: 30,
      borderRadius: 8,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center'
    },
    triggerLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary
    },
    triggerSub: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 1
    },
    triggerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8
    },
    countPill: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3
    },
    countPillText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary
    },
    backdrop: {
      flex: 1,
      backgroundColor: colors.backdrop,
      justifyContent: 'center',
      paddingHorizontal: 20
    },
    menuCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.borderHover,
      overflow: 'hidden'
    },
    menuHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 13,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surfaceElevated
    },
    menuHeaderTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 1
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 13,
      gap: 12
    },
    menuItemBorder: {
      borderTopWidth: 1,
      borderTopColor: colors.border
    },
    menuItemActive: {
      backgroundColor: colors.surfaceElevated
    },
    menuIconBox: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center'
    },
    menuIconBoxActive: {
      backgroundColor: colors.solidBtnBg,
      borderColor: colors.solidBtnBg
    },
    menuLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary
    },
    menuLabelActive: {
      color: colors.textPrimary,
      fontWeight: '700'
    },
    menuDesc: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 1
    },
    menuBadge: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted
    }
  });
