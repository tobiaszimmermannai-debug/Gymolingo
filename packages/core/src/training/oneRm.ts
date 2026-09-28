/**
 * One-rep-max estimation.
 * Epley: 1RM = w × (1 + reps / 30). Reps in reserve (RIR) are added to the
 * performed reps because the set was not taken to failure.
 * Above ~12 reps the estimate gets inaccurate, therefore the reps are capped.
 */

export const MAX_REPS_FOR_ESTIMATE = 15;

export function effectiveRir(rir: number | null | undefined, rpe: number | null | undefined): number | null {
  if (rir !== null && rir !== undefined && !Number.isNaN(rir)) return Math.max(0, rir);
  if (rpe !== null && rpe !== undefined && !Number.isNaN(rpe)) return Math.max(0, 10 - rpe);
  return null;
}

export function estimate1RM(weight: number, reps: number, rir: number | null = 0): number {
  if (weight <= 0 || reps <= 0) return 0;
  const r = Math.min(MAX_REPS_FOR_ESTIMATE, reps + Math.max(0, rir ?? 0));
  if (r <= 1) return weight;
  return weight * (1 + r / 30);
}

/** Weight that allows `reps` repetitions leaving `rir` reps in reserve. */
export function weightForReps(oneRm: number, reps: number, rir = 0): number {
  const r = Math.min(MAX_REPS_FOR_ESTIMATE, reps + Math.max(0, rir));
  if (r <= 1) return oneRm;
  return oneRm / (1 + r / 30);
}

/** Reps achievable at `weight` leaving `rir` in reserve (inverse Epley, floored). */
export function repsAtWeight(oneRm: number, weight: number, rir = 0): number {
  if (weight <= 0) return MAX_REPS_FOR_ESTIMATE;
  if (weight >= oneRm) return weight > oneRm ? 0 : 1;
  const total = 30 * (oneRm / weight - 1);
  return Math.max(0, Math.floor(total + 1e-9) - Math.max(0, rir));
}

export function roundToIncrement(weight: number, increment: number): number {
  if (increment <= 0) return Math.round(weight * 10) / 10;
  const v = Math.round(weight / increment) * increment;
  return Math.round(v * 100) / 100;
}

export function floorToIncrement(weight: number, increment: number): number {
  if (increment <= 0) return Math.floor(weight * 10) / 10;
  const v = Math.floor(weight / increment + 1e-9) * increment;
  return Math.round(v * 100) / 100;
}
