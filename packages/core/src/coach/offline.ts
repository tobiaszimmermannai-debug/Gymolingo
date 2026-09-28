/**
 * Rule-based coach answers used when no AI backend is configured or reachable.
 * Uses exclusively the facts in the CoachContext.
 */
import { formatNumberDE, formatSigned } from '../format';
import { normalize } from '../training/exercises';
import { proteinIdea } from '../reminders/engine';
import type { CoachContext } from './context';

export function answerOffline(ctx: CoachContext, question: string): string {
  const q = normalize(question);
  const has = (...words: string[]) => words.some((w) => q.includes(w));
  const lines: string[] = [];

  const lift = ctx.key_lifts.find((l) => q.includes(normalize(l.exercise).split(' ')[0]));
  if (lift) {
    lines.push(`**${lift.exercise}**`);
    if (lift.last_date) lines.push(`Zuletzt (${lift.last_date}): ${lift.last_sets}.`);
    if (lift.best_e1rm) lines.push(`Bestes geschätztes 1RM: ${formatNumberDE(lift.best_e1rm)} kg.`);
    lines.push(`Vorschlag fürs nächste Training: ${lift.next_suggestion}.`);
    if (lift.plateau) lines.push('Seit einigen Einheiten stagniert die Leistung – eine leichtere Woche oder ein anderer Wiederholungsbereich kann helfen.');
    return lines.join('\n');
  }

  if (has('protein', 'eiweiss')) {
    const t = ctx.today_status;
    lines.push(`Heute: ${formatNumberDE(t.protein_eaten, 0)} g von ${ctx.profile.targets.protein_g} g Protein.`);
    if (t.protein_remaining > 0) lines.push(`Es fehlen noch ${formatNumberDE(t.protein_remaining, 0)} g. ${proteinIdea(t.protein_remaining)}`);
    else lines.push('Ziel erreicht – stark! ✅');
    if (ctx.last_28_days.avg_protein_logged_days !== null)
      lines.push(`Ø der letzten 4 Wochen (getrackte Tage): ${ctx.last_28_days.avg_protein_logged_days} g.`);
    return lines.join('\n');
  }

  if (has('kalorie', 'kcal', 'essen', 'ernaehrung', 'hunger')) {
    const t = ctx.today_status;
    lines.push(`Heute gegessen: ${formatNumberDE(t.kcal_eaten, 0)} kcal – noch ${formatNumberDE(t.kcal_remaining, 0)} kcal bis zu deinem Ziel von ${formatNumberDE(ctx.profile.targets.kcal, 0)} kcal.`);
    if (ctx.last_28_days.avg_kcal_logged_days !== null)
      lines.push(`Ø der getrackten Tage (28 Tage): ${formatNumberDE(ctx.last_28_days.avg_kcal_logged_days, 0)} kcal an ${ctx.last_28_days.days_nutrition_logged} Tagen.`);
    if (has('hunger')) lines.push('Gegen Hunger helfen viel Protein, Gemüse, Ballaststoffe und ausreichend Wasser. Volumenreiche Lebensmittel (Gemüse, Beeren, Kartoffeln) sättigen bei wenigen Kalorien.');
    return lines.join('\n');
  }

  if (has('gewicht', 'abnehm', 'zunehm', 'waage', 'trend')) {
    const w = ctx.weight;
    if (w.latest === null) return 'Ich habe noch keine Gewichtsdaten. Trag dein Gewicht 3–4× pro Woche morgens ein – dann berechne ich deinen Trend.';
    lines.push(`Letzte Messung: ${formatNumberDE(w.latest)} kg (${w.latest_date}).`);
    if (w.avg_7d !== null) lines.push(`7-Tage-Schnitt: ${formatNumberDE(w.avg_7d)} kg${w.avg_prev_7d !== null ? ` (Vorwoche ${formatNumberDE(w.avg_prev_7d)} kg)` : ''}.`);
    if (w.weekly_rate_30d !== null)
      lines.push(`Trend (30 Tage): ${formatSigned(w.weekly_rate_30d, 2, 'kg')}/Woche, geplant ${formatSigned(ctx.profile.planned_weekly_rate_kg, 2, 'kg')}/Woche.`);
    else lines.push('Für einen 30-Tage-Trend brauche ich Messungen über mindestens 2 Wochen.');
    return lines.join('\n');
  }

  if (has('schritt', 'laufen', 'spazier')) {
    lines.push(`Dein Schrittziel: ${formatNumberDE(ctx.profile.targets.steps, 0)} pro Tag.`);
    if (ctx.last_28_days.avg_steps !== null) lines.push(`Ø der letzten 4 Wochen: ${formatNumberDE(ctx.last_28_days.avg_steps, 0)} Schritte.`);
    lines.push('Tipp: 10–15 Minuten Spaziergang nach den Mahlzeiten bringen schnell 1.500–2.000 Schritte.');
    return lines.join('\n');
  }

  if (has('plateau', 'stagn', 'fortschritt', 'steiger', 'training', 'gewichte')) {
    if (!ctx.key_lifts.length) return 'Sobald du ein paar Trainings geloggt hast, gebe ich dir konkrete Gewichts- und Wiederholungsziele.';
    lines.push('Deine nächsten Ziele:');
    for (const l of ctx.key_lifts) lines.push(`• ${l.exercise}: ${l.next_suggestion}${l.plateau ? ' (Plateau – Variation/Deload prüfen)' : ''}`);
    lines.push(`Trainings in den letzten 4 Wochen: ${ctx.last_28_days.workouts} (Ø ${formatNumberDE(ctx.last_28_days.avg_workouts_per_week)}/Woche bei Plan ${ctx.profile.training_days_per_week}).`);
    return lines.join('\n');
  }

  if (has('regeneration', 'schlaf', 'muede', 'erholung', 'pause')) {
    return 'Regeneration: 7–9 h Schlaf, ausreichend Kalorien und Protein sowie 1–2 Ruhetage pro Woche. Wenn du dich mehrere Tage schlapp fühlst, plane eine leichtere Woche mit ca. 10 % weniger Gewicht und einem Satz weniger pro Übung.';
  }

  // default: short status overview
  lines.push('Hier dein aktueller Stand:');
  lines.push(`• Heute: ${formatNumberDE(ctx.today_status.kcal_remaining, 0)} kcal und ${formatNumberDE(Math.max(0, ctx.today_status.protein_remaining), 0)} g Protein offen${ctx.today_status.workout_done ? ', Training erledigt ✅' : ''}.`);
  lines.push(`• 4 Wochen: ${ctx.last_28_days.workouts} Trainings, Ernährung an ${ctx.last_28_days.days_nutrition_logged} Tagen getrackt.`);
  if (ctx.data_gaps.length) lines.push(`• Datenlücken: ${ctx.data_gaps.join('; ')}.`);
  lines.push('Frag mich z. B. nach Protein, Kalorien, Gewichtstrend, Schritten oder einer Übung wie „Bankdrücken".');
  return lines.join('\n');
}
