import type { ISODate } from '../dates';
import type { MealEntry, MealType, Nutrients100, RecipeItem } from '../types';

export interface MacroTotals {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

export const EMPTY_TOTALS: MacroTotals = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Nutrients for `grams` of a food given per-100 g values. */
export function nutrientsForAmount(food: Nutrients100, grams: number): MacroTotals {
  const f = Math.max(0, grams) / 100;
  return {
    kcal: Math.round(food.kcal_100 * f),
    protein_g: r1(food.protein_100 * f),
    carbs_g: r1(food.carbs_100 * f),
    fat_g: r1(food.fat_100 * f),
    fiber_g: r1((food.fiber_100 ?? 0) * f),
  };
}

/** kcal derived from macros (Atwater 4/4/9) – used to sanity-check user input. */
export function kcalFromMacros(protein: number, carbs: number, fat: number): number {
  return Math.round(protein * 4 + carbs * 4 + fat * 9);
}

/**
 * Validates per-100 g values. Returns human-readable issues (German).
 * Physical limits: macros ≤ 100 g per 100 g, kcal ≤ 900, kcal roughly
 * consistent with macros (± 25 % / 40 kcal – fibre & alcohol cause deviations).
 */
export function validateNutrients(n: Nutrients100): string[] {
  const issues: string[] = [];
  if ([n.kcal_100, n.protein_100, n.carbs_100, n.fat_100].some((v) => v < 0 || Number.isNaN(v)))
    issues.push('Werte dürfen nicht negativ sein.');
  if (n.protein_100 + n.carbs_100 + n.fat_100 > 100.5) issues.push('Makros ergeben mehr als 100 g pro 100 g.');
  if (n.kcal_100 > 900) issues.push('Mehr als 900 kcal pro 100 g ist physikalisch nicht möglich.');
  const calc = kcalFromMacros(n.protein_100, n.carbs_100, n.fat_100);
  if (Math.abs(calc - n.kcal_100) > Math.max(40, n.kcal_100 * 0.25))
    issues.push(`Kalorien (${Math.round(n.kcal_100)}) passen nicht zu den Makros (≈ ${calc} kcal).`);
  return issues;
}

export function sumTotals(entries: Pick<MealEntry, 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g' | 'fiber_g'>[]): MacroTotals {
  const t = entries.reduce<MacroTotals>(
    (acc, e) => ({
      kcal: acc.kcal + (e.kcal || 0),
      protein_g: acc.protein_g + (e.protein_g || 0),
      carbs_g: acc.carbs_g + (e.carbs_g || 0),
      fat_g: acc.fat_g + (e.fat_g || 0),
      fiber_g: acc.fiber_g + (e.fiber_g || 0),
    }),
    { ...EMPTY_TOTALS },
  );
  return { kcal: Math.round(t.kcal), protein_g: r1(t.protein_g), carbs_g: r1(t.carbs_g), fat_g: r1(t.fat_g), fiber_g: r1(t.fiber_g) };
}

export interface DayNutrition {
  date: ISODate;
  totals: MacroTotals;
  byMeal: Record<MealType, MacroTotals>;
  entries: number;
  estimatedEntries: number;
}

export const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
export const MEAL_LABELS_DE: Record<MealType, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  dinner: 'Abendessen',
  snack: 'Snacks',
};

/**
 * Entries grouped by date, cached per array instance (arrays from the store are
 * immutable snapshots), so per-day lookups are O(1) instead of O(n).
 */
const byDateCache = new WeakMap<readonly MealEntry[], Map<ISODate, MealEntry[]>>();
export function mealsByDate(all: readonly MealEntry[]): Map<ISODate, MealEntry[]> {
  let m = byDateCache.get(all);
  if (!m) {
    m = new Map();
    for (const e of all) {
      if (e.deleted) continue;
      const arr = m.get(e.date);
      if (arr) arr.push(e);
      else m.set(e.date, [e]);
    }
    byDateCache.set(all, m);
  }
  return m;
}

export function dayNutrition(date: ISODate, all: MealEntry[]): DayNutrition {
  const entries = mealsByDate(all).get(date) ?? [];
  const byMeal = Object.fromEntries(
    MEAL_ORDER.map((m) => [m, sumTotals(entries.filter((e) => e.meal === m))]),
  ) as Record<MealType, MacroTotals>;
  return {
    date,
    totals: sumTotals(entries),
    byMeal,
    entries: entries.length,
    estimatedEntries: entries.filter((e) => e.is_estimate).length,
  };
}

export interface Remaining {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  /** 0..1+ progress ratios */
  pct: { kcal: number; protein: number; carbs: number; fat: number };
}

export function remainingForDay(
  totals: MacroTotals,
  targets: { calorie_target: number; protein_target_g: number; carbs_target_g: number; fat_target_g: number },
): Remaining {
  const safe = (a: number, b: number) => (b > 0 ? a / b : 0);
  return {
    kcal: Math.round(targets.calorie_target - totals.kcal),
    protein_g: r1(targets.protein_target_g - totals.protein_g),
    carbs_g: r1(targets.carbs_target_g - totals.carbs_g),
    fat_g: r1(targets.fat_target_g - totals.fat_g),
    pct: {
      kcal: safe(totals.kcal, targets.calorie_target),
      protein: safe(totals.protein_g, targets.protein_target_g),
      carbs: safe(totals.carbs_g, targets.carbs_target_g),
      fat: safe(totals.fat_g, targets.fat_target_g),
    },
  };
}

/** Per-100 g nutrients of a recipe (all items cooked together, raw weights). */
export function recipeNutrients(items: Pick<RecipeItem, keyof Nutrients100 | 'amount_g' | 'deleted'>[]): {
  per100: Nutrients100;
  totalGrams: number;
  totals: MacroTotals;
} {
  const live = items.filter((i) => !i.deleted);
  const totalGrams = live.reduce((s, i) => s + i.amount_g, 0);
  const totals = sumTotals(live.map((i) => ({ ...nutrientsForAmount(i, i.amount_g) })));
  const f = totalGrams > 0 ? 100 / totalGrams : 0;
  return {
    totalGrams,
    totals,
    per100: {
      kcal_100: Math.round(totals.kcal * f),
      protein_100: r1(totals.protein_g * f),
      carbs_100: r1(totals.carbs_g * f),
      fat_100: r1(totals.fat_g * f),
      fiber_100: r1(totals.fiber_g * f),
      sugar_100: null,
      salt_100: null,
    },
  };
}

/** A day counts as "logged" when at least 2 entries exist or ≥ 50 % of target calories are recorded. */
export function isDayLogged(day: DayNutrition, calorieTarget: number): boolean {
  return day.entries >= 2 || (calorieTarget > 0 && day.totals.kcal >= calorieTarget * 0.5);
}

/** Protein goal reached with a small tolerance (95 %). */
export function isProteinHit(day: DayNutrition, proteinTarget: number): boolean {
  return proteinTarget > 0 && day.totals.protein_g >= proteinTarget * 0.95;
}

/** Calories within ±10 % of target. */
export function isCaloriesOnTarget(day: DayNutrition, calorieTarget: number): boolean {
  if (calorieTarget <= 0 || day.entries === 0) return false;
  return Math.abs(day.totals.kcal - calorieTarget) <= calorieTarget * 0.1;
}
