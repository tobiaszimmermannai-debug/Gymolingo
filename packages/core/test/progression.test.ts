import { describe, expect, it } from 'vitest';
import { suggestProgression, progressReps, detectPlateau, type ExerciseSession } from '../src/training/progression';
import { estimate1RM, repsAtWeight, weightForReps, effectiveRir } from '../src/training/oneRm';

const cfg = { rep_min: 6, rep_max: 10, target_sets: 3, target_rir: 2, increment_kg: 2.5, is_bodyweight: false };
const sess = (date: string, weight: number, reps: number[], rir: number | null = 2): ExerciseSession => ({
  date,
  sets: reps.map((r) => ({ weight_kg: weight, reps: r, rir, rpe: null, set_type: 'working' as const })),
});

describe('1RM helpers', () => {
  it('Epley with RIR', () => {
    expect(estimate1RM(100, 1, 0)).toBe(100);
    expect(estimate1RM(80, 8, 0)).toBeCloseTo(101.33, 1);
    expect(estimate1RM(80, 8, 2)).toBeCloseTo(106.67, 1);
    expect(effectiveRir(null, 8)).toBe(2);
    expect(effectiveRir(1, 8)).toBe(1);
  });
  it('inverse functions are consistent', () => {
    const orm = estimate1RM(80, 8, 2);
    expect(weightForReps(orm, 8, 2)).toBeCloseTo(80, 5);
    expect(repsAtWeight(orm, 80, 2)).toBe(8);
    expect(repsAtWeight(orm, 85, 2)).toBeLessThan(8);
  });
});

describe('progressReps', () => {
  it('8/8/7 → 9/8/8 with enough reserve', () => {
    expect(progressReps([8, 8, 7], 10, 2, 2)).toEqual([9, 8, 8]);
  });
  it('8/8/7 → 8/8/8 when close to failure', () => {
    expect(progressReps([8, 8, 7], 10, 0.5, 2)).toEqual([8, 8, 8]);
  });
  it('never exceeds rep max', () => {
    expect(progressReps([10, 10, 9], 10, 3, 2)).toEqual([10, 10, 10]);
  });
  it('equal sets: first set +1', () => {
    expect(progressReps([8, 8, 8], 10, 2, 2)).toEqual([9, 8, 8]);
  });
});

describe('suggestProgression', () => {
  it('first time without history', () => {
    const s = suggestProgression([], cfg);
    expect(s.kind).toBe('first_time');
    expect(s.reps).toEqual([6, 6, 6]);
  });

  it('prompt example: 80 kg 8/8/7 keeps weight and adds reps (not auto-increase)', () => {
    const s = suggestProgression([sess('2026-01-05', 80, [8, 8, 7])], cfg);
    expect(s.kind).toBe('increase_reps');
    expect(s.weight_kg).toBe(80);
    expect(s.reps).toEqual([9, 8, 8]);
    expect(s.rationale).toContain('80 kg');
  });

  it('prompt example with range 6–8: all sets need 8 before a jump', () => {
    const s = suggestProgression([sess('2026-01-05', 80, [8, 8, 7])], { ...cfg, rep_max: 8 });
    expect(s.kind).toBe('increase_reps');
    expect(s.reps).toEqual([8, 8, 8]);
  });

  it('increases weight by the smallest increment when all sets reach the top with RIR', () => {
    const s = suggestProgression([sess('2026-01-05', 80, [10, 10, 10], 2)], cfg);
    expect(s.kind).toBe('increase_weight');
    expect(s.weight_kg).toBe(82.5);
    expect(s.reps.every((r) => r >= 6 && r <= 10)).toBe(true);
  });

  it('bigger jump if far above range with lots of reserve (capped at 10 %)', () => {
    const s = suggestProgression([sess('2026-01-05', 80, [13, 13, 13], 4)], cfg);
    expect(s.kind).toBe('increase_weight');
    expect(s.weight_kg).toBe(85);
  });

  it('holds when top reached at failure the first time', () => {
    const s = suggestProgression([sess('2026-01-05', 80, [10, 10, 10], 0)], cfg);
    expect(s.kind).toBe('hold');
    expect(s.weight_kg).toBe(80);
  });

  it('increases after top reached at failure twice', () => {
    const s = suggestProgression([sess('2026-01-08', 80, [10, 10, 10], 0), sess('2026-01-05', 80, [10, 10, 10], 0)], cfg);
    expect(s.kind).toBe('increase_weight');
  });

  it('respects machine increments (5 kg)', () => {
    const s = suggestProgression([sess('2026-01-05', 60, [12, 12, 12], 2)], { ...cfg, rep_min: 8, rep_max: 12, increment_kg: 5 });
    expect(s.weight_kg).toBe(65);
  });

  it('single slightly weak session → hold, not reduce', () => {
    const s = suggestProgression([sess('2026-01-05', 80, [6, 5, 5], 0)], cfg);
    expect(s.kind).toBe('hold');
    expect(s.weight_kg).toBe(80);
  });

  it('repeated under-performance → reduce weight', () => {
    const s = suggestProgression([sess('2026-01-08', 80, [5, 5, 4], 0), sess('2026-01-05', 80, [5, 5, 5], 0)], cfg);
    expect(s.kind).toBe('reduce_weight');
    expect(s.weight_kg).toBeLessThan(80);
    expect(s.weight_kg % 2.5).toBeCloseTo(0, 5);
  });

  it('far below range → reduce immediately', () => {
    const s = suggestProgression([sess('2026-01-05', 100, [2, 2, 1], 0)], cfg);
    expect(s.kind).toBe('reduce_weight');
  });

  it('ignores warm-up sets', () => {
    const h: ExerciseSession = {
      date: '2026-01-05',
      sets: [
        { weight_kg: 40, reps: 10, rir: 5, rpe: null, set_type: 'warmup' },
        ...sess('x', 80, [8, 8, 7]).sets,
      ],
    };
    expect(suggestProgression([h], cfg).weight_kg).toBe(80);
  });

  it('bodyweight: add reps, then added load', () => {
    const bw = { ...cfg, is_bodyweight: true, rep_min: 5, rep_max: 10 };
    expect(suggestProgression([sess('2026-01-05', 0, [7, 6, 6])], bw).kind).toBe('increase_reps');
    const up = suggestProgression([sess('2026-01-05', 0, [10, 10, 10])], bw);
    expect(up.kind).toBe('increase_weight');
    expect(up.weight_kg).toBe(2.5);
  });

  it('detects plateau and suggests deload when declining', () => {
    const hist = [
      sess('2026-02-10', 100, [5, 5, 4], 0),
      sess('2026-02-07', 100, [6, 5, 5], 0),
      sess('2026-02-03', 100, [6, 6, 5], 0),
      sess('2026-01-30', 100, [7, 6, 6], 1),
      sess('2026-01-27', 97.5, [7, 7, 6], 1),
    ];
    expect(detectPlateau(hist)).toBe(true);
    const s = suggestProgression(hist, cfg);
    expect(s.kind).toBe('deload');
    expect(s.weight_kg).toBe(90);
    expect(s.plateau).toBe(true);
  });
});
