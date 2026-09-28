/**
 * Builds per-day aggregates from raw rows. Shared by the app (Home, Progress,
 * streaks, gamification) and the edge functions (weekly report) so that all
 * numbers are computed by the same, testable code.
 */
import type { ISODate } from '../dates';
import { dateRange } from '../dates';
import { dayNutrition, isCaloriesOnTarget, isDayLogged, isProteinHit } from '../nutrition/calc';
import type { StreakInput } from '../streaks/streaks';
import { suggestedWeekdays } from '../streaks/streaks';
import { computePersonalRecords, isWorkingSet } from '../training/stats';
import type { DailyActivity } from '../gamification/xp';
import { emptyActivity } from '../gamification/xp';
import type {
  AthleteProfile,
  DailyCheckin,
  MealEntry,
  StepEntry,
  StreakPause,
  WeightEntry,
  WorkoutSession,
  WorkoutSet,
} from '../types';

export interface UserData {
  profile: AthleteProfile;
  sessions: WorkoutSession[];
  sets: WorkoutSet[];
  meals: MealEntry[];
  weights: WeightEntry[];
  steps: StepEntry[];
  checkins: DailyCheckin[];
  pauses: StreakPause[];
}

/**
 * Steps of a day: a manual entry always wins (the user deliberately entered it);
 * otherwise the highest value reported by a health source.
 */
export function stepsByDate(entries: StepEntry[]): Map<ISODate, StepEntry> {
  const out = new Map<ISODate, StepEntry>();
  for (const e of entries) {
    if (e.deleted) continue;
    const cur = out.get(e.date);
    if (!cur) {
      out.set(e.date, e);
      continue;
    }
    const curManual = cur.source === 'manual';
    const eManual = e.source === 'manual';
    if (eManual && !curManual) out.set(e.date, e);
    else if (eManual && curManual && e.updated_at > cur.updated_at) out.set(e.date, e);
    else if (!eManual && !curManual && e.steps > cur.steps) out.set(e.date, e);
  }
  return out;
}

export function trainedDates(sessions: WorkoutSession[]): Set<ISODate> {
  return new Set(sessions.filter((s) => !s.deleted && s.status === 'completed').map((s) => s.date));
}

export function buildDailyActivities(data: UserData, from: ISODate, to: ISODate): DailyActivity[] {
  const { profile } = data;
  const map = new Map<ISODate, DailyActivity>();
  const get = (d: ISODate) => {
    let a = map.get(d);
    if (!a) {
      a = emptyActivity(d);
      map.set(d, a);
    }
    return a;
  };
  const inRange = (d: ISODate) => d >= from && d <= to;

  const completed = data.sessions.filter((s) => !s.deleted && s.status === 'completed');
  const sessionDate = new Map(completed.map((s) => [s.id, s.date]));
  for (const s of completed) if (inRange(s.date)) get(s.date).workouts += 1;
  for (const set of data.sets) {
    if (!isWorkingSet(set)) continue;
    const d = sessionDate.get(set.session_id);
    if (d && inRange(d)) get(d).workingSets += 1;
  }
  const { events } = computePersonalRecords(data.sessions, data.sets);
  // count at most one PR per exercise & session
  const prKeys = new Set<string>();
  for (const e of events) {
    const k = `${e.session_id}:${e.exercise_id}`;
    if (prKeys.has(k) || !inRange(e.date)) continue;
    prKeys.add(k);
    get(e.date).prs += 1;
  }

  const mealDates = new Set(data.meals.filter((m) => !m.deleted && inRange(m.date)).map((m) => m.date));
  for (const d of mealDates) {
    const day = dayNutrition(d, data.meals);
    const a = get(d);
    a.mealEntries = day.entries;
    a.nutritionLogged = isDayLogged(day, profile.calorie_target);
    a.proteinHit = isProteinHit(day, profile.protein_target_g);
    a.caloriesOnTarget = isCaloriesOnTarget(day, profile.calorie_target);
  }

  for (const [d, e] of stepsByDate(data.steps)) {
    if (!inRange(d)) continue;
    const a = get(d);
    a.steps = e.steps;
    a.stepsHit = profile.step_target > 0 && e.steps >= profile.step_target;
  }
  for (const c of data.checkins) if (!c.deleted && inRange(c.date)) get(c.date).checkin = true;
  for (const w of data.weights) if (!w.deleted && inRange(w.date)) get(w.date).weighed = true;

  return [...map.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function firstDataDate(data: UserData): ISODate | null {
  const dates: ISODate[] = [];
  const push = (d?: string | null) => d && dates.push(d);
  data.sessions.forEach((s) => !s.deleted && push(s.date));
  data.meals.forEach((m) => !m.deleted && push(m.date));
  data.weights.forEach((w) => !w.deleted && push(w.date));
  data.steps.forEach((s) => !s.deleted && push(s.date));
  data.checkins.forEach((c) => !c.deleted && push(c.date));
  if (!dates.length) return null;
  return dates.reduce((m, d) => (d < m ? d : m));
}

export function buildStreakInput(data: UserData, today: ISODate, since: ISODate, jokersPerMonth = 2): StreakInput {
  const acts = buildDailyActivities(data, '0000-01-01', today);
  const p = data.profile;
  return {
    today,
    since,
    schedule: {
      type: p.schedule_type,
      weekdays: p.schedule_type === 'fixed_days' && p.training_weekdays.length ? p.training_weekdays : suggestedWeekdays(p.training_days_per_week),
      perWeek: p.training_days_per_week,
    },
    pauses: data.pauses.filter((x) => !x.deleted),
    jokersPerMonth,
    trainedDates: trainedDates(data.sessions),
    nutritionDates: new Set(acts.filter((a) => a.nutritionLogged).map((a) => a.date)),
    proteinDates: new Set(acts.filter((a) => a.proteinHit).map((a) => a.date)),
    stepsDates: new Set(acts.filter((a) => a.stepsHit).map((a) => a.date)),
    checkinDates: new Set(acts.filter((a) => a.checkin).map((a) => a.date)),
    weightDates: new Set(acts.filter((a) => a.weighed).map((a) => a.date)),
    weightTrackingEnabled: p.weight_tracking_enabled,
  };
}

export function daysBetween(from: ISODate, to: ISODate): ISODate[] {
  return dateRange(from, to);
}
