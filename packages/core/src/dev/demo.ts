/**
 * Deterministic, realistic demo data for development environments
 * (local Supabase seeding, screenshots, performance tests). Never used in production flows.
 */
import type { ISODate } from '../dates';
import { addDays, dateRange, weekdayIndex } from '../dates';
import { FOOD_MAP } from '../nutrition/foods';
import { nutrientsForAmount } from '../nutrition/calc';
import { calculateTargets } from '../nutrition/targets';
import { EXERCISE_MAP } from '../training/exercises';
import { suggestProgression, type ExerciseSession } from '../training/progression';
import { generatePlanTemplate } from '../training/templates';
import type {
  AthleteProfile,
  BaseRow,
  BodyMeasurement,
  DailyCheckin,
  MealEntry,
  MealType,
  PlanDay,
  PlanExercise,
  StepEntry,
  WeightEntry,
  WorkoutPlan,
  WorkoutSession,
  WorkoutSet,
  CardioSession,
} from '../types';
import { cardioKcal } from '../cardio/energy';

export interface DemoData {
  athlete_profiles: AthleteProfile[];
  workout_plans: WorkoutPlan[];
  plan_days: PlanDay[];
  plan_exercises: PlanExercise[];
  workout_sessions: WorkoutSession[];
  workout_sets: WorkoutSet[];
  meal_entries: MealEntry[];
  weight_entries: WeightEntry[];
  step_entries: StepEntry[];
  daily_checkins: DailyCheckin[];
  body_measurements: BodyMeasurement[];
  cardio_sessions: CardioSession[];
}

/** Mulberry32 PRNG. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const START_WEIGHTS: Record<string, number> = {
  'bench-press': 70, 'barbell-row': 60, 'overhead-press': 40, 'lat-pulldown': 55, 'lateral-raise': 8, 'triceps-pushdown': 25, 'db-curl': 12,
  squat: 85, 'romanian-deadlift': 70, 'leg-extension': 45, 'lying-leg-curl': 35, 'standing-calf-raise': 60, 'cable-crunch': 30,
  'incline-db-press': 24, 'seated-cable-row': 55, 'db-shoulder-press': 20, 'pull-up': 0, 'cable-fly': 15, 'face-pull': 20, 'hammer-curl': 12,
  'leg-press': 140, 'hip-thrust': 80, 'bulgarian-split-squat': 14, 'seated-leg-curl': 35, 'seated-calf-raise': 40, 'hanging-leg-raise': 0,
};

const MEALS: Record<MealType, [string, number][][]> = {
  breakfast: [
    [['builtin:haferflocken', 70], ['builtin:milch-15', 250], ['builtin:banane', 120]],
    [['builtin:skyr', 250], ['builtin:beeren-tk', 100], ['builtin:haferflocken', 40]],
    [['builtin:vollkornbrot', 100], ['builtin:ei', 110], ['builtin:kochschinken', 40]],
  ],
  lunch: [
    [['builtin:reis-gekocht', 250], ['builtin:haehnchenbrust-gegart', 180], ['builtin:brokkoli', 200]],
    [['builtin:nudeln-gekocht', 300], ['builtin:rinderhack-mager', 150], ['builtin:tomate', 150]],
    [['builtin:kartoffeln', 300], ['builtin:lachs', 150], ['builtin:gemuesemischung', 200]],
  ],
  dinner: [
    [['builtin:vollkornbrot', 100], ['builtin:huettenkaese', 200], ['builtin:gurke', 150]],
    [['builtin:wrap', 124], ['builtin:putenbrust', 150], ['builtin:paprika', 150], ['builtin:mozzarella-light', 60]],
    [['builtin:magerquark', 250], ['builtin:whey', 30], ['builtin:heidelbeeren', 125]],
  ],
  snack: [[['builtin:whey', 30], ['builtin:apfel', 150]], [['builtin:proteinriegel', 60]], [['builtin:skyr', 450]], [['builtin:magerquark', 250], ['builtin:mandeln', 20]]],
};

export function generateDemoData(opts: { userId: string; today: ISODate; weeks?: number; seed?: number }): DemoData {
  const rnd = prng(opts.seed ?? 42);
  const weeks = opts.weeks ?? 12;
  const start = addDays(opts.today, -weeks * 7 + 1);
  const uid = () => {
    const h = Array.from({ length: 32 }, () => Math.floor(rnd() * 16).toString(16)).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${'89ab'[Math.floor(rnd() * 4)]}${h.slice(17, 20)}-${h.slice(20, 32)}`;
  };
  const ts = (date: ISODate, hour: number, min = 0) => `${date}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00.000Z`;
  const base = (date: ISODate, hour = 8): BaseRow => ({ id: uid(), user_id: opts.userId, created_at: ts(date, hour), updated_at: ts(date, hour), deleted: false });
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
  const noise = (sd: number) => (rnd() + rnd() + rnd() - 1.5) * sd * 1.2;

  const startWeight = 88;
  const t = calculateTargets({ sex: 'male', age: 32, height_cm: 182, weight_kg: startWeight, activity_level: 'moderate', training_days_per_week: 4, goal: 'fat_loss' });
  const profile: AthleteProfile = {
    ...base(start),
    id: opts.userId,
    display_name: 'Demo',
    birth_year: Number(opts.today.slice(0, 4)) - 32,
    sex: 'male',
    height_cm: 182,
    start_weight_kg: startWeight,
    goal_weight_kg: 82,
    experience_level: 'intermediate',
    training_years: 3,
    goal: 'fat_loss',
    activity_level: 'moderate',
    schedule_type: 'fixed_days',
    training_days_per_week: 4,
    training_weekdays: [0, 1, 3, 4],
    preferred_workout_time: '18:00',
    equipment: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'],
    diet_type: 'omnivore',
    allergies: [],
    intolerances: [],
    targets_mode: 'auto',
    calorie_target: t.calorie_target,
    protein_target_g: t.protein_target_g,
    carbs_target_g: t.carbs_target_g,
    fat_target_g: t.fat_target_g,
    fiber_target_g: t.fiber_target_g,
    step_target: 10000,
    weekly_rate_kg: t.weekly_rate_kg,
    weight_tracking_enabled: true,
    onboarding_completed: true,
  };

  // plan
  const tpl = generatePlanTemplate({ daysPerWeek: 4, equipment: profile.equipment, goal: 'fat_loss', experience: 'intermediate' });
  const plan: WorkoutPlan = { ...base(start), name: tpl.name, description: tpl.description, is_active: true, sort_order: 0 };
  const days: PlanDay[] = [];
  const pex: PlanExercise[] = [];
  tpl.days.forEach((d, i) => {
    const day: PlanDay = { ...base(start), plan_id: plan.id, name: d.name, weekday: profile.training_weekdays[i], sort_order: i };
    days.push(day);
    d.exercises.forEach((e, j) => pex.push({ ...base(start), plan_day_id: day.id, exercise_id: e.exercise_id, sort_order: j, target_sets: e.target_sets, rep_min: e.rep_min, rep_max: e.rep_max, target_rir: e.target_rir, rest_seconds: e.rest_seconds, increment_kg: null, notes: null }));
  });

  const sessions: WorkoutSession[] = [];
  const sets: WorkoutSet[] = [];
  const history = new Map<string, ExerciseSession[]>();
  const meals: MealEntry[] = [];
  const weights: WeightEntry[] = [];
  const steps: StepEntry[] = [];
  const checkins: DailyCheckin[] = [];
  const measurements: BodyMeasurement[] = [];
  const cardio: CardioSession[] = [];

  let trueWeight = startWeight;
  for (const date of dateRange(start, opts.today)) {
    const wd = weekdayIndex(date);
    const isToday = date === opts.today;
    trueWeight += -0.055 + noise(0.02);

    // weight (most mornings)
    if (rnd() < 0.85) weights.push({ ...base(date, 7), date, weight_kg: Math.round((trueWeight + noise(0.5)) * 10) / 10, body_fat_pct: wd === 0 ? Math.round((22 - (startWeight - trueWeight) * 0.6 + noise(0.4)) * 10) / 10 : null, source: 'manual', note: null });

    // training
    const dayIdx = profile.training_weekdays.indexOf(wd);
    if (dayIdx >= 0 && !isToday && rnd() < 0.9) {
      const day = days[dayIdx];
      const startMin = 17 * 60 + Math.floor(rnd() * 120);
      const session: WorkoutSession = {
        ...base(date, 17),
        plan_day_id: day.id,
        name: day.name,
        date,
        started_at: ts(date, Math.floor(startMin / 60), startMin % 60),
        ended_at: ts(date, Math.floor((startMin + 65) / 60), (startMin + 65) % 60),
        status: 'completed',
        paused_at: null,
        paused_seconds: 0,
        notes: null,
      };
      sessions.push(session);
      pex.filter((p) => p.plan_day_id === day.id).forEach((p, order) => {
        const def = EXERCISE_MAP[p.exercise_id];
        const hist = history.get(p.exercise_id) ?? [];
        const sugg = suggestProgression(hist, { rep_min: p.rep_min, rep_max: p.rep_max, target_sets: p.target_sets, target_rir: p.target_rir, increment_kg: def.increment_kg, is_bodyweight: def.is_bodyweight });
        const weight = sugg.kind === 'first_time' ? START_WEIGHTS[p.exercise_id] ?? 20 : sugg.weight_kg;
        const performed = Array.from({ length: p.target_sets }, (_, i) => {
          const target = sugg.reps[i] ?? p.rep_min + 2;
          const reps = Math.max(1, Math.min(p.rep_max + 1, target + (rnd() < 0.7 ? 0 : rnd() < 0.6 ? 1 : -1) - (i === p.target_sets - 1 && rnd() < 0.3 ? 1 : 0)));
          return { weight_kg: weight, reps, rir: Math.max(0, Math.min(4, Math.round(p.target_rir + noise(0.8)))), rpe: null, set_type: 'working' as const };
        });
        history.set(p.exercise_id, [{ date, sets: performed }, ...hist]);
        performed.forEach((s, i) =>
          sets.push({ ...base(date, 18), session_id: session.id, exercise_id: p.exercise_id, exercise_order: order, set_index: i, set_type: 'working', weight_kg: s.weight_kg, reps: s.reps, rir: s.rir, rpe: null, completed: true, completed_at: ts(date, 18), rest_seconds: p.rest_seconds, target_weight_kg: sugg.weight_kg, target_reps: sugg.reps[i] ?? null }),
        );
      });
    }

    // nutrition (most days; today only breakfast + lunch)
    if (rnd() < 0.88) {
      const mealsToday: MealType[] = isToday ? ['breakfast', 'lunch'] : ['breakfast', 'lunch', 'dinner', ...(rnd() < 0.7 ? (['snack'] as MealType[]) : [])];
      for (const m of mealsToday) {
        for (const [ref, grams] of pick(MEALS[m])) {
          const food = FOOD_MAP[ref];
          if (!food) continue;
          const g = Math.round(grams * (0.85 + rnd() * 0.3));
          const n = nutrientsForAmount(food, g);
          const hour = m === 'breakfast' ? 7 : m === 'lunch' ? 12 : m === 'dinner' ? 19 : 16;
          meals.push({ ...base(date, hour), date, meal: m, food_ref: ref, name: food.name, brand: null, amount_g: g, serving_label: null, kcal: n.kcal, protein_g: n.protein_g, carbs_g: n.carbs_g, fat_g: n.fat_g, fiber_g: n.fiber_g, source: 'builtin', is_estimate: food.is_estimate, estimate_note: null, logged_at: ts(date, hour) });
        }
      }
    }

    if (!isToday) {
      steps.push({ ...base(date, 21), date, steps: Math.round(Math.max(2500, 9000 + noise(2500) + (wd >= 5 ? 1500 : 0))), source: 'manual' });
      if (rnd() < 0.75) checkins.push({ ...base(date, 21), date, mood: Math.max(1, Math.min(5, Math.round(3.8 + noise(0.8)))), energy: Math.max(1, Math.min(5, Math.round(3.5 + noise(0.9)))), sleep_hours: Math.round((7 + noise(0.8)) * 2) / 2, note: null, day_closed: true, completed_at: ts(date, 21) });
    }
    // endurance & EMS: EMS on Wednesdays, a jog on Saturdays, a walk on some Sundays
    if (!isToday && (wd === 2 || wd === 5 || (wd === 6 && rnd() < 0.5))) {
      const activity = wd === 2 ? 'ems' : wd === 5 ? 'jog' : 'walk';
      const duration_min = activity === 'ems' ? 20 : activity === 'jog' ? Math.round(30 + rnd() * 12) : Math.round(40 + rnd() * 30);
      const distance_km = activity === 'ems' ? null : Math.round((duration_min / 60) * (activity === 'jog' ? 8.6 + noise(0.5) : 5 + noise(0.3)) * 10) / 10;
      const intensity = activity === 'ems' ? (rnd() < 0.6 ? 'intense' : 'medium') : 'medium';
      const row = { activity, duration_min, distance_km, intensity } as const;
      cardio.push({ ...base(date, activity === 'ems' ? 18 : 9), date, ...row, kcal: cardioKcal(row, trueWeight), kcal_manual: false, note: null });
    }
    if (wd === 6) {
      const lost = startWeight - trueWeight;
      measurements.push({ ...base(date, 9), date, waist_cm: Math.round((94 - lost * 0.9 + noise(0.4)) * 10) / 10, chest_cm: Math.round((106 - lost * 0.3 + noise(0.4)) * 10) / 10, hips_cm: Math.round((102 - lost * 0.4 + noise(0.4)) * 10) / 10, arm_cm: Math.round((37 + noise(0.2)) * 10) / 10, thigh_cm: Math.round((60 - lost * 0.2 + noise(0.3)) * 10) / 10, neck_cm: 40, note: null });
    }
  }

  return {
    athlete_profiles: [profile],
    workout_plans: [plan],
    plan_days: days,
    plan_exercises: pex,
    workout_sessions: sessions,
    workout_sets: sets,
    meal_entries: meals,
    weight_entries: weights,
    step_entries: steps,
    daily_checkins: checkins,
    body_measurements: measurements,
    cardio_sessions: cardio,
  };
}
