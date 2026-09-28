import { describe, expect, it } from 'vitest';
import { generatePlanTemplate, resolveExercise } from '../src/training/templates';
import { EXERCISE_MAP } from '../src/training/exercises';

describe('plan templates', () => {
  it('full gym, 4 days → upper/lower', () => {
    const t = generatePlanTemplate({ daysPerWeek: 4, equipment: ['barbell', 'dumbbell', 'machine', 'cable'], goal: 'muscle_gain', experience: 'intermediate' });
    expect(t.days.map((d) => d.name)).toEqual(['Oberkörper A', 'Unterkörper A', 'Oberkörper B', 'Unterkörper B']);
    expect(t.days.every((d) => d.exercises.length >= 5)).toBe(true);
  });
  it('dumbbells only → substitutes and valid exercises', () => {
    const t = generatePlanTemplate({ daysPerWeek: 3, equipment: ['dumbbell'], goal: 'fat_loss', experience: 'beginner' });
    for (const d of t.days) {
      expect(d.exercises.length).toBeGreaterThanOrEqual(4);
      for (const e of d.exercises) {
        const def = EXERCISE_MAP[e.exercise_id];
        expect(['dumbbell', 'bodyweight']).toContain(def.equipment);
        expect(e.target_sets).toBeLessThanOrEqual(3);
      }
    }
    expect(resolveExercise('bench-press', ['dumbbell'])).toBe('db-bench-press');
    expect(resolveExercise('lat-pulldown', ['dumbbell'])).toBe('pull-up');
  });
  it('strength goal lowers compound rep ranges; 6 days = PPL x2 with suffixes', () => {
    const t = generatePlanTemplate({ daysPerWeek: 6, equipment: ['barbell', 'dumbbell', 'machine', 'cable'], goal: 'strength', experience: 'advanced' });
    expect(t.days.map((d) => d.name)).toEqual(['Push A', 'Pull A', 'Beine A', 'Push B', 'Pull B', 'Beine B']);
    const bench = t.days[0].exercises.find((e) => e.exercise_id === 'bench-press')!;
    expect([bench.rep_min, bench.rep_max]).toEqual([4, 6]);
  });
  it('beginners get at most 4 days', () => {
    expect(generatePlanTemplate({ daysPerWeek: 6, equipment: ['machine'], goal: 'muscle_gain', experience: 'beginner' }).days).toHaveLength(4);
  });
});
