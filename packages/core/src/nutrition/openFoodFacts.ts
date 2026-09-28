/**
 * Open Food Facts client (free, no API key, strong coverage of EU/German
 * products). `fetchImpl` is injectable for tests.
 * Docs: https://openfoodfacts.github.io/openfoodfacts-server/api/
 */
import type { FoodItem } from '../types';

const FIELDS = [
  'code',
  'product_name',
  'product_name_de',
  'generic_name_de',
  'brands',
  'nutriments',
  'serving_size',
  'serving_quantity',
  'allergens_tags',
  'labels_tags',
  'quantity',
].join(',');

export const OFF_BASE = 'https://world.openfoodfacts.org';
export const OFF_USER_AGENT = 'Gymolingo/0.1 (https://github.com/tobiaszimmermannai-debug/gymolingo)';

type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>;

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

const ALLERGEN_MAP: Record<string, string> = {
  'en:gluten': 'gluten',
  'en:milk': 'milk',
  'en:eggs': 'egg',
  'en:nuts': 'nuts',
  'en:peanuts': 'peanuts',
  'en:soybeans': 'soy',
  'en:fish': 'fish',
  'en:crustaceans': 'crustaceans',
  'en:sesame-seeds': 'sesame',
};

export function parseOffProduct(p: any): FoodItem | null {
  if (!p) return null;
  const n = p.nutriments ?? {};
  let kcal = num(n['energy-kcal_100g']);
  const kj = num(n['energy-kj_100g']) ?? num(n['energy_100g']);
  if (kcal === null && kj !== null) kcal = Math.round(kj / 4.184);
  const protein = num(n['proteins_100g']);
  const carbs = num(n['carbohydrates_100g']);
  const fat = num(n['fat_100g']);
  const name: string = (p.product_name_de || p.product_name || p.generic_name_de || '').trim();
  if (!name || kcal === null) return null;
  const incomplete = protein === null || carbs === null || fat === null;
  const servingQty = num(p.serving_quantity);
  const tags: string[] = [];
  for (const a of p.allergens_tags ?? []) if (ALLERGEN_MAP[a]) tags.push(ALLERGEN_MAP[a]);
  const labels: string[] = p.labels_tags ?? [];
  if (labels.includes('en:vegan')) tags.push('vegan');
  if (labels.includes('en:vegetarian')) tags.push('vegetarian');
  return {
    ref: `off:${p.code}`,
    name,
    brand: p.brands ? String(p.brands).split(',')[0].trim() : null,
    barcode: p.code ?? null,
    category: 'Markenprodukt',
    kcal_100: Math.round(kcal),
    protein_100: protein ?? 0,
    carbs_100: carbs ?? 0,
    fat_100: fat ?? 0,
    fiber_100: num(n['fiber_100g']),
    sugar_100: num(n['sugars_100g']),
    salt_100: num(n['salt_100g']),
    servings: servingQty && servingQty > 0 ? [{ label: `Portion (${p.serving_size ?? `${servingQty} g`})`, grams: servingQty }] : [],
    source: 'off',
    // community-maintained data: flag incomplete entries as estimates
    is_estimate: incomplete,
    tags,
  };
}

export async function fetchOffProduct(barcode: string, fetchImpl: FetchLike): Promise<FoodItem | null> {
  const code = barcode.replace(/\D/g, '');
  if (code.length < 8) return null;
  const res = await fetchImpl(`${OFF_BASE}/api/v2/product/${code}.json?fields=${FIELDS}`, {
    headers: { 'User-Agent': OFF_USER_AGENT },
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Open Food Facts: HTTP ${res.status}`);
  }
  const json = await res.json();
  if (json.status !== 1 && json.status !== 'success') return null;
  return parseOffProduct(json.product);
}

export async function searchOff(query: string, fetchImpl: FetchLike, pageSize = 20): Promise<FoodItem[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=${pageSize}&lc=de&cc=de&fields=${FIELDS}`;
  const res = await fetchImpl(url, { headers: { 'User-Agent': OFF_USER_AGENT } });
  if (!res.ok) throw new Error(`Open Food Facts: HTTP ${res.status}`);
  const json = await res.json();
  return (json.products ?? []).map(parseOffProduct).filter((x: FoodItem | null): x is FoodItem => x !== null);
}

/** EAN-8/EAN-13/UPC-A check digit validation. */
export function isValidBarcode(code: string): boolean {
  const digits = code.replace(/\D/g, '');
  if (![8, 12, 13, 14].includes(digits.length)) return false;
  const arr = digits.split('').map(Number);
  const check = arr.pop()!;
  const sum = arr
    .reverse()
    .reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}
