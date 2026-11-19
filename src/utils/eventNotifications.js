// ============================================================================
// src/utils/eventNotifications.js
// Local Scheduled Notifications + Hourly Escalation Until Seen in App
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

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'SecondBrain Calendar Alert',
        body: 'Sound & hourly reminder alerts are active for your Birthdays, Monthsaries & Anniversaries!',
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

export async function dismissTrayNotifications() {
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch (e) {}
}

export async function getScheduledEventAlertsSummary() {
  try {
    const list = await Notifications.getAllScheduledNotificationsAsync();
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

export async function syncEventNotifications(
  events = [],
  notificationsEnabled = true,
  acknowledgedAlerts = {}
) {
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
    const MAX_SLOTS = 48;
    let scheduledCount = 0;
    let immediateFired = 0;

    // Sort soonest events first so near-term hourly reminders get priority slots
    const sorted = [...events]
      .map((ev) => ({ ev, stats: computeEventStats(ev, now) }))
      .filter((x) => x.ev && x.ev.notifyLeadDays !== -1 && x.stats.nextDate)
      .sort((a, b) => (a.stats.daysUntil ?? 99999) - (b.stats.daysUntil ?? 99999));

    for (const { ev, stats } of sorted) {
      if (scheduledCount >= MAX_SLOTS) break;

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

      const monthsaryMilestone =
        ev.type === 'MONTHSARY' && stats.secondaryDetail?.includes('Monthsary')
          ? stats.secondaryDetail.split('•')[0].replace('Next:', '').trim()
          : null;

      for (const offset of offsets) {
        if (scheduledCount >= MAX_SLOTS) break;

        const baseFire = new Date(
          stats.nextDate.getFullYear(),
          stats.nextDate.getMonth(),
          stats.nextDate.getDate() - offset,
          hour,
          minute,
          0
        );
        const fireKey = toLocalDateKey(baseFire);
        const ackKey = `${ev.id}|${fireKey}`;

        // If the user already acknowledged/stopped this day's alarm inside the app, skip all alerts for it!
        if (acknowledgedAlerts && acknowledgedAlerts[ackKey]) {
          continue;
        }

        const prefix =
          offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : `In ${offset} days`;

        const coreDesc =
          ev.type === 'MONTHSARY' && monthsaryMilestone
            ? `${prefix} (${dateStr}): ${ev.title} — ${monthsaryMilestone}!`
            : ev.type === 'BIRTHDAY' || ev.type === 'ANNIVERSARY' || ev.type === 'MONTHSARY'
            ? `${prefix} (${dateStr}): ${ev.title} — ${stats.primaryHeadline || typeLabel}`
            : `${prefix} (${dateStr}): ${ev.title}`;

        const daysFromNow = Math.round(
          (new Date(baseFire.getFullYear(), baseFire.getMonth(), baseFire.getDate()).getTime() -
            new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
            (1000 * 60 * 60 * 24)
        );

        // If today's alert time has already passed & hasn't been acknowledged yet, fire immediate alert once
        let hourlyStart = new Date(baseFire.getTime());
        if (fireKey === todayKey && baseFire.getTime() <= now.getTime() + 5000) {
          const dedupeKey = `${ev.id}|${offset}|${todayKey}`;
          if (!notifiedTodayKeys.has(dedupeKey)) {
            notifiedTodayKeys.add(dedupeKey);
            await Notifications.scheduleNotificationAsync({
              content: {
                title: `${typeLabel}: ${ev.title}`,
                body: `${coreDesc} (Tap to open app & stop hourly alarm)`,
                sound: 'default',
                vibrate: [0, 280, 140, 280],
                data: { eventId: ev.id, ackKey, section: 'CALENDAR' }
              },
              trigger: Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null
            });
            immediateFired++;
          }
          // Next hourly nudge = 1 hour from right now!
          hourlyStart = new Date(now.getTime() + 60 * 60 * 1000);
        }

        if (hourlyStart.getTime() <= now.getTime() + 5000) {
          hourlyStart = new Date(now.getTime() + 60 * 60 * 1000);
        }

        // Schedule hourly follow-ups (up to 7 hourly repeats until 10:30 PM on that day)
        // for any unacknowledged occurrence landing within the next 3 days!
        const endOfFireDay = new Date(
          baseFire.getFullYear(),
          baseFire.getMonth(),
          baseFire.getDate(),
          22,
          30,
          0
        );
        const maxHourly = daysFromNow >= 0 && daysFromNow <= 3 ? 7 : 1;

        for (let h = 0; h < maxHourly; h++) {
          if (scheduledCount >= MAX_SLOTS) break;
          const slotDate = new Date(hourlyStart.getTime() + h * 60 * 60 * 1000);
          if (slotDate.getTime() <= now.getTime() + 5000) continue;
          if (h > 0 && slotDate.getTime() > endOfFireDay.getTime()) break;

          await Notifications.scheduleNotificationAsync({
            content: {
              title:
                h === 0
                  ? `${typeLabel}: ${ev.title}`
                  : `Hourly Reminder: ${ev.title}`,
              body:
                h === 0
                  ? `${coreDesc} (Repeats hourly until tapped)`
                  : `${coreDesc} — Open SecondBrain & tap to stop alarm`,
              sound: 'default',
              vibrate: [0, 280, 140, 280],
              data: { eventId: ev.id, ackKey, section: 'CALENDAR' }
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: slotDate,
              ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {})
            }
          });
          scheduledCount++;
        }
      }
    }

    return { scheduledCount, immediateFired };
  } catch (e) {
    return { scheduledCount: 0, immediateFired: 0, error: e?.message };
  }
}
