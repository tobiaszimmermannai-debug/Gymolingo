/**
 * Date helpers working on local calendar dates in `YYYY-MM-DD` format.
 * All day-based logic (streaks, nutrition days, steps) uses these ISO date strings
 * so that it is independent of time zones once a date has been assigned.
 */

export type ISODate = string; // YYYY-MM-DD

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date of a Date object. */
export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(now: Date = new Date()): ISODate {
  return toISODate(now);
}

/** Parses YYYY-MM-DD as a local date at 12:00 (avoids DST edge cases). */
export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function addDays(date: ISODate, days: number): ISODate {
  const d = parseISODate(date);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Whole days from a to b (b - a). */
export function diffDays(a: ISODate, b: ISODate): number {
  const ms = parseISODate(b).getTime() - parseISODate(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** Weekday index with Monday = 0 … Sunday = 6. */
export function weekdayIndex(date: ISODate): number {
  const js = parseISODate(date).getDay(); // 0 = Sunday
  return (js + 6) % 7;
}

/** Monday of the ISO week containing `date`. */
export function startOfWeek(date: ISODate): ISODate {
  return addDays(date, -weekdayIndex(date));
}

export function endOfWeek(date: ISODate): ISODate {
  return addDays(startOfWeek(date), 6);
}

export function startOfMonth(date: ISODate): ISODate {
  return `${date.slice(0, 7)}-01`;
}

/** Inclusive list of dates from `from` to `to`. */
export function dateRange(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  if (from > to) return out;
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function isBetween(date: ISODate, from: ISODate, to: ISODate): boolean {
  return date >= from && date <= to;
}

/** ISO week number (1–53) – used as a stable seed for weekly challenges. */
export function isoWeekNumber(date: ISODate): { year: number; week: number } {
  const d = parseISODate(date);
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4, 12);
  const week =
    1 + Math.round(((target.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
  return { year: target.getFullYear(), week };
}

/** "HH:MM" -> minutes since midnight. */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

export function ageFromBirthYear(birthYear: number, now: Date = new Date()): number {
  return now.getFullYear() - birthYear;
}

export type PeriodKey = '7d' | '30d' | '90d' | '6m' | '1y' | 'all';

export const PERIOD_DAYS: Record<Exclude<PeriodKey, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '6m': 182,
  '1y': 365,
};

/**
 * Resolves a period to an inclusive date range ending today, plus the directly
 * preceding range of equal length (for "vs. previous period" comparisons).
 */
export function periodRange(
  period: PeriodKey,
  today: ISODate,
  firstDataDate?: ISODate,
): { from: ISODate; to: ISODate; prevFrom: ISODate; prevTo: ISODate; days: number } {
  let days: number;
  if (period === 'all') {
    days = firstDataDate ? Math.max(1, diffDays(firstDataDate, today) + 1) : 30;
  } else {
    days = PERIOD_DAYS[period];
  }
  const from = addDays(today, -(days - 1));
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(days - 1));
  return { from, to: today, prevFrom, prevTo, days };
}

export const WEEKDAY_SHORT_DE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const WEEKDAY_LONG_DE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

export function formatDateDE(date: ISODate, withWeekday = false): string {
  const d = parseISODate(date);
  const s = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`;
  return withWeekday ? `${WEEKDAY_SHORT_DE[weekdayIndex(date)]}, ${s}` : s;
}
