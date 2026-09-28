import { describe, expect, it } from 'vitest';
import { generateDemoData } from '../src/dev/demo';
import { buildWeeklyReport } from '../src/coach/report';
import { computeAllStreaks } from '../src/streaks/streaks';
import { buildStreakInput } from '../src/data/aggregate';
import { weightSummary } from '../src/body/trend';
import { e1rmSeries } from '../src/training/stats';

describe('demo data generator', () => {
  const d = generateDemoData({ userId: '00000000-0000-4000-8000-000000000001', today: '2026-09-28', weeks: 12, seed: 7 });
  const data = { profile: d.athlete_profiles[0], sessions: d.workout_sessions, sets: d.workout_sets, meals: d.meal_entries, weights: d.weight_entries, steps: d.step_entries, checkins: d.daily_checkins, pauses: [] };

  it('is deterministic and uses valid uuids', () => {
    const again = generateDemoData({ userId: '00000000-0000-4000-8000-000000000001', today: '2026-09-28', weeks: 12, seed: 7 });
    expect(again.workout_sets.length).toBe(d.workout_sets.length);
    for (const s of d.workout_sessions) expect(s.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it('produces realistic training, nutrition and weight data', () => {
    expect(d.workout_sessions.length).toBeGreaterThan(35);
    expect(d.meal_entries.length).toBeGreaterThan(200);
    const w = weightSummary(d.weight_entries, '2026-09-28');
    expect(w.weeklyRate30!).toBeLessThan(0);
    // bench press gets stronger over 12 weeks
    const bench = e1rmSeries('bench-press', d.workout_sessions, d.workout_sets);
    expect(bench[bench.length - 1].e1rm).toBeGreaterThan(bench[0].e1rm);
    const r = buildWeeklyReport(data, '2026-09-21');
    expect(r.consistency.workoutsDone).toBeGreaterThan(0);
    const s = computeAllStreaks(buildStreakInput(data, '2026-09-28', d.athlete_profiles[0].created_at.slice(0, 10)));
    expect(s.steps.best).toBeGreaterThan(0);
  });
});
