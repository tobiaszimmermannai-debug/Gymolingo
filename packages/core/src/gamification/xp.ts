/**
 * Experience points, levels, badges and weekly challenges.
 *
 * XP is *derived* from stored data (never stored as a separate counter), which
 * makes it consistent across devices and impossible to drift. It rewards
 * consistent, healthy behaviour – not weight loss.
 */
import type { ISODate } from '../dates';
import { addDays, endOfWeek, isoWeekNumber, startOfWeek } from '../dates';
import type { StreakKind, StreakResult } from '../streaks/streaks';
import { STREAK_LABELS_DE } from '../streaks/streaks';

export interface DailyActivity {
  date: ISODate;
  workouts: number;
  workingSets: number;
  prs: number;
  mealEntries: number;
  nutritionLogged: boolean;
  proteinHit: boolean;
  caloriesOnTarget: boolean;
  steps: number;
  stepsHit: boolean;
  checkin: boolean;
  weighed: boolean;
}

export const XP_RULES = {
  workout: 50,
  perSet: 2,
  maxSetXp: 40,
  pr: 25,
  maxPrXpPerDay: 100,
  mealEntry: 5,
  maxMealXp: 20,
  nutritionDay: 15,
  proteinHit: 20,
  caloriesOnTarget: 10,
  stepsHit: 15,
  checkin: 10,
  weighed: 5,
  challenge: 100,
} as const;

export function xpForDay(a: DailyActivity): number {
  let xp = 0;
  xp += Math.min(a.workouts, 2) * XP_RULES.workout;
  xp += Math.min(a.workingSets * XP_RULES.perSet, XP_RULES.maxSetXp);
  xp += Math.min(a.prs * XP_RULES.pr, XP_RULES.maxPrXpPerDay);
  xp += Math.min(a.mealEntries * XP_RULES.mealEntry, XP_RULES.maxMealXp);
  if (a.nutritionLogged) xp += XP_RULES.nutritionDay;
  if (a.proteinHit) xp += XP_RULES.proteinHit;
  if (a.caloriesOnTarget) xp += XP_RULES.caloriesOnTarget;
  if (a.stepsHit) xp += XP_RULES.stepsHit;
  if (a.checkin) xp += XP_RULES.checkin;
  if (a.weighed) xp += XP_RULES.weighed;
  return xp;
}

/** Total XP required to reach `level` (level 1 = 0 XP). Grows ~ n^1.6. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(150 * Math.pow(level - 1, 1.6));
}

export interface LevelInfo {
  level: number;
  xp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progress: number; // 0..1
  title: string;
}

const LEVEL_TITLES: [number, string][] = [
  [1, 'Neuling'],
  [5, 'Einsteiger'],
  [10, 'Stammgast'],
  [15, 'Athlet'],
  [20, 'Fortgeschritten'],
  [30, 'Eisenherz'],
  [40, 'Profi'],
  [50, 'Legende'],
];

export function levelFromXp(xp: number): LevelInfo {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const cur = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const title = [...LEVEL_TITLES].reverse().find(([l]) => level >= l)?.[1] ?? 'Neuling';
  return { level, xp, currentLevelXp: cur, nextLevelXp: next, progress: (xp - cur) / (next - cur), title };
}

// ---------------------------------------------------------------- Badges

export interface BadgeDef {
  id: string;
  title: string;
  description: string;
  icon: string; // emoji
  category: 'training' | 'nutrition' | 'streak' | 'steps' | 'body' | 'community' | 'level';
}

export interface BadgeStats {
  totalWorkouts: number;
  totalPRs: number;
  totalVolumeKg: number;
  nutritionDays: number;
  proteinDays: number;
  stepGoalDays: number;
  maxStepsDay: number;
  checkins: number;
  weighIns: number;
  bestStreaks: Record<StreakKind, number>;
  level: number;
  challengesCompleted: number;
  friends: number;
  earlyWorkouts: number; // workouts started before 08:00
}

interface BadgeRule extends BadgeDef {
  check: (s: BadgeStats) => boolean;
}

const streakBadges: BadgeRule[] = (['training', 'nutrition', 'protein', 'steps', 'checkin', 'weight'] as StreakKind[]).flatMap((kind) =>
  [7, 30, 60, 100].map((m) => ({
    id: `streak-${kind}-${m}`,
    title: `${m} Tage ${STREAK_LABELS_DE[kind]}`,
    description: `Erreiche eine Serie von ${m} Tagen: ${STREAK_LABELS_DE[kind]}.`,
    icon: m >= 100 ? '💎' : m >= 60 ? '🏆' : m >= 30 ? '🔥' : '⚡',
    category: 'streak' as const,
    check: (s: BadgeStats) => (s.bestStreaks[kind] ?? 0) >= m,
  })),
);

export const BADGES: BadgeRule[] = [
  { id: 'first-workout', title: 'Erster Schritt', description: 'Dein erstes Training abgeschlossen.', icon: '🏋️', category: 'training', check: (s) => s.totalWorkouts >= 1 },
  { id: 'workouts-10', title: 'Dranbleiber', description: '10 Trainings abgeschlossen.', icon: '💪', category: 'training', check: (s) => s.totalWorkouts >= 10 },
  { id: 'workouts-50', title: 'Gewohnheitstier', description: '50 Trainings abgeschlossen.', icon: '🦾', category: 'training', check: (s) => s.totalWorkouts >= 50 },
  { id: 'workouts-100', title: 'Hundertschaft', description: '100 Trainings abgeschlossen.', icon: '🏅', category: 'training', check: (s) => s.totalWorkouts >= 100 },
  { id: 'first-pr', title: 'Rekordjäger', description: 'Deinen ersten persönlichen Rekord aufgestellt.', icon: '🎯', category: 'training', check: (s) => s.totalPRs >= 1 },
  { id: 'prs-25', title: 'Rekordmaschine', description: '25 persönliche Rekorde.', icon: '🚀', category: 'training', check: (s) => s.totalPRs >= 25 },
  { id: 'volume-100t', title: '100 Tonnen', description: 'Insgesamt 100.000 kg bewegt.', icon: '🏗️', category: 'training', check: (s) => s.totalVolumeKg >= 100_000 },
  { id: 'volume-1000t', title: 'Tausend Tonnen', description: 'Insgesamt 1.000.000 kg bewegt.', icon: '🌋', category: 'training', check: (s) => s.totalVolumeKg >= 1_000_000 },
  { id: 'early-bird', title: 'Frühaufsteher', description: '5 Trainings vor 8 Uhr gestartet.', icon: '🌅', category: 'training', check: (s) => s.earlyWorkouts >= 5 },
  { id: 'nutrition-7', title: 'Buchhalter', description: '7 Tage Ernährung vollständig getrackt.', icon: '📒', category: 'nutrition', check: (s) => s.nutritionDays >= 7 },
  { id: 'nutrition-50', title: 'Makro-Meister', description: '50 Tage Ernährung getrackt.', icon: '🥗', category: 'nutrition', check: (s) => s.nutritionDays >= 50 },
  { id: 'protein-10', title: 'Proteinprofi', description: 'An 10 Tagen das Proteinziel erreicht.', icon: '🥩', category: 'nutrition', check: (s) => s.proteinDays >= 10 },
  { id: 'protein-50', title: 'Protein-Legende', description: 'An 50 Tagen das Proteinziel erreicht.', icon: '🍗', category: 'nutrition', check: (s) => s.proteinDays >= 50 },
  { id: 'steps-10', title: 'Spaziergänger', description: 'An 10 Tagen das Schrittziel erreicht.', icon: '👟', category: 'steps', check: (s) => s.stepGoalDays >= 10 },
  { id: 'steps-20k', title: 'Marathon-Tag', description: 'Mehr als 20.000 Schritte an einem Tag.', icon: '🏃', category: 'steps', check: (s) => s.maxStepsDay >= 20_000 },
  { id: 'checkin-30', title: 'Reflektiert', description: '30 tägliche Check-ins.', icon: '🧘', category: 'body', check: (s) => s.checkins >= 30 },
  { id: 'weighin-30', title: 'Datenfreund', description: '30 Mal gewogen.', icon: '⚖️', category: 'body', check: (s) => s.weighIns >= 30 },
  { id: 'level-10', title: 'Level 10', description: 'Level 10 erreicht.', icon: '⭐', category: 'level', check: (s) => s.level >= 10 },
  { id: 'level-25', title: 'Level 25', description: 'Level 25 erreicht.', icon: '🌟', category: 'level', check: (s) => s.level >= 25 },
  { id: 'challenge-1', title: 'Herausforderer', description: 'Erste Wochen-Challenge geschafft.', icon: '🎖️', category: 'level', check: (s) => s.challengesCompleted >= 1 },
  { id: 'challenge-10', title: 'Challenge-Champion', description: '10 Wochen-Challenges geschafft.', icon: '👑', category: 'level', check: (s) => s.challengesCompleted >= 10 },
  { id: 'friend-1', title: 'Trainingspartner', description: 'Ersten Freund hinzugefügt.', icon: '🤝', category: 'community', check: (s) => s.friends >= 1 },
  ...streakBadges,
];

export const BADGE_MAP: Record<string, BadgeDef> = Object.fromEntries(BADGES.map(({ check: _c, ...b }) => [b.id, b]));

export function earnedBadgeIds(stats: BadgeStats): string[] {
  return BADGES.filter((b) => b.check(stats)).map((b) => b.id);
}

// ---------------------------------------------------------------- Weekly challenges

export type ChallengeMetric = 'workouts' | 'protein_days' | 'nutrition_days' | 'steps_total' | 'step_goal_days' | 'checkins' | 'sets';

export interface WeeklyChallenge {
  id: string; // `${weekStart}:${metric}`
  weekStart: ISODate;
  metric: ChallengeMetric;
  title: string;
  description: string;
  target: number;
  progress: number;
  completed: boolean;
  xp: number;
}

interface ChallengeTargets {
  plannedWorkouts: number;
  stepTarget: number;
}

const CHALLENGE_TEMPLATES: Record<ChallengeMetric, (t: ChallengeTargets) => { title: string; description: string; target: number }> = {
  workouts: (t) => ({ title: 'Plan erfüllt', description: `Absolviere ${Math.max(1, t.plannedWorkouts)} Trainings diese Woche.`, target: Math.max(1, t.plannedWorkouts) }),
  protein_days: () => ({ title: 'Protein-Woche', description: 'Erreiche an 5 Tagen dein Proteinziel.', target: 5 }),
  nutrition_days: () => ({ title: 'Tracking-Profi', description: 'Tracke an 6 Tagen deine Ernährung.', target: 6 }),
  steps_total: (t) => ({ title: 'Schritt für Schritt', description: `Sammle ${Math.round((t.stepTarget * 6) / 1000) * 1000} Schritte diese Woche.`, target: Math.round((t.stepTarget * 6) / 1000) * 1000 }),
  step_goal_days: () => ({ title: 'Aktiv-Woche', description: 'Erreiche an 5 Tagen dein Schrittziel.', target: 5 }),
  checkins: () => ({ title: 'Achtsam', description: 'Mache an 6 Tagen deinen Abend-Check-in.', target: 6 }),
  sets: (t) => ({ title: 'Volumen-Woche', description: `Absolviere ${Math.max(20, t.plannedWorkouts * 15)} Arbeitssätze.`, target: Math.max(20, t.plannedWorkouts * 15) }),
};

/** Deterministic pick of 3 challenges per week (always includes the training plan). */
export function weeklyChallenges(
  weekStartDate: ISODate,
  activities: DailyActivity[],
  targets: ChallengeTargets,
): WeeklyChallenge[] {
  const ws = startOfWeek(weekStartDate);
  const we = endOfWeek(ws);
  const { week, year } = isoWeekNumber(ws);
  const pool: ChallengeMetric[] = ['protein_days', 'nutrition_days', 'steps_total', 'step_goal_days', 'checkins', 'sets'];
  const seed = (year * 53 + week) % pool.length;
  const picks: ChallengeMetric[] = ['workouts', pool[seed], pool[(seed + 3) % pool.length]];
  const inWeek = activities.filter((a) => a.date >= ws && a.date <= we);
  const progressOf = (m: ChallengeMetric): number => {
    switch (m) {
      case 'workouts':
        return inWeek.reduce((s, a) => s + a.workouts, 0);
      case 'protein_days':
        return inWeek.filter((a) => a.proteinHit).length;
      case 'nutrition_days':
        return inWeek.filter((a) => a.nutritionLogged).length;
      case 'steps_total':
        return inWeek.reduce((s, a) => s + a.steps, 0);
      case 'step_goal_days':
        return inWeek.filter((a) => a.stepsHit).length;
      case 'checkins':
        return inWeek.filter((a) => a.checkin).length;
      case 'sets':
        return inWeek.reduce((s, a) => s + a.workingSets, 0);
    }
  };
  return picks.map((metric) => {
    const tpl = CHALLENGE_TEMPLATES[metric](targets);
    const progress = progressOf(metric);
    return {
      id: `${ws}:${metric}`,
      weekStart: ws,
      metric,
      ...tpl,
      progress,
      completed: progress >= tpl.target,
      xp: XP_RULES.challenge,
    };
  });
}

export interface GamificationSummary {
  totalXp: number;
  level: LevelInfo;
  xpToday: number;
  xpThisWeek: number;
  challengesCompleted: number;
  currentChallenges: WeeklyChallenge[];
}

/**
 * Totals XP over all days + completed weekly challenges (past and current).
 * `activities` must contain one entry per day with any data.
 */
export function summarizeGamification(
  activities: DailyActivity[],
  today: ISODate,
  targets: ChallengeTargets,
  firstDate?: ISODate,
): GamificationSummary {
  let totalXp = 0;
  let xpToday = 0;
  let xpThisWeek = 0;
  const ws = startOfWeek(today);
  for (const a of activities) {
    const xp = xpForDay(a);
    totalXp += xp;
    if (a.date === today) xpToday = xp;
    if (a.date >= ws && a.date <= today) xpThisWeek += xp;
  }
  let challengesCompleted = 0;
  const start = firstDate ?? (activities.length ? activities.reduce((m, a) => (a.date < m ? a.date : m), today) : today);
  let week = startOfWeek(start);
  let current: WeeklyChallenge[] = [];
  while (week <= ws) {
    const ch = weeklyChallenges(week, activities, targets);
    const done = ch.filter((c) => c.completed).length;
    challengesCompleted += done;
    totalXp += done * XP_RULES.challenge;
    if (week === ws) {
      current = ch;
      xpThisWeek += done * XP_RULES.challenge;
    }
    week = addDays(week, 7);
  }
  return { totalXp, level: levelFromXp(totalXp), xpToday, xpThisWeek, challengesCompleted, currentChallenges: current };
}

export function emptyActivity(date: ISODate): DailyActivity {
  return {
    date,
    workouts: 0,
    workingSets: 0,
    prs: 0,
    mealEntries: 0,
    nutritionLogged: false,
    proteinHit: false,
    caloriesOnTarget: false,
    steps: 0,
    stepsHit: false,
    checkin: false,
    weighed: false,
  };
}

export function bestStreaksFrom(results: Record<StreakKind, StreakResult>): Record<StreakKind, number> {
  return Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v.best])) as Record<StreakKind, number>;
}

