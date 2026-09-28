/**
 * Reminder engine (Duolingo-style, multi-tier but respectful).
 *
 * Produces a list of reminders for a given day and state. The app schedules
 * them as local notifications (and shows the same items in the in-app task
 * list). Rules:
 *  - Categories can be switched off individually.
 *  - Nothing is scheduled inside quiet hours; evening follow-ups are pulled
 *    before the quiet period or dropped.
 *  - A hard daily maximum is enforced (priority-based).
 *  - Copy is encouraging – no guilt, no shaming.
 *  - Once a goal is done (state), its reminders disappear.
 */
import type { ISODate } from '../dates';
import { minutesToTime, timeToMinutes } from '../dates';
import { formatNumberDE } from '../format';
import type { ReminderSettings } from '../types';

export type ReminderCategory =
  | 'morning'
  | 'weight'
  | 'nutrition'
  | 'pre_workout'
  | 'post_workout'
  | 'protein'
  | 'evening'
  | 'weekly_report';

export interface ReminderDayState {
  date: ISODate;
  displayName: string;
  isTrainingDay: boolean;
  plannedWorkoutName: string | null;
  workoutHint: string | null;
  workoutDone: boolean;
  /** Minutes since midnight when an unfinished workout was started. */
  activeWorkoutStartedMin: number | null;
  mealsLogged: number;
  calorieTarget: number;
  caloriesRemaining: number;
  proteinTarget: number;
  proteinRemaining: number;
  stepsLogged: boolean;
  stepTarget: number;
  weighed: boolean;
  weightTrackingEnabled: boolean;
  checkinDone: boolean;
  /** Longest streak that is at risk today (for gentle motivation). */
  streakAtRisk: { label: string; days: number } | null;
  openChallenges: string[];
  paused: boolean;
  preferredWorkoutTime: string;
  isWeeklyReportDay: boolean;
  /** true when this state is a projection for a future day (unknown progress) */
  projected?: boolean;
}

export interface PlannedReminder {
  id: string;
  date: ISODate;
  time: string;
  category: ReminderCategory;
  tier: number;
  title: string;
  body: string;
  route: string;
  priority: number;
}

export const DEFAULT_REMINDER_SETTINGS: Omit<ReminderSettings, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted'> = {
  enabled: true,
  morning_enabled: true,
  morning_time: '07:30',
  pre_workout_enabled: true,
  pre_workout_minutes: 60,
  post_workout_enabled: true,
  evening_enabled: true,
  evening_time: '20:30',
  weight_enabled: true,
  weight_time: '07:00',
  nutrition_enabled: true,
  streak_enabled: true,
  weekly_report_enabled: true,
  quiet_start: '22:00',
  quiet_end: '07:00',
  max_per_day: 5,
  intensity: 'normal',
};

type Settings = Pick<ReminderSettings, keyof typeof DEFAULT_REMINDER_SETTINGS>;

export function isQuiet(min: number, quietStart: string, quietEnd: string): boolean {
  const s = timeToMinutes(quietStart);
  const e = timeToMinutes(quietEnd);
  if (s === e) return false;
  return s < e ? min >= s && min < e : min >= s || min < e;
}

/** Deterministic variant picker so texts vary by day but are stable within a day. */
function pick<T>(arr: T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return arr[h % arr.length];
}

const MOTIVATION = [
  'Kleine Schritte, jeden Tag – genau so entsteht Fortschritt.',
  'Konstanz schlägt Perfektion. Du bist dran!',
  'Dein zukünftiges Ich wird dir danken.',
  'Heute zählt. Nicht perfekt, sondern gemacht.',
  'Jede Wiederholung ist eine Investition in dich.',
  'Stark wird man durch Gewohnheiten, nicht durch Zufall.',
];

export function planRemindersForDay(settings: Settings, st: ReminderDayState, nowMin: number | null): PlannedReminder[] {
  if (!settings.enabled) return [];
  const out: PlannedReminder[] = [];
  const add = (r: Omit<PlannedReminder, 'id' | 'date' | 'time'> & { minutes: number }) => {
    const { minutes, ...rest } = r;
    out.push({ ...rest, time: minutesToTime(minutes), id: `${st.date}:${r.category}:${r.tier}`, date: st.date });
  };
  const name = st.displayName ? `, ${st.displayName}` : '';
  const kcal = formatNumberDE(st.calorieTarget, 0);
  const protein = formatNumberDE(st.proteinTarget, 0);

  // ---- Morning briefing
  if (settings.morning_enabled && !st.paused) {
    const training = st.isTrainingDay && !st.workoutDone
      ? `Heute: ${st.plannedWorkoutName ?? 'Training'}.`
      : 'Heute ist Ruhetag – Regeneration gehört zum Plan.';
    const challenges = st.openChallenges.length ? ` Wochenziel: ${st.openChallenges[0]}.` : '';
    add({
      category: 'morning',
      tier: 1,
      minutes: timeToMinutes(settings.morning_time),
      title: `Guten Morgen${name}! ☀️`,
      body: `${training} Ziel: ${kcal} kcal · ${protein} g Protein.${challenges} ${pick(MOTIVATION, st.date)}`.trim(),
      route: '/',
      priority: 6,
    });
  }

  // ---- Weigh-in
  if (settings.weight_enabled && st.weightTrackingEnabled && !st.weighed && !st.paused) {
    add({
      category: 'weight',
      tier: 1,
      minutes: timeToMinutes(settings.weight_time),
      title: 'Kurz auf die Waage? ⚖️',
      body: 'Morgens nach dem Aufstehen ist dein Gewicht am besten vergleichbar. Einzelwerte schwanken – der Trend zählt.',
      route: '/body/weight',
      priority: 3,
    });
  }

  // ---- Nutrition: nothing logged by early afternoon
  if (settings.nutrition_enabled && st.mealsLogged === 0 && !st.paused) {
    add({
      category: 'nutrition',
      tier: 1,
      minutes: 14 * 60,
      title: 'Schon etwas gegessen? 🍽️',
      body: 'Trag deine ersten Mahlzeiten ein – dann weißt du jederzeit, wie viel Protein und Kalorien noch offen sind.',
      route: '/nutrition',
      priority: 4,
    });
  }

  // ---- Pre-workout
  if (settings.pre_workout_enabled && st.isTrainingDay && !st.workoutDone && st.activeWorkoutStartedMin === null && !st.paused) {
    const t = timeToMinutes(st.preferredWorkoutTime) - Math.max(0, settings.pre_workout_minutes);
    add({
      category: 'pre_workout',
      tier: 1,
      minutes: Math.max(0, t),
      title: `Gleich geht's los: ${st.plannedWorkoutName ?? 'Training'} 💪`,
      body: st.workoutHint ?? 'Deine Zielgewichte sind vorbereitet. Viel Erfolg!',
      route: '/training',
      priority: 7,
    });
  }

  // ---- Post-workout: unfinished workout
  if (settings.post_workout_enabled && st.activeWorkoutStartedMin !== null) {
    add({
      category: 'post_workout',
      tier: 1,
      minutes: st.activeWorkoutStartedMin + 120,
      title: 'Training noch offen 🏁',
      body: 'Schließe dein Training ab, damit Leistung und neue Rekorde gespeichert werden.',
      route: '/workout/active',
      priority: 8,
    });
  }

  // ---- Protein gap in the early evening (only if something was logged)
  if (settings.nutrition_enabled && st.mealsLogged > 0 && st.proteinRemaining >= 25 && !st.paused) {
    add({
      category: 'protein',
      tier: 1,
      minutes: Math.max(timeToMinutes(settings.evening_time) - 120, 17 * 60),
      title: `Noch ${formatNumberDE(st.proteinRemaining, 0)} g Protein offen 🥛`,
      body: proteinIdea(st.proteinRemaining),
      route: '/nutrition',
      priority: 5,
    });
  }

  // ---- Evening check-in with escalation
  const eveningOpen = !st.checkinDone || !st.stepsLogged;
  if (settings.evening_enabled && eveningOpen && !st.paused) {
    const base = timeToMinutes(settings.evening_time);
    const tiers = settings.intensity === 'gentle' ? 1 : settings.intensity === 'normal' ? 2 : 3;
    const offsets = [0, 60, 105];
    const quietStart = timeToMinutes(settings.quiet_start);
    const streakTxt =
      settings.streak_enabled && st.streakAtRisk && st.streakAtRisk.days >= 2
        ? ` Deine ${st.streakAtRisk.days}-Tage-Serie (${st.streakAtRisk.label}) läuft weiter, wenn du heute abschließt.`
        : '';
    const bodies = [
      `Wie viele Schritte hattest du heute? Dein Tagesabschluss dauert nur 30 Sekunden.${streakTxt}`,
      `Kurzer Check-in? Schritte eintragen, Tag abschließen – fertig.${streakTxt}`,
      `Letzte Erinnerung für heute: 30 Sekunden für deinen Tagesabschluss, danach ist Ruhe. 😴`,
    ];
    const titles = ['Tagesabschluss 🌙', 'Noch 1 Minute für dich? ✨', 'Letzte Erinnerung heute 🌙'];
    let lastMin = -Infinity;
    for (let i = 0; i < tiers; i++) {
      // follow-ups never run into quiet hours: clamp to 10 min before quiet start
      const latest = quietStart > base ? quietStart - 10 : 1439;
      const m = Math.min(base + offsets[i], latest);
      if (m - lastMin < 20) continue;
      lastMin = m;
      add({
        category: 'evening',
        tier: i + 1,
        minutes: m,
        title: titles[i],
        body: bodies[i],
        route: '/checkin',
        priority: i === 0 ? 9 : 5 - i,
      });
    }
  }

  // ---- Weekly report
  if (settings.weekly_report_enabled && st.isWeeklyReportDay) {
    add({
      category: 'weekly_report',
      tier: 1,
      minutes: Math.max(0, timeToMinutes(settings.evening_time) - 150),
      title: 'Dein Wochenbericht ist da 📊',
      body: 'Kraft, Ernährung, Gewichtstrend und 3 konkrete Empfehlungen für nächste Woche.',
      route: '/coach/report',
      priority: 4,
    });
  }

  // quiet hours filter
  let result = out.filter((r) => !isQuiet(timeToMinutes(r.time), settings.quiet_start, settings.quiet_end));
  // only the future
  if (nowMin !== null) result = result.filter((r) => timeToMinutes(r.time) > nowMin);
  // enforce max per day by priority
  const max = Math.max(0, settings.max_per_day);
  result = result.sort((a, b) => b.priority - a.priority).slice(0, max);
  return result.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
}

export function proteinIdea(grams: number): string {
  if (grams >= 60) return 'Idee: Hähnchenbrust (200 g ≈ 46 g) plus ein Skyr (250 g ≈ 28 g) schließen die Lücke.';
  if (grams >= 40) return 'Idee: 250 g Magerquark (≈ 30 g) mit Beeren oder eine Dose Thunfisch (≈ 25 g).';
  return 'Idee: Ein Skyr (≈ 28 g) oder ein Proteinshake (≈ 25 g) – schnell erledigt.';
}

/** In-app open tasks derived from the same state (shown on Home). */
export interface OpenTask {
  id: string;
  title: string;
  subtitle: string;
  route: string;
  done: boolean;
  icon: string;
}

export function openTasks(st: ReminderDayState): OpenTask[] {
  const tasks: OpenTask[] = [];
  if (st.isTrainingDay || st.workoutDone) {
    tasks.push({
      id: 'workout',
      title: st.workoutDone ? 'Training erledigt' : `Training: ${st.plannedWorkoutName ?? 'geplant'}`,
      subtitle: st.workoutDone ? 'Stark! 💪' : st.workoutHint ?? 'Starte dein geplantes Training',
      route: '/training',
      done: st.workoutDone,
      icon: '🏋️',
    });
  }
  tasks.push({
    id: 'nutrition',
    title: st.mealsLogged ? `${st.mealsLogged} Einträge heute` : 'Mahlzeiten eintragen',
    subtitle:
      st.proteinRemaining > 0
        ? `Noch ${formatNumberDE(Math.max(0, st.caloriesRemaining), 0)} kcal · ${formatNumberDE(st.proteinRemaining, 0)} g Protein`
        : 'Proteinziel erreicht ✅',
    route: '/nutrition',
    done: st.mealsLogged >= 3 && st.proteinRemaining <= 0,
    icon: '🍽️',
  });
  if (st.weightTrackingEnabled) {
    tasks.push({ id: 'weight', title: st.weighed ? 'Gewicht eingetragen' : 'Gewicht eintragen', subtitle: 'Der 7-Tage-Schnitt zählt', route: '/body/weight', done: st.weighed, icon: '⚖️' });
  }
  tasks.push({
    id: 'checkin',
    title: st.checkinDone ? 'Tag abgeschlossen' : 'Abend-Check-in',
    subtitle: st.stepsLogged ? 'Schritte eingetragen' : `Schritte eintragen (Ziel ${formatNumberDE(st.stepTarget, 0)})`,
    route: '/checkin',
    done: st.checkinDone && st.stepsLogged,
    icon: '🌙',
  });
  return tasks;
}
