// ============================================================================
// src/utils/eventNotifications.js
// Local Scheduled Notifications & Sound/Vibration Alerts for Calendar Events
// ============================================================================

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { computeEventStats, MONTH_SHORT, toLocalDateKey } from './helpers';

const CHANNEL_ID = 'secondbrain_calendar_v1';

let handlerConfigured = false;
const notifiedTodayKeys = new Set();

export function configureNotifications() {
  if (handlerConfigured) return;
  handlerConfigured = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false
      })
    });
  } catch (e) {}
}

export async function ensureNotificationChannelAndPermission(requestPrompt = false) {
  try {
    configureNotifications();

    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
          name: 'Calendar & Milestones',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 280, 140, 280],
          enableVibrate: true,
          sound: 'default'
        });
      } catch (chanErr) {}
    }

    const current = await Notifications.getPermissionsAsync();
    if (current.granted || current.status === 'granted') {
      return { granted: true, status: current.status || 'granted' };
    }
    if (!requestPrompt) {
      return { granted: false, status: current.status, canAskAgain: current.canAskAgain };
    }

    const req = await Notifications.requestPermissionsAsync();
    return {
      granted: Boolean(req.granted || req.status === 'granted'),
      status: req.status,
      canAskAgain: req.canAskAgain
    };
  } catch (e) {
    return { granted: false, status: 'error', error: e?.message || 'Permission error' };
  }
}

export function parseNotifyTime(notifyTime = '09:00') {
  const m = /^(\d{1,2}):(\d{2})$/.exec((notifyTime || '').trim());
  if (!m) return { hour: 9, minute: 0 };
  const hour = Math.max(0, Math.min(23, Number(m[1])));
  const minute = Math.max(0, Math.min(59, Number(m[2])));
  return { hour, minute };
}

export async function sendTestReminderNotification() {
  try {
    const perm = await ensureNotificationChannelAndPermission(true);
    if (!perm.granted) {
      return {
        ok: false,
        error: `Notification permission is "${perm.status}". Enable Notifications in Android App Settings.`
      };
    }

    // Present an immediate notification in the status bar/shade right away
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'SecondBrain Calendar Alert',
        body: 'Sound & notification alerts are active for your Birthdays, Monthsaries & Anniversaries!',
        sound: 'default',
        vibrate: [0, 280, 140, 280]
      },
      trigger: Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null
    });

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || 'Could not trigger notification.' };
  }
}

export async function getScheduledEventAlertsSummary() {
  try {
    const list = await Notifications.getAllScheduledNotificationsAsync();
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

export async function syncEventNotifications(events = [], notificationsEnabled = true) {
  try {
    configureNotifications();
    await Notifications.cancelAllScheduledNotificationsAsync();

    if (!notificationsEnabled || !Array.isArray(events) || events.length === 0) {
      return { scheduledCount: 0, immediateFired: 0 };
    }

    const perm = await ensureNotificationChannelAndPermission(true);
    if (!perm.granted) {
      return { scheduledCount: 0, immediateFired: 0, permissionDenied: true };
    }

    const now = new Date();
    const todayKey = toLocalDateKey(now);
    let scheduledCount = 0;
    let immediateFired = 0;

    for (const ev of events) {
      if (!ev || ev.notifyLeadDays === -1) continue;
      const stats = computeEventStats(ev, now);
      if (!stats.nextDate) continue;

      const leadDays = Number.isFinite(Number(ev.notifyLeadDays))
        ? Number(ev.notifyLeadDays)
        : 1;
      const { hour, minute } = parseNotifyTime(ev.notifyTime);

      const offsets = leadDays > 0 ? [leadDays, 0] : [0];
      const dateStr = `${MONTH_SHORT[stats.nextDate.getMonth()]} ${stats.nextDate.getDate()}`;
      const typeLabel =
        ev.type === 'BIRTHDAY'
          ? 'Birthday'
          : ev.type === 'ANNIVERSARY'
          ? 'Anniversary'
          : ev.type === 'MONTHSARY'
          ? 'Monthsary'
          : 'Reminder';

      for (const offset of offsets) {
        if (scheduledCount >= 48) break;
        const fireAt = new Date(
          stats.nextDate.getFullYear(),
          stats.nextDate.getMonth(),
          stats.nextDate.getDate() - offset,
          hour,
          minute,
          0
        );

        const prefix =
          offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : `In ${offset} days`;

        const body =
          ev.type === 'BIRTHDAY' || ev.type === 'ANNIVERSARY' || ev.type === 'MONTHSARY'
            ? `${prefix} (${dateStr}): ${ev.title} — ${stats.primaryHeadline || typeLabel}`
            : `${prefix} (${dateStr}): ${ev.title}`;

        const fireKey = toLocalDateKey(fireAt);

        // If the alert date IS TODAY and the selected clock time already passed today,
        // fire an immediate reminder once today instead of silently skipping!
        if (fireKey === todayKey && fireAt.getTime() <= now.getTime() + 5000) {
          const dedupeKey = `${ev.id}|${offset}|${todayKey}`;
          if (!notifiedTodayKeys.has(dedupeKey)) {
            notifiedTodayKeys.add(dedupeKey);
            await Notifications.scheduleNotificationAsync({
              content: {
                title: `${typeLabel}: ${ev.title}`,
                body,
                sound: 'default',
                vibrate: [0, 280, 140, 280],
                data: { eventId: ev.id, section: 'CALENDAR' }
              },
              trigger: Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null
            });
            immediateFired++;
          }
          continue;
        }

        if (fireAt.getTime() <= now.getTime() + 5000) continue;

        await Notifications.scheduleNotificationAsync({
          content: {
            title: `${typeLabel}: ${ev.title}`,
            body,
            sound: 'default',
            vibrate: [0, 280, 140, 280],
            data: { eventId: ev.id, section: 'CALENDAR' }
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: fireAt,
            ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {})
          }
        });
        scheduledCount++;
      }
    }

    return { scheduledCount, immediateFired };
  } catch (e) {
    return { scheduledCount: 0, immediateFired: 0, error: e?.message };
  }
}
