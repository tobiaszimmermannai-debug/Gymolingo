/**
 * Streak engine.
 *
 * Daily streaks (nutrition logging, protein goal, step goal, check-in, weight):
 *  - A day counts when its condition is fulfilled.
 *  - Today is "pending" until fulfilled – it never breaks a streak.
 *  - Paused days (vacation / sickness) neither count nor break the streak.
 *  - "Joker": up to N missed days per calendar month are bridged automatically
 *    (streak kept, day not counted). Duolingo-style streak freeze without
 *    having to buy anything.
 *
 * Training streak (adherence to the personal plan, counted in days):
 *  - Every day on which the weekly training quota is still reachable counts –
 *    rest days are part of the plan and therefore count as well.
 *  - The streak breaks on the day the weekly quota becomes impossible.
 *  - Paused days reduce the weekly quota proportionally.
 */
import type { ISODate } from '../dates';
import { addDays, dateRange, startOfWeek, weekdayIndex } from '../dates';

export type StreakKind = 'training' | 'nutrition' | 'protein' | 'steps' | 'checkin' | 'weight';

export const STREAK_LABELS_DE: Record<StreakKind, string> = {
  training: 'Trainingstreue',
  nutrition: 'Ernährungstracking',
  protein: 'Proteinziel',
  steps: 'Schrittziel',
  checkin: 'Täglicher Check-in',
  weight: 'Gewichtstracking',
};

export interface TrainingSchedule {
  type: 'fixed_days' | 'per_week';
  weekdays: number[]; // Mon = 0
  perWeek: number;
}

export interface Pause {
  start_date: ISODate;
  end_date: ISODate;
}

export interface StreakInput {
  today: ISODate;
  /** First day that counts (account creation / onboarding). */
  since: ISODate;
  schedule: TrainingSchedule;
  pauses: Pause[];
  jokersPerMonth: number;
  trainedDates: Set<ISODate>;
  nutritionDates: Set<ISODate>;
  proteinDates: Set<ISODate>;
  stepsDates: Set<ISODate>;
  checkinDates: Set<ISODate>;
  weightDates: Set<ISODate>;
  weightTrackingEnabled: boolean;
}

export interface StreakResult {
  kind: StreakKind;
  current: number;
  best: number;
  todayDone: boolean;
  /** Streak > 0 and today still has to be fulfilled to keep it. */
  atRisk: boolean;
  jokersLeftThisMonth: number;
  paused: boolean;
  /** Dates bridged by a joker (for the calendar UI). */
  jokerDates: ISODate[];
}

export function isPaused(date: ISODate, pauses: Pause[]): boolean {
  return pauses.some((p) => date >= p.start_date && date <= p.end_date);
}

export function computeDailyStreak(
  kind: StreakKind,
  doneDates: Set<ISODate>,
  input: Pick<StreakInput, 'today' | 'since' | 'pauses' | 'jokersPerMonth'>,
): StreakResult {
  const { today, since, pauses, jokersPerMonth } = input;
  let run = 0;
  let best = 0;
  const jokersUsed = new Map<string, number>();
  const jokerDates: ISODate[] = [];
  // Allow data before `since` (e.g. imported) to count as well.
  let first = since;
  for (const d of doneDates) if (d < first) first = d;

  for (const d of dateRange(first, today)) {
    if (isPaused(d, pauses)) continue;
    if (doneDates.has(d)) {
      run += 1;
      best = Math.max(best, run);
      continue;
    }
    if (d === today) break; // pending
    const month = d.slice(0, 7);
    const used = jokersUsed.get(month) ?? 0;
    if (run > 0 && used < jokersPerMonth) {
      jokersUsed.set(month, used + 1);
      jokerDates.push(d);
      continue;
    }
    run = 0;
  }
  const todayDone = doneDates.has(today);
  const paused = isPaused(today, pauses);
  return {
    kind,
    current: run,
    best,
    todayDone,
    atRisk: run > 0 && !todayDone && !paused,
    jokersLeftThisMonth: Math.max(0, jokersPerMonth - (jokersUsed.get(today.slice(0, 7)) ?? 0)),
    paused,
    jokerDates,
  };
}

/** Required sessions in a week given the schedule and paused / inactive days. */
export function weeklyQuota(schedule: TrainingSchedule, activeDays: ISODate[]): number {
  if (schedule.type === 'fixed_days') {
    return activeDays.filter((d) => schedule.weekdays.includes(weekdayIndex(d))).length;
  }
  return Math.round((Math.max(0, schedule.perWeek) * activeDays.length) / 7);
}

export function computeTrainingStreak(input: StreakInput): StreakResult & { weekDone: number; weekQuota: number; trainingNeededToday: boolean } {
  const { today, since, pauses, schedule, trainedDates } = input;
  let run = 0;
  let best = 0;
  let weekDone = 0;
  let weekQuota = 0;
  let trainingNeededToday = false;

  let first = since;
  for (const d of trainedDates) if (d < first) first = d;
  let weekStart = startOfWeek(first);

  while (weekStart <= today) {
    const days = dateRange(weekStart, addDays(weekStart, 6));
    const active = days.filter((d) => d >= first && !isPaused(d, pauses));
    const quota = weeklyQuota(schedule, active);
    let done = 0;
    for (const d of days) {
      if (d > today) break;
      if (d < first || isPaused(d, pauses)) continue;
      const trained = trainedDates.has(d);
      if (trained) done += 1;
      const remainingAfter = active.filter((x) => x > d).length;
      const feasible = done + remainingAfter >= quota;
      if (d === today) {
        weekDone = done;
        weekQuota = quota;
        if (trained || feasible) {
          run += 1;
        } else if (done + remainingAfter + 1 >= quota) {
          // today is required but not done yet → pending
          trainingNeededToday = true;
        } else {
          run = 0;
        }
        best = Math.max(best, run);
        break;
      }
      if (trained || feasible) {
        run += 1;
      } else {
        run = 0;
      }
      best = Math.max(best, run);
    }
    weekStart = addDays(weekStart, 7);
  }
  const paused = isPaused(today, pauses);
  return {
    kind: 'training',
    current: run,
    best,
    todayDone: trainedDates.has(today),
    atRisk: run > 0 && trainingNeededToday && !paused,
    jokersLeftThisMonth: 0,
    paused,
    jokerDates: [],
    weekDone,
    weekQuota,
    trainingNeededToday,
  };
}

export function computeAllStreaks(input: StreakInput): Record<StreakKind, StreakResult> {
  const common = { today: input.today, since: input.since, pauses: input.pauses, jokersPerMonth: input.jokersPerMonth };
  const training = computeTrainingStreak(input);
  const res: Record<StreakKind, StreakResult> = {
    training,
    nutrition: computeDailyStreak('nutrition', input.nutritionDates, common),
    protein: computeDailyStreak('protein', input.proteinDates, common),
    steps: computeDailyStreak('steps', input.stepsDates, common),
    checkin: computeDailyStreak('checkin', input.checkinDates, common),
    weight: input.weightTrackingEnabled
      ? computeDailyStreak('weight', input.weightDates, common)
      : { kind: 'weight', current: 0, best: 0, todayDone: false, atRisk: false, jokersLeftThisMonth: 0, paused: false, jokerDates: [] },
  };
  return res;
}

/** Is `date` a planned training day according to the schedule? */
export function isPlannedTrainingDay(schedule: TrainingSchedule, date: ISODate): boolean {
  if (schedule.type === 'fixed_days') return schedule.weekdays.includes(weekdayIndex(date));
  // per_week: suggest the days evenly (e.g. 3× → Mo/Mi/Fr)
  const n = Math.max(0, Math.min(7, schedule.perWeek));
  const suggested = suggestedWeekdays(n);
  return suggested.includes(weekdayIndex(date));
}

export function suggestedWeekdays(n: number): number[] {
  const presets: Record<number, number[]> = {
    0: [],
    1: [2],
    2: [0, 3],
    3: [0, 2, 4],
    4: [0, 1, 3, 4],
    5: [0, 1, 2, 3, 4],
    6: [0, 1, 2, 3, 4, 5],
    7: [0, 1, 2, 3, 4, 5, 6],
  };
  return presets[Math.max(0, Math.min(7, Math.round(n)))];
}

export const STREAK_MILESTONES = [7, 30, 60, 100, 180, 365];

export function nextMilestone(current: number): number | null {
  return STREAK_MILESTONES.find((m) => m > current) ?? null;
}
