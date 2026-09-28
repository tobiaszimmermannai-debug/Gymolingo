/**
 * Starter training plans generated from frequency, equipment and goal.
 * Exercises are substituted when the required equipment is not available.
 */
import type { Equipment, Goal } from '../types';
import { EXERCISE_MAP } from './exercises';

export interface TemplateExercise {
  exercise_id: string;
  target_sets: number;
  rep_min: number;
  rep_max: number;
  target_rir: number;
  rest_seconds: number;
}

export interface TemplateDay {
  name: string;
  exercises: TemplateExercise[];
}

export interface PlanTemplate {
  name: string;
  description: string;
  days: TemplateDay[];
}

type Slot = [id: string, sets: number];

const SUBSTITUTES: Record<string, string[]> = {
  'bench-press': ['db-bench-press', 'machine-chest-press', 'push-up'],
  'incline-bench-press': ['incline-db-press', 'smith-incline-press', 'push-up'],
  'incline-db-press': ['incline-bench-press', 'push-up'],
  'db-bench-press': ['bench-press', 'machine-chest-press', 'push-up'],
  squat: ['hack-squat', 'leg-press', 'goblet-squat', 'bulgarian-split-squat'],
  'leg-press': ['hack-squat', 'goblet-squat', 'bulgarian-split-squat'],
  'barbell-row': ['db-row', 'machine-row', 'seated-cable-row'],
  'seated-cable-row': ['machine-row', 'db-row', 'barbell-row'],
  'lat-pulldown': ['pull-up', 'chin-up', 'db-row'],
  'overhead-press': ['db-shoulder-press', 'machine-shoulder-press', 'push-up'],
  'db-shoulder-press': ['overhead-press', 'machine-shoulder-press'],
  'romanian-deadlift': ['db-romanian-deadlift', 'back-extension'],
  'lying-leg-curl': ['seated-leg-curl', 'db-romanian-deadlift', 'romanian-deadlift'],
  'leg-extension': ['bulgarian-split-squat', 'lunge'],
  'cable-fly': ['pec-deck', 'db-fly'],
  'lateral-raise': ['cable-lateral-raise', 'band-pull-apart'],
  'face-pull': ['reverse-fly', 'band-pull-apart'],
  'triceps-pushdown': ['db-triceps-extension', 'overhead-triceps-extension', 'dips'],
  'db-curl': ['cable-curl', 'barbell-curl'],
  'hammer-curl': ['db-curl', 'cable-curl'],
  'standing-calf-raise': ['seated-calf-raise'],
  'hip-thrust': ['kb-swing', 'db-romanian-deadlift'],
  'cable-crunch': ['hanging-leg-raise', 'plank'],
};

function available(id: string, equipment: Equipment[]): boolean {
  const e = EXERCISE_MAP[id];
  if (!e) return false;
  if (e.equipment === 'bodyweight') return true;
  if (e.equipment === 'smith') return equipment.includes('smith') || equipment.includes('machine');
  return equipment.includes(e.equipment);
}

export function resolveExercise(id: string, equipment: Equipment[]): string | null {
  if (available(id, equipment)) return id;
  for (const alt of SUBSTITUTES[id] ?? []) if (available(alt, equipment)) return alt;
  return null;
}

const DAYS: Record<string, { name: string; slots: Slot[] }> = {
  fullA: { name: 'Ganzkörper A', slots: [['squat', 3], ['bench-press', 3], ['barbell-row', 3], ['romanian-deadlift', 2], ['lateral-raise', 2], ['db-curl', 2]] },
  fullB: { name: 'Ganzkörper B', slots: [['leg-press', 3], ['overhead-press', 3], ['lat-pulldown', 3], ['lying-leg-curl', 2], ['incline-db-press', 2], ['triceps-pushdown', 2]] },
  fullC: { name: 'Ganzkörper C', slots: [['romanian-deadlift', 3], ['incline-bench-press', 3], ['seated-cable-row', 3], ['bulgarian-split-squat', 2], ['face-pull', 2], ['hammer-curl', 2]] },
  upperA: { name: 'Oberkörper A', slots: [['bench-press', 3], ['barbell-row', 3], ['overhead-press', 2], ['lat-pulldown', 3], ['lateral-raise', 3], ['triceps-pushdown', 2], ['db-curl', 2]] },
  lowerA: { name: 'Unterkörper A', slots: [['squat', 3], ['romanian-deadlift', 3], ['leg-extension', 2], ['lying-leg-curl', 3], ['standing-calf-raise', 3], ['cable-crunch', 2]] },
  upperB: { name: 'Oberkörper B', slots: [['incline-db-press', 3], ['seated-cable-row', 3], ['db-shoulder-press', 2], ['pull-up', 3], ['cable-fly', 2], ['face-pull', 2], ['hammer-curl', 2]] },
  lowerB: { name: 'Unterkörper B', slots: [['leg-press', 3], ['hip-thrust', 3], ['bulgarian-split-squat', 2], ['seated-leg-curl', 3], ['seated-calf-raise', 3], ['hanging-leg-raise', 2]] },
  push: { name: 'Push', slots: [['bench-press', 3], ['incline-db-press', 3], ['overhead-press', 2], ['lateral-raise', 3], ['cable-fly', 2], ['triceps-pushdown', 3]] },
  pull: { name: 'Pull', slots: [['barbell-row', 3], ['lat-pulldown', 3], ['seated-cable-row', 2], ['face-pull', 3], ['db-curl', 3], ['hammer-curl', 2]] },
  legs: { name: 'Beine', slots: [['squat', 3], ['romanian-deadlift', 3], ['leg-press', 2], ['lying-leg-curl', 3], ['standing-calf-raise', 3], ['cable-crunch', 2]] },
};

const SPLITS: Record<number, { name: string; description: string; days: string[] }> = {
  1: { name: 'Ganzkörper 1×', description: 'Eine intensive Ganzkörpereinheit pro Woche.', days: ['fullA'] },
  2: { name: 'Ganzkörper 2×', description: 'Zwei Ganzkörpereinheiten (A/B) pro Woche.', days: ['fullA', 'fullB'] },
  3: { name: 'Ganzkörper 3×', description: 'Drei Ganzkörpereinheiten (A/B/C) – ideal für Einsteiger und Wiedereinsteiger.', days: ['fullA', 'fullB', 'fullC'] },
  4: { name: 'Oberkörper/Unterkörper', description: 'Klassischer 4er-Split mit hoher Frequenz pro Muskelgruppe.', days: ['upperA', 'lowerA', 'upperB', 'lowerB'] },
  5: { name: 'Push/Pull/Beine + OK/UK', description: 'Fünf Einheiten: Push, Pull, Beine, Oberkörper, Unterkörper.', days: ['push', 'pull', 'legs', 'upperB', 'lowerB'] },
  6: { name: 'Push/Pull/Beine 2×', description: 'Sechs Einheiten für Fortgeschrittene.', days: ['push', 'pull', 'legs', 'push', 'pull', 'legs'] },
};

export function generatePlanTemplate(params: { daysPerWeek: number; equipment: Equipment[]; goal: Goal; experience: 'beginner' | 'intermediate' | 'advanced' }): PlanTemplate {
  const n = Math.max(1, Math.min(6, Math.round(params.daysPerWeek || 3)));
  const split = SPLITS[params.experience === 'beginner' && n > 4 ? 4 : n];
  const equipment: Equipment[] = params.equipment.length ? params.equipment : ['bodyweight'];
  const counts = new Map<string, number>();
  const days = split.days.map((key) => {
    const d = DAYS[key];
    counts.set(key, (counts.get(key) ?? 0) + 1);
    const suffix = split.days.filter((k) => k === key).length > 1 ? ` ${counts.get(key) === 1 ? 'A' : 'B'}` : '';
    const used = new Set<string>();
    const exercises: TemplateExercise[] = [];
    for (const [id, sets] of d.slots) {
      const resolved = resolveExercise(id, equipment);
      if (!resolved || used.has(resolved)) continue;
      used.add(resolved);
      const def = EXERCISE_MAP[resolved];
      const strength = params.goal === 'strength' && def.category === 'compound';
      exercises.push({
        exercise_id: resolved,
        target_sets: params.experience === 'beginner' ? Math.min(sets, 3) : sets,
        rep_min: strength ? 4 : def.default_rep_min,
        rep_max: strength ? 6 : def.default_rep_max,
        target_rir: params.experience === 'beginner' ? 3 : 2,
        rest_seconds: def.category === 'compound' ? (strength ? 180 : 150) : 90,
      });
    }
    return { name: `${d.name}${suffix}`, exercises };
  });
  return { name: split.name, description: split.description, days };
}
