import type {
  AthleteProfile,
  DailyCheckin,
  MealEntry,
  StepEntry,
  WeightEntry,
  WorkoutSession,
  WorkoutSet,
} from '../src/types';
import type { UserData } from '../src/data/aggregate';

let n = 0;
export const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const USER = 'user-1';
const base = (date = '2026-01-01') => ({
  id: uid(),
  user_id: USER,
  created_at: `${date}T10:00:00.000Z`,
  updated_at: `${date}T10:00:00.000Z`,
  deleted: false,
});

export function profile(over: Partial<AthleteProfile> = {}): AthleteProfile {
  return {
    ...base(),
    id: USER,
    display_name: 'Test',
    birth_year: 1995,
    sex: 'male',
    height_cm: 180,
    start_weight_kg: 85,
    goal_weight_kg: 80,
    experience_level: 'intermediate',
    training_years: 2,
    goal: 'fat_loss',
    activity_level: 'moderate',
    schedule_type: 'per_week',
    training_days_per_week: 3,
    training_weekdays: [0, 2, 4],
    preferred_workout_time: '18:00',
    equipment: ['barbell', 'dumbbell', 'machine', 'cable'],
    diet_type: 'omnivore',
    allergies: [],
    intolerances: [],
    targets_mode: 'auto',
    calorie_target: 2300,
    protein_target_g: 180,
    carbs_target_g: 230,
    fat_target_g: 70,
    fiber_target_g: 32,
    step_target: 10000,
    weekly_rate_kg: -0.5,
    weight_tracking_enabled: true,
    onboarding_completed: true,
    ...over,
  };
}

export function session(date: string, over: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    ...base(date),
    plan_day_id: null,
    name: 'Push',
    date,
    started_at: `${date}T17:00:00.000Z`,
    ended_at: `${date}T18:00:00.000Z`,
    status: 'completed',
    paused_at: null,
    paused_seconds: 0,
    notes: null,
    ...over,
  };
}

export function set(sessionId: string, exerciseId: string, weight: number, reps: number, idx: number, over: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    ...base(),
    session_id: sessionId,
    exercise_id: exerciseId,
    exercise_order: 0,
    set_index: idx,
    set_type: 'working',
    weight_kg: weight,
    reps,
    rir: null,
    rpe: null,
    completed: true,
    completed_at: null,
    rest_seconds: null,
    target_weight_kg: null,
    target_reps: null,
    ...over,
  };
}

/** Creates a completed session with straight sets. */
export function workout(date: string, exerciseId: string, weight: number, reps: number[], rir: number | null = null) {
  const s = session(date);
  const sets = reps.map((r, i) => set(s.id, exerciseId, weight, r, i, { rir }));
  return { session: s, sets };
}

export function meal(date: string, kcal: number, protein: number, over: Partial<MealEntry> = {}): MealEntry {
  return {
    ...base(date),
    date,
    meal: 'lunch',
    food_ref: 'builtin:haehnchenbrust',
    name: 'Essen',
    brand: null,
    amount_g: 100,
    serving_label: null,
    kcal,
    protein_g: protein,
    carbs_g: 10,
    fat_g: 5,
    fiber_g: 1,
    source: 'builtin',
    is_estimate: false,
    estimate_note: null,
    logged_at: `${date}T12:00:00.000Z`,
    ...over,
  };
}

export function weight(date: string, kg: number, over: Partial<WeightEntry> = {}): WeightEntry {
  return { ...base(date), date, weight_kg: kg, body_fat_pct: null, source: 'manual', note: null, ...over };
}

export function steps(date: string, count: number, over: Partial<StepEntry> = {}): StepEntry {
  return { ...base(date), date, steps: count, source: 'manual', ...over };
}

export function checkin(date: string, over: Partial<DailyCheckin> = {}): DailyCheckin {
  return { ...base(date), date, mood: 4, energy: 4, sleep_hours: 7.5, note: null, day_closed: true, completed_at: `${date}T21:00:00.000Z`, ...over };
}

export function emptyData(over: Partial<UserData> = {}): UserData {
  return { profile: profile(), sessions: [], sets: [], meals: [], weights: [], steps: [], checkins: [], pauses: [], ...over };
}
