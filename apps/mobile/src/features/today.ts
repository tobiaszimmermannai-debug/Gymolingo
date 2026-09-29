/**
 * Derived "today" state shared by Home, reminders and the tab badges.
 * All numbers come from the core package (tested, deterministic).
 */
import { useDeferredValue, useMemo } from 'react';
import {
  buildDailyActivities,
  burnedOn,
  withExerciseCalories,
  buildStreakInput,
  computeAllStreaks,
  dayNutrition,
  earnedBadgeIds,
  bestStreaksFrom,
  firstDataDate,
  formatKg,
  isPlannedTrainingDay,
  openTasks,
  remainingForDay,
  startOfWeek,
  stepsByDate,
  suggestedWeekdays,
  summarizeGamification,
  computePersonalRecords,
  STREAK_LABELS_DE,
  timeToMinutes,
  todayISO,
  weekdayIndex,
  type ReminderDayState,
  type StreakKind,
  type StreakResult,
  type UserData,
} from '@gymolingo/core';
import { useDB } from '@/data/store';
import { useExerciseLookup, useRows, useUserData } from '@/data/hooks';
import { suggestionFor } from '@/data/actions';
import { nextPlanDay, planStructure, toExerciseConfigs } from './planner';

export function useActivePlan() {
  const plans = useRows('workout_plans');
  const days = useRows('plan_days');
  const exercises = useRows('plan_exercises');
  return useMemo(() => {
    const plan = plans.find((p) => p.is_active) ?? plans[0];
    return plan ? planStructure(plan, days, exercises) : null;
  }, [plans, days, exercises]);
}

export function sinceDate(data: UserData, installedAt: string): string {
  const created = data.profile.created_at ? data.profile.created_at.slice(0, 10) : installedAt.slice(0, 10);
  const first = firstDataDate(data);
  return first && first < created ? first : created;
}

export function useStreaks(data: UserData, today: string): Record<StreakKind, StreakResult> & { trainingMeta: { weekDone: number; weekQuota: number; trainingNeededToday: boolean } } {
  const installedAt = useDB((s) => s.installedAt);
  return useMemo(() => {
    const input = buildStreakInput(data, today, sinceDate(data, installedAt));
    const all = computeAllStreaks(input);
    const t = all.training as StreakResult & { weekDone: number; weekQuota: number; trainingNeededToday: boolean };
    return { ...all, trainingMeta: { weekDone: t.weekDone, weekQuota: t.weekQuota, trainingNeededToday: t.trainingNeededToday } };
  }, [data, today, installedAt]);
}

export function useGamification(data: UserData, today: string) {
  const installedAt = useDB((s) => s.installedAt);
  return useMemo(() => {
    const since = sinceDate(data, installedAt);
    const acts = buildDailyActivities(data, since, today);
    return summarizeGamification(acts, today, { plannedWorkouts: data.profile.training_days_per_week, stepTarget: data.profile.step_target }, since);
  }, [data, today, installedAt]);
}

export function useBadgeStats(data: UserData, streaks: Record<StreakKind, StreakResult>, level: number, challengesCompleted: number, friends = 0) {
  return useMemo(() => {
    const acts = buildDailyActivities(data, '0000-01-01', todayISO());
    const { events } = computePersonalRecords(data.sessions, data.sets);
    const sessionIds = new Set(data.sessions.filter((s) => s.status === 'completed' && !s.deleted).map((s) => s.id));
    const stats = {
      totalWorkouts: sessionIds.size,
      totalPRs: events.length,
      totalVolumeKg: data.sets.filter((s) => s.completed && !s.deleted && s.set_type !== 'warmup' && sessionIds.has(s.session_id)).reduce((a, s) => a + s.weight_kg * s.reps, 0),
      nutritionDays: acts.filter((a) => a.nutritionLogged).length,
      proteinDays: acts.filter((a) => a.proteinHit).length,
      stepGoalDays: acts.filter((a) => a.stepsHit).length,
      maxStepsDay: acts.reduce((m, a) => Math.max(m, a.steps), 0),
      checkins: acts.filter((a) => a.checkin).length,
      weighIns: acts.filter((a) => a.weighed).length,
      bestStreaks: bestStreaksFrom(streaks),
      level,
      challengesCompleted,
      friends,
      earlyWorkouts: data.sessions.filter((s) => s.status === 'completed' && !s.deleted && new Date(s.started_at).getHours() < 8).length,
    };
    return { stats, earned: earnedBadgeIds(stats) };
  }, [data, streaks, level, challengesCompleted, friends]);
}

/** Everything the Home screen and the reminder engine need for today. */
export function useTodayState() {
  // heavy aggregations run in a deferred render so logging stays instant
  const data = useDeferredValue(useUserData());
  const lookup = useExerciseLookup();
  const structure = useActivePlan();
  const today = todayISO();
  const streaks = useStreaks(data, today);
  const game = useGamification(data, today);

  return useMemo(() => {
    const cardioToday = (data.cardio ?? []).filter((c) => !c.deleted && c.date === today);
    const burned = burnedOn(today, data.cardio ?? []);
    // optional: calories burned by walk/jog/run/EMS raise today's target
    const p = withExerciseCalories(data.profile, burned);
    const nut = dayNutrition(today, data.meals);
    const rem = remainingForDay(nut.totals, p);
    const schedule = {
      type: p.schedule_type,
      weekdays: p.schedule_type === 'fixed_days' && p.training_weekdays.length ? p.training_weekdays : suggestedWeekdays(p.training_days_per_week),
      perWeek: p.training_days_per_week,
    };
    const workoutDone = data.sessions.some((s) => s.status === 'completed' && s.date === today && !s.deleted);
    const active = data.sessions.find((s) => (s.status === 'active' || s.status === 'paused') && !s.deleted) ?? null;
    const planned = isPlannedTrainingDay(schedule, today) || streaks.trainingMeta.trainingNeededToday;
    const weekQuotaOpen = streaks.trainingMeta.weekDone < streaks.trainingMeta.weekQuota;
    const isTrainingDay = planned && (weekQuotaOpen || workoutDone);
    const next = nextPlanDay(structure, data.sessions, today);
    let hint: string | null = null;
    let firstSuggestion: { exercise: string; text: string } | null = null;
    if (next) {
      const cfgs = toExerciseConfigs(next.exercises, lookup);
      if (cfgs[0]) {
        const s = suggestionFor(cfgs[0]);
        const text = s.kind === 'first_time' ? `${cfgs[0].rep_min}–${cfgs[0].rep_max} Wdh.` : `${formatKg(s.weight_kg)} × ${s.reps.join('/')}`;
        hint = `${cfgs[0].exercise.name}: ${text}`;
        firstSuggestion = { exercise: cfgs[0].exercise.name, text };
      }
    }
    const steps = stepsByDate(data.steps).get(today)?.steps ?? null;
    const weighed = data.weights.some((w) => w.date === today && !w.deleted);
    const checkinDone = data.checkins.some((c) => c.date === today && !c.deleted);
    const atRisk = (Object.entries(streaks) as [string, StreakResult][])
      .filter(([k, v]) => k !== 'trainingMeta' && v?.atRisk)
      .sort((a, b) => b[1].current - a[1].current)[0];
    const reminderState: ReminderDayState = {
      date: today,
      displayName: p.display_name,
      isTrainingDay,
      plannedWorkoutName: next?.day.name ?? null,
      workoutHint: hint,
      workoutDone,
      activeWorkoutStartedMin: active ? new Date(active.started_at).getHours() * 60 + new Date(active.started_at).getMinutes() : null,
      mealsLogged: nut.entries,
      calorieTarget: p.calorie_target,
      caloriesRemaining: rem.kcal,
      proteinTarget: p.protein_target_g,
      proteinRemaining: Math.max(0, rem.protein_g),
      stepsLogged: steps !== null,
      stepTarget: p.step_target,
      weighed,
      weightTrackingEnabled: p.weight_tracking_enabled,
      checkinDone,
      streakAtRisk: atRisk ? { label: STREAK_LABELS_DE[atRisk[0] as StreakKind], days: atRisk[1].current } : null,
      openChallenges: game.currentChallenges.filter((c) => !c.completed).map((c) => `${c.title} (${c.progress}/${c.target})`),
      paused: streaks.training.paused,
      preferredWorkoutTime: p.preferred_workout_time,
      isWeeklyReportDay: weekdayIndex(today) === 6,
    };
    return {
      today,
      data,
      profile: p,
      burnedKcal: burned,
      cardioToday,
      nutrition: nut,
      remaining: rem,
      steps,
      weighed,
      checkinDone,
      workoutDone,
      activeSession: active,
      isTrainingDay,
      nextDay: next,
      firstSuggestion,
      streaks,
      game,
      reminderState,
      tasks: openTasks(reminderState),
      weekStart: startOfWeek(today),
      nowMin: timeToMinutes(`${new Date().getHours()}:${new Date().getMinutes()}`),
    };
  }, [data, lookup, structure, today, streaks, game]);
}
