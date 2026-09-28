/**
 * Food sources: built-in German DB, the user's own foods & recipes, recently
 * logged foods and Open Food Facts (branded EU products, online).
 */
import { useEffect, useMemo, useState } from 'react';
import {
  FOODS,
  FOOD_MAP,
  fetchOffProduct,
  normalize,
  recipeNutrients,
  searchFoods,
  searchOff,
  type CustomFood,
  type FoodItem,
  type MealEntry,
  type Recipe,
  type RecipeItem,
} from '@gymolingo/core';
import { useDB } from '@/data/store';
import { useRows } from '@/data/hooks';
import { insert, update } from '@/data/store';
import { requestSync } from '@/data/sync';

export const SOURCE_LABEL: Record<string, string> = {
  builtin: 'Basis-Datenbank · Durchschnittswert',
  custom: 'Eigenes Lebensmittel',
  off: 'Open Food Facts · Herstellerangaben (Community)',
  ai: 'KI-Schätzung',
  recipe: 'Eigenes Rezept',
};

/** Session cache for Open Food Facts results (so the amount screen can open them). */
const offCache = new Map<string, FoodItem>();

export function customFoodToItem(c: CustomFood): FoodItem {
  return {
    ref: `food:${c.id}`,
    name: c.name,
    brand: c.brand,
    barcode: c.barcode,
    category: c.source === 'off' ? 'Markenprodukt' : 'Eigene Lebensmittel',
    kcal_100: Number(c.kcal_100),
    protein_100: Number(c.protein_100),
    carbs_100: Number(c.carbs_100),
    fat_100: Number(c.fat_100),
    fiber_100: c.fiber_100 === null ? null : Number(c.fiber_100),
    sugar_100: c.sugar_100 === null ? null : Number(c.sugar_100),
    salt_100: c.salt_100 === null ? null : Number(c.salt_100),
    servings: c.serving_g ? [{ label: c.serving_label || 'Portion', grams: Number(c.serving_g) }] : [],
    source: c.source,
    is_estimate: c.is_estimate,
    tags: [],
  };
}

export function recipeToItem(r: Recipe, items: RecipeItem[]): FoodItem {
  const mine = items.filter((i) => i.recipe_id === r.id && !i.deleted);
  const n = recipeNutrients(mine.map((i) => ({ ...i, kcal_100: Number(i.kcal_100), protein_100: Number(i.protein_100), carbs_100: Number(i.carbs_100), fat_100: Number(i.fat_100), amount_g: Number(i.amount_g) })));
  const perServing = n.totalGrams / Math.max(1, Number(r.servings));
  return {
    ref: `recipe:${r.id}`,
    name: r.name,
    brand: null,
    barcode: null,
    category: 'Rezept',
    ...n.per100,
    servings: perServing > 0 ? [{ label: `1 Portion (1/${formatServings(r.servings)})`, grams: Math.round(perServing) }] : [],
    source: 'recipe',
    is_estimate: false,
    tags: [],
  };
}

const formatServings = (s: number) => String(Number(s)).replace('.', ',');

export function resolveFood(ref: string): FoodItem | undefined {
  if (ref.startsWith('builtin:')) return FOOD_MAP[ref];
  const s = useDB.getState();
  if (ref.startsWith('food:')) {
    const c = s.tables.custom_foods[ref.slice(5)];
    return c ? customFoodToItem(c) : undefined;
  }
  if (ref.startsWith('recipe:')) {
    const r = s.tables.recipes[ref.slice(7)];
    return r ? recipeToItem(r, Object.values(s.tables.recipe_items)) : undefined;
  }
  if (ref.startsWith('off:')) {
    const cached = offCache.get(ref);
    if (cached) return cached;
    const saved = Object.values(s.tables.custom_foods).find((c) => !c.deleted && c.source === 'off' && c.barcode === ref.slice(4));
    return saved ? customFoodToItem(saved) : undefined;
  }
  return undefined;
}

/** Stores an Open Food Facts product locally (offline availability, favourites, sync). */
export function persistOffFood(food: FoodItem): FoodItem {
  if (food.source !== 'off' || !food.barcode) return food;
  const s = useDB.getState();
  const existing = Object.values(s.tables.custom_foods).find((c) => !c.deleted && c.source === 'off' && c.barcode === food.barcode);
  const data = {
    name: food.name,
    brand: food.brand,
    barcode: food.barcode,
    kcal_100: food.kcal_100,
    protein_100: food.protein_100,
    carbs_100: food.carbs_100,
    fat_100: food.fat_100,
    fiber_100: food.fiber_100,
    sugar_100: food.sugar_100,
    salt_100: food.salt_100,
    serving_label: food.servings[0]?.label ?? null,
    serving_g: food.servings[0]?.grams ?? null,
    source: 'off' as const,
    is_estimate: food.is_estimate,
    favorite: false,
  };
  const row = existing ? update('custom_foods', existing.id, data)! : insert('custom_foods', data);
  requestSync();
  return customFoodToItem(row);
}

export function cacheOffFood(food: FoodItem) {
  offCache.set(food.ref, food);
}

const offFetch = (url: string, init?: { headers?: Record<string, string> }) => fetch(url, init as RequestInit);

export async function lookupBarcode(code: string): Promise<FoodItem | null> {
  const s = useDB.getState();
  const local = Object.values(s.tables.custom_foods).find((c) => !c.deleted && c.barcode === code.replace(/\D/g, ''));
  if (local) return customFoodToItem(local);
  const food = await fetchOffProduct(code, offFetch);
  if (food) cacheOffFood(food);
  return food;
}

/** Recently logged foods (unique by ref, newest first). */
export function recentFoods(entries: MealEntry[], limit = 12): { ref: string; name: string; brand: string | null; lastAmount: number; lastServing: string | null; kcal100: number }[] {
  const seen = new Set<string>();
  const out: { ref: string; name: string; brand: string | null; lastAmount: number; lastServing: string | null; kcal100: number }[] = [];
  for (const e of [...entries].sort((a, b) => b.logged_at.localeCompare(a.logged_at))) {
    if (e.deleted || seen.has(e.food_ref) || e.food_ref.startsWith('quick:')) continue;
    seen.add(e.food_ref);
    out.push({ ref: e.food_ref, name: e.name, brand: e.brand, lastAmount: Number(e.amount_g), lastServing: e.serving_label, kcal100: e.amount_g ? Math.round((Number(e.kcal) / Number(e.amount_g)) * 100) : 0 });
    if (out.length >= limit) break;
  }
  return out;
}

/** Combined local search (instant) + Open Food Facts (debounced, online). */
export function useFoodSearch(query: string) {
  const custom = useRows('custom_foods');
  const recipes = useRows('recipes');
  const recipeItems = useRows('recipe_items');
  const [off, setOff] = useState<{ q: string; items: FoodItem[]; loading: boolean; error: string | null }>({ q: '', items: [], loading: false, error: null });

  const local = useMemo(() => {
    const own = [...custom.map(customFoodToItem), ...recipes.map((r) => recipeToItem(r, recipeItems))];
    return { own: searchFoods(own, query, 20), builtin: searchFoods(FOODS, query, query ? 30 : 0) };
  }, [custom, recipes, recipeItems, query]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setOff({ q, items: [], loading: false, error: null });
      return;
    }
    let cancelled = false;
    setOff((o) => ({ ...o, loading: true, error: null }));
    const t = setTimeout(async () => {
      try {
        const items = await searchOff(q, offFetch, 20);
        if (cancelled) return;
        const known = new Set(custom.map((c) => c.barcode).filter(Boolean));
        const filtered = items.filter((i) => !known.has(i.barcode));
        filtered.forEach(cacheOffFood);
        setOff({ q, items: filtered, loading: false, error: null });
      } catch (e) {
        if (!cancelled) setOff({ q, items: [], loading: false, error: 'Markenprodukte gerade nicht erreichbar (offline?). Die Basis-Datenbank funktioniert weiter.' });
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  return { ...local, off: off.items, offLoading: off.loading, offError: off.error };
}

export function matchesQuery(name: string, q: string) {
  return normalize(name).includes(normalize(q));
}
