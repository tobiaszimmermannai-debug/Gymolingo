/**
 * Background side effects once the store is hydrated:
 *  - auth session restore + auto sync (interval, foreground, reconnect)
 *  - reminder scheduling (local notifications) from the reminder engine
 *  - badge unlocks (persisted as user_achievements)
 *  - public profile snapshot for friends (level, streaks, PRs – privacy filtered server-side)
 *  - optional health step import
 */
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {
  addDays,
  BADGE_MAP,
  computePersonalRecords,
  isPlannedTrainingDay,
  planRemindersForDay,
  suggestedWeekdays,
  weekdayIndex,
  type PlannedReminder,
  type ReminderDayState,
} from '@gymolingo/core';
import { useDB, insert, setPrefs } from '@/data/store';
import { autoReportWeek, ensureWeeklyReport } from './coach';
import { useReminderSettings, useRows } from '@/data/hooks';
import { syncNow } from '@/data/sync';
import { initAuth } from './account';
import { useBadgeStats, useTodayState } from './today';
import { configureNotifications, scheduleReminders } from '@/lib/notifications';
import { syncHealthSteps } from '@/lib/health';
import '@/lib/health/enable';
import { supabase } from '@/lib/supabase';
import { uploadPendingPhotos } from './photoSync';

export function AppBootstrap() {
  const onboarded = useDB((s) => !!s.tables.athlete_profiles[s.userId]?.onboarding_completed);
  useEffect(() => {
    configureNotifications();
    void initAuth();
  }, []);
  useAutoSync();
  if (!onboarded) return null;
  return <OnboardedEffects />;
}

function useAutoSync() {
  const account = useDB((s) => s.accountUserId);
  useEffect(() => {
    if (!account) return;
    const run = () => {
      void syncNow().then(() => uploadPendingPhotos());
    };
    run();
    const interval = setInterval(run, 5 * 60 * 1000);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && run());
    let wasOffline = false;
    const unsubNet = NetInfo.addEventListener((s) => {
      if (s.isConnected === false) wasOffline = true;
      else if (wasOffline && s.isConnected) {
        wasOffline = false;
        run();
      }
    });
    return () => {
      clearInterval(interval);
      sub.remove();
      unsubNet();
    };
  }, [account]);
}

function OnboardedEffects() {
  const t = useTodayState();
  const settings = useReminderSettings();
  const achievements = useRows('user_achievements');
  const friends = useDB((s) => s.prefs.friendsCount ?? 0);
  const badges = useBadgeStats(t.data, t.streaks, t.game.level.level, t.game.challengesCompleted, friends);
  const account = useDB((s) => s.accountUserId);

  // health import once per launch / foreground
  useEffect(() => {
    void syncHealthSteps();
    const sub = AppState.addEventListener('change', (st) => st === 'active' && void syncHealthSteps());
    return () => sub.remove();
  }, []);

  // automatic weekly report (once per day; computed on-device, AI only if explicitly enabled)
  useEffect(() => {
    const prefs = useDB.getState().prefs;
    if (prefs.lastAutoReport === t.today) return;
    const isSunday = new Date(`${t.today}T12:00:00`).getDay() === 0;
    void ensureWeeklyReport(autoReportWeek(t.today), isSunday).then(() => setPrefs({ lastAutoReport: t.today }));
  }, [t.today]);

  // reminders
  const reminderKey = JSON.stringify([t.reminderState, settings]);
  useEffect(() => {
    const timer = setTimeout(() => {
      const list: PlannedReminder[] = [...planRemindersForDay(settings, t.reminderState, t.nowMin)];
      const p = t.profile;
      const schedule = { type: p.schedule_type, weekdays: p.schedule_type === 'fixed_days' && p.training_weekdays.length ? p.training_weekdays : suggestedWeekdays(p.training_days_per_week), perWeek: p.training_days_per_week };
      for (let i = 1; i <= 2; i++) {
        const date = addDays(t.today, i);
        const projected: ReminderDayState = {
          ...t.reminderState,
          date,
          isTrainingDay: isPlannedTrainingDay(schedule, date),
          workoutDone: false,
          activeWorkoutStartedMin: null,
          mealsLogged: 0,
          caloriesRemaining: p.calorie_target,
          proteinRemaining: p.protein_target_g,
          stepsLogged: false,
          weighed: false,
          checkinDone: false,
          streakAtRisk: null,
          isWeeklyReportDay: weekdayIndex(date) === 6,
          projected: true,
        };
        list.push(...planRemindersForDay(settings, projected, null));
      }
      void scheduleReminders(list);
    }, 1200);
    return () => clearTimeout(timer);
  }, [reminderKey]);

  // badge unlocks
  const earnedKey = badges.earned.join(',');
  useEffect(() => {
    const have = new Set(achievements.map((a) => a.badge_id));
    for (const id of badges.earned) {
      if (!have.has(id) && BADGE_MAP[id]) insert('user_achievements', { badge_id: id, unlocked_at: new Date().toISOString(), seen: false });
    }
  }, [earnedKey]);

  // public snapshot for friends (server applies privacy settings)
  const snapshotKey = JSON.stringify([t.game.level.level, t.game.totalXp, badges.earned.length, (['training', 'nutrition', 'protein', 'steps', 'checkin'] as const).map((k) => t.streaks[k].current)]);
  const lastSnapshot = useRef('');
  useEffect(() => {
    if (!account || !supabase || lastSnapshot.current === snapshotKey) return;
    const timer = setTimeout(async () => {
      const { events } = computePersonalRecords(t.data.sessions, t.data.sets);
      const recent = events.slice(-5).reverse().map((e) => ({ exercise_id: e.exercise_id, type: e.type, value: e.value, weight_kg: e.weight_kg, reps: e.reps, date: e.date }));
      const streaks = Object.fromEntries((['training', 'nutrition', 'protein', 'steps', 'checkin'] as const).map((k) => [k, { current: t.streaks[k].current, best: t.streaks[k].best }]));
      const { error } = await supabase!.from('profile_snapshots').upsert({ user_id: account, level: t.game.level.level, total_xp: t.game.totalXp, streaks, recent_prs: recent, badges: badges.earned.length, updated_at: new Date().toISOString() });
      if (!error) lastSnapshot.current = snapshotKey;
    }, 8000);
    return () => clearTimeout(timer);
  }, [snapshotKey, account]);

  return null;
}
