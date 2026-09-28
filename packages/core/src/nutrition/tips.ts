/**
 * Personal nutrition tips derived from the user's actual logs (last 7 days).
 * Deterministic and explainable – every tip states the numbers it is based on.
 */
import type { ISODate } from '../dates';
import { addDays, dateRange } from '../dates';
import { formatNumberDE } from '../format';
import type { AthleteProfile, MealEntry } from '../types';
import { dayNutrition, isDayLogged } from './calc';

export interface NutritionTip {
  id: string;
  icon: string;
  title: string;
  text: string;
  priority: number;
}

const PROTEIN_SOURCES: Record<string, string> = {
  omnivore: 'Magerquark, Skyr, Hähnchen, Thunfisch oder Eier',
  vegetarian: 'Magerquark, Skyr, Eier, Harzer Käse oder Linsen',
  vegan: 'Tofu, Tempeh, Seitan, Linsen oder Sojadrink',
  pescetarian: 'Skyr, Thunfisch, Lachs, Garnelen oder Eier',
  keto: 'Eier, Hähnchen, Lachs, Harzer Käse oder Thunfisch',
  other: 'Magerquark, Skyr, Hülsenfrüchte oder mageres Fleisch',
};

export function nutritionTips(profile: AthleteProfile, meals: MealEntry[], today: ISODate, nowHour = 12): NutritionTip[] {
  const tips: NutritionTip[] = [];
  const days = dateRange(addDays(today, -7), addDays(today, -1)).map((d) => dayNutrition(d, meals));
  const logged = days.filter((d) => isDayLogged(d, profile.calorie_target));
  const todayN = dayNutrition(today, meals);
  const sources = PROTEIN_SOURCES[profile.diet_type] ?? PROTEIN_SOURCES.other;
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  if (logged.length < 4) {
    tips.push({
      id: 'consistency',
      icon: '📒',
      title: 'Regelmäßig tracken',
      text: `In den letzten 7 Tagen waren ${logged.length} Tage vollständig erfasst. Ab 5 Tagen pro Woche werden deine Auswertungen und Kalorienempfehlungen verlässlich.`,
      priority: 40,
    });
  }

  if (logged.length >= 3) {
    const p = avg(logged.map((d) => d.totals.protein_g));
    if (p < profile.protein_target_g * 0.85) {
      tips.push({
        id: 'protein-avg',
        icon: '🥩',
        title: `Protein: Ø ${formatNumberDE(p, 0)} g von ${profile.protein_target_g} g`,
        text: `Dir fehlen im Schnitt ${formatNumberDE(profile.protein_target_g - p, 0)} g pro Tag. Plane pro Mahlzeit eine Proteinquelle ein, z. B. ${sources}.`,
        priority: 60,
      });
    }
    const kcal = avg(logged.map((d) => d.totals.kcal));
    if (kcal > profile.calorie_target * 1.1) {
      tips.push({
        id: 'kcal-high',
        icon: '⚖️',
        title: `Ø ${formatNumberDE(kcal, 0)} kcal – über deinem Ziel`,
        text: `Das sind ca. ${formatNumberDE(kcal - profile.calorie_target, 0)} kcal/Tag mehr als geplant. Kleine Hebel: Getränke ohne Zucker, Öl abmessen, Snacks vorportionieren.`,
        priority: profile.goal === 'fat_loss' ? 55 : 30,
      });
    } else if (kcal < profile.calorie_target * 0.8 && profile.goal !== 'fat_loss') {
      tips.push({
        id: 'kcal-low',
        icon: '🍚',
        title: `Ø ${formatNumberDE(kcal, 0)} kcal – deutlich unter deinem Ziel`,
        text: 'Für Muskelaufbau und Leistung brauchst du genug Energie. Ergänze kalorienreiche, einfache Snacks wie Haferflocken mit Milch, Nüsse oder Bananen.',
        priority: 50,
      });
    }
    const fiber = avg(logged.map((d) => d.totals.fiber_g));
    if (fiber < 25) {
      tips.push({
        id: 'fiber',
        icon: '🥦',
        title: `Ballaststoffe: Ø ${formatNumberDE(fiber, 0)} g`,
        text: 'Empfohlen sind mindestens 30 g täglich. Gemüse, Vollkornbrot, Haferflocken und Hülsenfrüchte sättigen gut und helfen der Verdauung.',
        priority: 25,
      });
    }
    const breakfastProtein = avg(logged.map((d) => d.byMeal.breakfast.protein_g));
    if (breakfastProtein < 20 && p < profile.protein_target_g * 0.95) {
      tips.push({
        id: 'breakfast-protein',
        icon: '🥣',
        title: 'Proteinreiches Frühstück',
        text: `Dein Frühstück liefert im Schnitt ${formatNumberDE(breakfastProtein, 0)} g Protein. Mit 25–30 g am Morgen (z. B. Skyr mit Haferflocken) wird das Tagesziel leichter.`,
        priority: 35,
      });
    }
  }

  const estimated = meals.filter((m) => !m.deleted && m.date >= addDays(today, -7) && m.date <= today);
  const estShare = estimated.length ? estimated.filter((m) => m.is_estimate).length / estimated.length : 0;
  if (estimated.length >= 5 && estShare > 0.3) {
    tips.push({
      id: 'estimates',
      icon: '🔍',
      title: `${Math.round(estShare * 100)} % deiner Einträge sind Schätzungen`,
      text: 'Wo möglich: Barcode scannen oder abwiegen. Für Gerichte kannst du eigene Rezepte anlegen – das macht die Werte deutlich genauer.',
      priority: 20,
    });
  }

  const remainingProtein = profile.protein_target_g - todayN.totals.protein_g;
  if (nowHour >= 16 && todayN.entries > 0 && remainingProtein >= 30) {
    tips.push({
      id: 'protein-today',
      icon: '⏱️',
      title: `Heute noch ${formatNumberDE(remainingProtein, 0)} g Protein offen`,
      text: `Für den Rest des Tages: ${sources}.`,
      priority: 65,
    });
  }
  return tips.sort((a, b) => b.priority - a.priority).slice(0, 3);
}
