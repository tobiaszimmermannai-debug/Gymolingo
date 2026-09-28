import type {
  AiReport,
  AthleteProfile,
  BodyMeasurement,
  CoachMessage,
  CustomExercise,
  CustomFood,
  DailyCheckin,
  MealEntry,
  PlanDay,
  PlanExercise,
  PrivacySettings,
  ProgressPhoto,
  Recipe,
  RecipeItem,
  ReminderSettings,
  StepEntry,
  StreakPause,
  UserAchievement,
  WeightEntry,
  WorkoutPlan,
  WorkoutSession,
  WorkoutSet,
} from '@gymolingo/core';

/** Local tables (1:1 with the synced Postgres tables). */
export interface TableTypes {
  athlete_profiles: AthleteProfile;
  privacy_settings: PrivacySettings;
  reminder_settings: ReminderSettings;
  custom_exercises: CustomExercise;
  workout_plans: WorkoutPlan;
  plan_days: PlanDay;
  plan_exercises: PlanExercise;
  workout_sessions: WorkoutSession;
  workout_sets: WorkoutSet;
  custom_foods: CustomFood;
  recipes: Recipe;
  recipe_items: RecipeItem;
  meal_entries: MealEntry;
  weight_entries: WeightEntry;
  body_measurements: BodyMeasurement;
  progress_photos: ProgressPhoto;
  step_entries: StepEntry;
  daily_checkins: DailyCheckin;
  streak_pauses: StreakPause;
  user_achievements: UserAchievement;
  coach_messages: CoachMessage;
  ai_reports: AiReport;
}

export type TableName = keyof TableTypes;

/** Push order: parents before children (foreign keys). */
export const TABLES: TableName[] = [
  'athlete_profiles',
  'privacy_settings',
  'reminder_settings',
  'custom_exercises',
  'workout_plans',
  'plan_days',
  'plan_exercises',
  'workout_sessions',
  'workout_sets',
  'custom_foods',
  'recipes',
  'recipe_items',
  'meal_entries',
  'weight_entries',
  'body_measurements',
  'progress_photos',
  'step_entries',
  'daily_checkins',
  'streak_pauses',
  'user_achievements',
  'coach_messages',
  'ai_reports',
];

/** Tables whose single row per user uses id = user_id. */
export const SINGLETON_TABLES: TableName[] = ['athlete_profiles', 'privacy_settings', 'reminder_settings'];
