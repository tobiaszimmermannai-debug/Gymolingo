/**
 * Initial calorie & macro targets.
 *
 * - BMR: Mifflin-St Jeor (1990).
 * - TDEE: BMR × activity factor (+ training days adjustment).
 * - Goal adjustment: relative deficit/surplus with sensible bounds.
 * - Protein: g per kg body weight depending on goal.
 * - Fat: share of calories with a floor of 0.6 g/kg.
 * - Carbs: remainder.
 *
 * All results are *starting points* – the coach adapts them to the real
 * weight trend later (see `adaptiveCalorieAdjustment`).
 */
import type { ActivityLevel, DietType, Goal, Sex } from '../types';

export interface TargetInput {
  sex: Sex | null;
  age: number;
  height_cm: number;
  weight_kg: number;
  activity_level: ActivityLevel;
  training_days_per_week: number;
  goal: Goal;
  diet_type?: DietType;
}

export interface MacroTargets {
  bmr: number;
  tdee: number;
  calorie_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
  fiber_target_g: number;
  weekly_rate_kg: number;
  explanation: string[];
}

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABELS_DE: Record<ActivityLevel, string> = {
  sedentary: 'Überwiegend sitzend (< 5.000 Schritte)',
  light: 'Leicht aktiv (5.000–7.500 Schritte)',
  moderate: 'Mäßig aktiv (7.500–10.000 Schritte)',
  active: 'Aktiv (10.000–12.500 Schritte / körperlicher Job)',
  very_active: 'Sehr aktiv (> 12.500 Schritte / harte körperliche Arbeit)',
};

export function mifflinStJeor(sex: Sex | null, weight: number, height: number, age: number): number {
  const base = 10 * weight + 6.25 * height - 5 * age;
  if (sex === 'male') return base + 5;
  if (sex === 'female') return base - 161;
  // diverse / unknown: midpoint of both formulas
  return base - 78;
}

const round = (n: number, step = 1) => Math.round(n / step) * step;

export function calculateTargets(input: TargetInput): MacroTargets {
  const explanation: string[] = [];
  const bmr = mifflinStJeor(input.sex, input.weight_kg, input.height_cm, input.age);
  explanation.push(`Grundumsatz (Mifflin-St Jeor): ${Math.round(bmr)} kcal`);

  // Activity factor describes daily life; we add a small bonus per training day
  // (~ 0.025 per weekly session ≈ 250–400 kcal per session spread over the week).
  const trainingBonus = Math.min(7, Math.max(0, input.training_days_per_week)) * 0.025;
  const factor = ACTIVITY_FACTORS[input.activity_level] + trainingBonus;
  const tdee = bmr * factor;
  explanation.push(
    `Gesamtumsatz: ${Math.round(bmr)} × ${factor.toFixed(3)} (Alltag + ${input.training_days_per_week} Trainingstage) ≈ ${Math.round(tdee)} kcal`,
  );

  let calorieTarget: number;
  let weeklyRate: number;
  switch (input.goal) {
    case 'fat_loss': {
      // ~20 % deficit, capped at 750 kcal, never below BMR*1.0 for safety.
      const deficit = Math.min(750, tdee * 0.2);
      calorieTarget = Math.max(tdee - deficit, bmr * 1.0);
      weeklyRate = -((tdee - calorieTarget) * 7) / 7700;
      explanation.push(`Fettabbau: Defizit von ${Math.round(tdee - calorieTarget)} kcal/Tag`);
      break;
    }
    case 'muscle_gain': {
      // lean bulk: ~10 % surplus, capped at 350 kcal
      const surplus = Math.min(350, tdee * 0.1);
      calorieTarget = tdee + surplus;
      weeklyRate = (surplus * 7) / 7700;
      explanation.push(`Muskelaufbau: moderater Überschuss von ${Math.round(surplus)} kcal/Tag`);
      break;
    }
    case 'recomposition': {
      calorieTarget = tdee - Math.min(250, tdee * 0.08);
      weeklyRate = -((tdee - calorieTarget) * 7) / 7700;
      explanation.push('Recomposition: leichtes Defizit, hoher Proteinanteil');
      break;
    }
    case 'strength':
    default: {
      calorieTarget = tdee + 100;
      weeklyRate = (100 * 7) / 7700;
      explanation.push('Kraftsteigerung: Erhaltung mit kleinem Puffer für Leistung');
      break;
    }
  }

  // Protein per kg body weight (evidence range 1.6–2.2 g/kg).
  const proteinPerKg: Record<Goal, number> = {
    fat_loss: 2.2,
    recomposition: 2.2,
    muscle_gain: 1.8,
    strength: 1.8,
  };
  // For very heavy people use a reference weight (approx. BMI 27) to avoid absurd protein values.
  const bmi = input.weight_kg / Math.pow(input.height_cm / 100, 2);
  const refWeight = bmi > 30 ? 27 * Math.pow(input.height_cm / 100, 2) : input.weight_kg;
  let protein = proteinPerKg[input.goal] * refWeight;
  explanation.push(
    `Protein: ${proteinPerKg[input.goal]} g/kg × ${Math.round(refWeight)} kg${bmi > 30 ? ' (Referenzgewicht)' : ''}`,
  );

  // Fat: 25 % (keto: 65 %) of calories, at least 0.6 g/kg
  const fatShare = input.diet_type === 'keto' ? 0.65 : 0.27;
  let fat = Math.max((calorieTarget * fatShare) / 9, 0.6 * input.weight_kg);

  let carbs = (calorieTarget - protein * 4 - fat * 9) / 4;
  if (input.diet_type === 'keto') carbs = Math.min(carbs, 30);
  if (carbs < 50 && input.diet_type !== 'keto') {
    // keep a minimum of carbs for training performance – take from fat above floor
    const missing = 50 - carbs;
    const fatFloor = 0.6 * input.weight_kg;
    const fatReduction = Math.min(missing * (4 / 9), Math.max(0, fat - fatFloor));
    fat -= fatReduction;
    carbs = (calorieTarget - protein * 4 - fat * 9) / 4;
  }
  carbs = Math.max(0, carbs);
  if (input.diet_type === 'keto') {
    // recompute fat to fill calories
    fat = Math.max(0, (calorieTarget - protein * 4 - carbs * 4) / 9);
  }

  const fiber = Math.round((calorieTarget / 1000) * 14); // DGE: ~14 g per 1000 kcal (min 30)

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calorie_target: round(calorieTarget, 10),
    protein_target_g: round(protein, 5),
    carbs_target_g: round(carbs, 5),
    fat_target_g: round(fat, 5),
    fiber_target_g: Math.max(30, fiber),
    weekly_rate_kg: Math.round(weeklyRate * 100) / 100,
    explanation,
  };
}

/** Step goal suggestion by goal and current activity. */
export function suggestStepTarget(goal: Goal, activity: ActivityLevel): number {
  const base: Record<ActivityLevel, number> = {
    sedentary: 6000,
    light: 7500,
    moderate: 9000,
    active: 11000,
    very_active: 12500,
  };
  const bonus = goal === 'fat_loss' ? 1500 : goal === 'recomposition' ? 1000 : 0;
  return Math.min(15000, base[activity] + bonus);
}

/**
 * Adaptive calorie adjustment ("MacroFactor-style" but transparent):
 * compares the observed weekly weight change (from the smoothed trend) with the
 * planned rate and suggests a calorie correction. 1 kg ≈ 7700 kcal.
 * Only suggests changes if enough data exists and the deviation is meaningful.
 */
export function adaptiveCalorieAdjustment(params: {
  plannedWeeklyRateKg: number;
  observedWeeklyRateKg: number | null;
  daysOfData: number;
  avgLoggedCalories: number | null;
  loggingCompleteness: number; // 0..1 share of days with plausible food logs
  currentTarget: number;
}): { adjustKcal: number; reason: string } | null {
  const { plannedWeeklyRateKg, observedWeeklyRateKg, daysOfData, loggingCompleteness } = params;
  if (observedWeeklyRateKg === null || daysOfData < 14) return null;
  const diffKg = observedWeeklyRateKg - plannedWeeklyRateKg; // positive => gaining faster than planned
  if (Math.abs(diffKg) < 0.15) return null;
  // daily kcal difference implied by the deviation
  let adjust = -((diffKg * 7700) / 7);
  // be conservative: at most ±250 kcal per step, rounded to 25
  adjust = Math.max(-250, Math.min(250, adjust));
  adjust = Math.round(adjust / 25) * 25;
  if (adjust === 0) return null;
  const confidence = loggingCompleteness >= 0.8 ? '' : ' (Hinweis: Ernährungsprotokoll lückenhaft – Empfehlung mit Vorsicht)';
  const dir = adjust < 0 ? 'senken' : 'erhöhen';
  return {
    adjustKcal: adjust,
    reason: `Dein Gewichtstrend liegt bei ${observedWeeklyRateKg >= 0 ? '+' : ''}${observedWeeklyRateKg.toFixed(2)} kg/Woche, geplant waren ${plannedWeeklyRateKg >= 0 ? '+' : ''}${plannedWeeklyRateKg.toFixed(2)} kg/Woche. Kalorienziel um ${Math.abs(adjust)} kcal ${dir}.${confidence}`,
  };
}
