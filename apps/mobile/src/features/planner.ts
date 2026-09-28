import type { ExerciseDef, PlanDay, PlanExercise, WorkoutPlan, WorkoutSession } from '@gymolingo/core';
import { weekdayIndex } from '@gymolingo/core';
import type { ExerciseConfig } from '@/data/actions';

export interface PlanStructure {
  plan: WorkoutPlan;
  days: { day: PlanDay; exercises: PlanExercise[] }[];
}

export function planStructure(plan: WorkoutPlan, days: PlanDay[], exercises: PlanExercise[]): PlanStructure {
  return {
    plan,
    days: days
      .filter((d) => d.plan_id === plan.id && !d.deleted)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((day) => ({
        day,
        exercises: exercises.filter((e) => e.plan_day_id === day.id && !e.deleted).sort((a, b) => a.sort_order - b.sort_order),
      })),
  };
}

/**
 * Next plan day: a day fixed to today's weekday wins; otherwise the rotation
 * continues after the most recently completed plan day.
 */
export function nextPlanDay(structure: PlanStructure | null, sessions: WorkoutSession[], today: string): { day: PlanDay; exercises: PlanExercise[] } | null {
  if (!structure || structure.days.length === 0) return null;
  const wd = weekdayIndex(today);
  const fixed = structure.days.find((d) => d.day.weekday === wd);
  if (fixed) return fixed;
  const ids = new Set(structure.days.map((d) => d.day.id));
  const last = sessions
    .filter((s) => !s.deleted && s.status === 'completed' && s.plan_day_id && ids.has(s.plan_day_id))
    .sort((a, b) => (a.started_at < b.started_at ? 1 : -1))[0];
  if (!last) return structure.days[0];
  const i = structure.days.findIndex((d) => d.day.id === last.plan_day_id);
  // if the last one was done today, still show it as "done" – caller handles it
  if (last.date === today) return structure.days[i];
  return structure.days[(i + 1) % structure.days.length];
}

export function toExerciseConfigs(exercises: PlanExercise[], lookup: (id: string) => ExerciseDef | undefined): ExerciseConfig[] {
  return exercises
    .map((pe) => {
      const exercise = lookup(pe.exercise_id);
      if (!exercise) return null;
      return {
        exercise,
        target_sets: pe.target_sets,
        rep_min: pe.rep_min,
        rep_max: pe.rep_max,
        target_rir: pe.target_rir,
        rest_seconds: pe.rest_seconds,
        increment_kg: pe.increment_kg ?? exercise.increment_kg,
      };
    })
    .filter((x): x is ExerciseConfig => x !== null);
}

export function defaultConfig(exercise: ExerciseDef): ExerciseConfig {
  return {
    exercise,
    target_sets: 3,
    rep_min: exercise.default_rep_min,
    rep_max: exercise.default_rep_max,
    target_rir: 2,
    rest_seconds: exercise.category === 'compound' ? 150 : 90,
    increment_kg: exercise.increment_kg,
  };
}
