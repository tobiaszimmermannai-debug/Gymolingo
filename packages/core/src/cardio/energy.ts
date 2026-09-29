/**
 * Energy expenditure of walking, jogging, running and EMS training.
 * kcal = MET × body weight (kg) × hours (gross, like fitness trackers).
 *
 * Walking/running METs: Compendium of Physical Activities (Ainsworth et al. 2011),
 * interpolated by speed when a distance is known. Without distance the chosen
 * intensity picks a typical speed.
 * EMS (whole-body electromyostimulation, ~20 min): measured values are modest –
 * Kemmler et al. found ~412 kcal/h during light strength exercises with WB-EMS
 * (+17 % vs. without EMS); other studies report ~70 kcal per 20 min. We use
 * conservative METs of 3.5 / 4.5 / 5.5 for light / medium / intense.
 */
import type { ISODate } from '../dates';
import type { CardioActivity, CardioIntensity, CardioSession } from '../types';

export const CARDIO_LABELS_DE: Record<CardioActivity, string> = { walk: 'Spazieren', jog: 'Joggen', run: 'Laufen', ems: 'EMS-Training' };
export const CARDIO_ICONS: Record<CardioActivity, string> = { walk: '🚶', jog: '🏃', run: '🏃‍♂️', ems: '⚡' };
export const INTENSITY_LABELS_DE: Record<CardioIntensity, string> = { light: 'Leicht', medium: 'Mittel', intense: 'Intensiv' };
/** Typical session length used to prefill the form. */
export const DEFAULT_DURATION_MIN: Record<CardioActivity, number> = { walk: 30, jog: 30, run: 30, ems: 20 };
/** EMS/jog/run count as a training day (streaks, weekly quota); walking counts via steps. */
export const COUNTS_AS_TRAINING: Record<CardioActivity, boolean> = { walk: false, jog: true, run: true, ems: true };

export const EMS_MET: Record<CardioIntensity, number> = { light: 3.5, medium: 4.5, intense: 5.5 };

/** speed (km/h) → MET, Compendium 2011 (walking 17xxx, running 12xxx) */
const WALK_TABLE: [number, number][] = [
  [3.2, 2.8],
  [4.0, 3.0],
  [4.8, 3.5],
  [5.6, 4.3],
  [6.4, 5.0],
  [7.2, 7.0],
  [8.0, 8.3],
];
const RUN_TABLE: [number, number][] = [
  [6.4, 6.0],
  [8.0, 8.3],
  [8.4, 9.0],
  [9.7, 9.8],
  [10.8, 10.5],
  [11.3, 11.0],
  [12.1, 11.5],
  [12.9, 11.8],
  [13.8, 12.3],
  [14.5, 12.8],
  [16.1, 14.5],
  [17.7, 16.0],
  [19.3, 19.0],
];
/** typical speed (km/h) per intensity when no distance was entered */
const DEFAULT_SPEED: Record<Exclude<CardioActivity, 'ems'>, Record<CardioIntensity, number>> = {
  walk: { light: 4.0, medium: 5.0, intense: 6.0 },
  jog: { light: 7.0, medium: 8.0, intense: 9.0 },
  run: { light: 9.5, medium: 11.0, intense: 13.0 },
};

function interpolate(table: [number, number][], x: number): number {
  if (x <= table[0][0]) return table[0][1] * (x / table[0][0]) ** 0.5;
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i];
    if (x <= x1) {
      const [x0, y0] = table[i - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  const [xa, ya] = table[table.length - 2];
  const [xb, yb] = table[table.length - 1];
  return Math.min(23, yb + ((yb - ya) / (xb - xa)) * (x - xb));
}

export function speedKmh(durationMin: number, distanceKm: number | null): number | null {
  if (!distanceKm || distanceKm <= 0 || !durationMin || durationMin <= 0) return null;
  return distanceKm / (durationMin / 60);
}

/** Pace in minutes per km, e.g. 5.5 → "5:30". */
export function formatPace(durationMin: number, distanceKm: number | null): string | null {
  if (!distanceKm || distanceKm <= 0 || !durationMin) return null;
  const pace = durationMin / distanceKm;
  const m = Math.floor(pace);
  const s = Math.round((pace - m) * 60);
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, '0')}`;
}

export function cardioMet(activity: CardioActivity, intensity: CardioIntensity, durationMin: number, distanceKm: number | null): number {
  if (activity === 'ems') return EMS_MET[intensity];
  const speed = speedKmh(durationMin, distanceKm) ?? DEFAULT_SPEED[activity][intensity];
  // a fast walk (> 7.5 km/h) is really jogging, a slow "run" is really walking
  return speed >= 7.5 && activity === 'walk' ? interpolate(RUN_TABLE, speed) : activity !== 'walk' && speed < 6.4 ? interpolate(WALK_TABLE, speed) : interpolate(activity === 'walk' ? WALK_TABLE : RUN_TABLE, speed);
}

/** Calories burned (rounded, gross). */
export function cardioKcal(s: { activity: CardioActivity; intensity: CardioIntensity; duration_min: number; distance_km: number | null }, weightKg: number): number {
  if (!(s.duration_min > 0) || !(weightKg > 0)) return 0;
  return Math.round(cardioMet(s.activity, s.intensity, s.duration_min, s.distance_km) * weightKg * (s.duration_min / 60));
}

export interface CardioSummary {
  sessions: number;
  minutes: number;
  km: number;
  kcal: number;
  byActivity: Partial<Record<CardioActivity, number>>;
}

export function cardioSummary(sessions: CardioSession[], from: ISODate, to: ISODate): CardioSummary {
  const out: CardioSummary = { sessions: 0, minutes: 0, km: 0, kcal: 0, byActivity: {} };
  for (const s of sessions) {
    if (s.deleted || s.date < from || s.date > to) continue;
    out.sessions++;
    out.minutes += s.duration_min;
    out.km += s.distance_km ?? 0;
    out.kcal += s.kcal;
    out.byActivity[s.activity] = (out.byActivity[s.activity] ?? 0) + 1;
  }
  out.km = Math.round(out.km * 10) / 10;
  return out;
}

/** Calories burned on one day (all activities). */
export function burnedOn(date: ISODate, sessions: CardioSession[]): number {
  return sessions.reduce((a, s) => (!s.deleted && s.date === date ? a + s.kcal : a), 0);
}

/**
 * Daily targets including exercise calories when the user opted in: the extra
 * energy is added as carbohydrates (fuel for endurance / recovery).
 */
export function withExerciseCalories<T extends { calorie_target: number; carbs_target_g: number; add_exercise_calories?: boolean }>(profile: T, burnedKcal: number): T {
  if (!profile.add_exercise_calories || burnedKcal <= 0) return profile;
  return { ...profile, calorie_target: profile.calorie_target + burnedKcal, carbs_target_g: Math.round(profile.carbs_target_g + burnedKcal / 4) };
}
