/**
 * Progress dashboard aggregates for a selectable period with a comparison to
 * the preceding period of equal length. Uses real stored data only.
 */
import {
  startOfWeek,
  buildDailyActivities,
  computePersonalRecords,
  dailyBodyFat,
  dailyWeights,
  dateRange,
  dayNutrition,
  firstDataDate,
  isDayLogged,
  movingAverage,
  periodRange,
  setsPerMuscle,
  strengthChange,
  stepsByDate,
  volumeSeries,
  type ExerciseDef,
  type ISODate,
  type PeriodKey,
  type UserData,
} from '@gymolingo/core';

export interface PeriodStats {
  workouts: number;
  volumeKg: number;
  workingSets: number;
  avgKcal: number | null;
  avgProtein: number | null;
  nutritionDays: number;
  proteinDays: number;
  avgSteps: number | null;
  stepGoalDays: number;
  avgWeight: number | null;
  checkins: number;
}

function stats(data: UserData, from: ISODate, to: ISODate): PeriodStats {
  const acts = buildDailyActivities(data, from, to);
  const days = dateRange(from, to).map((d) => dayNutrition(d, data.meals));
  const logged = days.filter((d) => isDayLogged(d, data.profile.calorie_target));
  const steps = [...stepsByDate(data.steps).entries()].filter(([d]) => d >= from && d <= to).map(([, e]) => e.steps);
  const w = dailyWeights(data.weights).filter((p) => p.date >= from && p.date <= to);
  const sessionIds = new Set(data.sessions.filter((s) => !s.deleted && s.status === 'completed' && s.date >= from && s.date <= to).map((s) => s.id));
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  return {
    workouts: sessionIds.size,
    volumeKg: Math.round(data.sets.filter((s) => !s.deleted && s.completed && s.set_type !== 'warmup' && sessionIds.has(s.session_id)).reduce((a, s) => a + s.weight_kg * s.reps, 0)),
    workingSets: acts.reduce((a, x) => a + x.workingSets, 0),
    avgKcal: avg(logged.map((d) => d.totals.kcal)),
    avgProtein: avg(logged.map((d) => d.totals.protein_g)),
    nutritionDays: logged.length,
    proteinDays: acts.filter((a) => a.proteinHit).length,
    avgSteps: avg(steps),
    stepGoalDays: acts.filter((a) => a.stepsHit).length,
    avgWeight: avg(w.map((p) => p.weight)),
    checkins: acts.filter((a) => a.checkin).length,
  };
}

export function computeProgress(data: UserData, period: PeriodKey, today: ISODate, lookup: (id: string) => ExerciseDef | undefined) {
  const first = firstDataDate(data) ?? today;
  const r = periodRange(period, today, first);
  const cur = stats(data, r.from, r.to);
  const prev = stats(data, r.prevFrom, r.prevTo);
  const bucket: 'day' | 'week' = r.days <= 31 ? 'day' : 'week';

  const weightDaily = dailyWeights(data.weights);
  const weightAvg = movingAverage(weightDaily, 7).filter((p) => p.date >= r.from);
  const weightInRange = weightDaily.filter((p) => p.date >= r.from);
  const bodyFat = dailyBodyFat(data.weights).filter((p) => p.date >= r.from);

  const volume = volumeSeries(data.sessions, data.sets, r.from, r.to, bucket);
  const stepMap = stepsByDate(data.steps);
  const daysList = dateRange(r.from, r.to);

  // for long ranges aggregate nutrition/steps weekly (averages of logged days)
  const aggregate = (values: { date: ISODate; y: number | null }[]) => {
    if (bucket === 'day') return values.map((v) => ({ x: v.date, y: v.y ?? 0 }));
    const m = new Map<string, number[]>();
    for (const v of values) {
      if (v.y === null) continue;
      const k = startOfWeek(v.date);
      m.set(k, [...(m.get(k) ?? []), v.y]);
    }
    return [...m.entries()].sort().map(([x, ys]) => ({ x, y: Math.round(ys.reduce((a, b) => a + b, 0) / ys.length) }));
  };

  const nutritionDays = daysList.map((d) => dayNutrition(d, data.meals));
  const kcalSeries = aggregate(nutritionDays.map((d) => ({ date: d.date, y: d.entries ? d.totals.kcal : bucket === 'day' ? 0 : null })));
  const proteinSeries = aggregate(nutritionDays.map((d) => ({ date: d.date, y: d.entries ? d.totals.protein_g : bucket === 'day' ? 0 : null })));
  const stepsSeries = aggregate(daysList.map((d) => ({ date: d, y: stepMap.get(d)?.steps ?? (bucket === 'day' ? 0 : null) })));

  const strength = strengthChange(data.sessions, data.sets, { from: r.from, to: r.to }, { from: r.prevFrom, to: r.prevTo });
  const { events } = computePersonalRecords(data.sessions, data.sets);
  const prs = events.filter((e) => e.date >= r.from && e.date <= r.to);
  const muscles = setsPerMuscle(data.sets, data.sessions, lookup, r.from, r.to);

  return { range: r, cur, prev, bucket, weightInRange, weightAvg, bodyFat, volume, kcalSeries, proteinSeries, stepsSeries, strength, prs, muscles };
}

/** Relative change in % (null if no comparison possible). */
export function pctChange(cur: number | null, prev: number | null): number | null {
  if (cur === null || prev === null || prev === 0) return null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}
