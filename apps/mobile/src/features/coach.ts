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
  formatKg,
  renderWeeklyReportText,
  startOfWeek,
  todayISO,
  type CoachContext,
} from '@gymolingo/core';
import { insert, remove, useDB } from '@/data/store';
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
      const r = await askCoach(text, history, todayISO());
      reply = r.reply;
      source = r.source;
    } catch {
      // offline or server problem → rule-based answer from the same data
    }
  }
  insert('coach_messages', { role: 'assistant', content: reply, source });
  requestSync();
}

/** Creates (and stores) the weekly report for the given week if missing. */
export async function ensureWeeklyReport(weekStartDate: string, force = false) {
  const s = useDB.getState();
  const ws = startOfWeek(weekStartDate);
  const existing = Object.values(s.tables.ai_reports).find((r) => !r.deleted && r.week_start === ws);
  if (existing && !force) return existing;
  const profile = s.tables.athlete_profiles[s.userId];
  if (!profile) return null;
  const live = <T extends { deleted: boolean }>(o: Record<string, T>) => Object.values(o).filter((r) => !r.deleted);
  const data = {
    profile,
    sessions: live(s.tables.workout_sessions),
    sets: live(s.tables.workout_sets),
    meals: live(s.tables.meal_entries),
    weights: live(s.tables.weight_entries),
    steps: live(s.tables.step_entries),
    checkins: live(s.tables.daily_checkins),
    pauses: live(s.tables.streak_pauses),
  };
  const stats = buildWeeklyReport(data, ws);
  let content: { title: string; sections: { heading: string; body: string }[] } = renderWeeklyReportText(stats);
  let source: 'ai' | 'rules' = 'rules';
  let model: string | null = null;
  if (aiAvailability() === 'ok') {
    try {
      const r = await aiWeeklyReport(ws, todayISO());
      if (r.source === 'ai') {
        content = { title: content.title, sections: r.sections };
        source = 'ai';
        model = r.model ?? null;
      }
    } catch {
      // keep rule-based report
    }
  }
  const row = insert('ai_reports', { week_start: ws, stats, content, source, model });
  if (existing) remove('ai_reports', existing.id);
  requestSync();
  return row;
}

/** Automatic weekly report: on Sunday for the current week, otherwise for the last completed week. */
export function autoReportWeek(today = todayISO()): string {
  const ws = startOfWeek(today);
  return new Date(`${today}T12:00:00`).getDay() === 0 ? ws : addDays(ws, -7);
}
