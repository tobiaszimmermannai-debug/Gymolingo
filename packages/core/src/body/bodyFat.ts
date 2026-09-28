/**
 * Body fat from tape measurements (U.S. Navy circumference method, metric).
 * Free, offline and deterministic – typical error ±3–4 percentage points.
 */
import type { ISODate } from '../dates';
import type { BodyMeasurement, Sex } from '../types';

export interface NavyInput {
  sex: Sex | null;
  height_cm: number | null;
  waist_cm: number | null;
  neck_cm: number | null;
  hips_cm?: number | null;
}

/** Returns body fat in % (1 decimal) or null when inputs are missing/implausible. */
export function navyBodyFat(i: NavyInput): number | null {
  const { sex, height_cm: h, waist_cm: w, neck_cm: n } = i;
  if (!h || !w || !n || h < 120 || h > 230) return null;
  let pct: number;
  if (sex === 'male') {
    if (w - n <= 0) return null;
    pct = 495 / (1.0324 - 0.19077 * Math.log10(w - n) + 0.15456 * Math.log10(h)) - 450;
  } else if (sex === 'female') {
    const hip = i.hips_cm;
    if (!hip || w + hip - n <= 0) return null;
    pct = 495 / (1.29579 - 0.35004 * Math.log10(w + hip - n) + 0.221 * Math.log10(h)) - 450;
  } else return null;
  if (!Number.isFinite(pct)) return null;
  return Math.round(Math.min(60, Math.max(2, pct)) * 10) / 10;
}

/** Fields the Navy method needs for this sex (for hints in the UI). */
export function navyRequiredFields(sex: Sex | null): ('waist_cm' | 'neck_cm' | 'hips_cm')[] {
  return sex === 'female' ? ['waist_cm', 'neck_cm', 'hips_cm'] : ['waist_cm', 'neck_cm'];
}

/** Navy estimate from the most recent measurement that contains all required fields. */
export function latestNavyBodyFat(measurements: BodyMeasurement[], sex: Sex | null, heightCm: number | null): { date: ISODate; pct: number } | null {
  const need = navyRequiredFields(sex);
  const m = [...measurements]
    .filter((x) => !x.deleted && need.every((f) => x[f] != null))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!m) return null;
  const pct = navyBodyFat({ sex, height_cm: heightCm, waist_cm: m.waist_cm, neck_cm: m.neck_cm, hips_cm: m.hips_cm });
  return pct === null ? null : { date: m.date, pct };
}
