/**
 * Walk / jog / run / EMS sessions: calories are computed from duration,
 * distance or intensity and the latest body weight (core/cardio/energy).
 */
import { cardioKcal, type CardioActivity, type CardioIntensity, type CardioSession } from '@gymolingo/core';
import { insert, remove, update, useDB } from '@/data/store';
import { requestSync } from '@/data/sync';

/** Latest logged body weight, else the start weight from onboarding, else 75 kg. */
export function currentWeightKg(): number {
  const s = useDB.getState();
  const latest = Object.values(s.tables.weight_entries)
    .filter((w) => !w.deleted)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  return latest?.weight_kg ?? s.tables.athlete_profiles[s.userId]?.start_weight_kg ?? 75;
}

export interface CardioInput {
  date: string;
  activity: CardioActivity;
  duration_min: number;
  distance_km: number | null;
  intensity: CardioIntensity;
  /** manual override, otherwise computed */
  kcal: number | null;
  note: string | null;
}

export function computedKcal(i: Pick<CardioInput, 'activity' | 'intensity' | 'duration_min' | 'distance_km'>): number {
  return cardioKcal({ ...i, distance_km: i.activity === 'ems' ? null : i.distance_km }, currentWeightKg());
}

export function saveCardio(i: CardioInput, id?: string): string {
  const auto = computedKcal(i);
  const row = {
    date: i.date,
    activity: i.activity,
    duration_min: Math.round(i.duration_min * 10) / 10,
    distance_km: i.activity === 'ems' || !i.distance_km ? null : Math.round(i.distance_km * 100) / 100,
    intensity: i.intensity,
    kcal: i.kcal !== null && i.kcal !== auto ? Math.round(i.kcal) : auto,
    kcal_manual: i.kcal !== null && i.kcal !== auto,
    note: i.note,
  };
  let rid = id;
  if (id) update('cardio_sessions', id, row);
  else rid = insert('cardio_sessions', row).id;
  requestSync();
  return rid!;
}

export function deleteCardio(id: string) {
  remove('cardio_sessions', id);
  requestSync();
}

export function recentCardio(limit = 5): CardioSession[] {
  return Object.values(useDB.getState().tables.cardio_sessions)
    .filter((c) => !c.deleted)
    .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}
