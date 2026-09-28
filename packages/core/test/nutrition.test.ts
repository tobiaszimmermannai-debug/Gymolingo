import { describe, expect, it } from 'vitest';
import { calculateTargets, mifflinStJeor, adaptiveCalorieAdjustment, suggestStepTarget } from '../src/nutrition/targets';
import { nutrientsForAmount, validateNutrients, recipeNutrients, dayNutrition, remainingForDay, isDayLogged, isProteinHit } from '../src/nutrition/calc';
import { FOODS, searchFoods, foodWarnings, FOOD_MAP } from '../src/nutrition/foods';
import { parseOffProduct, isValidBarcode, fetchOffProduct, searchOff } from '../src/nutrition/openFoodFacts';
import { meal } from './fixtures';

describe('targets', () => {
  it('Mifflin-St Jeor reference values', () => {
    expect(mifflinStJeor('male', 80, 180, 30)).toBe(1780);
    expect(mifflinStJeor('female', 60, 165, 30)).toBeCloseTo(1320.25, 2);
  });

  it('fat loss: deficit, high protein, macros add up to calories', () => {
    const t = calculateTargets({ sex: 'male', age: 30, height_cm: 180, weight_kg: 85, activity_level: 'moderate', training_days_per_week: 4, goal: 'fat_loss' });
    expect(t.calorie_target).toBeLessThan(t.tdee);
    expect(t.protein_target_g).toBeGreaterThanOrEqual(180);
    const kcal = t.protein_target_g * 4 + t.carbs_target_g * 4 + t.fat_target_g * 9;
    expect(Math.abs(kcal - t.calorie_target)).toBeLessThan(60);
    expect(t.weekly_rate_kg).toBeLessThan(0);
  });

  it('muscle gain: surplus capped', () => {
    const t = calculateTargets({ sex: 'female', age: 25, height_cm: 168, weight_kg: 60, activity_level: 'light', training_days_per_week: 3, goal: 'muscle_gain' });
    expect(t.calorie_target - t.tdee).toBeLessThanOrEqual(360);
    expect(t.calorie_target).toBeGreaterThan(t.tdee);
    expect(t.fat_target_g).toBeGreaterThanOrEqual(36);
  });

  it('very heavy person uses reference weight for protein', () => {
    const t = calculateTargets({ sex: 'male', age: 40, height_cm: 175, weight_kg: 140, activity_level: 'sedentary', training_days_per_week: 2, goal: 'fat_loss' });
    expect(t.protein_target_g).toBeLessThan(2.2 * 140);
  });

  it('keto keeps carbs low', () => {
    const t = calculateTargets({ sex: 'male', age: 30, height_cm: 180, weight_kg: 80, activity_level: 'moderate', training_days_per_week: 3, goal: 'strength', diet_type: 'keto' });
    expect(t.carbs_target_g).toBeLessThanOrEqual(30);
  });

  it('step target suggestion', () => {
    expect(suggestStepTarget('fat_loss', 'sedentary')).toBe(7500);
  });

  it('adaptive adjustment only with enough data and meaningful deviation', () => {
    expect(adaptiveCalorieAdjustment({ plannedWeeklyRateKg: -0.5, observedWeeklyRateKg: -0.45, daysOfData: 28, avgLoggedCalories: 2000, loggingCompleteness: 1, currentTarget: 2000 })).toBeNull();
    expect(adaptiveCalorieAdjustment({ plannedWeeklyRateKg: -0.5, observedWeeklyRateKg: 0, daysOfData: 7, avgLoggedCalories: 2000, loggingCompleteness: 1, currentTarget: 2000 })).toBeNull();
    const adj = adaptiveCalorieAdjustment({ plannedWeeklyRateKg: -0.5, observedWeeklyRateKg: 0.1, daysOfData: 28, avgLoggedCalories: 2000, loggingCompleteness: 1, currentTarget: 2000 });
    expect(adj?.adjustKcal).toBe(-250);
  });
});

describe('calc', () => {
  it('nutrients for amount', () => {
    const chicken = FOOD_MAP['builtin:haehnchenbrust'];
    const n = nutrientsForAmount(chicken, 200);
    expect(n.kcal).toBe(210);
    expect(n.protein_g).toBe(47);
  });

  it('validates implausible values', () => {
    expect(validateNutrients({ kcal_100: 100, protein_100: 20, carbs_100: 2, fat_100: 1.5, fiber_100: 0, sugar_100: null, salt_100: null })).toEqual([]);
    expect(validateNutrients({ kcal_100: 1000, protein_100: 60, carbs_100: 30, fat_100: 30, fiber_100: 0, sugar_100: null, salt_100: null }).length).toBeGreaterThan(0);
    expect(validateNutrients({ kcal_100: 50, protein_100: 20, carbs_100: 20, fat_100: 20, fiber_100: 0, sugar_100: null, salt_100: null })[0]).toContain('passen nicht');
  });

  it('built-in foods have plausible values', () => {
    for (const f of FOODS) {
      const issues = validateNutrients(f).filter((i) => !i.includes('passen nicht') || !f.tags?.includes('alcohol'));
      expect(issues, f.name).toEqual([]);
      expect(f.servings.length, f.name).toBeGreaterThan(0);
    }
    expect(FOODS.length).toBeGreaterThan(120);
  });

  it('recipe per-100 g', () => {
    const r = recipeNutrients([
      { ...FOOD_MAP['builtin:haferflocken'], amount_g: 50, deleted: false },
      { ...FOOD_MAP['builtin:milch-15'], amount_g: 200, deleted: false },
    ] as any);
    expect(r.totalGrams).toBe(250);
    expect(r.totals.kcal).toBe(186 + 94);
    expect(r.per100.kcal_100).toBe(112);
  });

  it('day totals, remaining, flags', () => {
    const meals = [meal('2026-01-01', 600, 50), meal('2026-01-01', 800, 60), meal('2026-01-02', 500, 20), meal('2026-01-01', 300, 10, { deleted: true })];
    const d = dayNutrition('2026-01-01', meals);
    expect(d.totals.kcal).toBe(1400);
    expect(d.entries).toBe(2);
    const rem = remainingForDay(d.totals, { calorie_target: 2300, protein_target_g: 180, carbs_target_g: 200, fat_target_g: 70 });
    expect(rem.kcal).toBe(900);
    expect(rem.protein_g).toBe(70);
    expect(isDayLogged(d, 2300)).toBe(true);
    expect(isProteinHit(d, 180)).toBe(false);
    expect(isProteinHit(d, 115)).toBe(true);
  });
});

describe('food search & warnings', () => {
  it('finds German foods with umlaut-insensitive search', () => {
    expect(searchFoods(FOODS, 'hähnchen')[0].name).toContain('Hähnchen');
    expect(searchFoods(FOODS, 'haehnchen').length).toBeGreaterThan(0);
    expect(searchFoods(FOODS, 'quark')[0].name).toBe('Magerquark');
  });
  it('warns about allergens and diet', () => {
    const quark = FOOD_MAP['builtin:magerquark'];
    expect(foodWarnings(quark, { diet_type: 'vegan', allergies: [], intolerances: ['lactose'] })).toEqual(['Enthält Milch/Laktose', 'Nicht vegan']);
    expect(foodWarnings(FOOD_MAP['builtin:tofu'], { diet_type: 'vegan', allergies: [], intolerances: [] })).toEqual([]);
  });
});

describe('Open Food Facts', () => {
  const product = {
    code: '4000417025005',
    product_name_de: 'Proteinriegel Test',
    brands: 'TestBrand, Other',
    serving_quantity: 45,
    serving_size: '45 g',
    allergens_tags: ['en:milk', 'en:nuts'],
    nutriments: { 'energy-kcal_100g': 380, proteins_100g: 33, carbohydrates_100g: 30, fat_100g: 12, fiber_100g: 9, salt_100g: 0.3 },
  };
  it('parses products', () => {
    const f = parseOffProduct(product)!;
    expect(f.ref).toBe('off:4000417025005');
    expect(f.brand).toBe('TestBrand');
    expect(f.servings[0].grams).toBe(45);
    expect(f.tags).toEqual(['milk', 'nuts']);
    expect(f.is_estimate).toBe(false);
  });
  it('derives kcal from kJ and flags incomplete data', () => {
    const f = parseOffProduct({ code: '1', product_name: 'X', nutriments: { 'energy-kj_100g': 418.4, proteins_100g: 5 } })!;
    expect(f.kcal_100).toBe(100);
    expect(f.is_estimate).toBe(true);
    expect(parseOffProduct({ code: '1', product_name: '', nutriments: {} })).toBeNull();
  });
  it('fetch with mock', async () => {
    const fetchImpl = async (url: string) => ({ ok: true, status: 200, json: async () => (url.includes('/product/') ? { status: 1, product } : { products: [product, { code: '2' }] }) });
    expect((await fetchOffProduct('4000417025005', fetchImpl))!.name).toBe('Proteinriegel Test');
    expect(await searchOff('protein', fetchImpl)).toHaveLength(1);
    const notFound = async () => ({ ok: false, status: 404, json: async () => ({}) });
    expect(await fetchOffProduct('4000417025005', notFound)).toBeNull();
  });
  it('barcode check digits', () => {
    expect(isValidBarcode('4000417025005')).toBe(true);
    expect(isValidBarcode('4000417025006')).toBe(false);
    expect(isValidBarcode('96385074')).toBe(true);
  });
});
