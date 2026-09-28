/**
 * Progressive overload engine ("double progression" with RIR/RPE awareness).
 *
 * Principles
 * 1. Reps are progressed inside the target rep range first.
 * 2. Weight is increased only after *all* working sets reach the top of the
 *    range with acceptable effort (RIR close to the target).
 * 3. Weight jumps respect the smallest available increment of the equipment
 *    and are capped relative to the working weight (≈ 10 %).
 * 4. A single bad session does not trigger a weight reduction; repeated
 *    under-performance or a stalled e1RM trend leads to a hold / deload.
 * 5. Every suggestion carries a German rationale so the user understands it.
 */
import type { ISODate } from '../dates';
import type { SetType } from '../types';
import { formatKg } from '../format';
import { effectiveRir, estimate1RM, floorToIncrement, repsAtWeight } from './oneRm';

export interface SetPerformance {
  weight_kg: number;
  reps: number;
  rir: number | null;
  rpe: number | null;
  set_type: SetType;
}

export interface ExerciseSession {
  date: ISODate;
  sets: SetPerformance[];
}

export interface ProgressionConfig {
  rep_min: number;
  rep_max: number;
  target_sets: number;
  target_rir: number;
  increment_kg: number;
  is_bodyweight: boolean;
}

export type SuggestionKind =
  | 'first_time'
  | 'increase_weight'
  | 'increase_reps'
  | 'hold'
  | 'reduce_weight'
  | 'deload';

export interface ProgressionSuggestion {
  kind: SuggestionKind;
  weight_kg: number;
  reps: number[];
  rationale: string;
  plateau: boolean;
  last: { date: ISODate; weight_kg: number; reps: number[]; avgRir: number | null } | null;
  e1rm: number | null;
}

const fmtKg = formatKg;
const repsStr = (r: number[]) => r.join('/');

export function workingSets(sets: SetPerformance[]): SetPerformance[] {
  return sets.filter((s) => s.set_type !== 'warmup' && s.reps > 0);
}

/** Best RIR-adjusted e1RM of a session (working sets only). */
export function sessionE1RM(session: ExerciseSession): number {
  return workingSets(session.sets).reduce(
    (best, s) => Math.max(best, estimate1RM(s.weight_kg, s.reps, effectiveRir(s.rir, s.rpe) ?? 0)),
    0,
  );
}

function topSets(session: ExerciseSession): { weight: number; sets: SetPerformance[] } {
  const ws = workingSets(session.sets);
  const weight = ws.reduce((m, s) => Math.max(m, s.weight_kg), 0);
  return { weight, sets: ws.filter((s) => s.weight_kg === weight) };
}

function avg(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

/**
 * Detects a plateau: the best e1RM of the last 3 sessions did not exceed the
 * best e1RM before them by more than 1 %.
 */
export function detectPlateau(history: ExerciseSession[]): boolean {
  if (history.length < 4) return false;
  const recent = history.slice(0, 3).map(sessionE1RM);
  const before = history.slice(3, 8).map(sessionE1RM);
  const bestBefore = Math.max(...before);
  const bestRecent = Math.max(...recent);
  if (bestBefore <= 0) return false;
  return bestRecent <= bestBefore * 1.01;
}

/**
 * @param history sessions containing this exercise, newest first.
 */
export function suggestProgression(history: ExerciseSession[], cfg: ProgressionConfig): ProgressionSuggestion {
  const repMin = Math.max(1, Math.min(cfg.rep_min, cfg.rep_max));
  const repMax = Math.max(cfg.rep_min, cfg.rep_max);
  const nSets = Math.max(1, cfg.target_sets);
  const inc = cfg.increment_kg > 0 ? cfg.increment_kg : 2.5;
  const valid = history.filter((h) => workingSets(h.sets).length > 0);

  if (valid.length === 0) {
    return {
      kind: 'first_time',
      weight_kg: 0,
      reps: Array(nSets).fill(repMin),
      rationale: cfg.is_bodyweight
        ? `Erstes Training: Mach so viele saubere Wiederholungen wie möglich (Ziel ${repMin}–${repMax}) und lass ca. ${cfg.target_rir} Wdh. im Tank.`
        : `Erstes Training: Wähle ein Gewicht, mit dem du ${repMin}–${repMax} saubere Wiederholungen mit ca. ${cfg.target_rir} Wdh. Reserve schaffst. Die App lernt ab dem nächsten Training mit.`,
      plateau: false,
      last: null,
      e1rm: null,
    };
  }

  const last = valid[0];
  const { weight, sets } = topSets(last);
  const reps = sets.map((s) => s.reps);
  const rirs = sets.map((s) => effectiveRir(s.rir, s.rpe)).filter((v): v is number => v !== null);
  const avgRir = avg(rirs);
  const minReps = Math.min(...reps);
  const avgReps = avg(reps) ?? 0;
  const e1rm = sessionE1RM(last);
  const plateau = detectPlateau(valid);
  const lastInfo = { date: last.date, weight_kg: weight, reps, avgRir: avgRir === null ? null : Math.round(avgRir * 10) / 10 };
  const lastStr = `${fmtKg(weight)} × ${repsStr(reps)}${avgRir !== null ? ` (Ø RIR ${lastInfo.avgRir})` : ''}`;
  const enoughSets = sets.length >= nSets;
  const allAtTop = reps.every((r) => r >= repMax) && enoughSets;

  const padSets = (arr: number[]) => {
    const out = arr.slice(0, nSets);
    while (out.length < nSets) out.push(out.length ? out[out.length - 1] : repMin);
    return out;
  };

  // ---------- Bodyweight without added load: progress reps, then add load ----------
  if (cfg.is_bodyweight && weight === 0) {
    if (allAtTop && (avgRir === null || avgRir >= cfg.target_rir - 1)) {
      return {
        kind: 'increase_weight',
        weight_kg: inc,
        reps: Array(nSets).fill(repMin),
        rationale: `Letztes Mal: ${repsStr(reps)} Wdh. – obere Grenze (${repMax}) in allen Sätzen erreicht. Zeit für Zusatzgewicht (+${fmtKg(inc)}) oder eine schwerere Variante.`,
        plateau,
        last: lastInfo,
        e1rm: null,
      };
    }
    const target = progressReps(padSets(reps), repMax, avgRir, cfg.target_rir);
    return {
      kind: 'increase_reps',
      weight_kg: 0,
      reps: target,
      rationale: `Letztes Mal: ${repsStr(reps)} Wdh. Ziel heute: ${repsStr(target)} – eine Wiederholung mehr in den schwächeren Sätzen.`,
      plateau,
      last: lastInfo,
      e1rm: null,
    };
  }

  // ---------- Deload on plateau with declining performance ----------
  if (plateau && valid.length >= 4) {
    const prev = valid.slice(1, 3).map(sessionE1RM);
    const declining = prev.every((p) => e1rm < p * 0.995);
    if (declining) {
      const deloadWeight = floorToIncrement(weight * 0.9, inc);
      return {
        kind: 'deload',
        weight_kg: deloadWeight,
        reps: Array(Math.max(1, nSets - 1)).fill(repMin),
        rationale: `Deine Leistung stagniert seit mehreren Einheiten und war zuletzt rückläufig (${lastStr}). Empfehlung: eine leichtere Einheit mit ${fmtKg(deloadWeight)} (≈ −10 %) und einem Satz weniger. Prüfe auch Schlaf, Kalorien und Protein.`,
        plateau,
        last: lastInfo,
        e1rm: round1(e1rm),
      };
    }
  }

  // ---------- Top of range reached ----------
  if (allAtTop) {
    const effortOk = avgRir === null || avgRir >= cfg.target_rir - 1;
    const prevSame = valid[1] ? topSets(valid[1]) : null;
    const confirmedBefore =
      prevSame !== null && prevSame.weight === weight && prevSame.sets.length >= nSets && prevSame.sets.every((s) => s.reps >= repMax);

    if (effortOk || confirmedBefore) {
      // how much can we add? Use RIR-adjusted e1RM to find the weight that allows
      // rep_min+1 reps at target RIR, bounded by 1–2 increments and +10 %.
      const avgExtra = (avgRir ?? cfg.target_rir) - cfg.target_rir + (avgReps - repMax);
      let steps = avgExtra >= 3 ? 2 : 1;
      if (steps === 2 && weight + 2 * inc > weight * 1.1) steps = 1;
      const newWeight = round2(weight + steps * inc);

      const predicted = repsAtWeight(e1rm, newWeight, cfg.target_rir);
      const firstSet = clamp(predicted, repMin, repMax);
      const target = Array(nSets)
        .fill(0)
        .map((_, i) => clamp(firstSet - (i === nSets - 1 && nSets > 2 ? 1 : 0), repMin, repMax));
      return {
        kind: 'increase_weight',
        weight_kg: newWeight,
        reps: target,
        rationale: `Letztes Mal: ${lastStr} – alle Sätze am oberen Ende des Bereichs (${repMin}–${repMax}). Gewicht um ${fmtKg(round2(newWeight - weight))} erhöhen, Ziel ${repsStr(target)} Wdh.`,
        plateau,
        last: lastInfo,
        e1rm: round1(e1rm),
      };
    }
    return {
      kind: 'hold',
      weight_kg: weight,
      reps: Array(nSets).fill(repMax),
      rationale: `Letztes Mal: ${lastStr} – oberes Ende erreicht, aber sehr nah am Muskelversagen. Bestätige ${fmtKg(weight)} × ${repMax} mit etwas mehr Reserve, dann wird gesteigert.`,
      plateau,
      last: lastInfo,
      e1rm: round1(e1rm),
    };
  }

  // ---------- Within the range: add reps ----------
  if (minReps >= repMin) {
    const target = progressReps(padSets(reps), repMax, avgRir, cfg.target_rir);
    return {
      kind: 'increase_reps',
      weight_kg: weight,
      reps: target,
      rationale: `Letztes Mal: ${lastStr}. Gewicht halten und Wiederholungen steigern: Ziel ${repsStr(target)}. Sobald alle Sätze ${repMax} Wdh. erreichen, erhöhst du das Gewicht.${plateau ? ' Hinweis: Dein geschätztes 1RM stagniert seit 3 Einheiten.' : ''}`,
      plateau,
      last: lastInfo,
      e1rm: round1(e1rm),
    };
  }

  // ---------- Below the range ----------
  const prev = valid[1] ? topSets(valid[1]) : null;
  const prevAlsoBelow = prev !== null && prev.weight === weight && Math.min(...prev.sets.map((s) => s.reps)) < repMin;
  const farBelow = avgReps < repMin - 2;

  if ((prevAlsoBelow && avgReps < repMin) || farBelow) {
    // choose the weight that allows rep_min at target RIR
    let newWeight = floorToIncrement(
      Math.min(weight - inc, e1rm / (1 + Math.min(15, repMin + cfg.target_rir) / 30)),
      inc,
    );
    newWeight = Math.max(inc, newWeight);
    if (newWeight >= weight) newWeight = Math.max(0, weight - inc);
    return {
      kind: 'reduce_weight',
      weight_kg: newWeight,
      reps: Array(nSets).fill(repMin),
      rationale: `Letztes Mal: ${lastStr} – unter dem Zielbereich (${repMin}–${repMax})${prevAlsoBelow ? ' bereits zum zweiten Mal' : ''}. Mit ${fmtKg(newWeight)} schaffst du voraussichtlich ${repMin} saubere Wdh. und baust von dort wieder auf.`,
      plateau,
      last: lastInfo,
      e1rm: round1(e1rm),
    };
  }

  return {
    kind: 'hold',
    weight_kg: weight,
    reps: Array(nSets).fill(repMin),
    rationale: `Letztes Mal: ${lastStr} – knapp unter dem Zielbereich. Gewicht halten und ${repMin} Wdh. in allen Sätzen anpeilen. Ein einzelner schwächerer Tag ist normal.`,
    plateau,
    last: lastInfo,
    e1rm: round1(e1rm),
  };
}

/**
 * Adds reps realistically: +1 to the weakest set, and +1 to the first set if
 * effort allowed it (RIR ≥ target). Never exceeds `repMax`.
 * Example (range 6–10, RIR 2 target): 8/8/7 → 9/8/8.
 */
export function progressReps(reps: number[], repMax: number, avgRir: number | null, targetRir: number): number[] {
  const out = reps.map((r) => Math.min(r, repMax));
  if (out.length === 0) return out;
  const effortAllows = avgRir === null || avgRir >= targetRir;
  const allEqual = out.every((r) => r === out[0]);
  if (allEqual) {
    if (out[0] < repMax) out[0] += 1;
    if (effortAllows && avgRir !== null && avgRir >= targetRir + 1 && out.length > 1 && out[1] < repMax) out[1] += 1;
    return out;
  }
  const weakest = out.lastIndexOf(Math.min(...out));
  if (out[weakest] < repMax) out[weakest] += 1;
  if (effortAllows && weakest !== 0 && out[0] < repMax) out[0] += 1;
  return out;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
