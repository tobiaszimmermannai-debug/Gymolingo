import { describe, expect, it } from 'vitest';
import { xpForDay, levelFromXp, xpForLevel, earnedBadgeIds, weeklyChallenges, summarizeGamification, emptyActivity, BADGES, type BadgeStats } from '../src/gamification/xp';

describe('xp & levels', () => {
  it('xp rewards behaviour with caps', () => {
    const a = { ...emptyActivity('2026-03-02'), workouts: 1, workingSets: 30, prs: 10, mealEntries: 10, nutritionLogged: true, proteinHit: true, stepsHit: true, checkin: true, weighed: true };
    expect(xpForDay(a)).toBe(50 + 40 + 100 + 20 + 15 + 20 + 15 + 10 + 5);
    expect(xpForDay(emptyActivity('2026-03-02'))).toBe(0);
  });
  it('level curve is monotonic', () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(xpForLevel(5)).level).toBe(5);
    expect(levelFromXp(xpForLevel(5) - 1).level).toBe(4);
    for (let l = 2; l < 60; l++) expect(xpForLevel(l + 1)).toBeGreaterThan(xpForLevel(l));
  });
});

describe('badges', () => {
  const stats: BadgeStats = {
    totalWorkouts: 12, totalPRs: 1, totalVolumeKg: 120000, nutritionDays: 7, proteinDays: 3, stepGoalDays: 0, maxStepsDay: 21000, checkins: 0, weighIns: 0,
    bestStreaks: { training: 31, nutrition: 7, protein: 0, steps: 0, checkin: 0, weight: 0 }, level: 3, challengesCompleted: 0, friends: 0, earlyWorkouts: 0,
  };
  it('earns badges from stats incl. streak milestones', () => {
    const ids = earnedBadgeIds(stats);
    expect(ids).toEqual(expect.arrayContaining(['first-workout', 'workouts-10', 'first-pr', 'volume-100t', 'steps-20k', 'nutrition-7', 'streak-training-7', 'streak-training-30', 'streak-nutrition-7']));
    expect(ids).not.toContain('streak-training-60');
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
  });
});

describe('weekly challenges', () => {
  it('deterministic, includes plan challenge, tracks progress', () => {
    const acts = ['2026-03-02', '2026-03-04', '2026-03-06'].map((d) => ({ ...emptyActivity(d), workouts: 1, proteinHit: true, nutritionLogged: true, steps: 12000, stepsHit: true, checkin: true, workingSets: 16 }));
    const a = weeklyChallenges('2026-03-04', acts, { plannedWorkouts: 3, stepTarget: 10000 });
    const b = weeklyChallenges('2026-03-02', acts, { plannedWorkouts: 3, stepTarget: 10000 });
    expect(a).toEqual(b);
    expect(a).toHaveLength(3);
    expect(a[0].metric).toBe('workouts');
    expect(a[0].completed).toBe(true);
    expect(new Set(a.map((c) => c.metric)).size).toBe(3);
  });
  it('summary adds challenge xp', () => {
    const acts = ['2026-03-02', '2026-03-04', '2026-03-06'].map((d) => ({ ...emptyActivity(d), workouts: 1 }));
    const s = summarizeGamification(acts, '2026-03-06', { plannedWorkouts: 3, stepTarget: 10000 });
    expect(s.challengesCompleted).toBe(1);
    expect(s.totalXp).toBe(150 + 100);
    expect(s.xpThisWeek).toBe(250);
    expect(s.xpToday).toBe(50);
  });
});
