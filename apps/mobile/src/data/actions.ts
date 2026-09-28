/**
 * Domain write operations used by the screens. All writes are local-first and
 * trigger a debounced background sync.
 */
import {
  DEFAULT_REMINDER_SETTINGS,
  exerciseHistory,
  lastPerformedSets,
  nutrientsForAmount,
  suggestProgression,
  todayISO,
  type AthleteProfile,
  type ExerciseDef,
  type FoodItem,
  type MealType,
  type PlanTemplate,
  type ProgressionSuggestion,
  type WorkoutSession,
  type WorkoutSet,
} from '@gymolingo/core';
import { insert, insertMany, nowISO, remove, update, upsertSingleton, useDB } from './store';
import { DEFAULT_PRIVACY, DEFAULT_PROFILE } from './hooks';
import { requestSync } from './sync';

const live = <T extends { deleted: boolean }>(rows: Record<string, T>) => Object.values(rows).filter((r) => !r.deleted);

// ---------------------------------------------------------------- profile

export function saveProfile(patch: Partial<AthleteProfile>) {
  const row = upsertSingleton('athlete_profiles', patch, () => ({ ...DEFAULT_PROFILE }));
  requestSync();
  return row;
}

export function ensureSettingsRows() {
  const s = useDB.getState();
  if (!s.tables.privacy_settings[s.userId]) upsertSingleton('privacy_settings', {}, () => ({ ...DEFAULT_PRIVACY }));
  if (!s.tables.reminder_settings[s.userId]) upsertSingleton('reminder_settings', {}, () => ({ ...DEFAULT_REMINDER_SETTINGS }));
}

export function savePrivacy(patch: Parameters<typeof upsertSingleton<'privacy_settings'>>[1]) {
  upsertSingleton('privacy_settings', patch, () => ({ ...DEFAULT_PRIVACY }));
  requestSync();
}

export function saveReminderSettings(patch: Parameters<typeof upsertSingleton<'reminder_settings'>>[1]) {
  upsertSingleton('reminder_settings', patch, () => ({ ...DEFAULT_REMINDER_SETTINGS }));
  requestSync();
}

// ---------------------------------------------------------------- plans

export function createPlanFromTemplate(tpl: PlanTemplate, activate = true, weekdays: number[] = []) {
  if (activate) deactivateAllPlans();
  const plan = insert('workout_plans', { name: tpl.name, description: tpl.description, is_active: activate, sort_order: 0 });
  tpl.days.forEach((d, i) => {
    const day = insert('plan_days', { plan_id: plan.id, name: d.name, weekday: weekdays[i] ?? null, sort_order: i });
    insertMany(
      'plan_exercises',
      d.exercises.map((e, j) => ({
        plan_day_id: day.id,
        exercise_id: e.exercise_id,
        sort_order: j,
        target_sets: e.target_sets,
        rep_min: e.rep_min,
        rep_max: e.rep_max,
        target_rir: e.target_rir,
        rest_seconds: e.rest_seconds,
        increment_kg: null,
        notes: null,
      })),
    );
  });
  requestSync();
  return plan;
}

export function deactivateAllPlans() {
  for (const p of live(useDB.getState().tables.workout_plans)) if (p.is_active) update('workout_plans', p.id, { is_active: false });
}

export function activatePlan(planId: string) {
  deactivateAllPlans();
  update('workout_plans', planId, { is_active: true });
  requestSync();
}

export function createEmptyPlan(name: string) {
  const plan = insert('workout_plans', { name, description: null, is_active: live(useDB.getState().tables.workout_plans).length === 0, sort_order: 0 });
  insert('plan_days', { plan_id: plan.id, name: 'Tag A', weekday: null, sort_order: 0 });
  requestSync();
  return plan;
}

export function deletePlan(planId: string) {
  const s = useDB.getState();
  const days = live(s.tables.plan_days).filter((d) => d.plan_id === planId);
  for (const d of days) {
    for (const e of live(s.tables.plan_exercises).filter((x) => x.plan_day_id === d.id)) remove('plan_exercises', e.id);
    remove('plan_days', d.id);
  }
  remove('workout_plans', planId);
  requestSync();
}

export function addExerciseToDay(dayId: string, ex: ExerciseDef) {
  const s = useDB.getState();
  const count = live(s.tables.plan_exercises).filter((e) => e.plan_day_id === dayId).length;
  insert('plan_exercises', {
    plan_day_id: dayId,
    exercise_id: ex.id,
    sort_order: count,
    target_sets: 3,
    rep_min: ex.default_rep_min,
    rep_max: ex.default_rep_max,
    target_rir: 2,
    rest_seconds: ex.category === 'compound' ? 150 : 90,
    increment_kg: null,
    notes: null,
  });
  requestSync();
}

export function moveInList<T extends { id: string; sort_order: number }>(table: 'plan_exercises' | 'plan_days', items: T[], index: number, dir: -1 | 1) {
  const j = index + dir;
  if (j < 0 || j >= items.length) return;
  const a = items[index];
  const b = items[j];
  update(table, a.id, { sort_order: b.sort_order === a.sort_order ? j : b.sort_order } as never);
  update(table, b.id, { sort_order: b.sort_order === a.sort_order ? index : a.sort_order } as never);
  requestSync();
}

// ---------------------------------------------------------------- workouts

export function activeSession(): WorkoutSession | undefined {
  return live(useDB.getState().tables.workout_sessions).find((s) => s.status === 'active' || s.status === 'paused');
}

export interface ExerciseConfig {
  exercise: ExerciseDef;
  target_sets: number;
  rep_min: number;
  rep_max: number;
  target_rir: number;
  rest_seconds: number;
  increment_kg: number;
}

/** Progression suggestion for an exercise based on the full history. */
export function suggestionFor(cfg: ExerciseConfig, excludeSessionId?: string): ProgressionSuggestion {
  const s = useDB.getState();
  const hist = exerciseHistory(cfg.exercise.id, live(s.tables.workout_sessions), live(s.tables.workout_sets), { excludeSessionId, limit: 10 });
  return suggestProgression(hist, {
    rep_min: cfg.rep_min,
    rep_max: cfg.rep_max,
    target_sets: cfg.target_sets,
    target_rir: cfg.target_rir,
    increment_kg: cfg.increment_kg,
    is_bodyweight: cfg.exercise.is_bodyweight,
  });
}

/**
 * Starts a workout. Sets are pre-filled with the weights/reps of the last
 * session of each exercise (warm-ups included); the progression target is
 * stored per set (target_weight_kg / target_reps).
 */
export function startWorkout(params: { name: string; planDayId: string | null; exercises: ExerciseConfig[] }): WorkoutSession {
  const existing = activeSession();
  if (existing) return existing;
  const s = useDB.getState();
  const ts = nowISO();
  const session = insert('workout_sessions', {
    plan_day_id: params.planDayId,
    name: params.name,
    date: todayISO(),
    started_at: ts,
    ended_at: null,
    status: 'active',
    paused_at: null,
    paused_seconds: 0,
    notes: null,
  });
  const allSessions = live(s.tables.workout_sessions);
  const allSets = live(s.tables.workout_sets);
  const rows: Omit<WorkoutSet, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted'>[] = [];
  params.exercises.forEach((cfg, order) => {
    const last = lastPerformedSets(cfg.exercise.id, allSessions, allSets);
    const sugg = suggestionFor(cfg);
    const lastWorking = last.filter((x) => x.set_type !== 'warmup');
    const warmups = last.filter((x) => x.set_type === 'warmup');
    let idx = 0;
    for (const w of warmups) {
      rows.push(setRow(session.id, cfg.exercise.id, order, idx++, 'warmup', w.weight_kg, w.reps, null, null, cfg.rest_seconds));
    }
    for (let i = 0; i < cfg.target_sets; i++) {
      const prev = lastWorking[i] ?? lastWorking[lastWorking.length - 1];
      const weight = prev ? prev.weight_kg : sugg.weight_kg;
      const reps = prev ? prev.reps : sugg.reps[i] ?? cfg.rep_min;
      rows.push(setRow(session.id, cfg.exercise.id, order, idx++, 'working', weight, reps, sugg.weight_kg, sugg.reps[i] ?? sugg.reps[sugg.reps.length - 1] ?? null, cfg.rest_seconds));
    }
  });
  insertMany('workout_sets', rows);
  requestSync(15000);
  return session;
}

function setRow(sessionId: string, exerciseId: string, order: number, index: number, type: WorkoutSet['set_type'], weight: number, reps: number, tw: number | null, tr: number | null, rest: number) {
  return {
    session_id: sessionId,
    exercise_id: exerciseId,
    exercise_order: order,
    set_index: index,
    set_type: type,
    weight_kg: weight,
    reps,
    rir: null,
    rpe: null,
    completed: false,
    completed_at: null,
    rest_seconds: rest,
    target_weight_kg: tw,
    target_reps: tr,
  };
}

export function addExerciseToSession(sessionId: string, cfg: ExerciseConfig) {
  const s = useDB.getState();
  const sets = live(s.tables.workout_sets).filter((x) => x.session_id === sessionId);
  const order = sets.reduce((m, x) => Math.max(m, x.exercise_order), -1) + 1;
  const last = lastPerformedSets(cfg.exercise.id, live(s.tables.workout_sessions), live(s.tables.workout_sets), sessionId).filter((x) => x.set_type !== 'warmup');
  const sugg = suggestionFor(cfg, sessionId);
  insertMany(
    'workout_sets',
    Array.from({ length: cfg.target_sets }, (_, i) => {
      const prev = last[i] ?? last[last.length - 1];
      return setRow(sessionId, cfg.exercise.id, order, i, 'working', prev ? prev.weight_kg : sugg.weight_kg, prev ? prev.reps : sugg.reps[i] ?? cfg.rep_min, sugg.weight_kg, sugg.reps[i] ?? null, cfg.rest_seconds);
    }),
  );
}

export function addSet(sessionId: string, exerciseId: string, type: WorkoutSet['set_type'] = 'working') {
  const s = useDB.getState();
  const sets = live(s.tables.workout_sets)
    .filter((x) => x.session_id === sessionId && x.exercise_id === exerciseId)
    .sort((a, b) => a.set_index - b.set_index);
  const last = sets[sets.length - 1];
  return insert('workout_sets', setRow(sessionId, exerciseId, last?.exercise_order ?? 0, (last?.set_index ?? -1) + 1, type, last?.weight_kg ?? 0, last?.reps ?? 8, last?.target_weight_kg ?? null, last?.target_reps ?? null, last?.rest_seconds ?? 120));
}

export function updateSet(id: string, patch: Partial<WorkoutSet>) {
  update('workout_sets', id, patch);
}

export function toggleSetComplete(set: WorkoutSet) {
  update('workout_sets', set.id, { completed: !set.completed, completed_at: set.completed ? null : nowISO() });
  requestSync(20000);
}

export function removeSet(id: string) {
  remove('workout_sets', id);
}

export function removeExerciseFromSession(sessionId: string, exerciseId: string) {
  for (const x of live(useDB.getState().tables.workout_sets)) if (x.session_id === sessionId && x.exercise_id === exerciseId) remove('workout_sets', x.id);
}

export function pauseWorkout(session: WorkoutSession) {
  if (session.status !== 'active') return;
  update('workout_sessions', session.id, { status: 'paused', paused_at: nowISO() });
  requestSync();
}

export function resumeWorkout(session: WorkoutSession) {
  if (session.status !== 'paused' || !session.paused_at) return;
  const extra = Math.round((Date.now() - new Date(session.paused_at).getTime()) / 1000);
  update('workout_sessions', session.id, { status: 'active', paused_at: null, paused_seconds: (session.paused_seconds || 0) + Math.max(0, extra) });
  requestSync();
}

/** Completes the workout; incomplete sets are removed so statistics only contain performed sets. */
export function finishWorkout(session: WorkoutSession, notes?: string) {
  const s = useDB.getState();
  let paused = session.paused_seconds || 0;
  if (session.status === 'paused' && session.paused_at) paused += Math.round((Date.now() - new Date(session.paused_at).getTime()) / 1000);
  for (const x of live(s.tables.workout_sets)) if (x.session_id === session.id && !x.completed) remove('workout_sets', x.id);
  update('workout_sessions', session.id, { status: 'completed', ended_at: nowISO(), paused_at: null, paused_seconds: paused, notes: notes ?? session.notes });
  requestSync(1000);
}

export function discardWorkout(session: WorkoutSession) {
  update('workout_sessions', session.id, { status: 'discarded', ended_at: nowISO() });
  for (const x of live(useDB.getState().tables.workout_sets)) if (x.session_id === session.id) remove('workout_sets', x.id);
  requestSync();
}

export function deleteSession(sessionId: string) {
  for (const x of live(useDB.getState().tables.workout_sets)) if (x.session_id === sessionId) remove('workout_sets', x.id);
  remove('workout_sessions', sessionId);
  requestSync();
}

// ---------------------------------------------------------------- nutrition

export function logFood(params: {
  date: string;
  meal: MealType;
  food: FoodItem;
  grams: number;
  servingLabel?: string | null;
  estimateNote?: string | null;
}) {
  const n = nutrientsForAmount(params.food, params.grams);
  const row = insert('meal_entries', {
    date: params.date,
    meal: params.meal,
    food_ref: params.food.ref,
    name: params.food.name,
    brand: params.food.brand,
    amount_g: params.grams,
    serving_label: params.servingLabel ?? null,
    kcal: n.kcal,
    protein_g: n.protein_g,
    carbs_g: n.carbs_g,
    fat_g: n.fat_g,
    fiber_g: n.fiber_g,
    source: params.food.source,
    is_estimate: params.food.is_estimate,
    estimate_note: params.estimateNote ?? (params.food.is_estimate ? 'Durchschnitts-/Schätzwert' : null),
    logged_at: nowISO(),
  });
  requestSync();
  return row;
}

/** Copies all entries of a meal from one day to another ("Mahlzeit wiederholen"). */
export function repeatMeal(fromDate: string, meal: MealType, toDate: string, toMeal: MealType = meal) {
  const src = live(useDB.getState().tables.meal_entries).filter((e) => e.date === fromDate && e.meal === meal);
  const rows = src.map(({ id: _i, user_id: _u, created_at: _c, updated_at: _up, deleted: _d, ...rest }) => ({ ...rest, date: toDate, meal: toMeal, logged_at: nowISO() }));
  insertMany('meal_entries', rows);
  requestSync();
  return rows.length;
}

export function updateMealEntry(id: string, patch: Parameters<typeof update<'meal_entries'>>[2]) {
  update('meal_entries', id, patch);
  requestSync();
}

export function deleteMealEntry(id: string) {
  remove('meal_entries', id);
  requestSync();
}

// ---------------------------------------------------------------- body / steps / check-in

export function logWeight(date: string, weight: number, bodyFat: number | null = null, note: string | null = null) {
  const existing = live(useDB.getState().tables.weight_entries).find((w) => w.date === date);
  if (existing) update('weight_entries', existing.id, { weight_kg: weight, body_fat_pct: bodyFat ?? existing.body_fat_pct, note });
  else insert('weight_entries', { date, weight_kg: weight, body_fat_pct: bodyFat, source: 'manual', note });
  requestSync();
}

export function logSteps(date: string, steps: number, source: 'manual' | 'apple_health' | 'health_connect' = 'manual') {
  const existing = live(useDB.getState().tables.step_entries).find((w) => w.date === date && w.source === source);
  if (existing) update('step_entries', existing.id, { steps });
  else insert('step_entries', { date, steps, source });
  requestSync();
}

export function saveCheckin(date: string, data: { mood: number | null; energy: number | null; sleep_hours: number | null; note: string | null }) {
  const existing = live(useDB.getState().tables.daily_checkins).find((c) => c.date === date);
  if (existing) update('daily_checkins', existing.id, { ...data, day_closed: true, completed_at: nowISO() });
  else insert('daily_checkins', { date, ...data, day_closed: true, completed_at: nowISO() });
  requestSync();
}
