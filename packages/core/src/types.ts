/**
 * Domain row types. Field names intentionally use snake_case and match the
 * Postgres columns in `supabase/migrations` 1:1 so rows can be synced without
 * a mapping layer.
 */
import type { ISODate } from './dates';

export type UUID = string;
export type Timestamp = string; // ISO-8601

/** Columns shared by every syncable row. */
export interface BaseRow {
  id: UUID;
  user_id: UUID;
  created_at: Timestamp;
  updated_at: Timestamp;
  deleted: boolean;
}

export type Sex = 'male' | 'female' | 'diverse';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type Goal = 'muscle_gain' | 'fat_loss' | 'recomposition' | 'strength';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type DietType = 'omnivore' | 'vegetarian' | 'vegan' | 'pescetarian' | 'keto' | 'other';
export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'kettlebell' | 'bands' | 'smith';
export type ScheduleType = 'fixed_days' | 'per_week';

export interface AthleteProfile extends BaseRow {
  display_name: string;
  birth_year: number | null;
  sex: Sex | null;
  height_cm: number | null;
  start_weight_kg: number | null;
  goal_weight_kg: number | null;
  experience_level: ExperienceLevel;
  training_years: number | null;
  goal: Goal;
  activity_level: ActivityLevel;
  schedule_type: ScheduleType;
  training_days_per_week: number;
  /** Monday = 0 … Sunday = 6 (used when schedule_type = fixed_days). */
  training_weekdays: number[];
  preferred_workout_time: string; // HH:MM
  equipment: Equipment[];
  diet_type: DietType;
  allergies: string[];
  intolerances: string[];
  targets_mode: 'auto' | 'manual';
  calorie_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
  fiber_target_g: number;
  step_target: number;
  weekly_rate_kg: number; // planned change per week (negative = loss)
  weight_tracking_enabled: boolean;
  /** add calories burned by cardio/EMS to the daily calorie target (like MyFitnessPal) */
  add_exercise_calories?: boolean;
  onboarding_completed: boolean;
}

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'lats'
  | 'traps'
  | 'shoulders'
  | 'rear_delts'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'abs'
  | 'lower_back'
  | 'adductors'
  | 'full_body'
  | 'cardio';

export type ExerciseCategory = 'compound' | 'isolation' | 'cardio';

export interface ExerciseDef {
  /** Built-in: slug (e.g. "bench-press"); custom: uuid. */
  id: string;
  name: string;
  name_en?: string;
  primary_muscle: MuscleGroup;
  secondary_muscles: MuscleGroup[];
  equipment: Equipment;
  category: ExerciseCategory;
  /** Smallest realistic total load increase in kg. */
  increment_kg: number;
  is_bodyweight: boolean;
  default_rep_min: number;
  default_rep_max: number;
  instructions?: string;
}

export interface CustomExercise extends BaseRow, Omit<ExerciseDef, 'id' | 'name_en' | 'instructions'> {
  instructions: string | null;
}

export interface WorkoutPlan extends BaseRow {
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface PlanDay extends BaseRow {
  plan_id: UUID;
  name: string;
  /** Optional fixed weekday (Mon=0). */
  weekday: number | null;
  sort_order: number;
}

export interface PlanExercise extends BaseRow {
  plan_day_id: UUID;
  exercise_id: string;
  sort_order: number;
  target_sets: number;
  rep_min: number;
  rep_max: number;
  target_rir: number;
  rest_seconds: number;
  increment_kg: number | null;
  notes: string | null;
}

export type SessionStatus = 'active' | 'paused' | 'completed' | 'discarded';

export interface WorkoutSession extends BaseRow {
  plan_day_id: UUID | null;
  name: string;
  date: ISODate;
  started_at: Timestamp;
  ended_at: Timestamp | null;
  status: SessionStatus;
  paused_at: Timestamp | null;
  paused_seconds: number;
  notes: string | null;
}

export type SetType = 'warmup' | 'working' | 'drop' | 'failure';

export interface WorkoutSet extends BaseRow {
  session_id: UUID;
  exercise_id: string;
  exercise_order: number;
  set_index: number;
  set_type: SetType;
  weight_kg: number;
  reps: number;
  rir: number | null;
  rpe: number | null;
  completed: boolean;
  completed_at: Timestamp | null;
  rest_seconds: number | null;
  target_weight_kg: number | null;
  target_reps: number | null;
}

export type FoodSource = 'builtin' | 'custom' | 'off' | 'ai' | 'recipe';

/** Nutrients per 100 g (or 100 ml). */
export interface Nutrients100 {
  kcal_100: number;
  protein_100: number;
  carbs_100: number;
  fat_100: number;
  fiber_100: number | null;
  sugar_100: number | null;
  salt_100: number | null;
}

export interface FoodServing {
  label: string;
  grams: number;
}

export interface FoodItem extends Nutrients100 {
  /** Built-in: "builtin:<slug>", custom/cached: "food:<uuid>", OFF: "off:<barcode>" */
  ref: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  category?: string;
  servings: FoodServing[];
  source: FoodSource;
  is_estimate: boolean;
  tags?: string[];
}

export interface CustomFood extends BaseRow, Nutrients100 {
  name: string;
  brand: string | null;
  barcode: string | null;
  serving_label: string | null;
  serving_g: number | null;
  source: FoodSource;
  is_estimate: boolean;
  favorite: boolean;
}

export interface Recipe extends BaseRow {
  name: string;
  servings: number;
  notes: string | null;
}

export interface RecipeItem extends BaseRow, Nutrients100 {
  recipe_id: UUID;
  food_ref: string;
  name: string;
  amount_g: number;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface MealEntry extends BaseRow {
  date: ISODate;
  meal: MealType;
  food_ref: string;
  name: string;
  brand: string | null;
  amount_g: number;
  serving_label: string | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  source: FoodSource;
  is_estimate: boolean;
  estimate_note: string | null;
  logged_at: Timestamp;
}

export interface WeightEntry extends BaseRow {
  date: ISODate;
  weight_kg: number;
  body_fat_pct: number | null;
  source: 'manual' | 'apple_health' | 'health_connect';
  note: string | null;
}

export interface BodyMeasurement extends BaseRow {
  date: ISODate;
  waist_cm: number | null;
  chest_cm: number | null;
  hips_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  neck_cm: number | null;
  note: string | null;
}

export type PhotoPose = 'front' | 'side' | 'back';

export interface ProgressPhoto extends BaseRow {
  date: ISODate;
  pose: PhotoPose;
  /** Local file URI on the device (not synced). */
  local_uri: string | null;
  /** Path inside the private `progress-photos` storage bucket. */
  storage_path: string | null;
  note: string | null;
}

export type StepSource = 'manual' | 'apple_health' | 'health_connect';

export interface StepEntry extends BaseRow {
  date: ISODate;
  steps: number;
  source: StepSource;
}

export type CardioActivity = 'walk' | 'jog' | 'run' | 'ems';
export type CardioIntensity = 'light' | 'medium' | 'intense';

/** Endurance session (walk / jog / run) or EMS training. kcal is computed (MET) unless set manually. */
export interface CardioSession extends BaseRow {
  date: ISODate;
  activity: CardioActivity;
  duration_min: number;
  distance_km: number | null;
  intensity: CardioIntensity;
  kcal: number;
  kcal_manual: boolean;
  note: string | null;
}

export interface DailyCheckin extends BaseRow {
  date: ISODate;
  mood: number | null; // 1-5
  energy: number | null; // 1-5
  sleep_hours: number | null;
  note: string | null;
  day_closed: boolean;
  completed_at: Timestamp;
}

export type PauseReason = 'vacation' | 'sick' | 'other';

export interface StreakPause extends BaseRow {
  start_date: ISODate;
  end_date: ISODate;
  reason: PauseReason;
}

export interface UserAchievement extends BaseRow {
  badge_id: string;
  unlocked_at: Timestamp;
  seen: boolean;
}

export type ReminderIntensity = 'gentle' | 'normal' | 'persistent';

export interface ReminderSettings extends BaseRow {
  enabled: boolean;
  morning_enabled: boolean;
  morning_time: string;
  pre_workout_enabled: boolean;
  pre_workout_minutes: number;
  post_workout_enabled: boolean;
  evening_enabled: boolean;
  evening_time: string;
  weight_enabled: boolean;
  weight_time: string;
  nutrition_enabled: boolean;
  streak_enabled: boolean;
  weekly_report_enabled: boolean;
  quiet_start: string;
  quiet_end: string;
  max_per_day: number;
  intensity: ReminderIntensity;
}

export interface PrivacySettings extends BaseRow {
  searchable: boolean;
  share_workouts: boolean;
  share_steps: boolean;
  share_streaks: boolean;
  share_goal_completion: boolean;
  share_prs: boolean;
  share_level: boolean;
  share_weight: boolean;
  share_body_fat: boolean;
  share_nutrition: boolean;
  share_photos: boolean;
  /** friends see when you were last online (coach briefing) */
  share_online_status: boolean;
}

export interface CoachMessage extends BaseRow {
  role: 'user' | 'assistant';
  content: string;
  source: 'ai' | 'rules';
}

export interface AiReport extends BaseRow {
  week_start: ISODate;
  stats: unknown;
  content: unknown;
  source: 'ai' | 'rules';
  model: string | null;
}
