/**
 * Weekly report & coach insights.
 *
 * All numbers are computed here deterministically from stored data. The AI
 * model (server-side) only *interprets* these statistics – it never invents
 * numbers. Without AI the rule-based texts below are shown.
 */
import { CARDIO_LABELS_DE, cardioSummary, COUNTS_AS_TRAINING } from '../cardio/energy';
import type { ISODate } from '../dates';
import { addDays, dateRange, endOfWeek, startOfWeek } from '../dates';
import { formatNumberDE, formatSigned } from '../format';
import type { UserData } from '../data/aggregate';
import { buildDailyActivities, stepsByDate } from '../data/aggregate';
import { weightSummary } from '../body/trend';
import { dayNutrition, isDayLogged } from '../nutrition/calc';
import { adaptiveCalorieAdjustment } from '../nutrition/targets';
import { EXERCISE_MAP, MUSCLE_LABELS_DE } from '../training/exercises';
import { detectPlateau } from '../training/progression';
import { computePersonalRecords, exerciseHistory, isWorkingSet, mostTrainedExercises, setsPerMuscle, strengthChange } from '../training/stats';
import { weeklyQuota } from '../streaks/streaks';
import type { ExerciseDef, MuscleGroup } from '../types';

export type RecommendationArea = 'training' | 'nutrition' | 'weight' | 'steps' | 'recovery' | 'consistency';

export interface Recommendation {
  id: string;
  area: RecommendationArea;
  title: string;
  text: string;
  priority: number; // higher = more important
}

export interface WeeklyReportStats {
  weekStart: ISODate;
  weekEnd: ISODate;
  strength: {
    avgE1rmChangePct: number | null;
    improvements: { exercise: string; prev: number; cur: number; pct: number }[];
    prs: { exercise: string; type: string; value: number; weight_kg: number; reps: number }[];
    plateaus: string[];
  };
  consistency: {
    workoutsDone: number;
    workoutsPlanned: number;
    adherencePct: number | null;
    workingSets: number;
    volumeKg: number;
    volumePrevKg: number;
    setsPerMuscle: Record<string, number>;
    /** walk / jog / run / EMS this week (jog/run/EMS also count as trainings above) */
    cardio?: { sessions: number; minutes: number; km: number; kcal: number; byActivity: Record<string, number> };
  };
  nutrition: {
    daysLogged: number;
    avgKcal: number | null;
    avgProtein: number | null;
    avgCarbs: number | null;
    avgFat: number | null;
    calorieTarget: number;
    proteinTarget: number;
    proteinDaysHit: number;
    avgBalanceKcal: number | null;
    estimatedShare: number;
  };
  weight: {
    avg7: number | null;
    avgPrev7: number | null;
    change: number | null;
    weeklyRate30: number | null;
    plannedWeeklyRate: number;
    daysLogged: number;
    goalWeight: number | null;
  };
  steps: { avg: number | null; total: number; daysHit: number; daysLogged: number; target: number };
  recovery: { avgSleep: number | null; avgEnergy: number | null; checkins: number };
  achievements: string[];
  recommendations: Recommendation[];
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r0 = (n: number | null) => (n === null ? null : Math.round(n));
const r1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

export function exerciseName(id: string, custom?: (id: string) => ExerciseDef | undefined): string {
  return EXERCISE_MAP[id]?.name ?? custom?.(id)?.name ?? 'Übung';
}

export function buildWeeklyReport(
  data: UserData,
  weekStartDate: ISODate,
  opts: { lookup?: (id: string) => ExerciseDef | undefined; newBadges?: string[]; challengesCompleted?: string[] } = {},
): WeeklyReportStats {
  const p = data.profile;
  const ws = startOfWeek(weekStartDate);
  const we = endOfWeek(ws);
  const prevWs = addDays(ws, -7);
  const prevWe = addDays(ws, -1);
  const lookup = (id: string) => EXERCISE_MAP[id] ?? opts.lookup?.(id);
  const name = (id: string) => exerciseName(id, opts.lookup);

  // ---------- strength
  const sc = strengthChange(data.sessions, data.sets, { from: ws, to: we }, { from: addDays(ws, -28), to: prevWe });
  const { events } = computePersonalRecords(data.sessions, data.sets);
  const prsThisWeek = events.filter((e) => e.date >= ws && e.date <= we);
  const bestPr = new Map<string, (typeof prsThisWeek)[number]>();
  for (const e of prsThisWeek) {
    const k = `${e.exercise_id}:${e.type}`;
    if (!bestPr.has(k) || bestPr.get(k)!.value < e.value) bestPr.set(k, e);
  }
  const weekSessionIds = new Set(data.sessions.filter((x) => x.status === 'completed' && !x.deleted && x.date >= ws && x.date <= we).map((x) => x.id));
  const trainedThisWeek = new Set(data.sets.filter((s) => isWorkingSet(s) && weekSessionIds.has(s.session_id)).map((s) => s.exercise_id));
  const plateaus = [...trainedThisWeek].filter((id) => detectPlateau(exerciseHistory(id, data.sessions, data.sets).filter((h) => h.date <= we))).map(name);

  // ---------- consistency
  const done = data.sessions.filter((s) => !s.deleted && s.status === 'completed' && s.date >= ws && s.date <= we);
  const cardioWeek = (data.cardio ?? []).filter((c) => !c.deleted && c.date >= ws && c.date <= we);
  const cardioTrainings = cardioWeek.filter((c) => COUNTS_AS_TRAINING[c.activity]).length;
  const cs = cardioSummary(cardioWeek, ws, we);
  const schedule = {
    type: p.schedule_type,
    weekdays: p.training_weekdays,
    perWeek: p.training_days_per_week,
  } as const;
  const activeDays = dateRange(ws, we).filter((d) => !data.pauses.some((x) => !x.deleted && d >= x.start_date && d <= x.end_date));
  const planned = weeklyQuota(schedule, activeDays);
  const acts = buildDailyActivities(data, prevWs, we);
  const cur = acts.filter((a) => a.date >= ws);
  const volume = (from: ISODate, to: ISODate) => {
    const ids = new Set(data.sessions.filter((s) => !s.deleted && s.status === 'completed' && s.date >= from && s.date <= to).map((s) => s.id));
    return Math.round(data.sets.filter((s) => isWorkingSet(s) && ids.has(s.session_id)).reduce((a, s) => a + s.weight_kg * s.reps, 0));
  };
  const spm = setsPerMuscle(data.sets, data.sessions, lookup, ws, we);
  const spmLabeled: Record<string, number> = {};
  for (const [m, v] of Object.entries(spm)) spmLabeled[MUSCLE_LABELS_DE[m as MuscleGroup]] = Math.round((v ?? 0) * 10) / 10;

  // ---------- nutrition
  const days = dateRange(ws, we).map((d) => dayNutrition(d, data.meals));
  const logged = days.filter((d) => isDayLogged(d, p.calorie_target));
  const entriesWeek = data.meals.filter((m) => !m.deleted && m.date >= ws && m.date <= we);

  // ---------- weight
  const wsum = weightSummary(data.weights, we);

  // ---------- steps
  const stepMap = stepsByDate(data.steps);
  const stepVals = dateRange(ws, we)
    .map((d) => stepMap.get(d)?.steps)
    .filter((x): x is number => typeof x === 'number');

  // ---------- recovery
  const checks = data.checkins.filter((c) => !c.deleted && c.date >= ws && c.date <= we);

  const stats: WeeklyReportStats = {
    weekStart: ws,
    weekEnd: we,
    strength: {
      avgE1rmChangePct: sc.pct,
      improvements: sc.exercises.slice(0, 5).map((e) => ({ exercise: name(e.exercise_id), prev: e.prev, cur: e.cur, pct: e.pct })),
      prs: [...bestPr.values()].map((e) => ({ exercise: name(e.exercise_id), type: e.type, value: e.value, weight_kg: e.weight_kg, reps: e.reps })),
      plateaus,
    },
    consistency: {
      workoutsDone: done.length + cardioTrainings,
      workoutsPlanned: planned,
      adherencePct: planned > 0 ? Math.round((Math.min(done.length + cardioTrainings, planned) / planned) * 100) : null,
      workingSets: cur.reduce((a, x) => a + x.workingSets, 0),
      volumeKg: volume(ws, we),
      volumePrevKg: volume(prevWs, prevWe),
      setsPerMuscle: spmLabeled,
      cardio: cs.sessions
        ? { sessions: cs.sessions, minutes: cs.minutes, km: cs.km, kcal: cs.kcal, byActivity: Object.fromEntries(Object.entries(cs.byActivity).map(([k, v]) => [CARDIO_LABELS_DE[k as keyof typeof CARDIO_LABELS_DE], v])) }
        : undefined,
    },
    nutrition: {
      daysLogged: logged.length,
      avgKcal: r0(avg(logged.map((d) => d.totals.kcal))),
      avgProtein: r0(avg(logged.map((d) => d.totals.protein_g))),
      avgCarbs: r0(avg(logged.map((d) => d.totals.carbs_g))),
      avgFat: r0(avg(logged.map((d) => d.totals.fat_g))),
      calorieTarget: p.calorie_target,
      proteinTarget: p.protein_target_g,
      proteinDaysHit: logged.filter((d) => d.totals.protein_g >= p.protein_target_g * 0.95).length,
      avgBalanceKcal: r0(avg(logged.map((d) => d.totals.kcal - p.calorie_target))),
      estimatedShare: entriesWeek.length ? Math.round((entriesWeek.filter((e) => e.is_estimate).length / entriesWeek.length) * 100) / 100 : 0,
    },
    weight: {
      avg7: wsum.avg7,
      avgPrev7: wsum.avg7Prev,
      change: wsum.avg7 !== null && wsum.avg7Prev !== null ? Math.round((wsum.avg7 - wsum.avg7Prev) * 100) / 100 : null,
      weeklyRate30: wsum.weeklyRate30,
      plannedWeeklyRate: p.weekly_rate_kg,
      daysLogged: data.weights.filter((w) => !w.deleted && w.date >= ws && w.date <= we).length,
      goalWeight: p.goal_weight_kg,
    },
    steps: {
      avg: r0(avg(stepVals)),
      total: stepVals.reduce((a, b) => a + b, 0),
      daysHit: stepVals.filter((s) => s >= p.step_target).length,
      daysLogged: stepVals.length,
      target: p.step_target,
    },
    recovery: {
      avgSleep: r1(avg(checks.map((c) => c.sleep_hours).filter((x): x is number => typeof x === 'number'))),
      avgEnergy: r1(avg(checks.map((c) => c.energy).filter((x): x is number => typeof x === 'number'))),
      checkins: checks.length,
    },
    achievements: [],
    recommendations: [],
  };

  // ---------- achievements (facts only)
  const ach: string[] = [];
  if (stats.strength.prs.length) ach.push(`${stats.strength.prs.length} neue persönliche Rekorde`);
  if (planned > 0 && done.length >= planned) ach.push(`Trainingsplan zu 100 % erfüllt (${done.length}/${planned})`);
  if (stats.nutrition.proteinDaysHit >= 5) ach.push(`Proteinziel an ${stats.nutrition.proteinDaysHit} Tagen erreicht`);
  if (stats.steps.daysHit >= 5) ach.push(`Schrittziel an ${stats.steps.daysHit} Tagen erreicht`);
  if (stats.nutrition.daysLogged >= 6) ach.push(`Ernährung an ${stats.nutrition.daysLogged} Tagen getrackt`);
  for (const b of opts.newBadges ?? []) ach.push(`Abzeichen: ${b}`);
  for (const c of opts.challengesCompleted ?? []) ach.push(`Challenge geschafft: ${c}`);
  stats.achievements = ach;
  stats.recommendations = buildRecommendations(stats, data);
  return stats;
}

export function buildRecommendations(s: WeeklyReportStats, data: UserData): Recommendation[] {
  const p = data.profile;
  const recs: Recommendation[] = [];

  // Logging quality first: without data all other nutrition advice is unreliable
  if (s.nutrition.daysLogged < 4) {
    recs.push({
      id: 'log-more',
      area: 'nutrition',
      title: 'Ernährung an mehr Tagen tracken',
      text: `Diese Woche waren ${s.nutrition.daysLogged} von 7 Tagen vollständig getrackt. Ziel: mindestens 5 Tage – dann werden Kalorien- und Proteinempfehlungen deutlich genauer. Tipp: Nutze „Mahlzeit wiederholen" für Standard-Frühstücke.`,
      priority: 70 - s.nutrition.daysLogged * 5,
    });
  }

  if (s.nutrition.avgProtein !== null && s.nutrition.daysLogged >= 3 && s.nutrition.avgProtein < p.protein_target_g * 0.9) {
    const gap = p.protein_target_g - s.nutrition.avgProtein;
    recs.push({
      id: 'protein',
      area: 'nutrition',
      title: `Protein um ca. ${Math.round(gap)} g pro Tag erhöhen`,
      text: `Ø ${s.nutrition.avgProtein} g statt ${p.protein_target_g} g Protein. Verteile 30–40 g auf 3–4 Mahlzeiten, z. B. Skyr/Magerquark zum Frühstück, eine Portion Hähnchen, Tofu oder Fisch mittags und abends.`,
      priority: 60 + Math.min(30, gap / 2),
    });
  }

  if (s.consistency.adherencePct !== null && s.consistency.adherencePct < 100) {
    recs.push({
      id: 'adherence',
      area: 'consistency',
      title: 'Trainingstermine fest einplanen',
      text: `${s.consistency.workoutsDone} von ${s.consistency.workoutsPlanned} geplanten Einheiten absolviert. Lege für nächste Woche konkrete Tage und Uhrzeiten fest – die Erinnerung vor dem Training hilft dabei. Lieber eine kürzere Einheit als keine.`,
      priority: 55 + (100 - s.consistency.adherencePct) / 4,
    });
  }

  // Weight trend vs plan
  const completeness = s.nutrition.daysLogged / 7;
  const adj = adaptiveCalorieAdjustment({
    plannedWeeklyRateKg: p.weekly_rate_kg,
    observedWeeklyRateKg: s.weight.weeklyRate30,
    daysOfData: data.weights.filter((w) => !w.deleted).length >= 10 ? 21 : 0,
    avgLoggedCalories: s.nutrition.avgKcal,
    loggingCompleteness: completeness,
    currentTarget: p.calorie_target,
  });
  if (adj) {
    recs.push({
      id: 'calories-adjust',
      area: 'weight',
      title: `Kalorienziel ${adj.adjustKcal > 0 ? 'erhöhen' : 'senken'}: ${formatSigned(adj.adjustKcal, 0, 'kcal')}`,
      text: adj.reason,
      priority: 58,
    });
  } else if (s.weight.daysLogged < 3 && p.weight_tracking_enabled) {
    recs.push({
      id: 'weigh-more',
      area: 'weight',
      title: '3–4× pro Woche wiegen',
      text: `Diese Woche ${s.weight.daysLogged} Messungen. Tägliche Schwankungen von 0,5–1,5 kg sind normal (Wasser, Salz, Kohlenhydrate) – erst mehrere Messungen ergeben einen verlässlichen 7-Tage-Schnitt.`,
      priority: 35,
    });
  }

  for (const ex of s.strength.plateaus.slice(0, 1)) {
    recs.push({
      id: `plateau-${ex}`,
      area: 'training',
      title: `Plateau bei ${ex} lösen`,
      text: `Dein geschätztes 1RM bei ${ex} stagniert seit mindestens 3 Einheiten. Optionen: eine leichtere Woche (−10 %), den Wiederholungsbereich wechseln (z. B. 8–12 statt 5–8) oder eine Variante einbauen. Prüfe außerdem Schlaf und Kalorien.`,
      priority: 50,
    });
  }

  // Muscle volume (hypertrophy goals only)
  if (p.goal === 'muscle_gain' || p.goal === 'recomposition') {
    const spm = s.consistency.setsPerMuscle;
    const major: [string, number][] = [
      ['Brust', spm['Brust'] ?? 0],
      ['Rücken', (spm['Oberer Rücken'] ?? 0) + (spm['Latissimus'] ?? 0)],
      ['Quadrizeps', spm['Quadrizeps'] ?? 0],
      ['Beinbeuger', spm['Beinbeuger'] ?? 0],
      ['Schultern', spm['Schultern'] ?? 0],
    ];
    const low = major.filter(([, v]) => v < 6).sort((a, b) => a[1] - b[1]);
    if (s.consistency.workoutsDone >= 2 && low.length) {
      const [m, v] = low[0];
      recs.push({
        id: `volume-${m}`,
        area: 'training',
        title: `Mehr Volumen für ${m}`,
        text: `${m}: nur ${formatNumberDE(v)} harte Sätze diese Woche. Für Muskelaufbau sind ca. 10–20 Sätze pro Muskelgruppe und Woche ein bewährter Richtwert. Ergänze 2–4 Sätze in deinem Plan.`,
        priority: 40 + (6 - v) * 2,
      });
    }
  }

  if (s.steps.daysLogged >= 3 && s.steps.avg !== null && s.steps.avg < s.steps.target * 0.85) {
    recs.push({
      id: 'steps',
      area: 'steps',
      title: `Schritte: +${formatNumberDE(Math.round((s.steps.target - s.steps.avg) / 500) * 500, 0)} pro Tag`,
      text: `Ø ${formatNumberDE(s.steps.avg, 0)} Schritte bei einem Ziel von ${formatNumberDE(s.steps.target, 0)}. Ein 15-minütiger Spaziergang nach dem Essen bringt ca. 1.500–2.000 Schritte und hilft der Verdauung.`,
      priority: 38,
    });
  }

  if (s.recovery.avgSleep !== null && s.recovery.avgSleep < 7) {
    recs.push({
      id: 'sleep',
      area: 'recovery',
      title: 'Schlaf priorisieren',
      text: `Ø ${formatNumberDE(s.recovery.avgSleep)} h Schlaf laut Check-in. 7–9 h verbessern Regeneration, Kraftleistung und Hungerregulation. Ein fester Zeitpunkt fürs Zubettgehen hilft am meisten.`,
      priority: 45,
    });
  }

  // Positive progression hint for the main lift
  const main = mostTrainedExercises(data.sets, 1)[0];
  if (main) {
    recs.push({
      id: 'keep-going',
      area: 'training',
      title: `Weiter progressiv steigern: ${exerciseName(main)}`,
      text: `Halte dich an die Zielvorgaben im Training: erst Wiederholungen bis zum oberen Ende des Bereichs, dann Gewicht erhöhen. Konstanz ist dein größter Hebel.`,
      priority: 10,
    });
  }
  if (!recs.length) {
    recs.push({
      id: 'start',
      area: 'consistency',
      title: 'Starte mit deinem ersten Training',
      text: 'Sobald du trainierst und Mahlzeiten trackst, erhältst du hier individuelle Empfehlungen auf Basis deiner Daten.',
      priority: 1,
    });
  }

  // pick top 3, max 2 per area
  const sorted = recs.sort((a, b) => b.priority - a.priority);
  const out: Recommendation[] = [];
  const perArea = new Map<string, number>();
  for (const r of sorted) {
    const n = perArea.get(r.area) ?? 0;
    if (n >= 2) continue;
    out.push(r);
    perArea.set(r.area, n + 1);
    if (out.length === 3) break;
  }
  return out;
}

/** Plain-text rendering of the report (used without AI and as AI input). */
export function renderWeeklyReportText(s: WeeklyReportStats): { title: string; sections: { heading: string; body: string }[] } {
  const sections: { heading: string; body: string }[] = [];
  const st = s.strength;
  sections.push({
    heading: '1. Kraftentwicklung',
    body:
      (st.avgE1rmChangePct !== null
        ? `Geschätztes 1RM im Schnitt ${formatSigned(st.avgE1rmChangePct, 1, '%')} gegenüber den 4 Wochen davor.`
        : 'Noch nicht genug Vergleichsdaten für einen Krafttrend.') +
      (st.prs.length
        ? ` Neue Rekorde: ${[...new Map(st.prs.map((p) => [p.exercise, p])).values()]
            .slice(0, 4)
            .map((p) => `${p.exercise} (${formatNumberDE(p.weight_kg)} kg × ${p.reps})`)
            .join(', ')}.`
        : '') +
      (st.plateaus.length ? ` Stagnation bei: ${st.plateaus.slice(0, 3).join(', ')}${st.plateaus.length > 3 ? ` und ${st.plateaus.length - 3} weiteren Übungen` : ''}.` : ''),
  });
  const c = s.consistency;
  sections.push({
    heading: '2. Trainingskonsistenz',
    body:
      `${c.workoutsDone} von ${c.workoutsPlanned} geplanten Trainings${c.adherencePct !== null ? ` (${c.adherencePct} %)` : ''}. ${c.workingSets} Arbeitssätze, Volumen ${formatNumberDE(c.volumeKg, 0)} kg (Vorwoche ${formatNumberDE(c.volumePrevKg, 0)} kg).` +
      (c.cardio
        ? ` Ausdauer & EMS: ${Object.entries(c.cardio.byActivity)
            .map(([k, v]) => `${k} ${v}×`)
            .join(', ')}, ${c.cardio.minutes} min${c.cardio.km ? `, ${formatNumberDE(c.cardio.km)} km` : ''}, ca. ${formatNumberDE(c.cardio.kcal, 0)} kcal.`
        : ''),
  });
  const n = s.nutrition;
  sections.push({
    heading: '3. Ernährung & Kalorienbilanz',
    body:
      n.daysLogged === 0
        ? 'Diese Woche wurden keine vollständigen Ernährungstage erfasst.'
        : `${n.daysLogged} Tage getrackt. Ø ${formatNumberDE(n.avgKcal ?? 0, 0)} kcal (Ziel ${formatNumberDE(n.calorieTarget, 0)}, Bilanz ${formatSigned(n.avgBalanceKcal ?? 0, 0, 'kcal')}/Tag), Ø ${n.avgProtein} g Protein (Ziel ${n.proteinTarget} g, an ${n.proteinDaysHit} Tagen erreicht).${n.estimatedShare > 0.2 ? ` ${Math.round(n.estimatedShare * 100)} % der Einträge sind Schätzungen.` : ''}`,
  });
  const w = s.weight;
  sections.push({
    heading: '4. Gewichtstrend',
    body:
      w.avg7 === null
        ? 'Keine Gewichtsdaten in dieser Woche.'
        : `7-Tage-Schnitt ${formatNumberDE(w.avg7, 1)} kg${w.change !== null ? ` (${formatSigned(w.change, 1, 'kg')} zur Vorwoche)` : ''}.${w.weeklyRate30 !== null ? ` 30-Tage-Trend: ${formatSigned(w.weeklyRate30, 2, 'kg')}/Woche (geplant ${formatSigned(w.plannedWeeklyRate, 2, 'kg')}).` : ''}`,
  });
  const stp = s.steps;
  sections.push({
    heading: '5. Schritte',
    body:
      stp.daysLogged === 0
        ? 'Keine Schrittzahlen eingetragen.'
        : `Ø ${formatNumberDE(stp.avg ?? 0, 0)} Schritte/Tag (Ziel ${formatNumberDE(stp.target, 0)}), Ziel an ${stp.daysHit} von ${stp.daysLogged} Tagen erreicht. Gesamt: ${formatNumberDE(stp.total, 0)}.`,
  });
  sections.push({
    heading: '6. Erfolge',
    body: s.achievements.length ? s.achievements.map((a) => `• ${a}`).join('\n') : 'Jede erfasste Einheit zählt – nächste Woche holst du dir die ersten Erfolge.',
  });
  sections.push({
    heading: '7. Empfehlungen für nächste Woche',
    body: s.recommendations.map((r, i) => `${i + 1}. ${r.title}: ${r.text}`).join('\n'),
  });
  return { title: `Wochenbericht ${s.weekStart.slice(8, 10)}.${s.weekStart.slice(5, 7)}. – ${s.weekEnd.slice(8, 10)}.${s.weekEnd.slice(5, 7)}.`, sections };
}
