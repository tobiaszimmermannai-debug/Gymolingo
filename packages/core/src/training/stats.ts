import type { ISODate } from '../dates';
import { addDays, startOfWeek } from '../dates';
import type { ExerciseDef, MuscleGroup, WorkoutSession, WorkoutSet } from '../types';
import { estimate1RM } from './oneRm';
import type { ExerciseSession } from './progression';

export const isWorkingSet = (s: Pick<WorkoutSet, 'set_type' | 'completed' | 'deleted' | 'reps'>) =>
  !s.deleted && s.completed && s.set_type !== 'warmup' && s.reps > 0;

export function completedSessions(sessions: WorkoutSession[]): WorkoutSession[] {
  return sessions
    .filter((s) => !s.deleted && s.status === 'completed')
    .sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
}

/** History of one exercise (newest first) – input for the progression engine. */
export function exerciseHistory(
  exerciseId: string,
  sessions: WorkoutSession[],
  sets: WorkoutSet[],
  opts: { excludeSessionId?: string; limit?: number } = {},
): ExerciseSession[] {
  const bySession = new Map<string, WorkoutSet[]>();
  for (const s of sets) {
    if (s.exercise_id !== exerciseId || !isWorkingSet(s)) continue;
    const arr = bySession.get(s.session_id) ?? [];
    arr.push(s);
    bySession.set(s.session_id, arr);
  }
  const out: ExerciseSession[] = [];
  for (const session of completedSessions(sessions)) {
    if (session.id === opts.excludeSessionId) continue;
    const ss = bySession.get(session.id);
    if (!ss?.length) continue;
    out.push({
      date: session.date,
      sets: ss
        .sort((a, b) => a.set_index - b.set_index)
        .map((s) => ({ weight_kg: s.weight_kg, reps: s.reps, rir: s.rir, rpe: s.rpe, set_type: s.set_type })),
    });
    if (opts.limit && out.length >= opts.limit) break;
  }
  return out;
}

/** All sets (incl. warm-ups) of the most recent completed session with this exercise – used to pre-fill a new workout. */
export function lastPerformedSets(exerciseId: string, sessions: WorkoutSession[], sets: WorkoutSet[], excludeSessionId?: string): WorkoutSet[] {
  for (const session of completedSessions(sessions)) {
    if (session.id === excludeSessionId) continue;
    const ss = sets.filter((s) => s.session_id === session.id && s.exercise_id === exerciseId && !s.deleted && s.completed);
    if (ss.length) return ss.sort((a, b) => a.set_index - b.set_index);
  }
  return [];
}

export type PRType = 'weight' | 'e1rm' | 'reps' | 'volume';

export interface PersonalRecord {
  exercise_id: string;
  type: PRType;
  value: number;
  weight_kg: number;
  reps: number;
  date: ISODate;
  session_id: string;
  set_id: string;
}

export interface ExerciseRecords {
  exercise_id: string;
  maxWeight: PersonalRecord | null;
  bestE1RM: PersonalRecord | null;
  /** best reps per weight (kg -> record) */
  repsAtWeight: Record<string, PersonalRecord>;
}

/**
 * Computes PRs chronologically. Returns the current records per exercise and
 * the list of PR events (a set that improved a record at its time).
 */
export function computePersonalRecords(sessions: WorkoutSession[], sets: WorkoutSet[]) {
  const sessionMap = new Map(sessions.filter((s) => !s.deleted && s.status === 'completed').map((s) => [s.id, s]));
  const chronological = sets
    .filter((s) => isWorkingSet(s) && sessionMap.has(s.session_id))
    .sort((a, b) => {
      const sa = sessionMap.get(a.session_id)!;
      const sb = sessionMap.get(b.session_id)!;
      if (sa.started_at !== sb.started_at) return sa.started_at < sb.started_at ? -1 : 1;
      return a.exercise_order - b.exercise_order || a.set_index - b.set_index;
    });

  const records: Record<string, ExerciseRecords> = {};
  const events: PersonalRecord[] = [];
  // The first session of an exercise only establishes the baseline (no PR events).
  const firstSession = new Map<string, string>();

  for (const s of chronological) {
    const session = sessionMap.get(s.session_id)!;
    const rec = (records[s.exercise_id] ??= { exercise_id: s.exercise_id, maxWeight: null, bestE1RM: null, repsAtWeight: {} });
    if (!firstSession.has(s.exercise_id)) firstSession.set(s.exercise_id, s.session_id);
    const isFirstSession = firstSession.get(s.exercise_id) === s.session_id;
    const base = { exercise_id: s.exercise_id, weight_kg: s.weight_kg, reps: s.reps, date: session.date, session_id: s.session_id, set_id: s.id };
    const e1 = Math.round(estimate1RM(s.weight_kg, s.reps, 0) * 10) / 10;

    if (s.weight_kg > 0 && (!rec.maxWeight || s.weight_kg > rec.maxWeight.value)) {
      const r: PersonalRecord = { ...base, type: 'weight', value: s.weight_kg };
      if (rec.maxWeight && !isFirstSession) events.push(r);
      rec.maxWeight = r;
    }
    if (e1 > 0 && (!rec.bestE1RM || e1 > rec.bestE1RM.value)) {
      const r: PersonalRecord = { ...base, type: 'e1rm', value: e1 };
      if (rec.bestE1RM && !isFirstSession) events.push(r);
      rec.bestE1RM = r;
    }
    const key = String(s.weight_kg);
    const prev = rec.repsAtWeight[key];
    if (!prev || s.reps > prev.value) {
      const r: PersonalRecord = { ...base, type: 'reps', value: s.reps };
      if (prev && !isFirstSession) events.push(r);
      rec.repsAtWeight[key] = r;
    }
  }
  return { records, events };
}

/** PRs achieved inside one session (deduplicated per exercise & type, best value kept). */
export function sessionPRs(sessionId: string, sessions: WorkoutSession[], sets: WorkoutSet[]): PersonalRecord[] {
  const { events } = computePersonalRecords(sessions, sets);
  const best = new Map<string, PersonalRecord>();
  for (const e of events) {
    if (e.session_id !== sessionId) continue;
    const k = `${e.exercise_id}:${e.type}`;
    const cur = best.get(k);
    if (!cur || e.value > cur.value) best.set(k, e);
  }
  return [...best.values()];
}

export function setVolume(s: Pick<WorkoutSet, 'weight_kg' | 'reps'>): number {
  return Math.max(0, s.weight_kg) * Math.max(0, s.reps);
}

export interface SessionSummary {
  session_id: string;
  date: ISODate;
  name: string;
  durationSec: number;
  volumeKg: number;
  workingSets: number;
  exercises: number;
  prs: number;
}

export function sessionDurationSec(session: WorkoutSession, now: Date = new Date()): number {
  const start = new Date(session.started_at).getTime();
  const end = session.ended_at ? new Date(session.ended_at).getTime() : now.getTime();
  let paused = session.paused_seconds || 0;
  if (session.status === 'paused' && session.paused_at) paused += (now.getTime() - new Date(session.paused_at).getTime()) / 1000;
  return Math.max(0, Math.round((end - start) / 1000 - paused));
}

export function summarizeSession(session: WorkoutSession, sets: WorkoutSet[], prCount = 0): SessionSummary {
  const ss = sets.filter((s) => s.session_id === session.id && isWorkingSet(s));
  return {
    session_id: session.id,
    date: session.date,
    name: session.name,
    durationSec: sessionDurationSec(session),
    volumeKg: Math.round(ss.reduce((a, s) => a + setVolume(s), 0)),
    workingSets: ss.length,
    exercises: new Set(ss.map((s) => s.exercise_id)).size,
    prs: prCount,
  };
}

/**
 * Weekly hard sets per muscle group. Primary muscle counts 1 set,
 * each secondary muscle 0.5 sets (common convention in hypertrophy research).
 */
export function setsPerMuscle(
  sets: WorkoutSet[],
  sessions: WorkoutSession[],
  exerciseLookup: (id: string) => ExerciseDef | undefined,
  from: ISODate,
  to: ISODate,
): Partial<Record<MuscleGroup, number>> {
  const sessionDates = new Map(
    sessions.filter((s) => !s.deleted && s.status === 'completed').map((s) => [s.id, s.date]),
  );
  const out: Partial<Record<MuscleGroup, number>> = {};
  for (const s of sets) {
    if (!isWorkingSet(s)) continue;
    const d = sessionDates.get(s.session_id);
    if (!d || d < from || d > to) continue;
    const ex = exerciseLookup(s.exercise_id);
    if (!ex) continue;
    out[ex.primary_muscle] = (out[ex.primary_muscle] ?? 0) + 1;
    for (const m of ex.secondary_muscles) out[m] = (out[m] ?? 0) + 0.5;
  }
  return out;
}

export interface VolumePoint {
  date: ISODate;
  volumeKg: number;
  sets: number;
  sessions: number;
}

/** Training volume aggregated per week (Monday) or per day. */
export function volumeSeries(
  sessions: WorkoutSession[],
  sets: WorkoutSet[],
  from: ISODate,
  to: ISODate,
  bucket: 'day' | 'week',
): VolumePoint[] {
  const done = completedSessions(sessions).filter((s) => s.date >= from && s.date <= to);
  const map = new Map<string, VolumePoint>();
  const keyOf = (d: ISODate) => (bucket === 'week' ? startOfWeek(d) : d);
  // prefill buckets so charts show gaps as 0
  let cur = keyOf(from);
  while (cur <= to) {
    map.set(cur, { date: cur, volumeKg: 0, sets: 0, sessions: 0 });
    cur = addDays(cur, bucket === 'week' ? 7 : 1);
  }
  const setsBySession = new Map<string, WorkoutSet[]>();
  for (const s of sets) {
    if (!isWorkingSet(s)) continue;
    const arr = setsBySession.get(s.session_id) ?? [];
    arr.push(s);
    setsBySession.set(s.session_id, arr);
  }
  for (const session of done) {
    const k = keyOf(session.date);
    const p = map.get(k) ?? { date: k, volumeKg: 0, sets: 0, sessions: 0 };
    const ss = setsBySession.get(session.id) ?? [];
    p.volumeKg += ss.reduce((a, s) => a + setVolume(s), 0);
    p.sets += ss.length;
    p.sessions += 1;
    map.set(k, p);
  }
  return [...map.values()].sort((a, b) => (a.date < b.date ? -1 : 1)).map((p) => ({ ...p, volumeKg: Math.round(p.volumeKg) }));
}

/** Best e1RM per session for an exercise (chronological) – strength curve. */
export function e1rmSeries(exerciseId: string, sessions: WorkoutSession[], sets: WorkoutSet[]): { date: ISODate; e1rm: number; topWeight: number }[] {
  const hist = exerciseHistory(exerciseId, sessions, sets);
  return hist
    .map((h) => ({
      date: h.date,
      e1rm: Math.round(h.sets.reduce((m, s) => Math.max(m, estimate1RM(s.weight_kg, s.reps, 0)), 0) * 10) / 10,
      topWeight: h.sets.reduce((m, s) => Math.max(m, s.weight_kg), 0),
    }))
    .reverse();
}

/** Exercises ranked by how often they were trained (for "key lifts" charts). */
export function mostTrainedExercises(sets: WorkoutSet[], limit = 5): string[] {
  const count = new Map<string, number>();
  for (const s of sets) if (isWorkingSet(s)) count.set(s.exercise_id, (count.get(s.exercise_id) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
}

/**
 * Strength change between two periods: for every exercise trained in both
 * periods the *median* of the per-session best e1RM (Epley, performed reps) is
 * compared – robust against single good or bad days. Returns the average
 * relative change.
 */
export function strengthChange(
  sessions: WorkoutSession[],
  sets: WorkoutSet[],
  cur: { from: ISODate; to: ISODate },
  prev: { from: ISODate; to: ISODate },
): { pct: number | null; exercises: { exercise_id: string; prev: number; cur: number; pct: number }[] } {
  const sessionDates = new Map(sessions.filter((s) => !s.deleted && s.status === 'completed').map((s) => [s.id, s.date]));
  const medianOfSessionBests = (from: ISODate, to: ISODate) => {
    const perSession = new Map<string, Map<string, number>>(); // exercise -> session -> best
    for (const s of sets) {
      if (!isWorkingSet(s)) continue;
      const d = sessionDates.get(s.session_id);
      if (!d || d < from || d > to) continue;
      const v = estimate1RM(s.weight_kg, s.reps, 0);
      const m = perSession.get(s.exercise_id) ?? new Map<string, number>();
      if (v > (m.get(s.session_id) ?? 0)) m.set(s.session_id, v);
      perSession.set(s.exercise_id, m);
    }
    const out = new Map<string, number>();
    for (const [id, m] of perSession) {
      const vals = [...m.values()].sort((a, b) => a - b);
      const mid = Math.floor(vals.length / 2);
      out.set(id, vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2);
    }
    return out;
  };
  const a = medianOfSessionBests(prev.from, prev.to);
  const b = medianOfSessionBests(cur.from, cur.to);
  const exercises: { exercise_id: string; prev: number; cur: number; pct: number }[] = [];
  for (const [id, p] of a) {
    const c = b.get(id);
    if (c && p > 0) exercises.push({ exercise_id: id, prev: Math.round(p * 10) / 10, cur: Math.round(c * 10) / 10, pct: Math.round(((c - p) / p) * 1000) / 10 });
  }
  if (!exercises.length) return { pct: null, exercises };
  const pct = Math.round((exercises.reduce((s, e) => s + e.pct, 0) / exercises.length) * 10) / 10;
  return { pct, exercises: exercises.sort((x, y) => y.pct - x.pct) };
}
