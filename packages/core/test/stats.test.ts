import { describe, expect, it } from 'vitest';
import { computePersonalRecords, sessionPRs, exerciseHistory, setsPerMuscle, volumeSeries, e1rmSeries, strengthChange, summarizeSession, lastPerformedSets, sessionDurationSec } from '../src/training/stats';
import { EXERCISE_MAP, searchExercises, EXERCISES } from '../src/training/exercises';
import { workout, session, set } from './fixtures';

describe('training stats', () => {
  const w1 = workout('2026-01-05', 'bench-press', 80, [8, 8, 7]);
  const w2 = workout('2026-01-08', 'bench-press', 80, [9, 8, 8]);
  const w3 = workout('2026-01-12', 'bench-press', 82.5, [8, 7, 7]);
  const sessions = [w1.session, w2.session, w3.session];
  const sets = [...w1.sets, ...w2.sets, ...w3.sets];

  it('history newest first, excluding a session', () => {
    const h = exerciseHistory('bench-press', sessions, sets);
    expect(h.map((x) => x.date)).toEqual(['2026-01-12', '2026-01-08', '2026-01-05']);
    expect(exerciseHistory('bench-press', sessions, sets, { excludeSessionId: w3.session.id })[0].date).toBe('2026-01-08');
    expect(lastPerformedSets('bench-press', sessions, sets).map((s) => s.weight_kg)).toEqual([82.5, 82.5, 82.5]);
  });

  it('PR detection: first session is baseline, later improvements are PRs', () => {
    const { records, events } = computePersonalRecords(sessions, sets);
    expect(records['bench-press'].maxWeight?.value).toBe(82.5);
    expect(events.some((e) => e.session_id === w1.session.id)).toBe(false);
    expect(sessionPRs(w2.session.id, sessions, sets).map((e) => e.type).sort()).toEqual(['e1rm', 'reps']);
    expect(sessionPRs(w3.session.id, sessions, sets).map((e) => e.type)).toContain('weight');
  });

  it('ignores discarded sessions, warm-ups and incomplete sets', () => {
    const d = session('2026-01-20', { status: 'discarded' });
    const extra = [set(d.id, 'bench-press', 150, 5, 0), set(w3.session.id, 'bench-press', 120, 3, 9, { set_type: 'warmup' }), set(w3.session.id, 'bench-press', 130, 3, 10, { completed: false })];
    const { records } = computePersonalRecords([...sessions, d], [...sets, ...extra]);
    expect(records['bench-press'].maxWeight?.value).toBe(82.5);
  });

  it('sets per muscle with secondary = 0.5', () => {
    const m = setsPerMuscle(sets, sessions, (id) => EXERCISE_MAP[id], '2026-01-05', '2026-01-11');
    expect(m.chest).toBe(6);
    expect(m.triceps).toBe(3);
  });

  it('volume series by week fills gaps', () => {
    const v = volumeSeries(sessions, sets, '2026-01-05', '2026-01-25', 'week');
    expect(v.map((p) => p.date)).toEqual(['2026-01-05', '2026-01-12', '2026-01-19']);
    expect(v[0].volumeKg).toBe(80 * 23 + 80 * 25);
    expect(v[2].volumeKg).toBe(0);
  });

  it('e1RM series chronological and strength change', () => {
    const s = e1rmSeries('bench-press', sessions, sets);
    expect(s.map((x) => x.date)).toEqual(['2026-01-05', '2026-01-08', '2026-01-12']);
    const ch = strengthChange(sessions, sets, { from: '2026-01-08', to: '2026-01-14' }, { from: '2026-01-01', to: '2026-01-07' });
    expect(ch.pct).toBeGreaterThan(0);
  });

  it('session summary & duration with pauses', () => {
    const s = { ...w1.session, paused_seconds: 600 };
    expect(sessionDurationSec(s)).toBe(3000);
    const sum = summarizeSession(w1.session, sets, 1);
    expect(sum.workingSets).toBe(3);
    expect(sum.volumeKg).toBe(80 * 23);
  });

  it('exercise search is umlaut tolerant', () => {
    expect(searchExercises(EXERCISES, 'bankdrücken')[0].id).toBe('bench-press');
    expect(searchExercises(EXERCISES, 'kniebeuge').length).toBeGreaterThan(0);
    expect(searchExercises(EXERCISES, '', { muscle: 'biceps' }).every((e) => e.primary_muscle === 'biceps' || e.secondary_muscles.includes('biceps'))).toBe(true);
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
  });
});
