/**
 * Coach: answers from the on-device rule engine by default (free, offline).
 * If AI is explicitly enabled (paid opt-in), questions go to the server-side
 * edge function, which uses the same computed facts.
 */
import { useMemo } from 'react';
import {
  addDays,
  answerOffline,
  buildCoachContext,
  buildWeeklyReport,
  firstDataDate,
  formatKg,
  renderWeeklyReportText,
  startOfWeek,
  todayISO,
  type CoachContext,
} from '@gymolingo/core';
import { insert, update, useDB } from '@/data/store';
import { useExerciseLookup } from '@/data/hooks';
import { requestSync } from '@/data/sync';
import { aiAvailability, aiWeeklyReport, askCoach } from '@/lib/ai';
import { suggestionFor } from '@/data/actions';
import { toExerciseConfigs } from './planner';
import { useTodayState } from './today';

export function useCoachContext(): CoachContext {
  const t = useTodayState();
  const lookup = useExerciseLookup();
  return useMemo(() => {
    const plan = t.nextDay
      ? {
          name: t.nextDay.day.name,
          is_training_day: t.isTrainingDay,
          done: t.workoutDone,
          exercises: toExerciseConfigs(t.nextDay.exercises, lookup).map((cfg) => {
            const s = suggestionFor(cfg);
            return { exercise: cfg.exercise.name, target: s.kind === 'first_time' ? `${cfg.rep_min}–${cfg.rep_max} Wdh. (Arbeitsgewicht finden)` : `${formatKg(s.weight_kg)} × ${s.reps.join('/')}` };
          }),
        }
      : null;
    return buildCoachContext(t.data, t.today, lookup, t.profile.birth_year, plan);
  }, [t, lookup]);
}

export async function sendCoachMessage(text: string, ctx: CoachContext): Promise<void> {
  const s = useDB.getState();
  const history = Object.values(s.tables.coach_messages)
    .filter((m) => !m.deleted)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content }));
  insert('coach_messages', { role: 'user', content: text, source: 'rules' });
  let reply = answerOffline(ctx, text);
  let source: 'ai' | 'rules' = 'rules';
  if (aiAvailability() === 'ok') {
    try {
      const r = await askCoach(text, history, ctx);
      if (r) {
        reply = r.reply;
        source = r.source;
      }
    } catch {
      // offline or server problem → rule-based answer from the same data
    }
  }
  insert('coach_messages', { role: 'assistant', content: reply, source });
  requestSync();
}

export interface ReportView {
  week_start: string;
  stats: unknown;
  content: { title: string; sections: { heading: string; body: string }[] };
  source: 'ai' | 'rules';
  model: string | null;
  /** true when the week has no logged data at all (nothing to report) */
  empty?: boolean;
}

function liveData() {
  const s = useDB.getState();
  const profile = s.tables.athlete_profiles[s.userId];
  if (!profile) return null;
  const live = <T extends { deleted: boolean }>(o: Record<string, T>) => Object.values(o).filter((r) => !r.deleted);
  return {
    profile,
    sessions: live(s.tables.workout_sessions),
    sets: live(s.tables.workout_sets),
    meals: live(s.tables.meal_entries),
    weights: live(s.tables.weight_entries),
    steps: live(s.tables.step_entries),
    checkins: live(s.tables.daily_checkins),
    cardio: live(s.tables.cardio_sessions),
    pauses: live(s.tables.streak_pauses),
  };
}

/**
 * Returns the weekly report for a week. Rule-based reports are always
 * recomputed from the current data (so late entries are reflected) and
 * persisted when something changed; AI reports are kept unless forced.
 */
export async function ensureWeeklyReport(weekStartDate: string, force = false): Promise<ReportView | null> {
  const ws = startOfWeek(weekStartDate);
  const s = useDB.getState();
  const existing = Object.values(s.tables.ai_reports).find((r) => !r.deleted && r.week_start === ws);
  if (existing && existing.source === 'ai' && !force) return existing as unknown as ReportView;
  const data = liveData();
  if (!data) return null;
  const stats = buildWeeklyReport(data, ws);
  let view: ReportView = { week_start: ws, stats, content: renderWeeklyReportText(stats), source: 'rules', model: null };
  if (aiAvailability() === 'ok' && (force || !existing)) {
    try {
      const r = await aiWeeklyReport(ws, stats, data.profile.display_name, data.profile.goal);
      if (r && r.source === 'ai') view = { ...view, content: { title: view.content.title, sections: r.sections }, source: 'ai', model: r.model ?? null };
    } catch {
      // keep rule-based report
    }
  }
  const we = addDays(ws, 6);
  const inWeek = (d: string) => d >= ws && d <= we;
  const hasData = data.sessions.some((x) => inWeek(x.date)) || data.meals.some((x) => inWeek(x.date)) || data.weights.some((x) => inWeek(x.date)) || data.steps.some((x) => inWeek(x.date));
  if (!hasData) return { ...view, empty: true };
  if (!existing) insert('ai_reports', view);
  else if (JSON.stringify(existing.content) !== JSON.stringify(view.content) || existing.source !== view.source) update('ai_reports', existing.id, { stats: view.stats, content: view.content, source: view.source, model: view.model });
  requestSync();
  return view;
}

/** Week the report screen opens with: like autoReportWeek, but never a week before the user started. */
export function defaultReportWeek(today = todayISO()): string {
  const ws = autoReportWeek(today);
  const data = liveData();
  if (!data) return ws;
  const created = data.profile.created_at?.slice(0, 10) ?? today;
  const first = firstDataDate(data);
  const since = first && first < created ? first : created;
  return addDays(ws, 6) < since ? startOfWeek(today) : ws;
}

/** Automatic weekly report: on Sunday for the current week, otherwise for the last completed week. */
export function autoReportWeek(today = todayISO()): string {
  const ws = startOfWeek(today);
  return new Date(`${today}T12:00:00`).getDay() === 0 ? ws : addDays(ws, -7);
}
