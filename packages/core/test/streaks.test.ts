import { describe, expect, it } from 'vitest';
import { computeDailyStreak, computeTrainingStreak, weeklyQuota, isPlannedTrainingDay, nextMilestone, type StreakInput } from '../src/streaks/streaks';
import { dateRange } from '../src/dates';

const common = { today: '2026-03-10', since: '2026-03-01', pauses: [], jokersPerMonth: 0 };

describe('daily streak', () => {
  it('counts consecutive days, today pending does not break', () => {
    const done = new Set(dateRange('2026-03-05', '2026-03-09'));
    const r = computeDailyStreak('protein', done, common);
    expect(r.current).toBe(5);
    expect(r.todayDone).toBe(false);
    expect(r.atRisk).toBe(true);
  });
  it('today done counts', () => {
    const done = new Set(dateRange('2026-03-05', '2026-03-10'));
    expect(computeDailyStreak('protein', done, common).current).toBe(6);
  });
  it('a missed day breaks the streak, best is kept', () => {
    const done = new Set([...dateRange('2026-03-01', '2026-03-05'), '2026-03-07', '2026-03-08']);
    const r = computeDailyStreak('steps', done, { ...common, today: '2026-03-08' });
    expect(r.current).toBe(2);
    expect(r.best).toBe(5);
  });
  it('pauses (vacation) neither count nor break', () => {
    const done = new Set([...dateRange('2026-03-01', '2026-03-03'), ...dateRange('2026-03-07', '2026-03-09')]);
    const r = computeDailyStreak('checkin', done, { ...common, today: '2026-03-09', pauses: [{ start_date: '2026-03-04', end_date: '2026-03-06' }] });
    expect(r.current).toBe(6);
  });
  it('jokers bridge missed days (limited per month)', () => {
    const done = new Set([...dateRange('2026-03-01', '2026-03-03'), ...dateRange('2026-03-05', '2026-03-06'), '2026-03-08']);
    const r1 = computeDailyStreak('nutrition', done, { ...common, today: '2026-03-08', jokersPerMonth: 2 });
    expect(r1.current).toBe(6);
    expect(r1.jokerDates).toEqual(['2026-03-04', '2026-03-07']);
    expect(r1.jokersLeftThisMonth).toBe(0);
    const r2 = computeDailyStreak('nutrition', done, { ...common, today: '2026-03-08', jokersPerMonth: 1 });
    expect(r2.current).toBe(1);
  });
  it('joker is not wasted before a streak started', () => {
    const done = new Set(['2026-03-05']);
    const r = computeDailyStreak('nutrition', done, { ...common, today: '2026-03-05', jokersPerMonth: 1 });
    expect(r.jokersLeftThisMonth).toBe(1);
  });
});

describe('training streak', () => {
  const base = (trained: string[], today: string, extra: Partial<StreakInput> = {}): StreakInput => ({
    today,
    since: '2026-03-02', // Monday
    schedule: { type: 'per_week', weekdays: [], perWeek: 3 },
    pauses: [],
    jokersPerMonth: 0,
    trainedDates: new Set(trained),
    nutritionDates: new Set(),
    proteinDates: new Set(),
    stepsDates: new Set(),
    checkinDates: new Set(),
    weightDates: new Set(),
    weightTrackingEnabled: false,
    ...extra,
  });

  it('rest days count while the weekly quota is reachable', () => {
    const r = computeTrainingStreak(base(['2026-03-02', '2026-03-04', '2026-03-06'], '2026-03-08'));
    expect(r.current).toBe(7);
    expect(r.weekDone).toBe(3);
    expect(r.weekQuota).toBe(3);
  });
  it('breaks when the quota becomes impossible and restarts next week', () => {
    // only 1 workout in week 1 -> impossible from Saturday on (1 + 1 remaining < 3)
    const r = computeTrainingStreak(base(['2026-03-02', '2026-03-09'], '2026-03-10'));
    expect(r.best).toBe(5);
    expect(r.current).toBe(2);
  });
  it('flags training needed today', () => {
    // Sat: 2 done + Sunday left → rest day ok; Sun: 2 done, nothing left → training needed today
    expect(computeTrainingStreak(base(['2026-03-02', '2026-03-06'], '2026-03-07')).trainingNeededToday).toBe(false);
    const r = computeTrainingStreak(base(['2026-03-02', '2026-03-06'], '2026-03-08'));
    expect(r.trainingNeededToday).toBe(true);
    expect(r.atRisk).toBe(true);
  });
  it('fixed weekdays quota and paused days reduce the quota', () => {
    const sched = { type: 'fixed_days' as const, weekdays: [0, 2, 4], perWeek: 3 };
    expect(weeklyQuota(sched, dateRange('2026-03-02', '2026-03-08'))).toBe(3);
    expect(weeklyQuota(sched, dateRange('2026-03-05', '2026-03-08'))).toBe(1);
    const r = computeTrainingStreak(base(['2026-03-06'], '2026-03-08', { schedule: sched, pauses: [{ start_date: '2026-03-02', end_date: '2026-03-04' }] }));
    expect(r.current).toBe(4);
  });
  it('planned days', () => {
    expect(isPlannedTrainingDay({ type: 'fixed_days', weekdays: [0], perWeek: 1 }, '2026-03-02')).toBe(true);
    expect(isPlannedTrainingDay({ type: 'per_week', weekdays: [], perWeek: 3 }, '2026-03-04')).toBe(true);
    expect(isPlannedTrainingDay({ type: 'per_week', weekdays: [], perWeek: 3 }, '2026-03-03')).toBe(false);
  });
  it('milestones', () => {
    expect(nextMilestone(5)).toBe(7);
    expect(nextMilestone(30)).toBe(60);
  });
});
