import { useMemo } from 'react';
import {
  DEFAULT_REMINDER_SETTINGS,
  EXERCISE_MAP,
  todayISO,
  type AthleteProfile,
  type BaseRow,
  type ExerciseDef,
  type PrivacySettings,
  type ReminderSettings,
  type UserData,
} from '@gymolingo/core';
import { useDB } from './store';
import type { TableName, TableTypes } from './tables';

/** Live, non-deleted rows of a table (memoized per table change). */
export function useRows<K extends TableName>(table: K): TableTypes[K][] {
  const t = useDB((s) => s.tables[table]);
  return useMemo(() => (Object.values(t) as TableTypes[K][]).filter((r) => !(r as BaseRow).deleted), [t]);
}

export function useRow<K extends TableName>(table: K, id: string | undefined | null): TableTypes[K] | undefined {
  return useDB((s) => (id ? (s.tables[table][id] as TableTypes[K] | undefined) : undefined));
}

export const DEFAULT_PROFILE: Omit<AthleteProfile, keyof BaseRow> = {
  display_name: '',
  birth_year: null,
  sex: null,
  height_cm: null,
  start_weight_kg: null,
  goal_weight_kg: null,
  experience_level: 'beginner',
  training_years: null,
  goal: 'muscle_gain',
  activity_level: 'moderate',
  schedule_type: 'per_week',
  training_days_per_week: 3,
  training_weekdays: [0, 2, 4],
  preferred_workout_time: '18:00',
  equipment: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'],
  diet_type: 'omnivore',
  allergies: [],
  intolerances: [],
  targets_mode: 'auto',
  calorie_target: 2200,
  protein_target_g: 150,
  carbs_target_g: 220,
  fat_target_g: 70,
  fiber_target_g: 30,
  step_target: 8000,
  weekly_rate_kg: 0,
  weight_tracking_enabled: true,
  onboarding_completed: false,
};

export const DEFAULT_PRIVACY: Omit<PrivacySettings, keyof BaseRow> = {
  searchable: true,
  share_workouts: false,
  share_steps: false,
  share_streaks: true,
  share_goal_completion: false,
  share_prs: false,
  share_level: false,
  share_weight: false,
  share_body_fat: false,
  share_nutrition: false,
  share_photos: false,
  share_online_status: true,
};

export function useProfile(): AthleteProfile | undefined {
  return useDB((s) => s.tables.athlete_profiles[s.userId]);
}

/** Profile with defaults – safe to use everywhere after onboarding. */
export function useProfileOrDefault(): AthleteProfile {
  const p = useProfile();
  const userId = useDB((s) => s.userId);
  return useMemo(
    () =>
      p ?? ({ ...DEFAULT_PROFILE, id: userId, user_id: userId, created_at: '', updated_at: '', deleted: false } as AthleteProfile),
    [p, userId],
  );
}

export function useReminderSettings(): ReminderSettings {
  const r = useDB((s) => s.tables.reminder_settings[s.userId]);
  const userId = useDB((s) => s.userId);
  return useMemo(
    () => r ?? ({ ...DEFAULT_REMINDER_SETTINGS, id: userId, user_id: userId, created_at: '', updated_at: '', deleted: false } as ReminderSettings),
    [r, userId],
  );
}

export function usePrivacy(): PrivacySettings {
  const r = useDB((s) => s.tables.privacy_settings[s.userId]);
  const userId = useDB((s) => s.userId);
  return useMemo(() => r ?? ({ ...DEFAULT_PRIVACY, id: userId, user_id: userId, created_at: '', updated_at: '', deleted: false } as PrivacySettings), [r, userId]);
}

/** All data needed by the core aggregations. */
export function useUserData(): UserData {
  const profile = useProfileOrDefault();
  const sessions = useRows('workout_sessions');
  const sets = useRows('workout_sets');
  const meals = useRows('meal_entries');
  const weights = useRows('weight_entries');
  const steps = useRows('step_entries');
  const checkins = useRows('daily_checkins');
  const pauses = useRows('streak_pauses');
  const cardio = useRows('cardio_sessions');
  return useMemo(
    () => ({ profile, sessions, sets, meals, weights, steps, checkins, pauses, cardio }),
    [profile, sessions, sets, meals, weights, steps, checkins, pauses, cardio],
  );
}

/** Built-in + custom exercises. */
export function useExerciseLookup(): (id: string) => ExerciseDef | undefined {
  const custom = useDB((s) => s.tables.custom_exercises);
  return useMemo(
    () => (id: string) => {
      if (EXERCISE_MAP[id]) return EXERCISE_MAP[id];
      const c = custom[id];
      if (!c || c.deleted) return undefined;
      return {
        id: c.id,
        name: c.name,
        primary_muscle: c.primary_muscle,
        secondary_muscles: c.secondary_muscles,
        equipment: c.equipment,
        category: c.category,
        increment_kg: Number(c.increment_kg),
        is_bodyweight: c.is_bodyweight,
        default_rep_min: c.default_rep_min,
        default_rep_max: c.default_rep_max,
        instructions: c.instructions ?? undefined,
      };
    },
    [custom],
  );
}

/** "Today" as local ISO date – re-evaluated on each render. */
export function useToday(): string {
  return todayISO();
}
