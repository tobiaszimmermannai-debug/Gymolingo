import type { ExerciseDef, PlanExercise } from '@gymolingo/core';
import { startWorkout } from '@/data/actions';
import { toExerciseConfigs } from './planner';

export function startWorkoutForDay(name: string, dayId: string | null, exercises: PlanExercise[], lookup: (id: string) => ExerciseDef | undefined) {
  return startWorkout({ name, planDayId: dayId, exercises: toExerciseConfigs(exercises, lookup) });
}
