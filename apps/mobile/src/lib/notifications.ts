/**
 * Local notifications (iOS/Android) for the reminder engine.
 * All reminders are scheduled on-device, so they work offline and without a
 * push server. Rescheduled whenever relevant data changes.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import type { PlannedReminder } from '@gymolingo/core';

const CHANNEL = 'reminders';
let configured = false;

export function configureNotifications() {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Erinnerungen',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#C6F432',
    }).catch(() => undefined);
  }
  Notifications.addNotificationResponseReceivedListener((resp) => {
    const route = resp.notification.request.content.data?.route;
    if (typeof route === 'string') router.push(route as never);
  });
}

export async function notificationPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  const p = await Notifications.getPermissionsAsync();
  return p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';
}

export async function requestNotificationPermission(): Promise<boolean> {
  configureNotifications();
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  const res = await Notifications.requestPermissionsAsync();
  return res.granted;
}

/** Replaces all scheduled reminders with the given list (future ones only). */
export async function scheduleReminders(list: PlannedReminder[]): Promise<number> {
  configureNotifications();
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return 0;
  await Notifications.cancelAllScheduledNotificationsAsync();
  const now = Date.now();
  let n = 0;
  // iOS allows at most 64 pending local notifications
  for (const r of list.slice(0, 60)) {
    const [y, m, d] = r.date.split('-').map(Number);
    const [hh, mm] = r.time.split(':').map(Number);
    const at = new Date(y, m - 1, d, hh, mm, 0, 0);
    if (at.getTime() <= now + 30_000) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: { title: r.title, body: r.body, data: { route: r.route, category: r.category } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: Platform.OS === 'android' ? CHANNEL : undefined },
    });
    n++;
  }
  return n;
}

export const notificationsSupported = true;
