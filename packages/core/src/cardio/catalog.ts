/**
 * Activity catalog: sports and everyday activities with MET values.
 *
 * Sources: Compendium of Physical Activities (Ainsworth et al. 2011 / Herrmann et
 * al. 2024 update, adult values). Where the compendium lists several efforts, they
 * become the levels light / medium / intense. Sex: compendium 1.8 (moderate) and
 * 2.8 (vigorous) METs; the "passionate" level uses the measured average of
 * Frappier et al. 2013 (≈ 4.2 kcal/min in men ≈ 3.5 MET). Padel and e-bike are
 * estimates (tennis doubles / leisure cycling with assistance).
 *
 * Sports count as gross kcal (like fitness trackers). Everyday, household and garden
 * activities count only the extra energy above rest (MET − 1): the daily calorie
 * target already contains normal everyday movement, so gross values would overstate.
 */
import type { CardioIntensity } from '../types';

export type ActivityCategory = 'endurance' | 'fitness' | 'ball' | 'outdoor' | 'household' | 'garden' | 'everyday';

export interface ActivityDef {
  id: string;
  label: string;
  icon: string;
  category: ActivityCategory;
  /** one MET value, or light / medium / intense */
  met: number | [number, number, number];
  /** own names for the three levels (default: Leicht / Mittel / Intensiv) */
  levels?: [string, string, string];
  /** counts as a training day (streaks, weekly quota, XP) */
  training: boolean;
  /** typical duration in minutes (form default) */
  duration: number;
  /** a distance field makes sense (speed-based for walking, running, cycling) */
  distance?: boolean;
  /** search synonyms */
  keywords?: string;
}

export const CATEGORY_LABELS_DE: Record<ActivityCategory, string> = {
  endurance: 'Ausdauer',
  fitness: 'Fitness & Kurse',
  ball: 'Ballsport & Schläger',
  outdoor: 'Outdoor, Wasser & Winter',
  household: 'Haushalt',
  garden: 'Garten',
  everyday: 'Alltag & Freizeit',
};

/** categories that count only the extra energy above rest */
export const NET_CATEGORIES: ReadonlySet<ActivityCategory> = new Set(['household', 'garden', 'everyday']);

export const ACTIVITIES: ActivityDef[] = [
  // Ausdauer
  { id: 'walk', label: 'Spazieren', icon: '🚶', category: 'endurance', met: [3.0, 3.5, 4.3], levels: ['Gemütlich', 'Normal', 'Zügig'], training: false, duration: 30, distance: true, keywords: 'gehen laufen spaziergang' },
  { id: 'jog', label: 'Joggen', icon: '🏃', category: 'endurance', met: [7.0, 8.3, 9.0], levels: ['Locker', 'Normal', 'Zügig'], training: true, duration: 30, distance: true, keywords: 'laufen rennen' },
  { id: 'run', label: 'Laufen', icon: '🏃‍♂️', category: 'endurance', met: [9.8, 11.0, 12.3], levels: ['Normal', 'Schnell', 'Sehr schnell'], training: true, duration: 30, distance: true, keywords: 'rennen joggen sprint' },
  { id: 'hike', label: 'Wandern', icon: '🥾', category: 'endurance', met: [4.5, 6.0, 7.8], levels: ['Flach', 'Hügelig', 'Steil / mit Gepäck'], training: true, duration: 120, distance: true, keywords: 'bergwandern trekking' },
  { id: 'nordic_walking', label: 'Nordic Walking', icon: '🥢', category: 'endurance', met: 4.8, training: true, duration: 45, distance: true, keywords: 'stöcke' },
  { id: 'bike', label: 'Radfahren', icon: '🚴', category: 'endurance', met: [4.0, 6.8, 8.0], levels: ['Gemütlich (< 16 km/h)', 'Zügig (16–19 km/h)', 'Schnell (19–22 km/h)'], training: true, duration: 45, distance: true, keywords: 'fahrrad rennrad pendeln' },
  { id: 'ebike', label: 'E-Bike', icon: '🚲', category: 'endurance', met: [3.0, 4.0, 5.0], training: true, duration: 45, distance: true, keywords: 'pedelec fahrrad' },
  { id: 'mtb', label: 'Mountainbike', icon: '🚵', category: 'endurance', met: [6.8, 8.5, 14.0], levels: ['Gemütlich', 'Normal', 'Bergauf / hart'], training: true, duration: 60, distance: true, keywords: 'mtb gravel' },
  { id: 'spinning', label: 'Indoor-Cycling / Spinning', icon: '🚴‍♀️', category: 'endurance', met: [4.8, 8.5, 11.0], levels: ['Locker', 'Kurs', 'Hart'], training: true, duration: 45, keywords: 'ergometer heimtrainer' },
  { id: 'swim', label: 'Schwimmen', icon: '🏊', category: 'endurance', met: [5.8, 8.3, 9.8], levels: ['Gemütlich', 'Zügig', 'Schnell'], training: true, duration: 45, distance: true, keywords: 'kraulen brust bahnen' },
  { id: 'aqua', label: 'Aquafitness', icon: '🌊', category: 'endurance', met: 5.5, training: true, duration: 45, keywords: 'aqua jogging wassergymnastik' },
  { id: 'rowing', label: 'Rudern / Rudergerät', icon: '🚣', category: 'endurance', met: [4.8, 7.0, 8.5], training: true, duration: 30, keywords: 'ergometer' },
  { id: 'crosstrainer', label: 'Crosstrainer', icon: '🏃‍♀️', category: 'endurance', met: [4.0, 5.0, 6.5], training: true, duration: 30, keywords: 'ellipsentrainer' },
  { id: 'stepper', label: 'Stepper / Stairmaster', icon: '🪜', category: 'endurance', met: 9.0, training: true, duration: 20 },
  { id: 'jump_rope', label: 'Seilspringen', icon: '🪢', category: 'endurance', met: [8.8, 11.8, 12.3], levels: ['Langsam', 'Mittel', 'Schnell'], training: true, duration: 15 },
  { id: 'inline', label: 'Inline-Skaten', icon: '🛼', category: 'endurance', met: 7.5, training: true, duration: 45, distance: true, keywords: 'rollschuh skaten' },
  { id: 'xc_ski', label: 'Skilanglauf', icon: '⛷️', category: 'endurance', met: [6.8, 9.0, 12.5], training: true, duration: 60, distance: true, keywords: 'langlauf loipe' },

  // Fitness & Kurse
  { id: 'ems', label: 'EMS-Training', icon: '⚡', category: 'fitness', met: [3.5, 4.5, 5.5], levels: ['Leicht', 'Mittel', 'Intensiv'], training: true, duration: 20, keywords: 'strom bodystreet' },
  { id: 'hiit', label: 'HIIT / Zirkel / CrossFit', icon: '🔥', category: 'fitness', met: [4.3, 6.0, 8.0], training: true, duration: 30, keywords: 'functional bootcamp kettlebell tabata' },
  { id: 'yoga', label: 'Yoga', icon: '🧘', category: 'fitness', met: [2.5, 3.3, 4.0], levels: ['Hatha / Yin', 'Flow', 'Power'], training: true, duration: 60 },
  { id: 'pilates', label: 'Pilates', icon: '🤸‍♀️', category: 'fitness', met: 3.0, training: true, duration: 45 },
  { id: 'gymnastics', label: 'Gymnastik / Rückenkurs', icon: '🙆', category: 'fitness', met: 3.8, training: true, duration: 45, keywords: 'reha funktionsgymnastik' },
  { id: 'stretching', label: 'Stretching / Mobility', icon: '🤸', category: 'fitness', met: 2.3, training: false, duration: 20, keywords: 'dehnen faszien' },
  { id: 'aerobic', label: 'Aerobic / Step', icon: '👟', category: 'fitness', met: [5.0, 7.3, 9.5], training: true, duration: 45 },
  { id: 'zumba', label: 'Zumba / Dance-Fitness', icon: '💃', category: 'fitness', met: 6.5, training: true, duration: 60 },
  { id: 'martial_arts', label: 'Kampfsport', icon: '🥋', category: 'fitness', met: [5.3, 7.8, 10.3], training: true, duration: 60, keywords: 'karate judo kickboxen taekwondo mma jiu jitsu' },
  { id: 'boxing', label: 'Boxen', icon: '🥊', category: 'fitness', met: [5.5, 7.8, 12.8], levels: ['Sandsack', 'Sparring', 'Kampf'], training: true, duration: 45 },
  { id: 'climbing', label: 'Klettern / Bouldern', icon: '🧗', category: 'fitness', met: [5.0, 5.8, 7.5], training: true, duration: 90, keywords: 'boulder kletterhalle' },
  { id: 'dance', label: 'Tanzen', icon: '🕺', category: 'fitness', met: [3.0, 5.5, 7.8], levels: ['Langsam', 'Tanzkurs / schnell', 'Party / Disco'], training: true, duration: 60, keywords: 'salsa standard disco club' },
  { id: 'trampoline', label: 'Trampolin', icon: '🦘', category: 'fitness', met: [3.5, 4.5, 6.0], training: true, duration: 30 },

  // Ballsport & Schläger
  { id: 'soccer', label: 'Fußball', icon: '⚽', category: 'ball', met: [7.0, 8.5, 10.0], levels: ['Freizeit', 'Training', 'Spiel'], training: true, duration: 90, keywords: 'kicken futsal' },
  { id: 'basketball', label: 'Basketball', icon: '🏀', category: 'ball', met: [4.5, 6.5, 8.0], levels: ['Körbe werfen', 'Training', 'Spiel'], training: true, duration: 60 },
  { id: 'volleyball', label: 'Volleyball', icon: '🏐', category: 'ball', met: [3.0, 4.0, 8.0], levels: ['Freizeit', 'Verein', 'Beach'], training: true, duration: 60 },
  { id: 'handball', label: 'Handball', icon: '🤾', category: 'ball', met: [8.0, 10.0, 12.0], levels: ['Training', 'Spiel', 'Wettkampf'], training: true, duration: 60 },
  { id: 'tennis', label: 'Tennis', icon: '🎾', category: 'ball', met: [6.0, 7.3, 8.0], levels: ['Doppel', 'Allgemein', 'Einzel'], training: true, duration: 60 },
  { id: 'padel', label: 'Padel', icon: '🏓', category: 'ball', met: [5.0, 6.0, 7.3], training: true, duration: 60 },
  { id: 'badminton', label: 'Badminton', icon: '🏸', category: 'ball', met: [4.5, 5.5, 7.0], levels: ['Locker', 'Freizeit', 'Wettkampf'], training: true, duration: 60, keywords: 'federball' },
  { id: 'table_tennis', label: 'Tischtennis', icon: '🏓', category: 'ball', met: [3.0, 4.0, 5.5], training: true, duration: 60, keywords: 'ping pong' },
  { id: 'squash', label: 'Squash', icon: '🟡', category: 'ball', met: [7.3, 9.0, 12.0], training: true, duration: 45 },
  { id: 'golf', label: 'Golf', icon: '⛳', category: 'ball', met: [3.5, 4.3, 4.8], levels: ['Mit Cart', 'Zu Fuß mit Trolley', 'Zu Fuß mit Tasche'], training: true, duration: 180 },
  { id: 'ice_hockey', label: 'Eishockey', icon: '🏒', category: 'ball', met: 8.0, training: true, duration: 60 },
  { id: 'hockey', label: 'Hockey', icon: '🏑', category: 'ball', met: 7.8, training: true, duration: 60 },
  { id: 'rugby', label: 'Rugby', icon: '🏉', category: 'ball', met: 8.3, training: true, duration: 80 },
  { id: 'american_football', label: 'American Football', icon: '🏈', category: 'ball', met: 8.0, training: true, duration: 90 },
  { id: 'frisbee', label: 'Frisbee', icon: '🥏', category: 'ball', met: [3.0, 5.0, 8.0], levels: ['Werfen', 'Spiel', 'Ultimate'], training: false, duration: 45 },
  { id: 'bowling', label: 'Bowling / Kegeln', icon: '🎳', category: 'ball', met: 3.8, training: false, duration: 90 },
  { id: 'darts', label: 'Darts', icon: '🎯', category: 'ball', met: 2.5, training: false, duration: 60 },
  { id: 'billiards', label: 'Billard', icon: '🎱', category: 'ball', met: 2.5, training: false, duration: 60 },

  // Outdoor, Wasser & Winter
  { id: 'sup', label: 'Stand-Up-Paddling', icon: '🏄‍♀️', category: 'outdoor', met: [4.0, 6.0, 8.0], training: true, duration: 60, keywords: 'sup paddeln' },
  { id: 'kayak', label: 'Kanu / Kajak', icon: '🛶', category: 'outdoor', met: [3.5, 5.0, 8.0], training: true, duration: 60, keywords: 'paddeln' },
  { id: 'surf', label: 'Surfen', icon: '🏄', category: 'outdoor', met: [3.0, 5.0, 7.0], training: true, duration: 90, keywords: 'wellenreiten kitesurfen windsurfen' },
  { id: 'sailing', label: 'Segeln', icon: '⛵', category: 'outdoor', met: 3.0, training: false, duration: 120 },
  { id: 'ski', label: 'Ski alpin', icon: '⛷️', category: 'outdoor', met: [4.3, 5.3, 8.0], training: true, duration: 180, keywords: 'skifahren piste' },
  { id: 'snowboard', label: 'Snowboard', icon: '🏂', category: 'outdoor', met: [4.3, 5.3, 8.0], training: true, duration: 180 },
  { id: 'ice_skating', label: 'Eislaufen', icon: '⛸️', category: 'outdoor', met: [5.5, 7.0, 9.0], training: true, duration: 60, keywords: 'schlittschuh' },
  { id: 'sledding', label: 'Rodeln', icon: '🛷', category: 'outdoor', met: 7.0, training: false, duration: 60, keywords: 'schlitten' },
  { id: 'snowshoe', label: 'Schneeschuhwandern', icon: '🏔️', category: 'outdoor', met: [5.3, 6.5, 8.0], training: true, duration: 120 },
  { id: 'riding', label: 'Reiten', icon: '🏇', category: 'outdoor', met: [3.8, 5.5, 7.3], levels: ['Schritt', 'Trab', 'Galopp'], training: true, duration: 60, keywords: 'pferd' },
  { id: 'fishing', label: 'Angeln', icon: '🎣', category: 'outdoor', met: [2.0, 3.5, 4.0], training: false, duration: 180 },

  // Haushalt
  { id: 'vacuuming', label: 'Staubsaugen', icon: '🧹', category: 'household', met: 3.3, training: false, duration: 20, keywords: 'saugen' },
  { id: 'cleaning', label: 'Putzen', icon: '🧽', category: 'household', met: [2.3, 3.3, 3.8], levels: ['Abstauben', 'Normal', 'Grundputz / Böden schrubben'], training: false, duration: 30, keywords: 'bad küche wischen' },
  { id: 'windows', label: 'Fenster putzen', icon: '🪟', category: 'household', met: 3.2, training: false, duration: 45 },
  { id: 'ironing', label: 'Bügeln', icon: '👔', category: 'household', met: 1.8, training: false, duration: 30 },
  { id: 'laundry', label: 'Wäsche waschen / aufhängen', icon: '🧺', category: 'household', met: 2.0, training: false, duration: 20, keywords: 'wäsche falten' },
  { id: 'cooking', label: 'Kochen', icon: '🍳', category: 'household', met: [2.0, 2.5, 3.5], levels: ['Aufwärmen', 'Kochen', 'Großes Essen / Meal Prep'], training: false, duration: 45, keywords: 'backen meal prep' },
  { id: 'dishes', label: 'Abwasch / Küche aufräumen', icon: '🍽️', category: 'household', met: [1.8, 2.3, 3.3], training: false, duration: 20, keywords: 'spülen spülmaschine' },
  { id: 'tidying', label: 'Aufräumen', icon: '🧸', category: 'household', met: [2.0, 2.5, 3.3], training: false, duration: 30 },
  { id: 'bed_making', label: 'Betten machen / beziehen', icon: '🛏️', category: 'household', met: 3.3, training: false, duration: 15 },
  { id: 'shopping', label: 'Einkaufen', icon: '🛒', category: 'household', met: [2.3, 2.3, 3.0], levels: ['Mit Wagen', 'Normal', 'Shoppingbummel'], training: false, duration: 45, keywords: 'supermarkt shopping bummeln' },
  { id: 'carrying', label: 'Tragen / Umzug', icon: '📦', category: 'household', met: [3.5, 5.8, 7.5], levels: ['Einkäufe tragen', 'Kisten tragen', 'Möbel / Treppen'], training: false, duration: 60, keywords: 'umziehen schleppen möbel' },
  { id: 'diy', label: 'Heimwerken / Renovieren', icon: '🔨', category: 'household', met: [2.3, 3.3, 4.5], levels: ['Kleinkram', 'Streichen / Bohren', 'Schwere Arbeiten'], training: false, duration: 60, keywords: 'streichen tapezieren bohren renovieren' },
  { id: 'car_wash', label: 'Auto waschen / putzen', icon: '🚗', category: 'household', met: 3.5, training: false, duration: 45 },

  // Garten
  { id: 'gardening', label: 'Gartenarbeit', icon: '🌱', category: 'garden', met: [2.3, 3.8, 4.5], training: false, duration: 60, keywords: 'pflanzen umgraben beet' },
  { id: 'mowing', label: 'Rasen mähen', icon: '🚜', category: 'garden', met: [2.5, 5.0, 6.0], levels: ['Aufsitzmäher', 'Motormäher', 'Handmäher'], training: false, duration: 45 },
  { id: 'weeding', label: 'Unkraut jäten', icon: '🌿', category: 'garden', met: 3.5, training: false, duration: 30 },
  { id: 'raking', label: 'Laub rechen', icon: '🍂', category: 'garden', met: 3.8, training: false, duration: 30, keywords: 'laub harken' },
  { id: 'hedge', label: 'Hecke / Sträucher schneiden', icon: '✂️', category: 'garden', met: [3.5, 4.0, 4.5], training: false, duration: 45 },
  { id: 'snow_shoveling', label: 'Schnee schippen', icon: '❄️', category: 'garden', met: [3.5, 5.3, 7.5], training: false, duration: 30, keywords: 'schnee räumen' },
  { id: 'wood', label: 'Holz hacken / stapeln', icon: '🪓', category: 'garden', met: [3.0, 4.5, 6.3], training: false, duration: 45, keywords: 'brennholz' },

  // Alltag & Freizeit
  { id: 'stairs', label: 'Treppensteigen', icon: '🪜', category: 'everyday', met: [4.0, 6.0, 8.8], levels: ['Langsam', 'Normal', 'Schnell'], training: false, duration: 10, keywords: 'treppe stufen' },
  { id: 'dog_walk', label: 'Gassi gehen', icon: '🐕', category: 'everyday', met: 3.0, training: false, duration: 30, keywords: 'hund' },
  { id: 'stroller', label: 'Kinderwagen schieben', icon: '👶', category: 'everyday', met: [2.5, 3.5, 4.0], training: false, duration: 30, keywords: 'buggy baby' },
  { id: 'kids_play', label: 'Mit Kindern spielen', icon: '🧒', category: 'everyday', met: [2.2, 3.5, 5.8], levels: ['Ruhig', 'Aktiv', 'Toben / Fangen'], training: false, duration: 30, keywords: 'spielplatz' },
  { id: 'sex', label: 'Sex', icon: '❤️', category: 'everyday', met: [1.8, 2.8, 3.5], levels: ['Entspannt', 'Normal', 'Leidenschaftlich'], training: false, duration: 25, keywords: 'liebe intim schlafzimmer' },
  { id: 'standing_work', label: 'Arbeiten im Stehen', icon: '🧍', category: 'everyday', met: [1.8, 2.3, 3.0], training: false, duration: 120, keywords: 'stehschreibtisch verkauf kasse' },
  { id: 'manual_work', label: 'Körperliche Arbeit', icon: '👷', category: 'everyday', met: [3.0, 4.0, 6.0], levels: ['Leicht (Lager, Pflege)', 'Mittel (Handwerk)', 'Schwer (Bau)'], training: false, duration: 240, keywords: 'job bau handwerk pflege lager' },
  { id: 'music', label: 'Musizieren', icon: '🥁', category: 'everyday', met: [2.0, 2.8, 3.8], levels: ['Gitarre / Klavier', 'Im Stehen', 'Schlagzeug'], training: false, duration: 60, keywords: 'instrument band' },
  { id: 'active_gaming', label: 'Active Gaming / VR', icon: '🎮', category: 'everyday', met: [2.3, 3.8, 6.0], training: false, duration: 30, keywords: 'wii switch vr beat saber' },
  { id: 'other', label: 'Sonstige Aktivität', icon: '🏅', category: 'everyday', met: [2.5, 4.0, 6.0], training: false, duration: 30, keywords: 'eigene andere' },
];

export const ACTIVITY_MAP: Record<string, ActivityDef> = Object.fromEntries(ACTIVITIES.map((a) => [a.id, a]));

const UNKNOWN: ActivityDef = { id: 'unknown', label: 'Aktivität', icon: '🏅', category: 'fitness', met: 4.0, training: false, duration: 30 };

export const activityDef = (id: string): ActivityDef => ACTIVITY_MAP[id] ?? UNKNOWN;
export const activityLabel = (id: string) => activityDef(id).label;
export const activityIcon = (id: string) => activityDef(id).icon;
export const countsAsTraining = (id: string) => activityDef(id).training;
export const hasLevels = (id: string) => Array.isArray(activityDef(id).met);

const DEFAULT_LEVELS: [string, string, string] = ['Leicht', 'Mittel', 'Intensiv'];
const LEVEL_INDEX: Record<CardioIntensity, number> = { light: 0, medium: 1, intense: 2 };

export function levelLabel(id: string, intensity: CardioIntensity): string {
  return (activityDef(id).levels ?? DEFAULT_LEVELS)[LEVEL_INDEX[intensity]];
}

/** MET of a catalog activity at a level (ignores speed). */
export function catalogMet(id: string, intensity: CardioIntensity): number {
  const m = activityDef(id).met;
  return Array.isArray(m) ? m[LEVEL_INDEX[intensity]] : m;
}

/** true when the kcal count only the extra energy above rest (MET − 1) */
export const isNetActivity = (id: string) => NET_CATEGORIES.has(activityDef(id).category);

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');

/** Search by name or synonym (accent-insensitive). */
export function searchActivities(query: string): ActivityDef[] {
  const q = fold(query.trim());
  if (!q) return ACTIVITIES;
  return ACTIVITIES.filter((a) => fold(`${a.label} ${a.keywords ?? ''}`).includes(q));
}
