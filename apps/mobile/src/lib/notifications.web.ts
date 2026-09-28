/**
 * Web fallback: uses the browser Notification API while the app tab is open.
 * (Background push on the web would require a service worker + VAPID keys –
 * the mobile apps use native local notifications instead.)
 */
import type { PlannedReminder } from '@gymolingo/core';

const timers: ReturnType<typeof setTimeout>[] = [];
const hasApi = typeof window !== 'undefined' && 'Notification' in window;

export function configureNotifications() {}

export async function notificationPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (!hasApi) return 'denied';
  return Notification.permission === 'granted' ? 'granted' : Notification.permission === 'denied' ? 'denied' : 'undetermined';
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!hasApi) return false;
  if (Notification.permission === 'granted') return true;
  return (await Notification.requestPermission()) === 'granted';
}

export async function scheduleReminders(list: PlannedReminder[]): Promise<number> {
  timers.splice(0).forEach(clearTimeout);
  if (!hasApi || Notification.permission !== 'granted') return 0;
  const now = Date.now();
  let n = 0;
  for (const r of list) {
    const [y, m, d] = r.date.split('-').map(Number);
    const [hh, mm] = r.time.split(':').map(Number);
    const delay = new Date(y, m - 1, d, hh, mm).getTime() - now;
    if (delay <= 0 || delay > 24 * 3600_000) continue;
    timers.push(
      setTimeout(() => {
        const notif = new Notification(r.title, { body: r.body, tag: r.id });
        notif.onclick = () => {
          window.focus();
          window.location.assign(r.route);
        };
      }, delay),
    );
    n++;
  }
  return n;
}

export const notificationsSupported = hasApi;
