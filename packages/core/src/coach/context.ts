/**
 * Coach context: a compact, factual snapshot of the user's stored data that is
 * sent to the AI model (server-side). The model must only use these facts.
 * The same snapshot powers the rule-based offline coach.
 */
import type { ISODate } from '../dates';
import { addDays } from '../dates';
import type { UserData } from '../data/aggregate';
import { buildDailyActivities } from '../data/aggregate';
import { weightSummary } from '../body/trend';
import { dayNutrition, remainingForDay } from '../nutrition/calc';
import { EXERCISE_MAP } from '../training/exercises';
import { suggestProgression } from '../training/progression';
import { computePersonalRecords, exerciseHistory, mostTrainedExercises } from '../training/stats';
import type { ExerciseDef } from '../types';
import { formatNumberDE } from '../format';

export interface CoachContext {
  today: ISODate;
  profile: {
    goal: string;
    experience: string;
    sex: string | null;
    age: number | null;
    height_cm: number | null;
    training_days_per_week: number;
    targets: { kcal: number; protein_g: number; carbs_g: number; fat_g: number; steps: number };
    planned_weekly_rate_kg: number;
    goal_weight_kg: number | null;
    diet_type: string;
    allergies: string[];
  };
  today_status: {
    kcal_eaten: number;
    protein_eaten: number;
    kcal_remaining: number;
    protein_remaining: number;
    workout_done: boolean;
    steps: number | null;
  };
  last_28_days: {
    workouts: number;
    avg_workouts_per_week: number;
    days_nutrition_logged: number;
    avg_kcal_logged_days: number | null;
    avg_protein_logged_days: number | null;
    avg_steps: number | null;
    checkins: number;
  };
  weight: {
    latest: number | null;
    latest_date: ISODate | null;
    avg_7d: number | null;
    avg_prev_7d: number | null;
    weekly_rate_30d: number | null;
    entries_30d: number;
  };
  key_lifts: {
    exercise: string;
    last_date: ISODate | null;
    last_sets: string;
    best_e1rm: number | null;
    next_suggestion: string;
    plateau: boolean;
  }[];
  data_gaps: string[];
}

export function buildCoachContext(
  data: UserData,
  today: ISODate,
  lookup?: (id: string) => ExerciseDef | undefined,
  birthYear?: number | null,
): CoachContext {
  const p = data.profile;
  const from = addDays(today, -27);
  const acts = buildDailyActivities(data, from, today);
  const todayNut = dayNutrition(today, data.meals);
  const rem = remainingForDay(todayNut.totals, p);
  const logged = acts.filter((a) => a.nutritionLogged);
  const nutDays = logged.map((a) => dayNutrition(a.date, data.meals));
  const avgOf = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  const stepsDays = acts.filter((a) => a.steps > 0);
  const ws = weightSummary(data.weights, today);
  const { records } = computePersonalRecords(data.sessions, data.sets);

  const keyIds = mostTrainedExercises(data.sets, 5);
  const key_lifts = keyIds.map((id) => {
    const def = EXERCISE_MAP[id] ?? lookup?.(id);
    const hist = exerciseHistory(id, data.sessions, data.sets, { limit: 8 });
    const sugg = suggestProgression(hist, {
      rep_min: def?.default_rep_min ?? 6,
      rep_max: def?.default_rep_max ?? 10,
      target_sets: Math.max(1, hist[0]?.sets.length ?? 3),
      target_rir: 2,
      increment_kg: def?.increment_kg ?? 2.5,
      is_bodyweight: def?.is_bodyweight ?? false,
    });
    const last = hist[0];
    return {
      exercise: def?.name ?? id,
      last_date: last?.date ?? null,
      last_sets: last ? last.sets.map((s) => `${formatNumberDE(s.weight_kg)}×${s.reps}${s.rir !== null ? `@RIR${s.rir}` : ''}`).join(', ') : '',
      best_e1rm: records[id]?.bestE1RM?.value ?? null,
      next_suggestion: `${formatNumberDE(sugg.weight_kg)} kg × ${sugg.reps.join('/')}`,
      plateau: sugg.plateau,
    };
  });

  const gaps: string[] = [];
  if (logged.length < 7) gaps.push(`Ernährung nur an ${logged.length} der letzten 28 Tage vollständig getrackt`);
  if (ws.daysLogged30 < 4) gaps.push('Zu wenige Gewichtsmessungen für einen verlässlichen Trend');
  if (!data.sessions.some((s) => s.status === 'completed' && !s.deleted)) gaps.push('Noch keine abgeschlossenen Trainings');
  if (stepsDays.length < 7) gaps.push('Schrittzahl selten eingetragen');

  const workouts = acts.reduce((a, x) => a + x.workouts, 0);
  return {
    today,
    profile: {
      goal: p.goal,
      experience: p.experience_level,
      sex: p.sex,
      age: birthYear ? Number(today.slice(0, 4)) - birthYear : p.birth_year ? Number(today.slice(0, 4)) - p.birth_year : null,
      height_cm: p.height_cm,
      training_days_per_week: p.training_days_per_week,
      targets: { kcal: p.calorie_target, protein_g: p.protein_target_g, carbs_g: p.carbs_target_g, fat_g: p.fat_target_g, steps: p.step_target },
      planned_weekly_rate_kg: p.weekly_rate_kg,
      goal_weight_kg: p.goal_weight_kg,
      diet_type: p.diet_type,
      allergies: [...p.allergies, ...p.intolerances],
    },
    today_status: {
      kcal_eaten: todayNut.totals.kcal,
      protein_eaten: todayNut.totals.protein_g,
      kcal_remaining: rem.kcal,
      protein_remaining: rem.protein_g,
      workout_done: acts.some((a) => a.date === today && a.workouts > 0),
      steps: acts.find((a) => a.date === today)?.steps || null,
    },
    last_28_days: {
      workouts,
      avg_workouts_per_week: Math.round((workouts / 4) * 10) / 10,
      days_nutrition_logged: logged.length,
      avg_kcal_logged_days: avgOf(nutDays.map((d) => d.totals.kcal)),
      avg_protein_logged_days: avgOf(nutDays.map((d) => d.totals.protein_g)),
      avg_steps: avgOf(stepsDays.map((a) => a.steps)),
      checkins: acts.filter((a) => a.checkin).length,
    },
    weight: {
      latest: ws.latest?.weight ?? null,
      latest_date: ws.latest?.date ?? null,
      avg_7d: ws.avg7,
      avg_prev_7d: ws.avg7Prev,
      weekly_rate_30d: ws.weeklyRate30,
      entries_30d: ws.daysLogged30,
    },
    key_lifts,
    data_gaps: gaps,
  };
}

export const COACH_SYSTEM_PROMPT = `Du bist „Coach", der persönliche KI-Fitnesscoach in der App Gymolingo.
Regeln:
- Antworte auf Deutsch, kurz, konkret und motivierend. Keine Schuldzuweisungen, kein Beschämen.
- Nutze AUSSCHLIESSLICH die Fakten aus dem JSON-Block <nutzerdaten>. Erfinde keine Zahlen, Trainings, Mahlzeiten oder Messwerte.
- Wenn Daten fehlen, sage das offen und erkläre, welche Eingabe helfen würde (siehe data_gaps).
- Berechnungen (Durchschnitte, 1RM, Trends, Vorschläge) liegen bereits vor – interpretiere sie, statt neu zu rechnen.
- Gewichts- und Wiederholungsempfehlungen orientieren sich an key_lifts.next_suggestion; weiche nur mit Begründung ab.
- Gib keine medizinischen Diagnosen. Bei Schmerzen, Verletzungen, Essstörungen oder gesundheitlichen Problemen empfiehl ärztlichen Rat.
- Beachte Ernährungsform und Allergien des Nutzers bei Lebensmittelvorschlägen.
- Formatiere mit kurzen Absätzen oder Aufzählungen, maximal ca. 180 Wörter, außer der Nutzer fragt nach mehr Details.`;

export const WEEKLY_REPORT_PROMPT = `Erstelle aus den Statistiken in <wochenstatistik> einen motivierenden Wochenbericht auf Deutsch.
Struktur (genau diese 7 Überschriften):
1. Kraftentwicklung 2. Trainingskonsistenz 3. Ernährung & Kalorienbilanz 4. Gewichtstrend 5. Schritte 6. Erfolge 7. Drei Empfehlungen für nächste Woche
Regeln: Verwende nur die gelieferten Zahlen. Keine neuen Zahlen erfinden. Die drei Empfehlungen basieren auf dem Feld "recommendations" (du darfst sie umformulieren und konkretisieren, aber nicht durch erfundene Fakten ersetzen). Maximal ca. 350 Wörter. Antworte als JSON: {"sections":[{"heading":"...","body":"..."}]}`;

export function buildCoachUserMessage(ctx: CoachContext, question: string): string {
  return `<nutzerdaten>\n${JSON.stringify(ctx)}\n</nutzerdaten>\n\nFrage des Nutzers: ${question}`;
}
