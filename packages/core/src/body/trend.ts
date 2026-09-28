import type { ISODate } from '../dates';
import { addDays, dateRange, diffDays } from '../dates';
import type { WeightEntry } from '../types';

export interface WeightPoint {
  date: ISODate;
  weight: number;
}

/** One value per date (latest `updated_at` wins), sorted ascending. */
export function dailyWeights(entries: WeightEntry[]): WeightPoint[] {
  const byDate = new Map<string, WeightEntry>();
  for (const e of entries) {
    if (e.deleted || !(e.weight_kg > 0)) continue;
    const cur = byDate.get(e.date);
    if (!cur || cur.updated_at < e.updated_at) byDate.set(e.date, e);
  }
  return [...byDate.values()]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((e) => ({ date: e.date, weight: e.weight_kg }));
}

export function dailyBodyFat(entries: WeightEntry[]): { date: ISODate; value: number }[] {
  const byDate = new Map<string, WeightEntry>();
  for (const e of entries) {
    if (e.deleted || e.body_fat_pct === null || e.body_fat_pct === undefined) continue;
    const cur = byDate.get(e.date);
    if (!cur || cur.updated_at < e.updated_at) byDate.set(e.date, e);
  }
  return [...byDate.values()]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((e) => ({ date: e.date, value: e.body_fat_pct as number }));
}

/**
 * Trailing moving average over `windowDays` calendar days (not entries), so
 * missing days do not distort the window. Returns a value for each date that has
 * at least one weigh-in inside the window.
 */
export function movingAverage(points: WeightPoint[], windowDays = 7): WeightPoint[] {
  if (!points.length) return [];
  const out: WeightPoint[] = [];
  const first = points[0].date;
  const last = points[points.length - 1].date;
  const map = new Map(points.map((p) => [p.date, p.weight]));
  for (const d of dateRange(first, last)) {
    const window = dateRange(addDays(d, -(windowDays - 1)), d)
      .map((x) => map.get(x))
      .filter((x): x is number => x !== undefined);
    if (window.length && map.has(d)) {
      out.push({ date: d, weight: Math.round((window.reduce((a, b) => a + b, 0) / window.length) * 100) / 100 });
    }
  }
  return out;
}

/**
 * Exponentially smoothed trend weight (Hacker's Diet style, α = 0.1 per day).
 * Handles gaps by applying the decay per missing day.
 */
export function smoothedTrend(points: WeightPoint[], alpha = 0.1): WeightPoint[] {
  const out: WeightPoint[] = [];
  let trend: number | null = null;
  let lastDate: ISODate | null = null;
  for (const p of points) {
    if (trend === null || lastDate === null) {
      trend = p.weight;
    } else {
      const gap = Math.max(1, diffDays(lastDate, p.date));
      const a = 1 - Math.pow(1 - alpha, gap);
      trend = trend + a * (p.weight - trend);
    }
    lastDate = p.date;
    out.push({ date: p.date, weight: Math.round(trend * 100) / 100 });
  }
  return out;
}

/** Least-squares slope in kg per day. */
export function linearSlope(points: WeightPoint[]): number | null {
  if (points.length < 2) return null;
  const x0 = points[0].date;
  const xs = points.map((p) => diffDays(x0, p.date));
  const ys = points.map((p) => p.weight);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (den === 0) return null;
  return num / den;
}

export interface WeightSummary {
  latest: WeightPoint | null;
  avg7: number | null;
  avg7Prev: number | null;
  /** kg per week over the last 30 days (linear regression), null if < 2 weeks of data */
  weeklyRate30: number | null;
  change30: number | null;
  daysLogged30: number;
  trend: WeightPoint[];
}

export function weightSummary(entries: WeightEntry[], today: ISODate): WeightSummary {
  const pts = dailyWeights(entries);
  const inRange = (from: ISODate, to: ISODate) => pts.filter((p) => p.date >= from && p.date <= to);
  const mean = (arr: WeightPoint[]) => (arr.length ? Math.round((arr.reduce((a, p) => a + p.weight, 0) / arr.length) * 100) / 100 : null);
  const last7 = inRange(addDays(today, -6), today);
  const prev7 = inRange(addDays(today, -13), addDays(today, -7));
  const last30 = inRange(addDays(today, -29), today);
  const span = last30.length >= 2 ? diffDays(last30[0].date, last30[last30.length - 1].date) : 0;
  const slope = span >= 13 && last30.length >= 4 ? linearSlope(last30) : null;
  return {
    latest: pts.length ? pts[pts.length - 1] : null,
    avg7: mean(last7),
    avg7Prev: mean(prev7),
    weeklyRate30: slope === null ? null : Math.round(slope * 7 * 100) / 100,
    change30: last30.length >= 2 ? Math.round((last30[last30.length - 1].weight - last30[0].weight) * 100) / 100 : null,
    daysLogged30: last30.length,
    trend: smoothedTrend(pts),
  };
}

/** Body-mass index (informational only). */
export function bmi(weightKg: number, heightCm: number): number {
  return Math.round((weightKg / Math.pow(heightCm / 100, 2)) * 10) / 10;
}
