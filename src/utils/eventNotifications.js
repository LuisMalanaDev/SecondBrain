// ============================================================================
// src/utils/eventNotifications.js
// Local Scheduled Notifications & Sound/Vibration Alerts for Calendar Events
// ============================================================================

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { computeEventStats, MONTH_SHORT } from './helpers';

const CHANNEL_ID = 'secondbrain_calendar_v1';

let handlerConfigured = false;

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
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Calendar & Milestones',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 280, 140, 280],
        enableVibrate: true,
        sound: 'default'
      });
    }

    const current = await Notifications.getPermissionsAsync();
    if (current.status === 'granted') return true;
    if (!requestPrompt) return false;

    const req = await Notifications.requestPermissionsAsync();
    return req.status === 'granted';
  } catch (e) {
    return false;
  }
}

export async function sendTestReminderNotification() {
  const granted = await ensureNotificationChannelAndPermission(true);
  if (!granted) return false;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'SecondBrain Calendar',
      body: 'Sound & notification alerts are working for your Birthdays & Anniversaries!',
      sound: 'default',
      vibrate: [0, 280, 140, 280]
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 2,
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {})
    }
  });
  return true;
}

export async function syncEventNotifications(events = [], notificationsEnabled = true) {
  try {
    configureNotifications();
    await Notifications.cancelAllScheduledNotificationsAsync();

    if (!notificationsEnabled || !Array.isArray(events) || events.length === 0) {
      return 0;
    }

    const granted = await ensureNotificationChannelAndPermission(false);
    if (!granted) return 0;

    const now = new Date();
    let scheduledCount = 0;

    for (const ev of events) {
      if (!ev || ev.notifyLeadDays === -1) continue;
      const stats = computeEventStats(ev, now);
      if (!stats.nextDate) continue;

      const leadDays = Number.isFinite(Number(ev.notifyLeadDays))
        ? Number(ev.notifyLeadDays)
        : 1;

      const offsets = leadDays > 0 ? [leadDays, 0] : [0];
      const dateStr = `${MONTH_SHORT[stats.nextDate.getMonth()]} ${stats.nextDate.getDate()}`;

      for (const offset of offsets) {
        if (scheduledCount >= 48) break;
        const fireAt = new Date(
          stats.nextDate.getFullYear(),
          stats.nextDate.getMonth(),
          stats.nextDate.getDate() - offset,
          9,
          0,
          0
        );

        if (fireAt.getTime() <= now.getTime() + 5000) continue;

        const prefix =
          offset === 0
            ? 'Today'
            : offset === 1
            ? 'Tomorrow'
            : `In ${offset} days`;

        const typeLabel =
          ev.type === 'BIRTHDAY'
            ? 'Birthday'
            : ev.type === 'ANNIVERSARY'
            ? 'Anniversary'
            : ev.type === 'MONTHSARY'
            ? 'Monthsary'
            : 'Reminder';

        const body =
          ev.type === 'BIRTHDAY' || ev.type === 'ANNIVERSARY' || ev.type === 'MONTHSARY'
            ? `${prefix} (${dateStr}): ${ev.title} — ${stats.primaryHeadline || typeLabel}`
            : `${prefix} (${dateStr}): ${ev.title}`;

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

    return scheduledCount;
  } catch (e) {
    return 0;
  }
}
