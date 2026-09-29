import { describe, expect, it } from 'vitest';
import { burnedOn, cardioKcal, cardioMet, cardioSummary, formatPace, withExerciseCalories } from '../src/cardio/energy';
import type { CardioSession } from '../src/types';

const s = (v: Partial<CardioSession>): CardioSession =>
  ({ id: v.date ?? 'x', user_id: 'u', created_at: '', updated_at: '', deleted: false, date: '2026-09-29', activity: 'jog', duration_min: 30, distance_km: null, intensity: 'medium', kcal: 0, kcal_manual: false, note: null, ...v }) as CardioSession;

describe('cardio energy', () => {
  it('running: 5 km in 30 min (10 km/h) at 80 kg ≈ 400 kcal', () => {
    expect(cardioMet('run', 'medium', 30, 5)).toBeCloseTo(9.98, 1);
    expect(cardioKcal({ activity: 'run', intensity: 'medium', duration_min: 30, distance_km: 5 }, 80)).toBe(400);
  });
  it('faster is more intense; pace formatting', () => {
    const slow = cardioKcal({ activity: 'jog', intensity: 'medium', duration_min: 30, distance_km: 4 }, 80);
    const fast = cardioKcal({ activity: 'run', intensity: 'medium', duration_min: 30, distance_km: 6.5 }, 80);
    expect(fast).toBeGreaterThan(slow + 100);
    expect(formatPace(30, 5)).toBe('6:00');
    expect(formatPace(27.5, 5)).toBe('5:30');
    expect(formatPace(30, null)).toBeNull();
  });
  it('walking without distance uses the intensity; 5 km/h walk for 60 min at 70 kg ≈ 260 kcal', () => {
    const k = cardioKcal({ activity: 'walk', intensity: 'medium', duration_min: 60, distance_km: null }, 70);
    expect(k).toBeGreaterThan(240);
    expect(k).toBeLessThan(290);
    expect(cardioKcal({ activity: 'walk', intensity: 'light', duration_min: 60, distance_km: null }, 70)).toBeLessThan(k);
  });
  it('a fast "walk" is rated like jogging', () => {
    expect(cardioMet('walk', 'medium', 60, 8)).toBeCloseTo(cardioMet('jog', 'medium', 60, 8), 5);
  });
  it('EMS 20 min at 80 kg: light / medium / intense', () => {
    const k = (i: 'light' | 'medium' | 'intense') => cardioKcal({ activity: 'ems', intensity: i, duration_min: 20, distance_km: null }, 80);
    expect([k('light'), k('medium'), k('intense')]).toEqual([93, 120, 147]);
  });
  it('invalid input → 0 kcal', () => {
    expect(cardioKcal({ activity: 'run', intensity: 'medium', duration_min: 0, distance_km: 5 }, 80)).toBe(0);
  });
  it('summary, burned per day and optional exercise calories in the target', () => {
    const rows = [s({ date: '2026-09-28', kcal: 300, distance_km: 5 }), s({ date: '2026-09-29', activity: 'ems', kcal: 147 }), s({ date: '2026-09-29', kcal: 200, deleted: true })];
    expect(cardioSummary(rows, '2026-09-23', '2026-09-29')).toMatchObject({ sessions: 2, minutes: 60, km: 5, kcal: 447, byActivity: { jog: 1, ems: 1 } });
    expect(burnedOn('2026-09-29', rows)).toBe(147);
    const p = { calorie_target: 2400, carbs_target_g: 250, add_exercise_calories: false };
    expect(withExerciseCalories(p, 147)).toBe(p);
    expect(withExerciseCalories({ ...p, add_exercise_calories: true }, 200)).toMatchObject({ calorie_target: 2600, carbs_target_g: 300 });
  });
});

import { buildWeeklyReport, renderWeeklyReportText } from '../src/coach/report';
import { buildCoachContext } from '../src/coach/context';
import { answerOffline } from '../src/coach/offline';
import { buildStreakInput, trainedDates } from '../src/data/aggregate';
import { emptyData, profile } from './fixtures';

describe('cardio in reports, coach and streaks', () => {
  const data = emptyData({
    profile: profile({ training_days_per_week: 3 }),
    cardio: [
      s({ id: 'a', date: '2026-09-22', activity: 'ems', intensity: 'intense', duration_min: 20, kcal: 147 }),
      s({ id: 'b', date: '2026-09-24', activity: 'jog', duration_min: 30, distance_km: 5, kcal: 380 }),
      s({ id: 'c', date: '2026-09-25', activity: 'walk', duration_min: 45, kcal: 190 }),
    ],
  });
  it('jog/run/EMS count as trainings, walking does not', () => {
    expect([...trainedDates([], data.cardio)].sort()).toEqual(['2026-09-22', '2026-09-24']);
    expect(buildStreakInput(data, '2026-09-28', '2026-09-01').trainedDates.size).toBe(2);
  });
  it('weekly report lists endurance & EMS', () => {
    const stats = buildWeeklyReport(data, '2026-09-22');
    expect(stats.consistency.workoutsDone).toBe(2);
    expect(stats.consistency.cardio).toMatchObject({ sessions: 3, minutes: 95, km: 5, kcal: 717 });
    expect(renderWeeklyReportText(stats).sections[1].body).toContain('EMS-Training 1×');
  });
  it('offline coach answers questions about running / EMS', () => {
    const ctx = buildCoachContext(data, '2026-09-28');
    expect(ctx.cardio_28_days.sessions).toBe(3);
    expect(answerOffline(ctx, 'Wie viel habe ich beim Laufen verbrannt?')).toContain('717 kcal');
  });
});
