/**
 * Built-in exercise database (German names). Increments are the smallest
 * realistic total load change in a typical German commercial gym:
 * barbell 2,5 kg (2 × 1,25 kg), dumbbells 2 kg steps (per dumbbell),
 * machines / cables 5 kg (stack), bodyweight exercises use added load.
 */
import type { Equipment, ExerciseDef, MuscleGroup } from '../types';

type Def = Omit<ExerciseDef, 'secondary_muscles' | 'default_rep_min' | 'default_rep_max' | 'is_bodyweight' | 'increment_kg' | 'category'> &
  Partial<Pick<ExerciseDef, 'secondary_muscles' | 'default_rep_min' | 'default_rep_max' | 'is_bodyweight' | 'increment_kg' | 'category'>>;

const INC: Record<Equipment, number> = {
  barbell: 2.5,
  smith: 2.5,
  dumbbell: 2,
  machine: 5,
  cable: 5,
  kettlebell: 4,
  bodyweight: 2.5,
  bands: 0,
};

function ex(d: Def): ExerciseDef {
  const category = d.category ?? 'compound';
  return {
    secondary_muscles: [],
    is_bodyweight: d.equipment === 'bodyweight',
    increment_kg: INC[d.equipment],
    default_rep_min: category === 'isolation' ? 10 : 6,
    default_rep_max: category === 'isolation' ? 15 : 10,
    category,
    ...d,
  } as ExerciseDef;
}

export const EXERCISES: ExerciseDef[] = [
  // Chest
  ex({ id: 'bench-press', name: 'Bankdrücken (Langhantel)', name_en: 'Barbell Bench Press', primary_muscle: 'chest', secondary_muscles: ['triceps', 'shoulders'], equipment: 'barbell', default_rep_min: 5, default_rep_max: 8 }),
  ex({ id: 'incline-bench-press', name: 'Schrägbankdrücken (Langhantel)', name_en: 'Incline Barbell Bench Press', primary_muscle: 'chest', secondary_muscles: ['shoulders', 'triceps'], equipment: 'barbell' }),
  ex({ id: 'db-bench-press', name: 'Kurzhantel-Bankdrücken', name_en: 'Dumbbell Bench Press', primary_muscle: 'chest', secondary_muscles: ['triceps', 'shoulders'], equipment: 'dumbbell', default_rep_min: 8, default_rep_max: 12 }),
  ex({ id: 'incline-db-press', name: 'Schrägbankdrücken (Kurzhantel)', name_en: 'Incline Dumbbell Press', primary_muscle: 'chest', secondary_muscles: ['shoulders', 'triceps'], equipment: 'dumbbell', default_rep_min: 8, default_rep_max: 12 }),
  ex({ id: 'machine-chest-press', name: 'Brustpresse (Maschine)', name_en: 'Machine Chest Press', primary_muscle: 'chest', secondary_muscles: ['triceps'], equipment: 'machine', default_rep_min: 8, default_rep_max: 12 }),
  ex({ id: 'smith-incline-press', name: 'Schrägbankdrücken (Multipresse)', name_en: 'Smith Machine Incline Press', primary_muscle: 'chest', secondary_muscles: ['shoulders', 'triceps'], equipment: 'smith', default_rep_min: 8, default_rep_max: 12 }),
  ex({ id: 'cable-fly', name: 'Kabelzug-Fliegende', name_en: 'Cable Fly', primary_muscle: 'chest', equipment: 'cable', category: 'isolation' }),
  ex({ id: 'pec-deck', name: 'Butterfly (Maschine)', name_en: 'Pec Deck', primary_muscle: 'chest', equipment: 'machine', category: 'isolation' }),
  ex({ id: 'db-fly', name: 'Kurzhantel-Fliegende', name_en: 'Dumbbell Fly', primary_muscle: 'chest', equipment: 'dumbbell', category: 'isolation' }),
  ex({ id: 'dips', name: 'Dips', name_en: 'Dips', primary_muscle: 'chest', secondary_muscles: ['triceps', 'shoulders'], equipment: 'bodyweight', default_rep_min: 6, default_rep_max: 12 }),
  ex({ id: 'push-up', name: 'Liegestütze', name_en: 'Push-up', primary_muscle: 'chest', secondary_muscles: ['triceps', 'shoulders'], equipment: 'bodyweight', default_rep_min: 10, default_rep_max: 25 }),

  // Back
  ex({ id: 'deadlift', name: 'Kreuzheben', name_en: 'Deadlift', primary_muscle: 'lower_back', secondary_muscles: ['glutes', 'hamstrings', 'back', 'traps'], equipment: 'barbell', default_rep_min: 3, default_rep_max: 6, increment_kg: 5 }),
  ex({ id: 'barbell-row', name: 'Langhantelrudern', name_en: 'Barbell Row', primary_muscle: 'back', secondary_muscles: ['lats', 'biceps', 'rear_delts'], equipment: 'barbell' }),
  ex({ id: 'db-row', name: 'Einarmiges Kurzhantelrudern', name_en: 'One-Arm Dumbbell Row', primary_muscle: 'back', secondary_muscles: ['lats', 'biceps'], equipment: 'dumbbell', default_rep_min: 8, default_rep_max: 12 }),
  ex({ id: 'pull-up', name: 'Klimmzüge', name_en: 'Pull-up', primary_muscle: 'lats', secondary_muscles: ['biceps', 'back'], equipment: 'bodyweight', default_rep_min: 5, default_rep_max: 10 }),
  ex({ id: 'chin-up', name: 'Klimmzüge (Untergriff)', name_en: 'Chin-up', primary_muscle: 'lats', secondary_muscles: ['biceps'], equipment: 'bodyweight', default_rep_min: 5, default_rep_max: 10 }),
  ex({ id: 'lat-pulldown', name: 'Latzug', name_en: 'Lat Pulldown', primary_muscle: 'lats', secondary_muscles: ['biceps', 'back'], equipment: 'cable', default_rep_min: 8, default_rep_max: 12 }),
  ex({ id: 'close-grip-pulldown', name: 'Latzug (enger Griff)', name_en: 'Close-Grip Pulldown', primary_muscle: 'lats', secondary_muscles: ['biceps'], equipment: 'cable', default_rep_min: 8, default_rep_max: 12 }),
  ex({ id: 'seated-cable-row', name: 'Rudern am Kabelzug (sitzend)', name_en: 'Seated Cable Row', primary_muscle: 'back', secondary_muscles: ['lats', 'biceps', 'rear_delts'], equipment: 'cable', default_rep_min: 8, default_rep_max: 12 }),
  ex({ id: 'machine-row', name: 'Rudermaschine (T-Bar/Brustgestützt)', name_en: 'Chest-Supported Machine Row', primary_muscle: 'back', secondary_muscles: ['lats', 'rear_delts', 'biceps'], equipment: 'machine', default_rep_min: 8, default_rep_max: 12 }),
  ex({ id: 'straight-arm-pulldown', name: 'Überzüge am Kabel', name_en: 'Straight-Arm Pulldown', primary_muscle: 'lats', equipment: 'cable', category: 'isolation' }),
  ex({ id: 'shrug', name: 'Shrugs (Kurzhantel)', name_en: 'Dumbbell Shrug', primary_muscle: 'traps', equipment: 'dumbbell', category: 'isolation' }),
  ex({ id: 'back-extension', name: 'Hyperextensions', name_en: 'Back Extension', primary_muscle: 'lower_back', secondary_muscles: ['glutes', 'hamstrings'], equipment: 'bodyweight', default_rep_min: 10, default_rep_max: 15 }),

  // Shoulders
  ex({ id: 'overhead-press', name: 'Schulterdrücken (Langhantel, stehend)', name_en: 'Overhead Press', primary_muscle: 'shoulders', secondary_muscles: ['triceps'], equipment: 'barbell', default_rep_min: 5, default_rep_max: 8 }),
  ex({ id: 'db-shoulder-press', name: 'Kurzhantel-Schulterdrücken', name_en: 'Dumbbell Shoulder Press', primary_muscle: 'shoulders', secondary_muscles: ['triceps'], equipment: 'dumbbell', default_rep_min: 8, default_rep_max: 12 }),
  ex({ id: 'machine-shoulder-press', name: 'Schulterpresse (Maschine)', name_en: 'Machine Shoulder Press', primary_muscle: 'shoulders', secondary_muscles: ['triceps'], equipment: 'machine', default_rep_min: 8, default_rep_max: 12 }),
  ex({ id: 'lateral-raise', name: 'Seitheben (Kurzhantel)', name_en: 'Lateral Raise', primary_muscle: 'shoulders', equipment: 'dumbbell', category: 'isolation', increment_kg: 1 }),
  ex({ id: 'cable-lateral-raise', name: 'Seitheben am Kabel', name_en: 'Cable Lateral Raise', primary_muscle: 'shoulders', equipment: 'cable', category: 'isolation', increment_kg: 2.5 }),
  ex({ id: 'reverse-fly', name: 'Reverse Butterfly', name_en: 'Reverse Pec Deck', primary_muscle: 'rear_delts', secondary_muscles: ['back'], equipment: 'machine', category: 'isolation' }),
  ex({ id: 'face-pull', name: 'Face Pulls', name_en: 'Face Pull', primary_muscle: 'rear_delts', secondary_muscles: ['traps'], equipment: 'cable', category: 'isolation', increment_kg: 2.5 }),

  // Arms
  ex({ id: 'barbell-curl', name: 'Langhantel-Curls', name_en: 'Barbell Curl', primary_muscle: 'biceps', secondary_muscles: ['forearms'], equipment: 'barbell', category: 'isolation', default_rep_min: 8, default_rep_max: 12 }),
  ex({ id: 'db-curl', name: 'Kurzhantel-Curls', name_en: 'Dumbbell Curl', primary_muscle: 'biceps', secondary_muscles: ['forearms'], equipment: 'dumbbell', category: 'isolation', increment_kg: 1 }),
  ex({ id: 'hammer-curl', name: 'Hammercurls', name_en: 'Hammer Curl', primary_muscle: 'biceps', secondary_muscles: ['forearms'], equipment: 'dumbbell', category: 'isolation', increment_kg: 1 }),
  ex({ id: 'cable-curl', name: 'Bizepscurls am Kabel', name_en: 'Cable Curl', primary_muscle: 'biceps', equipment: 'cable', category: 'isolation', increment_kg: 2.5 }),
  ex({ id: 'preacher-curl', name: 'Scottcurls (Maschine)', name_en: 'Preacher Curl Machine', primary_muscle: 'biceps', equipment: 'machine', category: 'isolation' }),
  ex({ id: 'triceps-pushdown', name: 'Trizepsdrücken am Kabel', name_en: 'Triceps Pushdown', primary_muscle: 'triceps', equipment: 'cable', category: 'isolation', increment_kg: 2.5 }),
  ex({ id: 'overhead-triceps-extension', name: 'Überkopf-Trizepsstrecken (Kabel)', name_en: 'Overhead Cable Triceps Extension', primary_muscle: 'triceps', equipment: 'cable', category: 'isolation', increment_kg: 2.5 }),
  ex({ id: 'skull-crusher', name: 'French Press (SZ-Stange)', name_en: 'Skull Crusher', primary_muscle: 'triceps', equipment: 'barbell', category: 'isolation', default_rep_min: 8, default_rep_max: 12 }),
  ex({ id: 'close-grip-bench', name: 'Enges Bankdrücken', name_en: 'Close-Grip Bench Press', primary_muscle: 'triceps', secondary_muscles: ['chest', 'shoulders'], equipment: 'barbell' }),
  ex({ id: 'wrist-curl', name: 'Unterarmcurls', name_en: 'Wrist Curl', primary_muscle: 'forearms', equipment: 'dumbbell', category: 'isolation', increment_kg: 1 }),

  // Legs
  ex({ id: 'squat', name: 'Kniebeuge (Langhantel)', name_en: 'Back Squat', primary_muscle: 'quads', secondary_muscles: ['glutes', 'adductors', 'lower_back'], equipment: 'barbell', default_rep_min: 5, default_rep_max: 8 }),
  ex({ id: 'front-squat', name: 'Frontkniebeuge', name_en: 'Front Squat', primary_muscle: 'quads', secondary_muscles: ['glutes', 'abs'], equipment: 'barbell', default_rep_min: 5, default_rep_max: 8 }),
  ex({ id: 'hack-squat', name: 'Hackenschmidt-Kniebeuge', name_en: 'Hack Squat', primary_muscle: 'quads', secondary_muscles: ['glutes'], equipment: 'machine', default_rep_min: 8, default_rep_max: 12 }),
  ex({ id: 'leg-press', name: 'Beinpresse', name_en: 'Leg Press', primary_muscle: 'quads', secondary_muscles: ['glutes', 'adductors'], equipment: 'machine', default_rep_min: 8, default_rep_max: 12, increment_kg: 10 }),
  ex({ id: 'bulgarian-split-squat', name: 'Bulgarian Split Squats', name_en: 'Bulgarian Split Squat', primary_muscle: 'quads', secondary_muscles: ['glutes'], equipment: 'dumbbell', default_rep_min: 8, default_rep_max: 12 }),
  ex({ id: 'lunge', name: 'Ausfallschritte (Kurzhantel)', name_en: 'Dumbbell Lunge', primary_muscle: 'quads', secondary_muscles: ['glutes'], equipment: 'dumbbell', default_rep_min: 8, default_rep_max: 12 }),
  ex({ id: 'leg-extension', name: 'Beinstrecker', name_en: 'Leg Extension', primary_muscle: 'quads', equipment: 'machine', category: 'isolation' }),
  ex({ id: 'romanian-deadlift', name: 'Rumänisches Kreuzheben', name_en: 'Romanian Deadlift', primary_muscle: 'hamstrings', secondary_muscles: ['glutes', 'lower_back'], equipment: 'barbell', default_rep_min: 6, default_rep_max: 10 }),
  ex({ id: 'lying-leg-curl', name: 'Beinbeuger liegend', name_en: 'Lying Leg Curl', primary_muscle: 'hamstrings', equipment: 'machine', category: 'isolation' }),
  ex({ id: 'seated-leg-curl', name: 'Beinbeuger sitzend', name_en: 'Seated Leg Curl', primary_muscle: 'hamstrings', equipment: 'machine', category: 'isolation' }),
  ex({ id: 'hip-thrust', name: 'Hip Thrust (Langhantel)', name_en: 'Barbell Hip Thrust', primary_muscle: 'glutes', secondary_muscles: ['hamstrings'], equipment: 'barbell', default_rep_min: 8, default_rep_max: 12, increment_kg: 5 }),
  ex({ id: 'hip-abduction', name: 'Abduktoren-Maschine', name_en: 'Hip Abduction', primary_muscle: 'glutes', equipment: 'machine', category: 'isolation' }),
  ex({ id: 'hip-adduction', name: 'Adduktoren-Maschine', name_en: 'Hip Adduction', primary_muscle: 'adductors', equipment: 'machine', category: 'isolation' }),
  ex({ id: 'standing-calf-raise', name: 'Wadenheben stehend', name_en: 'Standing Calf Raise', primary_muscle: 'calves', equipment: 'machine', category: 'isolation' }),
  ex({ id: 'seated-calf-raise', name: 'Wadenheben sitzend', name_en: 'Seated Calf Raise', primary_muscle: 'calves', equipment: 'machine', category: 'isolation' }),
  ex({ id: 'goblet-squat', name: 'Goblet Squat', name_en: 'Goblet Squat', primary_muscle: 'quads', secondary_muscles: ['glutes'], equipment: 'dumbbell', default_rep_min: 8, default_rep_max: 15 }),
  ex({ id: 'kb-swing', name: 'Kettlebell Swings', name_en: 'Kettlebell Swing', primary_muscle: 'glutes', secondary_muscles: ['hamstrings', 'lower_back'], equipment: 'kettlebell', default_rep_min: 12, default_rep_max: 20 }),

  // Core
  ex({ id: 'plank', name: 'Unterarmstütz (Sek.)', name_en: 'Plank (seconds)', primary_muscle: 'abs', equipment: 'bodyweight', category: 'isolation', default_rep_min: 30, default_rep_max: 90 }),
  ex({ id: 'cable-crunch', name: 'Kabel-Crunches', name_en: 'Cable Crunch', primary_muscle: 'abs', equipment: 'cable', category: 'isolation' }),
  ex({ id: 'hanging-leg-raise', name: 'Beinheben hängend', name_en: 'Hanging Leg Raise', primary_muscle: 'abs', equipment: 'bodyweight', category: 'isolation', default_rep_min: 8, default_rep_max: 15 }),
  ex({ id: 'ab-wheel', name: 'Ab Wheel Rollouts', name_en: 'Ab Wheel Rollout', primary_muscle: 'abs', equipment: 'bodyweight', category: 'isolation', default_rep_min: 8, default_rep_max: 15 }),
  ex({ id: 'band-pull-apart', name: 'Band Pull-Aparts', name_en: 'Band Pull-Apart', primary_muscle: 'rear_delts', equipment: 'bands', category: 'isolation', default_rep_min: 15, default_rep_max: 25 }),
];

export const EXERCISE_MAP: Record<string, ExerciseDef> = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));

export const MUSCLE_LABELS_DE: Record<MuscleGroup, string> = {
  chest: 'Brust',
  back: 'Oberer Rücken',
  lats: 'Latissimus',
  traps: 'Trapez',
  shoulders: 'Schultern',
  rear_delts: 'Hintere Schulter',
  biceps: 'Bizeps',
  triceps: 'Trizeps',
  forearms: 'Unterarme',
  quads: 'Quadrizeps',
  hamstrings: 'Beinbeuger',
  glutes: 'Gesäß',
  calves: 'Waden',
  abs: 'Bauch',
  lower_back: 'Unterer Rücken',
  adductors: 'Adduktoren',
  full_body: 'Ganzkörper',
  cardio: 'Cardio',
};

export const EQUIPMENT_LABELS_DE: Record<Equipment, string> = {
  barbell: 'Langhantel',
  dumbbell: 'Kurzhantel',
  machine: 'Maschine',
  cable: 'Kabelzug',
  bodyweight: 'Körpergewicht',
  kettlebell: 'Kettlebell',
  bands: 'Widerstandsbänder',
  smith: 'Multipresse',
};

/** Muscle groups aggregated for volume statistics (UI level). */
export const MUSCLE_GROUP_BUCKETS: Record<string, MuscleGroup[]> = {
  Brust: ['chest'],
  Rücken: ['back', 'lats', 'traps', 'lower_back'],
  Schultern: ['shoulders', 'rear_delts'],
  Arme: ['biceps', 'triceps', 'forearms'],
  Beine: ['quads', 'hamstrings', 'glutes', 'calves', 'adductors'],
  Core: ['abs'],
};

export function searchExercises(list: ExerciseDef[], query: string, filter?: { muscle?: MuscleGroup; equipment?: Equipment[] }): ExerciseDef[] {
  const q = normalize(query);
  return list
    .filter((e) => (filter?.muscle ? e.primary_muscle === filter.muscle || e.secondary_muscles.includes(filter.muscle) : true))
    .filter((e) => (filter?.equipment && filter.equipment.length ? filter.equipment.includes(e.equipment) : true))
    .map((e) => {
      const hay = normalize(`${e.name} ${e.name_en ?? ''} ${MUSCLE_LABELS_DE[e.primary_muscle]}`);
      if (!q) return { e, score: 1 };
      if (normalize(e.name).startsWith(q)) return { e, score: 3 };
      if (hay.includes(q)) return { e, score: 2 };
      const words = q.split(' ').filter(Boolean);
      return { e, score: words.every((w) => hay.includes(w)) ? 1.5 : 0 };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name, 'de'))
    .map((x) => x.e);
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
