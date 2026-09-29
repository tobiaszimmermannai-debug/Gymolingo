// GENERATED from packages/core by 'npm run build:edge -w @gymolingo/core' – do not edit.

// src/dates.ts
var pad = (n) => String(n).padStart(2, "0");
function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function todayISO(now = /* @__PURE__ */ new Date()) {
  return toISODate(now);
}
function parseISODate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}
function addDays(date, days) {
  const d = parseISODate(date);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}
function diffDays(a, b) {
  const ms = parseISODate(b).getTime() - parseISODate(a).getTime();
  return Math.round(ms / 864e5);
}
function weekdayIndex(date) {
  const js = parseISODate(date).getDay();
  return (js + 6) % 7;
}
function startOfWeek(date) {
  return addDays(date, -weekdayIndex(date));
}
function endOfWeek(date) {
  return addDays(startOfWeek(date), 6);
}
function startOfMonth(date) {
  return `${date.slice(0, 7)}-01`;
}
function dateRange(from, to) {
  const out = [];
  if (from > to) return out;
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}
function isBetween(date, from, to) {
  return date >= from && date <= to;
}
function isoWeekNumber(date) {
  const d = parseISODate(date);
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4, 12);
  const week = 1 + Math.round(((target.getTime() - firstThursday.getTime()) / 864e5 - 3 + (firstThursday.getDay() + 6) % 7) / 7);
  return { year: target.getFullYear(), week };
}
function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function minutesToTime(min) {
  const m = (Math.round(min) % 1440 + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}
function ageFromBirthYear(birthYear, now = /* @__PURE__ */ new Date()) {
  return now.getFullYear() - birthYear;
}
var PERIOD_DAYS = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "6m": 182,
  "1y": 365
};
function periodRange(period, today, firstDataDate2) {
  let days;
  if (period === "all") {
    days = firstDataDate2 ? Math.max(1, diffDays(firstDataDate2, today) + 1) : 30;
  } else {
    days = PERIOD_DAYS[period];
  }
  const from = addDays(today, -(days - 1));
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(days - 1));
  return { from, to: today, prevFrom, prevTo, days };
}
var WEEKDAY_SHORT_DE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
var WEEKDAY_LONG_DE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
function formatDateDE(date, withWeekday = false) {
  const d = parseISODate(date);
  const s = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`;
  return withWeekday ? `${WEEKDAY_SHORT_DE[weekdayIndex(date)]}, ${s}` : s;
}

// src/format.ts
function formatNumberDE(n, maxDecimals = 1) {
  if (!Number.isFinite(n)) return "\u2013";
  const factor = Math.pow(10, maxDecimals);
  const rounded = Math.round(n * factor) / factor;
  const [int, dec] = String(Math.abs(rounded)).split(".");
  const withSep = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${rounded < 0 ? "\u2212" : ""}${withSep}${dec ? "," + dec : ""}`;
}
function formatKg(n) {
  return `${formatNumberDE(n, 2)} kg`;
}
function formatSigned(n, maxDecimals = 1, unit = "") {
  const s = formatNumberDE(Math.abs(n), maxDecimals);
  const sign = n > 0 ? "+" : n < 0 ? "\u2212" : "\xB1";
  return `${sign}${s}${unit ? " " + unit : ""}`;
}
function formatDuration(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor(s % 3600 / 60);
  const sec = s % 60;
  const pad2 = (x) => String(x).padStart(2, "0");
  return h > 0 ? `${h}:${pad2(m)}:${pad2(sec)}` : `${m}:${pad2(sec)}`;
}
function formatLastSeen(iso, now = /* @__PURE__ */ new Date()) {
  if (!iso) return "noch nie online";
  const t = new Date(iso);
  const mins = Math.floor((now.getTime() - t.getTime()) / 6e4);
  if (mins < 5) return "gerade online";
  if (mins < 60) return `vor ${mins} Min.`;
  const hhmm = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
  const day = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(now) - day(t)) / 864e5);
  if (days === 0) return `heute ${hhmm}`;
  if (days === 1) return `gestern ${hhmm}`;
  if (days < 30) return `vor ${days} Tagen`;
  return `am ${String(t.getDate()).padStart(2, "0")}.${String(t.getMonth() + 1).padStart(2, "0")}.`;
}

// src/nutrition/targets.ts
var ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9
};
var ACTIVITY_LABELS_DE = {
  sedentary: "\xDCberwiegend sitzend (< 5.000 Schritte)",
  light: "Leicht aktiv (5.000\u20137.500 Schritte)",
  moderate: "M\xE4\xDFig aktiv (7.500\u201310.000 Schritte)",
  active: "Aktiv (10.000\u201312.500 Schritte / k\xF6rperlicher Job)",
  very_active: "Sehr aktiv (> 12.500 Schritte / harte k\xF6rperliche Arbeit)"
};
function mifflinStJeor(sex, weight, height, age) {
  const base = 10 * weight + 6.25 * height - 5 * age;
  if (sex === "male") return base + 5;
  if (sex === "female") return base - 161;
  return base - 78;
}
var round = (n, step = 1) => Math.round(n / step) * step;
function calculateTargets(input) {
  const explanation = [];
  const bmr = mifflinStJeor(input.sex, input.weight_kg, input.height_cm, input.age);
  explanation.push(`Grundumsatz (Mifflin-St Jeor): ${Math.round(bmr)} kcal`);
  const trainingBonus = Math.min(7, Math.max(0, input.training_days_per_week)) * 0.025;
  const factor = ACTIVITY_FACTORS[input.activity_level] + trainingBonus;
  const tdee = bmr * factor;
  explanation.push(
    `Gesamtumsatz: ${Math.round(bmr)} \xD7 ${factor.toFixed(3)} (Alltag + ${input.training_days_per_week} Trainingstage) \u2248 ${Math.round(tdee)} kcal`
  );
  let calorieTarget;
  let weeklyRate;
  switch (input.goal) {
    case "fat_loss": {
      const deficit = Math.min(750, tdee * 0.2);
      calorieTarget = Math.max(tdee - deficit, bmr * 1);
      weeklyRate = -((tdee - calorieTarget) * 7) / 7700;
      explanation.push(`Fettabbau: Defizit von ${Math.round(tdee - calorieTarget)} kcal/Tag`);
      break;
    }
    case "muscle_gain": {
      const surplus = Math.min(350, tdee * 0.1);
      calorieTarget = tdee + surplus;
      weeklyRate = surplus * 7 / 7700;
      explanation.push(`Muskelaufbau: moderater \xDCberschuss von ${Math.round(surplus)} kcal/Tag`);
      break;
    }
    case "recomposition": {
      calorieTarget = tdee - Math.min(250, tdee * 0.08);
      weeklyRate = -((tdee - calorieTarget) * 7) / 7700;
      explanation.push("Recomposition: leichtes Defizit, hoher Proteinanteil");
      break;
    }
    case "strength":
    default: {
      calorieTarget = tdee + 100;
      weeklyRate = 100 * 7 / 7700;
      explanation.push("Kraftsteigerung: Erhaltung mit kleinem Puffer f\xFCr Leistung");
      break;
    }
  }
  const proteinPerKg = {
    fat_loss: 2.2,
    recomposition: 2.2,
    muscle_gain: 1.8,
    strength: 1.8
  };
  const bmi2 = input.weight_kg / Math.pow(input.height_cm / 100, 2);
  const refWeight = bmi2 > 30 ? 27 * Math.pow(input.height_cm / 100, 2) : input.weight_kg;
  let protein = proteinPerKg[input.goal] * refWeight;
  explanation.push(
    `Protein: ${proteinPerKg[input.goal]} g/kg \xD7 ${Math.round(refWeight)} kg${bmi2 > 30 ? " (Referenzgewicht)" : ""}`
  );
  const fatShare = input.diet_type === "keto" ? 0.65 : 0.27;
  let fat = Math.max(calorieTarget * fatShare / 9, 0.6 * input.weight_kg);
  let carbs = (calorieTarget - protein * 4 - fat * 9) / 4;
  if (input.diet_type === "keto") carbs = Math.min(carbs, 30);
  if (carbs < 50 && input.diet_type !== "keto") {
    const missing = 50 - carbs;
    const fatFloor = 0.6 * input.weight_kg;
    const fatReduction = Math.min(missing * (4 / 9), Math.max(0, fat - fatFloor));
    fat -= fatReduction;
    carbs = (calorieTarget - protein * 4 - fat * 9) / 4;
  }
  carbs = Math.max(0, carbs);
  if (input.diet_type === "keto") {
    fat = Math.max(0, (calorieTarget - protein * 4 - carbs * 4) / 9);
  }
  const fiber = Math.round(calorieTarget / 1e3 * 14);
  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calorie_target: round(calorieTarget, 10),
    protein_target_g: round(protein, 5),
    carbs_target_g: round(carbs, 5),
    fat_target_g: round(fat, 5),
    fiber_target_g: Math.max(30, fiber),
    weekly_rate_kg: Math.round(weeklyRate * 100) / 100,
    explanation
  };
}
function suggestStepTarget(goal, activity) {
  const base = {
    sedentary: 6e3,
    light: 7500,
    moderate: 9e3,
    active: 11e3,
    very_active: 12500
  };
  const bonus = goal === "fat_loss" ? 1500 : goal === "recomposition" ? 1e3 : 0;
  return Math.min(15e3, base[activity] + bonus);
}
function adaptiveCalorieAdjustment(params) {
  const { plannedWeeklyRateKg, observedWeeklyRateKg, daysOfData, loggingCompleteness } = params;
  if (observedWeeklyRateKg === null || daysOfData < 14) return null;
  const diffKg = observedWeeklyRateKg - plannedWeeklyRateKg;
  if (Math.abs(diffKg) < 0.15) return null;
  let adjust = -(diffKg * 7700 / 7);
  adjust = Math.max(-250, Math.min(250, adjust));
  adjust = Math.round(adjust / 25) * 25;
  if (adjust === 0) return null;
  const confidence = loggingCompleteness >= 0.8 ? "" : " (Hinweis: Ern\xE4hrungsprotokoll l\xFCckenhaft \u2013 Empfehlung mit Vorsicht)";
  const dir = adjust < 0 ? "senken" : "erh\xF6hen";
  return {
    adjustKcal: adjust,
    reason: `Dein Gewichtstrend liegt bei ${observedWeeklyRateKg >= 0 ? "+" : ""}${observedWeeklyRateKg.toFixed(2)} kg/Woche, geplant waren ${plannedWeeklyRateKg >= 0 ? "+" : ""}${plannedWeeklyRateKg.toFixed(2)} kg/Woche. Kalorienziel um ${Math.abs(adjust)} kcal ${dir}.${confidence}`
  };
}

// src/nutrition/calc.ts
var EMPTY_TOTALS = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };
var r1 = (n) => Math.round(n * 10) / 10;
function nutrientsForAmount(food, grams) {
  const f = Math.max(0, grams) / 100;
  return {
    kcal: Math.round(food.kcal_100 * f),
    protein_g: r1(food.protein_100 * f),
    carbs_g: r1(food.carbs_100 * f),
    fat_g: r1(food.fat_100 * f),
    fiber_g: r1((food.fiber_100 ?? 0) * f)
  };
}
function kcalFromMacros(protein, carbs, fat) {
  return Math.round(protein * 4 + carbs * 4 + fat * 9);
}
function validateNutrients(n) {
  const issues = [];
  if ([n.kcal_100, n.protein_100, n.carbs_100, n.fat_100].some((v) => v < 0 || Number.isNaN(v)))
    issues.push("Werte d\xFCrfen nicht negativ sein.");
  if (n.protein_100 + n.carbs_100 + n.fat_100 > 100.5) issues.push("Makros ergeben mehr als 100 g pro 100 g.");
  if (n.kcal_100 > 900) issues.push("Mehr als 900 kcal pro 100 g ist physikalisch nicht m\xF6glich.");
  const calc = kcalFromMacros(n.protein_100, n.carbs_100, n.fat_100);
  if (Math.abs(calc - n.kcal_100) > Math.max(40, n.kcal_100 * 0.25))
    issues.push(`Kalorien (${Math.round(n.kcal_100)}) passen nicht zu den Makros (\u2248 ${calc} kcal).`);
  return issues;
}
function sumTotals(entries) {
  const t = entries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + (e.kcal || 0),
      protein_g: acc.protein_g + (e.protein_g || 0),
      carbs_g: acc.carbs_g + (e.carbs_g || 0),
      fat_g: acc.fat_g + (e.fat_g || 0),
      fiber_g: acc.fiber_g + (e.fiber_g || 0)
    }),
    { ...EMPTY_TOTALS }
  );
  return { kcal: Math.round(t.kcal), protein_g: r1(t.protein_g), carbs_g: r1(t.carbs_g), fat_g: r1(t.fat_g), fiber_g: r1(t.fiber_g) };
}
var MEAL_ORDER = ["breakfast", "lunch", "dinner", "snack"];
var MEAL_LABELS_DE = {
  breakfast: "Fr\xFChst\xFCck",
  lunch: "Mittagessen",
  dinner: "Abendessen",
  snack: "Snacks"
};
var byDateCache = /* @__PURE__ */ new WeakMap();
function mealsByDate(all) {
  let m = byDateCache.get(all);
  if (!m) {
    m = /* @__PURE__ */ new Map();
    for (const e of all) {
      if (e.deleted) continue;
      const arr = m.get(e.date);
      if (arr) arr.push(e);
      else m.set(e.date, [e]);
    }
    byDateCache.set(all, m);
  }
  return m;
}
function dayNutrition(date, all) {
  const entries = mealsByDate(all).get(date) ?? [];
  const byMeal = Object.fromEntries(
    MEAL_ORDER.map((m) => [m, sumTotals(entries.filter((e) => e.meal === m))])
  );
  return {
    date,
    totals: sumTotals(entries),
    byMeal,
    entries: entries.length,
    estimatedEntries: entries.filter((e) => e.is_estimate).length
  };
}
function remainingForDay(totals, targets) {
  const safe = (a, b) => b > 0 ? a / b : 0;
  return {
    kcal: Math.round(targets.calorie_target - totals.kcal),
    protein_g: r1(targets.protein_target_g - totals.protein_g),
    carbs_g: r1(targets.carbs_target_g - totals.carbs_g),
    fat_g: r1(targets.fat_target_g - totals.fat_g),
    pct: {
      kcal: safe(totals.kcal, targets.calorie_target),
      protein: safe(totals.protein_g, targets.protein_target_g),
      carbs: safe(totals.carbs_g, targets.carbs_target_g),
      fat: safe(totals.fat_g, targets.fat_target_g)
    }
  };
}
function recipeNutrients(items) {
  const live = items.filter((i) => !i.deleted);
  const totalGrams = live.reduce((s, i) => s + i.amount_g, 0);
  const totals = sumTotals(live.map((i) => ({ ...nutrientsForAmount(i, i.amount_g) })));
  const f = totalGrams > 0 ? 100 / totalGrams : 0;
  return {
    totalGrams,
    totals,
    per100: {
      kcal_100: Math.round(totals.kcal * f),
      protein_100: r1(totals.protein_g * f),
      carbs_100: r1(totals.carbs_g * f),
      fat_100: r1(totals.fat_g * f),
      fiber_100: r1(totals.fiber_g * f),
      sugar_100: null,
      salt_100: null
    }
  };
}
function isDayLogged(day, calorieTarget) {
  return day.entries >= 2 || calorieTarget > 0 && day.totals.kcal >= calorieTarget * 0.5;
}
function isProteinHit(day, proteinTarget) {
  return proteinTarget > 0 && day.totals.protein_g >= proteinTarget * 0.95;
}
function isCaloriesOnTarget(day, calorieTarget) {
  if (calorieTarget <= 0 || day.entries === 0) return false;
  return Math.abs(day.totals.kcal - calorieTarget) <= calorieTarget * 0.1;
}

// src/training/exercises.ts
var INC = {
  barbell: 2.5,
  smith: 2.5,
  dumbbell: 2,
  machine: 5,
  cable: 5,
  kettlebell: 4,
  bodyweight: 2.5,
  bands: 0
};
function ex(d) {
  const category = d.category ?? "compound";
  return {
    secondary_muscles: [],
    is_bodyweight: d.equipment === "bodyweight",
    increment_kg: INC[d.equipment],
    default_rep_min: category === "isolation" ? 10 : 6,
    default_rep_max: category === "isolation" ? 15 : 10,
    category,
    ...d
  };
}
var EXERCISES = [
  // Chest
  ex({ id: "bench-press", name: "Bankdr\xFCcken (Langhantel)", name_en: "Barbell Bench Press", primary_muscle: "chest", secondary_muscles: ["triceps", "shoulders"], equipment: "barbell", default_rep_min: 5, default_rep_max: 8 }),
  ex({ id: "incline-bench-press", name: "Schr\xE4gbankdr\xFCcken (Langhantel)", name_en: "Incline Barbell Bench Press", primary_muscle: "chest", secondary_muscles: ["shoulders", "triceps"], equipment: "barbell" }),
  ex({ id: "db-bench-press", name: "Kurzhantel-Bankdr\xFCcken", name_en: "Dumbbell Bench Press", primary_muscle: "chest", secondary_muscles: ["triceps", "shoulders"], equipment: "dumbbell", default_rep_min: 8, default_rep_max: 12 }),
  ex({ id: "incline-db-press", name: "Schr\xE4gbankdr\xFCcken (Kurzhantel)", name_en: "Incline Dumbbell Press", primary_muscle: "chest", secondary_muscles: ["shoulders", "triceps"], equipment: "dumbbell", default_rep_min: 8, default_rep_max: 12 }),
  ex({ id: "machine-chest-press", name: "Brustpresse (Maschine)", name_en: "Machine Chest Press", primary_muscle: "chest", secondary_muscles: ["triceps"], equipment: "machine", default_rep_min: 8, default_rep_max: 12 }),
  ex({ id: "smith-incline-press", name: "Schr\xE4gbankdr\xFCcken (Multipresse)", name_en: "Smith Machine Incline Press", primary_muscle: "chest", secondary_muscles: ["shoulders", "triceps"], equipment: "smith", default_rep_min: 8, default_rep_max: 12 }),
  ex({ id: "cable-fly", name: "Kabelzug-Fliegende", name_en: "Cable Fly", primary_muscle: "chest", equipment: "cable", category: "isolation" }),
  ex({ id: "pec-deck", name: "Butterfly (Maschine)", name_en: "Pec Deck", primary_muscle: "chest", equipment: "machine", category: "isolation" }),
  ex({ id: "db-fly", name: "Kurzhantel-Fliegende", name_en: "Dumbbell Fly", primary_muscle: "chest", equipment: "dumbbell", category: "isolation" }),
  ex({ id: "dips", name: "Dips", name_en: "Dips", primary_muscle: "chest", secondary_muscles: ["triceps", "shoulders"], equipment: "bodyweight", default_rep_min: 6, default_rep_max: 12 }),
  ex({ id: "push-up", name: "Liegest\xFCtze", name_en: "Push-up", primary_muscle: "chest", secondary_muscles: ["triceps", "shoulders"], equipment: "bodyweight", default_rep_min: 10, default_rep_max: 25 }),
  // Back
  ex({ id: "deadlift", name: "Kreuzheben", name_en: "Deadlift", primary_muscle: "lower_back", secondary_muscles: ["glutes", "hamstrings", "back", "traps"], equipment: "barbell", default_rep_min: 3, default_rep_max: 6, increment_kg: 5 }),
  ex({ id: "barbell-row", name: "Langhantelrudern", name_en: "Barbell Row", primary_muscle: "back", secondary_muscles: ["lats", "biceps", "rear_delts"], equipment: "barbell" }),
  ex({ id: "db-row", name: "Einarmiges Kurzhantelrudern", name_en: "One-Arm Dumbbell Row", primary_muscle: "back", secondary_muscles: ["lats", "biceps"], equipment: "dumbbell", default_rep_min: 8, default_rep_max: 12 }),
  ex({ id: "pull-up", name: "Klimmz\xFCge", name_en: "Pull-up", primary_muscle: "lats", secondary_muscles: ["biceps", "back"], equipment: "bodyweight", default_rep_min: 5, default_rep_max: 10 }),
  ex({ id: "chin-up", name: "Klimmz\xFCge (Untergriff)", name_en: "Chin-up", primary_muscle: "lats", secondary_muscles: ["biceps"], equipment: "bodyweight", default_rep_min: 5, default_rep_max: 10 }),
  ex({ id: "lat-pulldown", name: "Latzug", name_en: "Lat Pulldown", primary_muscle: "lats", secondary_muscles: ["biceps", "back"], equipment: "cable", default_rep_min: 8, default_rep_max: 12 }),
  ex({ id: "close-grip-pulldown", name: "Latzug (enger Griff)", name_en: "Close-Grip Pulldown", primary_muscle: "lats", secondary_muscles: ["biceps"], equipment: "cable", default_rep_min: 8, default_rep_max: 12 }),
  ex({ id: "seated-cable-row", name: "Rudern am Kabelzug (sitzend)", name_en: "Seated Cable Row", primary_muscle: "back", secondary_muscles: ["lats", "biceps", "rear_delts"], equipment: "cable", default_rep_min: 8, default_rep_max: 12 }),
  ex({ id: "machine-row", name: "Rudermaschine (T-Bar/Brustgest\xFCtzt)", name_en: "Chest-Supported Machine Row", primary_muscle: "back", secondary_muscles: ["lats", "rear_delts", "biceps"], equipment: "machine", default_rep_min: 8, default_rep_max: 12 }),
  ex({ id: "straight-arm-pulldown", name: "\xDCberz\xFCge am Kabel", name_en: "Straight-Arm Pulldown", primary_muscle: "lats", equipment: "cable", category: "isolation" }),
  ex({ id: "shrug", name: "Shrugs (Kurzhantel)", name_en: "Dumbbell Shrug", primary_muscle: "traps", equipment: "dumbbell", category: "isolation" }),
  ex({ id: "back-extension", name: "Hyperextensions", name_en: "Back Extension", primary_muscle: "lower_back", secondary_muscles: ["glutes", "hamstrings"], equipment: "bodyweight", default_rep_min: 10, default_rep_max: 15 }),
  // Shoulders
  ex({ id: "overhead-press", name: "Schulterdr\xFCcken (Langhantel, stehend)", name_en: "Overhead Press", primary_muscle: "shoulders", secondary_muscles: ["triceps"], equipment: "barbell", default_rep_min: 5, default_rep_max: 8 }),
  ex({ id: "db-shoulder-press", name: "Kurzhantel-Schulterdr\xFCcken", name_en: "Dumbbell Shoulder Press", primary_muscle: "shoulders", secondary_muscles: ["triceps"], equipment: "dumbbell", default_rep_min: 8, default_rep_max: 12 }),
  ex({ id: "machine-shoulder-press", name: "Schulterpresse (Maschine)", name_en: "Machine Shoulder Press", primary_muscle: "shoulders", secondary_muscles: ["triceps"], equipment: "machine", default_rep_min: 8, default_rep_max: 12 }),
  ex({ id: "lateral-raise", name: "Seitheben (Kurzhantel)", name_en: "Lateral Raise", primary_muscle: "shoulders", equipment: "dumbbell", category: "isolation", increment_kg: 1 }),
  ex({ id: "cable-lateral-raise", name: "Seitheben am Kabel", name_en: "Cable Lateral Raise", primary_muscle: "shoulders", equipment: "cable", category: "isolation", increment_kg: 2.5 }),
  ex({ id: "reverse-fly", name: "Reverse Butterfly", name_en: "Reverse Pec Deck", primary_muscle: "rear_delts", secondary_muscles: ["back"], equipment: "machine", category: "isolation" }),
  ex({ id: "face-pull", name: "Face Pulls", name_en: "Face Pull", primary_muscle: "rear_delts", secondary_muscles: ["traps"], equipment: "cable", category: "isolation", increment_kg: 2.5 }),
  // Arms
  ex({ id: "barbell-curl", name: "Langhantel-Curls", name_en: "Barbell Curl", primary_muscle: "biceps", secondary_muscles: ["forearms"], equipment: "barbell", category: "isolation", default_rep_min: 8, default_rep_max: 12 }),
  ex({ id: "db-curl", name: "Kurzhantel-Curls", name_en: "Dumbbell Curl", primary_muscle: "biceps", secondary_muscles: ["forearms"], equipment: "dumbbell", category: "isolation", increment_kg: 1 }),
  ex({ id: "hammer-curl", name: "Hammercurls", name_en: "Hammer Curl", primary_muscle: "biceps", secondary_muscles: ["forearms"], equipment: "dumbbell", category: "isolation", increment_kg: 1 }),
  ex({ id: "cable-curl", name: "Bizepscurls am Kabel", name_en: "Cable Curl", primary_muscle: "biceps", equipment: "cable", category: "isolation", increment_kg: 2.5 }),
  ex({ id: "preacher-curl", name: "Scottcurls (Maschine)", name_en: "Preacher Curl Machine", primary_muscle: "biceps", equipment: "machine", category: "isolation" }),
  ex({ id: "triceps-pushdown", name: "Trizepsdr\xFCcken am Kabel", name_en: "Triceps Pushdown", primary_muscle: "triceps", equipment: "cable", category: "isolation", increment_kg: 2.5 }),
  ex({ id: "overhead-triceps-extension", name: "\xDCberkopf-Trizepsstrecken (Kabel)", name_en: "Overhead Cable Triceps Extension", primary_muscle: "triceps", equipment: "cable", category: "isolation", increment_kg: 2.5 }),
  ex({ id: "db-triceps-extension", name: "Trizepsstrecken \xFCber Kopf (Kurzhantel)", name_en: "Dumbbell Overhead Triceps Extension", primary_muscle: "triceps", equipment: "dumbbell", category: "isolation", increment_kg: 2 }),
  ex({ id: "skull-crusher", name: "French Press (SZ-Stange)", name_en: "Skull Crusher", primary_muscle: "triceps", equipment: "barbell", category: "isolation", default_rep_min: 8, default_rep_max: 12 }),
  ex({ id: "close-grip-bench", name: "Enges Bankdr\xFCcken", name_en: "Close-Grip Bench Press", primary_muscle: "triceps", secondary_muscles: ["chest", "shoulders"], equipment: "barbell" }),
  ex({ id: "wrist-curl", name: "Unterarmcurls", name_en: "Wrist Curl", primary_muscle: "forearms", equipment: "dumbbell", category: "isolation", increment_kg: 1 }),
  // Legs
  ex({ id: "squat", name: "Kniebeuge (Langhantel)", name_en: "Back Squat", primary_muscle: "quads", secondary_muscles: ["glutes", "adductors", "lower_back"], equipment: "barbell", default_rep_min: 5, default_rep_max: 8 }),
  ex({ id: "front-squat", name: "Frontkniebeuge", name_en: "Front Squat", primary_muscle: "quads", secondary_muscles: ["glutes", "abs"], equipment: "barbell", default_rep_min: 5, default_rep_max: 8 }),
  ex({ id: "hack-squat", name: "Hackenschmidt-Kniebeuge", name_en: "Hack Squat", primary_muscle: "quads", secondary_muscles: ["glutes"], equipment: "machine", default_rep_min: 8, default_rep_max: 12 }),
  ex({ id: "leg-press", name: "Beinpresse", name_en: "Leg Press", primary_muscle: "quads", secondary_muscles: ["glutes", "adductors"], equipment: "machine", default_rep_min: 8, default_rep_max: 12, increment_kg: 10 }),
  ex({ id: "bulgarian-split-squat", name: "Bulgarian Split Squats", name_en: "Bulgarian Split Squat", primary_muscle: "quads", secondary_muscles: ["glutes"], equipment: "dumbbell", default_rep_min: 8, default_rep_max: 12 }),
  ex({ id: "lunge", name: "Ausfallschritte (Kurzhantel)", name_en: "Dumbbell Lunge", primary_muscle: "quads", secondary_muscles: ["glutes"], equipment: "dumbbell", default_rep_min: 8, default_rep_max: 12 }),
  ex({ id: "leg-extension", name: "Beinstrecker", name_en: "Leg Extension", primary_muscle: "quads", equipment: "machine", category: "isolation" }),
  ex({ id: "romanian-deadlift", name: "Rum\xE4nisches Kreuzheben", name_en: "Romanian Deadlift", primary_muscle: "hamstrings", secondary_muscles: ["glutes", "lower_back"], equipment: "barbell", default_rep_min: 6, default_rep_max: 10 }),
  ex({ id: "db-romanian-deadlift", name: "Rum\xE4nisches Kreuzheben (Kurzhantel)", name_en: "Dumbbell Romanian Deadlift", primary_muscle: "hamstrings", secondary_muscles: ["glutes", "lower_back"], equipment: "dumbbell", default_rep_min: 8, default_rep_max: 12 }),
  ex({ id: "lying-leg-curl", name: "Beinbeuger liegend", name_en: "Lying Leg Curl", primary_muscle: "hamstrings", equipment: "machine", category: "isolation" }),
  ex({ id: "seated-leg-curl", name: "Beinbeuger sitzend", name_en: "Seated Leg Curl", primary_muscle: "hamstrings", equipment: "machine", category: "isolation" }),
  ex({ id: "hip-thrust", name: "Hip Thrust (Langhantel)", name_en: "Barbell Hip Thrust", primary_muscle: "glutes", secondary_muscles: ["hamstrings"], equipment: "barbell", default_rep_min: 8, default_rep_max: 12, increment_kg: 5 }),
  ex({ id: "hip-abduction", name: "Abduktoren-Maschine", name_en: "Hip Abduction", primary_muscle: "glutes", equipment: "machine", category: "isolation" }),
  ex({ id: "hip-adduction", name: "Adduktoren-Maschine", name_en: "Hip Adduction", primary_muscle: "adductors", equipment: "machine", category: "isolation" }),
  ex({ id: "standing-calf-raise", name: "Wadenheben stehend", name_en: "Standing Calf Raise", primary_muscle: "calves", equipment: "machine", category: "isolation" }),
  ex({ id: "seated-calf-raise", name: "Wadenheben sitzend", name_en: "Seated Calf Raise", primary_muscle: "calves", equipment: "machine", category: "isolation" }),
  ex({ id: "goblet-squat", name: "Goblet Squat", name_en: "Goblet Squat", primary_muscle: "quads", secondary_muscles: ["glutes"], equipment: "dumbbell", default_rep_min: 8, default_rep_max: 15 }),
  ex({ id: "kb-swing", name: "Kettlebell Swings", name_en: "Kettlebell Swing", primary_muscle: "glutes", secondary_muscles: ["hamstrings", "lower_back"], equipment: "kettlebell", default_rep_min: 12, default_rep_max: 20 }),
  // Core
  ex({ id: "plank", name: "Unterarmst\xFCtz (Sek.)", name_en: "Plank (seconds)", primary_muscle: "abs", equipment: "bodyweight", category: "isolation", default_rep_min: 30, default_rep_max: 90 }),
  ex({ id: "cable-crunch", name: "Kabel-Crunches", name_en: "Cable Crunch", primary_muscle: "abs", equipment: "cable", category: "isolation" }),
  ex({ id: "hanging-leg-raise", name: "Beinheben h\xE4ngend", name_en: "Hanging Leg Raise", primary_muscle: "abs", equipment: "bodyweight", category: "isolation", default_rep_min: 8, default_rep_max: 15 }),
  ex({ id: "ab-wheel", name: "Ab Wheel Rollouts", name_en: "Ab Wheel Rollout", primary_muscle: "abs", equipment: "bodyweight", category: "isolation", default_rep_min: 8, default_rep_max: 15 }),
  ex({ id: "band-pull-apart", name: "Band Pull-Aparts", name_en: "Band Pull-Apart", primary_muscle: "rear_delts", equipment: "bands", category: "isolation", default_rep_min: 15, default_rep_max: 25 })
];
var EXERCISE_MAP = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));
var MUSCLE_LABELS_DE = {
  chest: "Brust",
  back: "Oberer R\xFCcken",
  lats: "Latissimus",
  traps: "Trapez",
  shoulders: "Schultern",
  rear_delts: "Hintere Schulter",
  biceps: "Bizeps",
  triceps: "Trizeps",
  forearms: "Unterarme",
  quads: "Quadrizeps",
  hamstrings: "Beinbeuger",
  glutes: "Ges\xE4\xDF",
  calves: "Waden",
  abs: "Bauch",
  lower_back: "Unterer R\xFCcken",
  adductors: "Adduktoren",
  full_body: "Ganzk\xF6rper",
  cardio: "Cardio"
};
var EQUIPMENT_LABELS_DE = {
  barbell: "Langhantel",
  dumbbell: "Kurzhantel",
  machine: "Maschine",
  cable: "Kabelzug",
  bodyweight: "K\xF6rpergewicht",
  kettlebell: "Kettlebell",
  bands: "Widerstandsb\xE4nder",
  smith: "Multipresse"
};
var MUSCLE_GROUP_BUCKETS = {
  Brust: ["chest"],
  R\u00FCcken: ["back", "lats", "traps", "lower_back"],
  Schultern: ["shoulders", "rear_delts"],
  Arme: ["biceps", "triceps", "forearms"],
  Beine: ["quads", "hamstrings", "glutes", "calves", "adductors"],
  Core: ["abs"]
};
function searchExercises(list, query, filter) {
  const q = normalize(query);
  return list.filter((e) => filter?.muscle ? e.primary_muscle === filter.muscle || e.secondary_muscles.includes(filter.muscle) : true).filter((e) => filter?.equipment && filter.equipment.length ? filter.equipment.includes(e.equipment) : true).map((e) => {
    const hay = normalize(`${e.name} ${e.name_en ?? ""} ${MUSCLE_LABELS_DE[e.primary_muscle]}`);
    if (!q) return { e, score: 1 };
    if (normalize(e.name).startsWith(q)) return { e, score: 3 };
    if (hay.includes(q)) return { e, score: 2 };
    const words = q.split(" ").filter(Boolean);
    return { e, score: words.every((w) => hay.includes(w)) ? 1.5 : 0 };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name, "de")).map((x) => x.e);
}
function normalize(s) {
  return s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

// src/nutrition/foods.ts
var ROWS = [
  // Milchprodukte & Eier
  ["ei", "H\xFChnerei", "Eier & Milchprodukte", 143, 12.6, 0.7, 9.5, 0, "1 Ei (M):55|2 Eier (M):110|3 Eier (M):165", "vegetarian egg"],
  ["eiklar", "Eiklar", "Eier & Milchprodukte", 48, 10.9, 0.7, 0.2, 0, "1 Eiklar:33", "vegetarian egg"],
  ["ruehrei", "R\xFChrei (mit Milch & Butter)", "Eier & Milchprodukte", 170, 11, 1.5, 13.5, 0, "Portion aus 2 Eiern:130|Portion aus 3 Eiern:190", "vegetarian egg milk estimate"],
  ["magerquark", "Magerquark", "Eier & Milchprodukte", 67, 12, 4, 0.3, 0, "1 Becher:250|1 EL:30", "vegetarian milk"],
  ["quark-20", "Speisequark 20 %", "Eier & Milchprodukte", 109, 12.5, 3.5, 5.1, 0, "1 Becher:250", "vegetarian milk"],
  ["skyr", "Skyr natur", "Eier & Milchprodukte", 63, 11, 4, 0.2, 0, "1 Becher:450|1 Portion:150", "vegetarian milk"],
  ["griech-joghurt", "Griechischer Joghurt 10 %", "Eier & Milchprodukte", 125, 5, 4, 10, 0, "1 Portion:150", "vegetarian milk"],
  ["joghurt-35", "Naturjoghurt 3,5 %", "Eier & Milchprodukte", 64, 3.8, 4.5, 3.5, 0, "1 Becher:150|1 Portion:200", "vegetarian milk"],
  ["joghurt-15", "Naturjoghurt 1,5 %", "Eier & Milchprodukte", 48, 4, 4.8, 1.5, 0, "1 Becher:150|1 Portion:200", "vegetarian milk"],
  ["joghurt-01", "Magerjoghurt 0,1 %", "Eier & Milchprodukte", 35, 4.5, 4, 0.1, 0, "1 Becher:150", "vegetarian milk"],
  ["milch-15", "Milch 1,5 %", "Eier & Milchprodukte", 47, 3.4, 4.9, 1.5, 0, "1 Glas (200 ml):206|Schuss f\xFCr Kaffee:30", "vegetarian milk"],
  ["milch-35", "Vollmilch 3,5 %", "Eier & Milchprodukte", 64, 3.3, 4.8, 3.5, 0, "1 Glas (200 ml):206", "vegetarian milk"],
  ["buttermilch", "Buttermilch", "Eier & Milchprodukte", 36, 3.3, 4, 0.5, 0, "1 Glas (250 ml):255", "vegetarian milk"],
  ["kefir", "Kefir 1,5 %", "Eier & Milchprodukte", 45, 3.4, 4.2, 1.5, 0, "1 Becher (500 ml):510", "vegetarian milk"],
  ["huettenkaese", "K\xF6rniger Frischk\xE4se (H\xFCttenk\xE4se)", "Eier & Milchprodukte", 98, 12.3, 2.7, 4.3, 0, "1 Becher:200", "vegetarian milk"],
  ["gouda", "Gouda (45 % Fett i. Tr.)", "Eier & Milchprodukte", 350, 25, 0, 27.5, 0, "1 Scheibe:20|2 Scheiben:40", "vegetarian milk"],
  ["emmentaler", "Emmentaler", "Eier & Milchprodukte", 380, 28, 0, 29.5, 0, "1 Scheibe:20", "vegetarian milk"],
  ["mozzarella", "Mozzarella", "Eier & Milchprodukte", 247, 18, 1, 19, 0, "1 Kugel:125", "vegetarian milk"],
  ["mozzarella-light", "Mozzarella light", "Eier & Milchprodukte", 165, 19, 1, 9.5, 0, "1 Kugel:125", "vegetarian milk"],
  ["feta", "Feta", "Eier & Milchprodukte", 270, 16.7, 0.5, 22.5, 0, "1 Packung:200|Portion:50", "vegetarian milk"],
  ["harzer", "Harzer K\xE4se", "Eier & Milchprodukte", 112, 27, 0, 0.5, 0, "1 Rolle:200|Portion:50", "vegetarian milk"],
  ["frischkaese", "Frischk\xE4se Doppelrahmstufe", "Eier & Milchprodukte", 250, 5.5, 3, 24, 0, "1 EL:20|Portion f\xFCr 1 Br\xF6tchen:30", "vegetarian milk"],
  ["frischkaese-light", "Frischk\xE4se light (k\xF6rnig/leicht)", "Eier & Milchprodukte", 135, 11, 4, 8.3, 0, "1 EL:20", "vegetarian milk"],
  ["butter", "Butter", "Fette & \xD6le", 741, 0.7, 0.6, 83.2, 0, "1 TL:5|Portion f\xFCr 1 Brot:10", "vegetarian milk"],
  ["sahne", "Schlagsahne 30 %", "Eier & Milchprodukte", 300, 2.4, 3.2, 30.5, 0, "1 EL:15|1 Becher:200", "vegetarian milk"],
  ["protein-pudding", "Proteinpudding (Durchschnitt)", "Eier & Milchprodukte", 80, 10, 7, 1.5, 0, "1 Becher:200", "vegetarian milk"],
  // Fleisch, Wurst, Fisch
  ["haehnchenbrust", "H\xE4hnchenbrustfilet (roh)", "Fleisch & Fisch", 105, 23.5, 0, 1.1, 0, "1 Filet:150|Portion:200", "meat"],
  ["haehnchenbrust-gegart", "H\xE4hnchenbrust (gegart)", "Fleisch & Fisch", 155, 30, 0, 3.9, 0, "Portion:150", "meat"],
  ["putenbrust", "Putenbrust (roh)", "Fleisch & Fisch", 105, 24, 0, 1, 0, "Portion:150", "meat"],
  ["rinderhack", "Rinderhackfleisch (roh, ca. 17 % Fett)", "Fleisch & Fisch", 230, 19.5, 0, 17, 0, "Packung:500|Portion:125", "meat"],
  ["rinderhack-mager", "Rinderhackfleisch mager (5 % Fett)", "Fleisch & Fisch", 128, 21, 0, 5, 0, "Packung:400|Portion:125", "meat"],
  ["hack-gemischt", "Gemischtes Hackfleisch (roh)", "Fleisch & Fisch", 260, 18, 0, 21, 0, "Packung:500|Portion:125", "meat"],
  ["rindersteak", "Rindersteak H\xFCfte (roh)", "Fleisch & Fisch", 124, 22, 0, 4, 0, "1 Steak:200", "meat"],
  ["schweinefilet", "Schweinefilet (roh)", "Fleisch & Fisch", 108, 21.5, 0, 2, 0, "Portion:150", "meat"],
  ["schnitzel", "Schnitzel (Schwein, paniert, gebraten)", "Fleisch & Fisch", 230, 19, 9, 13, 0.5, "1 Schnitzel:180", "meat gluten egg"],
  ["kochschinken", "Kochschinken", "Wurst & Aufschnitt", 112, 19.5, 1, 3.3, 0, "1 Scheibe:20|Portion:50", "meat"],
  ["haehnchenaufschnitt", "H\xE4hnchenbrust-Aufschnitt", "Wurst & Aufschnitt", 104, 21, 1.5, 1.5, 0, "1 Scheibe:15|Packung:100", "meat"],
  ["salami", "Salami", "Wurst & Aufschnitt", 374, 21, 0.5, 32, 0, "1 Scheibe:8|Portion:30", "meat"],
  ["bratwurst", "Bratwurst", "Wurst & Aufschnitt", 299, 13.5, 0.5, 27, 0, "1 Wurst:100", "meat"],
  ["wiener", "Wiener W\xFCrstchen", "Wurst & Aufschnitt", 272, 12.5, 0.5, 24.5, 0, "1 W\xFCrstchen:50|Paar:100", "meat"],
  ["leberkaese", "Leberk\xE4se", "Wurst & Aufschnitt", 295, 12, 1, 27, 0, "1 Scheibe:120", "meat"],
  ["lachs", "Lachsfilet (roh)", "Fleisch & Fisch", 202, 20, 0, 13.5, 0, "1 Filet:125", "fish"],
  ["thunfisch-dose", "Thunfisch naturell (abgetropft)", "Fleisch & Fisch", 112, 25.5, 0, 1, 0, "1 Dose (abgetropft):150|halbe Dose:75", "fish"],
  ["seelachs", "Alaska-Seelachsfilet", "Fleisch & Fisch", 80, 18, 0, 0.9, 0, "1 Filet:100", "fish"],
  ["kabeljau", "Kabeljaufilet", "Fleisch & Fisch", 77, 17.7, 0, 0.6, 0, "1 Filet:150", "fish"],
  ["garnelen", "Garnelen (roh)", "Fleisch & Fisch", 85, 20, 0, 0.5, 0, "Portion:150", "fish crustaceans"],
  // Vegetarische Proteinquellen
  ["tofu", "Tofu natur", "Pflanzliches Protein", 125, 13, 1.5, 7.5, 1, "1 Block:200|Portion:100", "vegan soy"],
  ["tofu-raeuchertofu", "R\xE4uchertofu", "Pflanzliches Protein", 150, 16, 2, 8.5, 1, "1 Block:175", "vegan soy"],
  ["tempeh", "Tempeh", "Pflanzliches Protein", 200, 20, 7.6, 10.8, 5, "1 Packung:200|Portion:100", "vegan soy"],
  ["seitan", "Seitan", "Pflanzliches Protein", 120, 25, 4, 1.5, 0.5, "Portion:100", "vegan gluten"],
  ["linsen-rot", "Rote Linsen (roh)", "H\xFClsenfr\xFCchte", 340, 24, 50, 1.5, 11, "Portion (roh):70", "vegan"],
  ["kichererbsen", "Kichererbsen (Dose, abgetropft)", "H\xFClsenfr\xFCchte", 120, 7, 15, 2.5, 5, "1 Dose (abgetropft):240|Portion:120", "vegan"],
  ["kidneybohnen", "Kidneybohnen (Dose, abgetropft)", "H\xFClsenfr\xFCchte", 90, 6.5, 12, 0.5, 6, "1 Dose (abgetropft):250", "vegan"],
  ["erbsen", "Erbsen (TK)", "Gem\xFCse", 78, 5.4, 10, 0.4, 5, "Portion:150", "vegan"],
  ["edamame", "Edamame", "H\xFClsenfr\xFCchte", 125, 11, 7, 5, 5, "Portion:100", "vegan soy"],
  // Getreide & Beilagen
  ["haferflocken", "Haferflocken", "Getreide & Beilagen", 372, 13.5, 58.7, 7, 10, "Portion:50|Gro\xDFe Portion:80|1 EL:10", "vegan gluten"],
  ["reis", "Reis (roh)", "Getreide & Beilagen", 350, 7, 78, 0.6, 1.4, "Portion (roh):75|Kochbeutel:125", "vegan"],
  ["reis-gekocht", "Reis (gekocht)", "Getreide & Beilagen", 130, 2.7, 28, 0.3, 0.4, "Portion:200", "vegan"],
  ["basmati", "Basmatireis (roh)", "Getreide & Beilagen", 355, 8.5, 78, 0.8, 1, "Portion (roh):75", "vegan"],
  ["nudeln", "Nudeln Hartweizen (roh)", "Getreide & Beilagen", 355, 12.5, 71, 1.5, 3, "Portion (roh):100|Kleine Portion (roh):75", "vegan gluten"],
  ["nudeln-gekocht", "Nudeln (gekocht)", "Getreide & Beilagen", 150, 5, 30, 0.9, 1.5, "Portion:250", "vegan gluten"],
  ["vollkornnudeln", "Vollkornnudeln (roh)", "Getreide & Beilagen", 348, 13.5, 64, 2.5, 8, "Portion (roh):100", "vegan gluten"],
  ["kartoffeln", "Kartoffeln (gekocht)", "Getreide & Beilagen", 72, 2, 15.6, 0.1, 2, "1 mittelgro\xDFe:100|Portion:250", "vegan"],
  ["suesskartoffel", "S\xFC\xDFkartoffel", "Getreide & Beilagen", 86, 1.6, 20, 0.1, 3, "1 St\xFCck:250", "vegan"],
  ["pommes", "Pommes frites (zubereitet)", "Getreide & Beilagen", 290, 3.4, 36, 14.5, 3.5, "Kleine Portion:120|Gro\xDFe Portion:200", "vegan estimate"],
  ["couscous", "Couscous (roh)", "Getreide & Beilagen", 354, 12.5, 72, 1.8, 5, "Portion (roh):70", "vegan gluten"],
  ["bulgur", "Bulgur (roh)", "Getreide & Beilagen", 350, 12, 70, 1.5, 8, "Portion (roh):70", "vegan gluten"],
  ["quinoa", "Quinoa (roh)", "Getreide & Beilagen", 360, 14, 60, 6, 7, "Portion (roh):70", "vegan"],
  ["vollkornbrot", "Vollkornbrot", "Brot & Backwaren", 210, 7, 38, 1.5, 8, "1 Scheibe:50|2 Scheiben:100", "vegan gluten"],
  ["mischbrot", "Weizenmischbrot", "Brot & Backwaren", 240, 7.5, 47, 1.6, 4, "1 Scheibe:45", "vegan gluten"],
  ["broetchen", "Br\xF6tchen (Weizen)", "Brot & Backwaren", 268, 8.5, 54, 1.5, 3, "1 Br\xF6tchen:60", "vegan gluten"],
  ["vollkornbroetchen", "Vollkornbr\xF6tchen", "Brot & Backwaren", 240, 9, 42, 3, 7, "1 Br\xF6tchen:75", "vegan gluten"],
  ["brezel", "Laugenbrezel", "Brot & Backwaren", 262, 8, 53, 1.5, 2.5, "1 Brezel:85", "vegan gluten"],
  ["toast", "Toastbrot", "Brot & Backwaren", 260, 8, 48, 4, 3, "1 Scheibe:25", "vegetarian gluten"],
  ["knaeckebrot", "Kn\xE4ckebrot (Roggen)", "Brot & Backwaren", 330, 9.5, 60, 1.8, 16, "1 Scheibe:10", "vegan gluten"],
  ["reiswaffeln", "Reiswaffeln", "Brot & Backwaren", 385, 8, 80, 2.8, 3, "1 Waffel:8", "vegan"],
  ["wrap", "Weizentortilla (Wrap)", "Brot & Backwaren", 305, 8.5, 52, 7, 3, "1 Wrap:62", "vegan gluten"],
  ["cornflakes", "Cornflakes", "Fr\xFChst\xFCck", 380, 7, 84, 0.9, 3, "Portion:40", "vegan"],
  ["muesli", "M\xFCsli ohne Zuckerzusatz", "Fr\xFChst\xFCck", 360, 10, 60, 7, 8, "Portion:60", "vegan gluten nuts"],
  ["muesliriegel", "M\xFCsliriegel", "Snacks & S\xFC\xDFes", 400, 6, 65, 12, 5, "1 Riegel:25", "vegetarian gluten"],
  // Gemüse
  ["brokkoli", "Brokkoli", "Gem\xFCse", 34, 3.3, 2.7, 0.2, 3, "Portion:200", "vegan"],
  ["tomate", "Tomate", "Gem\xFCse", 18, 0.9, 2.6, 0.2, 1.2, "1 Tomate:80|Portion:150", "vegan"],
  ["gurke", "Salatgurke", "Gem\xFCse", 12, 0.6, 1.8, 0.2, 0.5, "halbe Gurke:200|Portion:100", "vegan"],
  ["paprika", "Paprika rot", "Gem\xFCse", 33, 1, 5.3, 0.3, 3.5, "1 Paprika:150", "vegan"],
  ["karotte", "Karotte", "Gem\xFCse", 38, 0.9, 6.7, 0.2, 3.6, "1 Karotte:80", "vegan"],
  ["spinat", "Blattspinat", "Gem\xFCse", 24, 2.9, 1.6, 0.4, 2.6, "Portion:150", "vegan"],
  ["salat", "Blattsalat (Eisberg)", "Gem\xFCse", 14, 0.9, 2, 0.2, 1.2, "Portion:80", "vegan"],
  ["zucchini", "Zucchini", "Gem\xFCse", 19, 1.6, 2.2, 0.4, 1.1, "1 Zucchini:250", "vegan"],
  ["zwiebel", "Zwiebel", "Gem\xFCse", 36, 1.2, 7, 0.2, 1.8, "1 Zwiebel:70", "vegan"],
  ["champignons", "Champignons", "Gem\xFCse", 22, 3.1, 0.6, 0.3, 2, "Portion:150", "vegan"],
  ["blumenkohl", "Blumenkohl", "Gem\xFCse", 27, 2.4, 2.5, 0.3, 2.4, "Portion:200", "vegan"],
  ["mais", "Mais (Dose, abgetropft)", "Gem\xFCse", 80, 2.9, 13, 1.2, 3, "1 kleine Dose:140", "vegan"],
  ["avocado", "Avocado", "Gem\xFCse", 160, 2, 1.8, 14.7, 6.7, "halbe Avocado:70|1 Avocado:140", "vegan"],
  ["gemuesemischung", "Gem\xFCsemischung (TK)", "Gem\xFCse", 40, 2.3, 5.5, 0.4, 3, "Portion:200", "vegan"],
  // Obst
  ["apfel", "Apfel", "Obst", 54, 0.3, 12, 0.2, 2.4, "1 Apfel:150", "vegan"],
  ["banane", "Banane", "Obst", 90, 1.1, 20, 0.2, 2, "1 Banane (ohne Schale):120", "vegan"],
  ["heidelbeeren", "Heidelbeeren", "Obst", 45, 0.7, 7.4, 0.6, 4.9, "Portion:125", "vegan"],
  ["erdbeeren", "Erdbeeren", "Obst", 33, 0.8, 5.5, 0.4, 2, "Portion:200", "vegan"],
  ["beeren-tk", "Beerenmischung (TK)", "Obst", 41, 0.9, 6.5, 0.4, 4, "Portion:100", "vegan"],
  ["orange", "Orange", "Obst", 44, 1, 8.3, 0.2, 2.2, "1 Orange:180", "vegan"],
  ["weintrauben", "Weintrauben", "Obst", 70, 0.7, 15.6, 0.3, 1.5, "Portion:125", "vegan"],
  ["kiwi", "Kiwi", "Obst", 52, 1, 9, 0.6, 3, "1 Kiwi:75", "vegan"],
  ["mango", "Mango", "Obst", 62, 0.6, 13, 0.4, 1.7, "halbe Mango:150", "vegan"],
  ["rosinen", "Rosinen", "Obst", 295, 2.5, 68, 0.6, 4, "1 EL:15", "vegan"],
  ["datteln", "Datteln (getrocknet)", "Obst", 288, 2, 65, 0.4, 8, "1 Dattel:8", "vegan"],
  // Nüsse & Fette
  ["mandeln", "Mandeln", "N\xFCsse & Samen", 600, 21, 5.7, 52, 12.5, "Handvoll:30", "vegan nuts"],
  ["walnuesse", "Waln\xFCsse", "N\xFCsse & Samen", 680, 15, 6.3, 66, 6, "Handvoll:30", "vegan nuts"],
  ["cashews", "Cashewkerne", "N\xFCsse & Samen", 585, 18, 30, 44, 3, "Handvoll:30", "vegan nuts"],
  ["erdnuesse", "Erdn\xFCsse (ger\xF6stet)", "N\xFCsse & Samen", 590, 25, 8, 49, 8, "Handvoll:30", "vegan peanuts"],
  ["erdnussbutter", "Erdnussbutter (100 % Erdnuss)", "N\xFCsse & Samen", 615, 25, 12, 50, 6.5, "1 EL:15|1 TL:7", "vegan peanuts"],
  ["chiasamen", "Chiasamen", "N\xFCsse & Samen", 450, 17, 8, 31, 34, "1 EL:12", "vegan"],
  ["leinsamen", "Leinsamen (geschrotet)", "N\xFCsse & Samen", 530, 24, 2, 42, 27, "1 EL:10", "vegan"],
  ["olivenoel", "Oliven\xF6l", "Fette & \xD6le", 900, 0, 0, 100, 0, "1 EL:10|1 TL:4", "vegan"],
  ["rapsoel", "Raps\xF6l", "Fette & \xD6le", 900, 0, 0, 100, 0, "1 EL:10|1 TL:4", "vegan"],
  ["kokosoel", "Kokos\xF6l", "Fette & \xD6le", 900, 0, 0, 100, 0, "1 EL:10", "vegan"],
  // Supplements & Snacks
  ["whey", "Whey Proteinpulver (Durchschnitt)", "Supplements", 377, 75, 8, 5, 0, "1 Messl\xF6ffel:30", "vegetarian milk"],
  ["protein-vegan", "Veganes Proteinpulver (Erbse/Reis)", "Supplements", 375, 72, 6, 7, 3, "1 Messl\xF6ffel:30", "vegan"],
  ["proteinriegel", "Proteinriegel (Durchschnitt)", "Supplements", 372, 32, 30, 12, 8, "1 Riegel:60|1 Riegel (45 g):45", "vegetarian milk estimate"],
  ["zartbitter", "Zartbitterschokolade 70 %", "Snacks & S\xFC\xDFes", 568, 9, 33, 42, 11, "1 Rippe:10|Halbe Tafel:50", "vegetarian"],
  ["vollmilchschokolade", "Vollmilchschokolade", "Snacks & S\xFC\xDFes", 535, 6.5, 56, 31, 2, "1 Rippe:12|Halbe Tafel:50", "vegetarian milk"],
  ["gummibaerchen", "Fruchtgummi", "Snacks & S\xFC\xDFes", 343, 6.9, 77, 0.1, 0, "Handvoll:25|T\xFCte:200", ""],
  ["chips", "Kartoffelchips", "Snacks & S\xFC\xDFes", 538, 6, 50, 34, 4, "Portion:30|T\xFCte:175", "vegan"],
  ["nussnougatcreme", "Nuss-Nougat-Creme", "Snacks & S\xFC\xDFes", 533, 6.3, 57.5, 30.9, 3, "1 TL:10|Portion f\xFCr 1 Brot:15", "vegetarian milk nuts"],
  ["honig", "Honig", "Aufstriche & Saucen", 302, 0.4, 75, 0, 0, "1 TL:8|1 EL:20", "vegetarian"],
  ["marmelade", "Konfit\xFCre", "Aufstriche & Saucen", 243, 0.4, 60, 0.1, 1, "1 TL:10|Portion f\xFCr 1 Br\xF6tchen:20", "vegan"],
  ["zucker", "Zucker", "Aufstriche & Saucen", 400, 0, 100, 0, 0, "1 TL:5", "vegan"],
  ["ketchup", "Ketchup", "Aufstriche & Saucen", 105, 1.2, 24, 0.3, 0.5, "1 EL:15", "vegan"],
  ["mayonnaise", "Mayonnaise 80 %", "Aufstriche & Saucen", 735, 1, 2, 80, 0, "1 EL:15", "vegetarian egg"],
  ["pesto", "Pesto Genovese", "Aufstriche & Saucen", 500, 5, 6, 50, 2, "1 EL:15|Portion:50", "vegetarian milk nuts"],
  ["hummus", "Hummus", "Aufstriche & Saucen", 280, 7, 12, 21.5, 5, "1 EL:20|Portion:50", "vegan sesame"],
  // Getränke
  ["kaffee", "Kaffee schwarz", "Getr\xE4nke", 2, 0.2, 0.3, 0, 0, "1 Tasse:200", "vegan"],
  ["latte", "Latte Macchiato (Vollmilch, unges\xFC\xDFt)", "Getr\xE4nke", 42, 2.3, 3.3, 2.2, 0, "1 Glas:300", "vegetarian milk estimate"],
  ["hafermilch", "Haferdrink natur", "Getr\xE4nke", 42, 0.3, 6.7, 1.5, 0.8, "1 Glas (200 ml):200|Schuss f\xFCr Kaffee:30", "vegan gluten"],
  ["sojadrink", "Sojadrink unges\xFC\xDFt", "Getr\xE4nke", 33, 3.3, 0.2, 1.8, 0.6, "1 Glas (200 ml):200", "vegan soy"],
  ["orangensaft", "Orangensaft", "Getr\xE4nke", 43, 0.7, 9.5, 0.2, 0.2, "1 Glas (200 ml):200", "vegan"],
  ["apfelsaft", "Apfelsaft", "Getr\xE4nke", 44, 0.1, 10.5, 0.1, 0, "1 Glas (200 ml):200", "vegan"],
  ["apfelschorle", "Apfelschorle", "Getr\xE4nke", 24, 0, 5.7, 0, 0, "1 Flasche (0,5 l):500|1 Glas:250", "vegan"],
  ["cola", "Cola", "Getr\xE4nke", 42, 0, 10.6, 0, 0, "1 Dose (0,33 l):330|1 Flasche (0,5 l):500", "vegan"],
  ["cola-zero", "Cola Zero", "Getr\xE4nke", 0.3, 0, 0, 0, 0, "1 Dose (0,33 l):330|1 Flasche (0,5 l):500", "vegan"],
  ["bier", "Bier (Pils)", "Getr\xE4nke", 42, 0.5, 3, 0, 0, "1 Flasche (0,5 l):500|1 Glas (0,3 l):300", "vegan gluten alcohol"],
  ["rotwein", "Rotwein", "Getr\xE4nke", 83, 0.1, 2.6, 0, 0, "1 Glas (0,2 l):200", "vegan alcohol"],
  // Gerichte (Schätzwerte)
  ["doener", "D\xF6ner Kebab (Brot, Fleisch, Salat, So\xDFe)", "Gerichte", 215, 11, 20, 10, 1.5, "1 D\xF6ner:400", "meat gluten milk estimate"],
  ["pizza-margherita", "Pizza Margherita", "Gerichte", 235, 9.5, 31, 8, 2, "1 Pizza:350|halbe Pizza:175", "vegetarian gluten milk estimate"],
  ["currywurst", "Currywurst mit So\xDFe", "Gerichte", 235, 10, 8, 18, 0.5, "1 Portion:200", "meat estimate"],
  ["spaghetti-bolo", "Spaghetti Bolognese", "Gerichte", 150, 7.5, 18, 5, 1.5, "1 Teller:400", "meat gluten estimate"],
  ["kartoffelsalat", "Kartoffelsalat (mit Mayonnaise)", "Gerichte", 150, 1.8, 13, 10, 1.5, "Portion:200", "vegetarian egg estimate"],
  ["chili-con-carne", "Chili con Carne", "Gerichte", 110, 8, 9, 4.5, 3, "1 Teller:350", "meat estimate"],
  ["gemuese-curry", "Gem\xFCsecurry mit Kokosmilch", "Gerichte", 95, 2.5, 7, 6.5, 2.5, "1 Teller:350", "vegan estimate"]
];
function toFood(r) {
  const [slug, name, category, kcal, protein, carbs, fat, fiber, servings, tags] = r;
  const tagList = tags.split(" ").filter(Boolean);
  return {
    ref: `builtin:${slug}`,
    name,
    brand: null,
    barcode: null,
    category,
    kcal_100: kcal,
    protein_100: protein,
    carbs_100: carbs,
    fat_100: fat,
    fiber_100: fiber,
    sugar_100: null,
    salt_100: null,
    servings: servings.split("|").filter(Boolean).map((s) => {
      const idx = s.lastIndexOf(":");
      return { label: s.slice(0, idx), grams: Number(s.slice(idx + 1)) };
    }),
    source: "builtin",
    is_estimate: tagList.includes("estimate"),
    tags: tagList.filter((t) => t !== "estimate")
  };
}
var FOODS = ROWS.map(toFood);
var FOOD_MAP = Object.fromEntries(FOODS.map((f) => [f.ref, f]));
var ALLERGEN_LABELS_DE = {
  gluten: "Gluten",
  milk: "Milch/Laktose",
  egg: "Ei",
  nuts: "Schalenfr\xFCchte (N\xFCsse)",
  peanuts: "Erdn\xFCsse",
  soy: "Soja",
  fish: "Fisch",
  crustaceans: "Krebstiere",
  sesame: "Sesam"
};
function foodWarnings(food, profile) {
  const tags = food.tags ?? [];
  const out = [];
  for (const a of [...profile.allergies, ...profile.intolerances]) {
    const key = a === "lactose" ? "milk" : a;
    if (tags.includes(key)) out.push(`Enth\xE4lt ${ALLERGEN_LABELS_DE[key] ?? a}`);
  }
  if (profile.diet_type === "vegan" && !tags.includes("vegan") && tags.length) out.push("Nicht vegan");
  if (profile.diet_type === "vegetarian" && (tags.includes("meat") || tags.includes("fish"))) out.push("Nicht vegetarisch");
  if (profile.diet_type === "pescetarian" && tags.includes("meat")) out.push("Enth\xE4lt Fleisch");
  return out;
}
function searchFoods(list, query, limit = 30) {
  const q = normalize(query);
  if (!q) return list.slice(0, limit);
  const words = q.split(" ").filter(Boolean);
  return list.map((f) => {
    const n = normalize(f.name);
    const hay = `${n} ${normalize(f.brand ?? "")} ${normalize(f.category ?? "")}`;
    let score = 0;
    if (n === q) score = 5;
    else if (n.startsWith(q)) score = 4;
    else if (n.split(" ").some((w) => w.startsWith(q))) score = 3;
    else if (hay.includes(q)) score = 2;
    else if (words.every((w) => hay.includes(w))) score = 1;
    return { f, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score || a.f.name.length - b.f.name.length).slice(0, limit).map((x) => x.f);
}

// src/nutrition/openFoodFacts.ts
var FIELDS = [
  "code",
  "product_name",
  "product_name_de",
  "generic_name_de",
  "brands",
  "nutriments",
  "serving_size",
  "serving_quantity",
  "allergens_tags",
  "labels_tags",
  "quantity"
].join(",");
var OFF_BASE = "https://world.openfoodfacts.org";
var OFF_USER_AGENT = "Gymolingo/0.1 (https://github.com/tobiaszimmermannai-debug/gymolingo)";
var num = (v) => {
  const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};
var ALLERGEN_MAP = {
  "en:gluten": "gluten",
  "en:milk": "milk",
  "en:eggs": "egg",
  "en:nuts": "nuts",
  "en:peanuts": "peanuts",
  "en:soybeans": "soy",
  "en:fish": "fish",
  "en:crustaceans": "crustaceans",
  "en:sesame-seeds": "sesame"
};
function parseOffProduct(p) {
  if (!p) return null;
  const n = p.nutriments ?? {};
  let kcal = num(n["energy-kcal_100g"]);
  const kj = num(n["energy-kj_100g"]) ?? num(n["energy_100g"]);
  if (kcal === null && kj !== null) kcal = Math.round(kj / 4.184);
  const protein = num(n["proteins_100g"]);
  const carbs = num(n["carbohydrates_100g"]);
  const fat = num(n["fat_100g"]);
  const name = (p.product_name_de || p.product_name || p.generic_name_de || "").trim();
  if (!name || kcal === null) return null;
  const incomplete = protein === null || carbs === null || fat === null;
  const servingQty = num(p.serving_quantity);
  const tags = [];
  for (const a of p.allergens_tags ?? []) if (ALLERGEN_MAP[a]) tags.push(ALLERGEN_MAP[a]);
  const labels = p.labels_tags ?? [];
  if (labels.includes("en:vegan")) tags.push("vegan");
  if (labels.includes("en:vegetarian")) tags.push("vegetarian");
  return {
    ref: `off:${p.code}`,
    name,
    brand: p.brands ? String(p.brands).split(",")[0].trim() : null,
    barcode: p.code ?? null,
    category: "Markenprodukt",
    kcal_100: Math.round(kcal),
    protein_100: protein ?? 0,
    carbs_100: carbs ?? 0,
    fat_100: fat ?? 0,
    fiber_100: num(n["fiber_100g"]),
    sugar_100: num(n["sugars_100g"]),
    salt_100: num(n["salt_100g"]),
    servings: servingQty && servingQty > 0 ? [{ label: `Portion (${p.serving_size ?? `${servingQty} g`})`, grams: servingQty }] : [],
    source: "off",
    // community-maintained data: flag incomplete entries as estimates
    is_estimate: incomplete,
    tags
  };
}
async function fetchOffProduct(barcode, fetchImpl) {
  const code = barcode.replace(/\D/g, "");
  if (code.length < 8) return null;
  const res = await fetchImpl(`${OFF_BASE}/api/v2/product/${code}.json?fields=${FIELDS}`, {
    headers: { "User-Agent": OFF_USER_AGENT }
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Open Food Facts: HTTP ${res.status}`);
  }
  const json = await res.json();
  if (json.status !== 1 && json.status !== "success") return null;
  return parseOffProduct(json.product);
}
async function searchOff(query, fetchImpl, pageSize = 20) {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=${pageSize}&lc=de&cc=de&fields=${FIELDS}`;
  const res = await fetchImpl(url, { headers: { "User-Agent": OFF_USER_AGENT } });
  if (!res.ok) throw new Error(`Open Food Facts: HTTP ${res.status}`);
  const json = await res.json();
  return (json.products ?? []).map(parseOffProduct).filter((x) => x !== null);
}
function isValidBarcode(code) {
  const digits = code.replace(/\D/g, "");
  if (![8, 12, 13, 14].includes(digits.length)) return false;
  const arr = digits.split("").map(Number);
  const check = arr.pop();
  const sum = arr.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - sum % 10) % 10 === check;
}

// src/training/oneRm.ts
var MAX_REPS_FOR_ESTIMATE = 15;
function effectiveRir(rir, rpe) {
  if (rir !== null && rir !== void 0 && !Number.isNaN(rir)) return Math.max(0, rir);
  if (rpe !== null && rpe !== void 0 && !Number.isNaN(rpe)) return Math.max(0, 10 - rpe);
  return null;
}
function estimate1RM(weight, reps, rir = 0) {
  if (weight <= 0 || reps <= 0) return 0;
  const r = Math.min(MAX_REPS_FOR_ESTIMATE, reps + Math.max(0, rir ?? 0));
  if (r <= 1) return weight;
  return weight * (1 + r / 30);
}
function weightForReps(oneRm, reps, rir = 0) {
  const r = Math.min(MAX_REPS_FOR_ESTIMATE, reps + Math.max(0, rir));
  if (r <= 1) return oneRm;
  return oneRm / (1 + r / 30);
}
function repsAtWeight(oneRm, weight, rir = 0) {
  if (weight <= 0) return MAX_REPS_FOR_ESTIMATE;
  if (weight >= oneRm) return weight > oneRm ? 0 : 1;
  const total = 30 * (oneRm / weight - 1);
  return Math.max(0, Math.floor(total + 1e-9) - Math.max(0, rir));
}
function roundToIncrement(weight, increment) {
  if (increment <= 0) return Math.round(weight * 10) / 10;
  const v = Math.round(weight / increment) * increment;
  return Math.round(v * 100) / 100;
}
function floorToIncrement(weight, increment) {
  if (increment <= 0) return Math.floor(weight * 10) / 10;
  const v = Math.floor(weight / increment + 1e-9) * increment;
  return Math.round(v * 100) / 100;
}

// src/training/progression.ts
var fmtKg = formatKg;
var repsStr = (r) => r.join("/");
function workingSets(sets) {
  return sets.filter((s) => s.set_type !== "warmup" && s.reps > 0);
}
function sessionE1RM(session) {
  return workingSets(session.sets).reduce(
    (best, s) => Math.max(best, estimate1RM(s.weight_kg, s.reps, effectiveRir(s.rir, s.rpe) ?? 0)),
    0
  );
}
function sessionPerformanceE1RM(session) {
  return workingSets(session.sets).reduce((best, s) => Math.max(best, estimate1RM(s.weight_kg, s.reps, 0)), 0);
}
function topSets(session) {
  const ws = workingSets(session.sets);
  const weight = ws.reduce((m, s) => Math.max(m, s.weight_kg), 0);
  return { weight, sets: ws.filter((s) => s.weight_kg === weight) };
}
function avg(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}
function detectPlateau(history) {
  if (history.length < 4) return false;
  const recent = history.slice(0, 3).map(sessionPerformanceE1RM);
  const before = history.slice(3, 8).map(sessionPerformanceE1RM);
  const bestBefore = Math.max(...before);
  const bestRecent = Math.max(...recent);
  if (bestBefore <= 0) return false;
  return bestRecent <= bestBefore * 1.01;
}
function suggestProgression(history, cfg) {
  const repMin = Math.max(1, Math.min(cfg.rep_min, cfg.rep_max));
  const repMax = Math.max(cfg.rep_min, cfg.rep_max);
  const nSets = Math.max(1, cfg.target_sets);
  const inc = cfg.increment_kg > 0 ? cfg.increment_kg : 2.5;
  const valid = history.filter((h) => workingSets(h.sets).length > 0);
  if (valid.length === 0) {
    return {
      kind: "first_time",
      weight_kg: 0,
      reps: Array(nSets).fill(repMin),
      rationale: cfg.is_bodyweight ? `Erstes Training: Mach so viele saubere Wiederholungen wie m\xF6glich (Ziel ${repMin}\u2013${repMax}) und lass ca. ${cfg.target_rir} Wdh. im Tank.` : `Erstes Training: W\xE4hle ein Gewicht, mit dem du ${repMin}\u2013${repMax} saubere Wiederholungen mit ca. ${cfg.target_rir} Wdh. Reserve schaffst. Die App lernt ab dem n\xE4chsten Training mit.`,
      plateau: false,
      last: null,
      e1rm: null
    };
  }
  const last = valid[0];
  const { weight, sets } = topSets(last);
  const reps = sets.map((s) => s.reps);
  const rirs = sets.map((s) => effectiveRir(s.rir, s.rpe)).filter((v) => v !== null);
  const avgRir = avg(rirs);
  const minReps = Math.min(...reps);
  const avgReps = avg(reps) ?? 0;
  const e1rm = sessionE1RM(last);
  const plateau = detectPlateau(valid);
  const lastInfo = { date: last.date, weight_kg: weight, reps, avgRir: avgRir === null ? null : Math.round(avgRir * 10) / 10 };
  const lastStr = `${fmtKg(weight)} \xD7 ${repsStr(reps)}${avgRir !== null ? ` (\xD8 RIR ${lastInfo.avgRir})` : ""}`;
  const enoughSets = sets.length >= nSets;
  const allAtTop = reps.every((r) => r >= repMax) && enoughSets;
  const padSets = (arr) => {
    const out = arr.slice(0, nSets);
    while (out.length < nSets) out.push(out.length ? out[out.length - 1] : repMin);
    return out;
  };
  if (cfg.is_bodyweight && weight === 0) {
    if (allAtTop && (avgRir === null || avgRir >= cfg.target_rir - 1)) {
      return {
        kind: "increase_weight",
        weight_kg: inc,
        reps: Array(nSets).fill(repMin),
        rationale: `Letztes Mal: ${repsStr(reps)} Wdh. \u2013 obere Grenze (${repMax}) in allen S\xE4tzen erreicht. Zeit f\xFCr Zusatzgewicht (+${fmtKg(inc)}) oder eine schwerere Variante.`,
        plateau,
        last: lastInfo,
        e1rm: null
      };
    }
    const target = progressReps(padSets(reps), repMax, avgRir, cfg.target_rir);
    return {
      kind: "increase_reps",
      weight_kg: 0,
      reps: target,
      rationale: `Letztes Mal: ${repsStr(reps)} Wdh. Ziel heute: ${repsStr(target)} \u2013 eine Wiederholung mehr in den schw\xE4cheren S\xE4tzen.`,
      plateau,
      last: lastInfo,
      e1rm: null
    };
  }
  if (plateau && valid.length >= 4) {
    const prev2 = valid.slice(1, 3).map(sessionPerformanceE1RM);
    const lastPerf = sessionPerformanceE1RM(last);
    const declining = prev2.every((p) => lastPerf < p * 0.995);
    if (declining) {
      const deloadWeight = floorToIncrement(weight * 0.9, inc);
      return {
        kind: "deload",
        weight_kg: deloadWeight,
        reps: Array(Math.max(1, nSets - 1)).fill(repMin),
        rationale: `Deine Leistung stagniert seit mehreren Einheiten und war zuletzt r\xFCckl\xE4ufig (${lastStr}). Empfehlung: eine leichtere Einheit mit ${fmtKg(deloadWeight)} (\u2248 \u221210 %) und einem Satz weniger. Pr\xFCfe auch Schlaf, Kalorien und Protein.`,
        plateau,
        last: lastInfo,
        e1rm: round1(e1rm)
      };
    }
  }
  if (allAtTop) {
    const effortOk = avgRir === null || avgRir >= cfg.target_rir - 1;
    const prevSame = valid[1] ? topSets(valid[1]) : null;
    const confirmedBefore = prevSame !== null && prevSame.weight === weight && prevSame.sets.length >= nSets && prevSame.sets.every((s) => s.reps >= repMax);
    if (effortOk || confirmedBefore) {
      const avgExtra = (avgRir ?? cfg.target_rir) - cfg.target_rir + (avgReps - repMax);
      let steps = avgExtra >= 3 ? 2 : 1;
      if (steps === 2 && weight + 2 * inc > weight * 1.1) steps = 1;
      const newWeight = round2(weight + steps * inc);
      const predicted = repsAtWeight(e1rm, newWeight, cfg.target_rir);
      const firstSet = clamp(predicted, repMin, repMax);
      const target = Array(nSets).fill(0).map((_, i) => clamp(firstSet - (i === nSets - 1 && nSets > 2 ? 1 : 0), repMin, repMax));
      return {
        kind: "increase_weight",
        weight_kg: newWeight,
        reps: target,
        rationale: `Letztes Mal: ${lastStr} \u2013 alle S\xE4tze am oberen Ende des Bereichs (${repMin}\u2013${repMax}). Gewicht um ${fmtKg(round2(newWeight - weight))} erh\xF6hen, Ziel ${repsStr(target)} Wdh.`,
        plateau,
        last: lastInfo,
        e1rm: round1(e1rm)
      };
    }
    return {
      kind: "hold",
      weight_kg: weight,
      reps: Array(nSets).fill(repMax),
      rationale: `Letztes Mal: ${lastStr} \u2013 oberes Ende erreicht, aber sehr nah am Muskelversagen. Best\xE4tige ${fmtKg(weight)} \xD7 ${repMax} mit etwas mehr Reserve, dann wird gesteigert.`,
      plateau,
      last: lastInfo,
      e1rm: round1(e1rm)
    };
  }
  if (minReps >= repMin) {
    const target = progressReps(padSets(reps), repMax, avgRir, cfg.target_rir);
    return {
      kind: "increase_reps",
      weight_kg: weight,
      reps: target,
      rationale: `Letztes Mal: ${lastStr}. Gewicht halten und Wiederholungen steigern: Ziel ${repsStr(target)}. Sobald alle S\xE4tze ${repMax} Wdh. erreichen, erh\xF6hst du das Gewicht.${plateau ? " Hinweis: Dein gesch\xE4tztes 1RM stagniert seit 3 Einheiten." : ""}`,
      plateau,
      last: lastInfo,
      e1rm: round1(e1rm)
    };
  }
  const prev = valid[1] ? topSets(valid[1]) : null;
  const prevAlsoBelow = prev !== null && prev.weight === weight && Math.min(...prev.sets.map((s) => s.reps)) < repMin;
  const farBelow = avgReps < repMin - 2;
  if (prevAlsoBelow && avgReps < repMin || farBelow) {
    let newWeight = floorToIncrement(
      Math.min(weight - inc, e1rm / (1 + Math.min(15, repMin + cfg.target_rir) / 30)),
      inc
    );
    newWeight = Math.max(inc, newWeight);
    if (newWeight >= weight) newWeight = Math.max(0, weight - inc);
    return {
      kind: "reduce_weight",
      weight_kg: newWeight,
      reps: Array(nSets).fill(repMin),
      rationale: `Letztes Mal: ${lastStr} \u2013 unter dem Zielbereich (${repMin}\u2013${repMax})${prevAlsoBelow ? " bereits zum zweiten Mal" : ""}. Mit ${fmtKg(newWeight)} schaffst du voraussichtlich ${repMin} saubere Wdh. und baust von dort wieder auf.`,
      plateau,
      last: lastInfo,
      e1rm: round1(e1rm)
    };
  }
  return {
    kind: "hold",
    weight_kg: weight,
    reps: Array(nSets).fill(repMin),
    rationale: `Letztes Mal: ${lastStr} \u2013 knapp unter dem Zielbereich. Gewicht halten und ${repMin} Wdh. in allen S\xE4tzen anpeilen. Ein einzelner schw\xE4cherer Tag ist normal.`,
    plateau,
    last: lastInfo,
    e1rm: round1(e1rm)
  };
}
function progressReps(reps, repMax, avgRir, targetRir) {
  const out = reps.map((r) => Math.min(r, repMax));
  if (out.length === 0) return out;
  const effortAllows = avgRir === null || avgRir >= targetRir;
  const allEqual = out.every((r) => r === out[0]);
  if (allEqual) {
    if (out[0] < repMax) out[0] += 1;
    if (effortAllows && avgRir !== null && avgRir >= targetRir + 1 && out.length > 1 && out[1] < repMax) out[1] += 1;
    return out;
  }
  const weakest = out.lastIndexOf(Math.min(...out));
  if (out[weakest] < repMax) out[weakest] += 1;
  if (effortAllows && weakest !== 0 && out[0] < repMax) out[0] += 1;
  return out;
}
var clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
var round1 = (n) => Math.round(n * 10) / 10;
var round2 = (n) => Math.round(n * 100) / 100;

// src/training/stats.ts
var isWorkingSet = (s) => !s.deleted && s.completed && s.set_type !== "warmup" && s.reps > 0;
function completedSessions(sessions) {
  return sessions.filter((s) => !s.deleted && s.status === "completed").sort((a, b) => a.started_at < b.started_at ? 1 : -1);
}
function exerciseHistory(exerciseId, sessions, sets, opts = {}) {
  const bySession = /* @__PURE__ */ new Map();
  for (const s of sets) {
    if (s.exercise_id !== exerciseId || !isWorkingSet(s)) continue;
    const arr = bySession.get(s.session_id) ?? [];
    arr.push(s);
    bySession.set(s.session_id, arr);
  }
  const out = [];
  for (const session of completedSessions(sessions)) {
    if (session.id === opts.excludeSessionId) continue;
    const ss = bySession.get(session.id);
    if (!ss?.length) continue;
    out.push({
      date: session.date,
      sets: ss.sort((a, b) => a.set_index - b.set_index).map((s) => ({ weight_kg: s.weight_kg, reps: s.reps, rir: s.rir, rpe: s.rpe, set_type: s.set_type }))
    });
    if (opts.limit && out.length >= opts.limit) break;
  }
  return out;
}
function lastPerformedSets(exerciseId, sessions, sets, excludeSessionId) {
  for (const session of completedSessions(sessions)) {
    if (session.id === excludeSessionId) continue;
    const ss = sets.filter((s) => s.session_id === session.id && s.exercise_id === exerciseId && !s.deleted && s.completed);
    if (ss.length) return ss.sort((a, b) => a.set_index - b.set_index);
  }
  return [];
}
function computePersonalRecords(sessions, sets) {
  const sessionMap = new Map(sessions.filter((s) => !s.deleted && s.status === "completed").map((s) => [s.id, s]));
  const chronological = sets.filter((s) => isWorkingSet(s) && sessionMap.has(s.session_id)).sort((a, b) => {
    const sa = sessionMap.get(a.session_id);
    const sb = sessionMap.get(b.session_id);
    if (sa.started_at !== sb.started_at) return sa.started_at < sb.started_at ? -1 : 1;
    return a.exercise_order - b.exercise_order || a.set_index - b.set_index;
  });
  const records = {};
  const events = [];
  const firstSession = /* @__PURE__ */ new Map();
  for (const s of chronological) {
    const session = sessionMap.get(s.session_id);
    const rec = records[s.exercise_id] ??= { exercise_id: s.exercise_id, maxWeight: null, bestE1RM: null, repsAtWeight: {} };
    if (!firstSession.has(s.exercise_id)) firstSession.set(s.exercise_id, s.session_id);
    const isFirstSession = firstSession.get(s.exercise_id) === s.session_id;
    const base = { exercise_id: s.exercise_id, weight_kg: s.weight_kg, reps: s.reps, date: session.date, session_id: s.session_id, set_id: s.id };
    const e1 = Math.round(estimate1RM(s.weight_kg, s.reps, 0) * 10) / 10;
    if (s.weight_kg > 0 && (!rec.maxWeight || s.weight_kg > rec.maxWeight.value)) {
      const r = { ...base, type: "weight", value: s.weight_kg };
      if (rec.maxWeight && !isFirstSession) events.push(r);
      rec.maxWeight = r;
    }
    if (e1 > 0 && (!rec.bestE1RM || e1 > rec.bestE1RM.value)) {
      const r = { ...base, type: "e1rm", value: e1 };
      if (rec.bestE1RM && !isFirstSession) events.push(r);
      rec.bestE1RM = r;
    }
    const key = String(s.weight_kg);
    const prev = rec.repsAtWeight[key];
    if (!prev || s.reps > prev.value) {
      const r = { ...base, type: "reps", value: s.reps };
      if (prev && !isFirstSession) events.push(r);
      rec.repsAtWeight[key] = r;
    }
  }
  return { records, events };
}
function sessionPRs(sessionId, sessions, sets) {
  const { events } = computePersonalRecords(sessions, sets);
  const best = /* @__PURE__ */ new Map();
  for (const e of events) {
    if (e.session_id !== sessionId) continue;
    const k = `${e.exercise_id}:${e.type}`;
    const cur = best.get(k);
    if (!cur || e.value > cur.value) best.set(k, e);
  }
  return [...best.values()];
}
function setVolume(s) {
  return Math.max(0, s.weight_kg) * Math.max(0, s.reps);
}
function sessionDurationSec(session, now = /* @__PURE__ */ new Date()) {
  const start = new Date(session.started_at).getTime();
  const end = session.ended_at ? new Date(session.ended_at).getTime() : now.getTime();
  let paused = session.paused_seconds || 0;
  if (session.status === "paused" && session.paused_at) paused += (now.getTime() - new Date(session.paused_at).getTime()) / 1e3;
  return Math.max(0, Math.round((end - start) / 1e3 - paused));
}
function summarizeSession(session, sets, prCount = 0) {
  const ss = sets.filter((s) => s.session_id === session.id && isWorkingSet(s));
  return {
    session_id: session.id,
    date: session.date,
    name: session.name,
    durationSec: sessionDurationSec(session),
    volumeKg: Math.round(ss.reduce((a, s) => a + setVolume(s), 0)),
    workingSets: ss.length,
    exercises: new Set(ss.map((s) => s.exercise_id)).size,
    prs: prCount
  };
}
function setsPerMuscle(sets, sessions, exerciseLookup, from, to) {
  const sessionDates = new Map(
    sessions.filter((s) => !s.deleted && s.status === "completed").map((s) => [s.id, s.date])
  );
  const out = {};
  for (const s of sets) {
    if (!isWorkingSet(s)) continue;
    const d = sessionDates.get(s.session_id);
    if (!d || d < from || d > to) continue;
    const ex2 = exerciseLookup(s.exercise_id);
    if (!ex2) continue;
    out[ex2.primary_muscle] = (out[ex2.primary_muscle] ?? 0) + 1;
    for (const m of ex2.secondary_muscles) out[m] = (out[m] ?? 0) + 0.5;
  }
  return out;
}
function volumeSeries(sessions, sets, from, to, bucket) {
  const done = completedSessions(sessions).filter((s) => s.date >= from && s.date <= to);
  const map = /* @__PURE__ */ new Map();
  const keyOf = (d) => bucket === "week" ? startOfWeek(d) : d;
  let cur = keyOf(from);
  while (cur <= to) {
    map.set(cur, { date: cur, volumeKg: 0, sets: 0, sessions: 0 });
    cur = addDays(cur, bucket === "week" ? 7 : 1);
  }
  const setsBySession = /* @__PURE__ */ new Map();
  for (const s of sets) {
    if (!isWorkingSet(s)) continue;
    const arr = setsBySession.get(s.session_id) ?? [];
    arr.push(s);
    setsBySession.set(s.session_id, arr);
  }
  for (const session of done) {
    const k = keyOf(session.date);
    const p = map.get(k) ?? { date: k, volumeKg: 0, sets: 0, sessions: 0 };
    const ss = setsBySession.get(session.id) ?? [];
    p.volumeKg += ss.reduce((a, s) => a + setVolume(s), 0);
    p.sets += ss.length;
    p.sessions += 1;
    map.set(k, p);
  }
  return [...map.values()].sort((a, b) => a.date < b.date ? -1 : 1).map((p) => ({ ...p, volumeKg: Math.round(p.volumeKg) }));
}
function e1rmSeries(exerciseId, sessions, sets) {
  const hist = exerciseHistory(exerciseId, sessions, sets);
  return hist.map((h) => ({
    date: h.date,
    e1rm: Math.round(h.sets.reduce((m, s) => Math.max(m, estimate1RM(s.weight_kg, s.reps, 0)), 0) * 10) / 10,
    topWeight: h.sets.reduce((m, s) => Math.max(m, s.weight_kg), 0)
  })).reverse();
}
function mostTrainedExercises(sets, limit = 5) {
  const count = /* @__PURE__ */ new Map();
  for (const s of sets) if (isWorkingSet(s)) count.set(s.exercise_id, (count.get(s.exercise_id) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
}
function strengthChange(sessions, sets, cur, prev) {
  const sessionDates = new Map(sessions.filter((s) => !s.deleted && s.status === "completed").map((s) => [s.id, s.date]));
  const medianOfSessionBests = (from, to) => {
    const perSession = /* @__PURE__ */ new Map();
    for (const s of sets) {
      if (!isWorkingSet(s)) continue;
      const d = sessionDates.get(s.session_id);
      if (!d || d < from || d > to) continue;
      const v = estimate1RM(s.weight_kg, s.reps, 0);
      const m = perSession.get(s.exercise_id) ?? /* @__PURE__ */ new Map();
      if (v > (m.get(s.session_id) ?? 0)) m.set(s.session_id, v);
      perSession.set(s.exercise_id, m);
    }
    const out = /* @__PURE__ */ new Map();
    for (const [id, m] of perSession) {
      const vals = [...m.values()].sort((a2, b2) => a2 - b2);
      const mid = Math.floor(vals.length / 2);
      out.set(id, vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2);
    }
    return out;
  };
  const a = medianOfSessionBests(prev.from, prev.to);
  const b = medianOfSessionBests(cur.from, cur.to);
  const exercises = [];
  for (const [id, p] of a) {
    const c = b.get(id);
    if (c && p > 0) exercises.push({ exercise_id: id, prev: Math.round(p * 10) / 10, cur: Math.round(c * 10) / 10, pct: Math.round((c - p) / p * 1e3) / 10 });
  }
  if (!exercises.length) return { pct: null, exercises };
  const pct = Math.round(exercises.reduce((s, e) => s + e.pct, 0) / exercises.length * 10) / 10;
  return { pct, exercises: exercises.sort((x, y) => y.pct - x.pct) };
}

// src/body/trend.ts
function dailyWeights(entries) {
  const byDate = /* @__PURE__ */ new Map();
  for (const e of entries) {
    if (e.deleted || !(e.weight_kg > 0)) continue;
    const cur = byDate.get(e.date);
    if (!cur || cur.updated_at < e.updated_at) byDate.set(e.date, e);
  }
  return [...byDate.values()].sort((a, b) => a.date < b.date ? -1 : 1).map((e) => ({ date: e.date, weight: e.weight_kg }));
}
function dailyBodyFat(entries) {
  const byDate = /* @__PURE__ */ new Map();
  for (const e of entries) {
    if (e.deleted || e.body_fat_pct === null || e.body_fat_pct === void 0) continue;
    const cur = byDate.get(e.date);
    if (!cur || cur.updated_at < e.updated_at) byDate.set(e.date, e);
  }
  return [...byDate.values()].sort((a, b) => a.date < b.date ? -1 : 1).map((e) => ({ date: e.date, value: e.body_fat_pct }));
}
function movingAverage(points, windowDays = 7) {
  if (!points.length) return [];
  const out = [];
  const first = points[0].date;
  const last = points[points.length - 1].date;
  const map = new Map(points.map((p) => [p.date, p.weight]));
  for (const d of dateRange(first, last)) {
    const window = dateRange(addDays(d, -(windowDays - 1)), d).map((x) => map.get(x)).filter((x) => x !== void 0);
    if (window.length && map.has(d)) {
      out.push({ date: d, weight: Math.round(window.reduce((a, b) => a + b, 0) / window.length * 100) / 100 });
    }
  }
  return out;
}
function smoothedTrend(points, alpha = 0.1) {
  const out = [];
  let trend = null;
  let lastDate = null;
  for (const p of points) {
    if (trend === null || lastDate === null) {
      trend = p.weight;
    } else {
      const gap = Math.max(1, diffDays(lastDate, p.date));
      const a = 1 - Math.pow(1 - alpha, gap);
      trend = trend + a * (p.weight - trend);
    }
    lastDate = p.date;
    out.push({ date: p.date, weight: Math.round(trend * 100) / 100 });
  }
  return out;
}
function linearSlope(points) {
  if (points.length < 2) return null;
  const x0 = points[0].date;
  const xs = points.map((p) => diffDays(x0, p.date));
  const ys = points.map((p) => p.weight);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num2 = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num2 += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (den === 0) return null;
  return num2 / den;
}
function weightSummary(entries, today) {
  const pts = dailyWeights(entries);
  const inRange = (from, to) => pts.filter((p) => p.date >= from && p.date <= to);
  const mean = (arr) => arr.length ? Math.round(arr.reduce((a, p) => a + p.weight, 0) / arr.length * 100) / 100 : null;
  const last7 = inRange(addDays(today, -6), today);
  const prev7 = inRange(addDays(today, -13), addDays(today, -7));
  const last30 = inRange(addDays(today, -29), today);
  const span = last30.length >= 2 ? diffDays(last30[0].date, last30[last30.length - 1].date) : 0;
  const slope = span >= 13 && last30.length >= 4 ? linearSlope(last30) : null;
  return {
    latest: pts.length ? pts[pts.length - 1] : null,
    avg7: mean(last7),
    avg7Prev: mean(prev7),
    weeklyRate30: slope === null ? null : Math.round(slope * 7 * 100) / 100,
    change30: last30.length >= 2 ? Math.round((last30[last30.length - 1].weight - last30[0].weight) * 100) / 100 : null,
    daysLogged30: last30.length,
    trend: smoothedTrend(pts)
  };
}
function bmi(weightKg, heightCm) {
  return Math.round(weightKg / Math.pow(heightCm / 100, 2) * 10) / 10;
}

// src/body/bodyFat.ts
function navyBodyFat(i) {
  const { sex, height_cm: h, waist_cm: w, neck_cm: n } = i;
  if (!h || !w || !n || h < 120 || h > 230) return null;
  let pct;
  if (sex === "male") {
    if (w - n <= 0) return null;
    pct = 495 / (1.0324 - 0.19077 * Math.log10(w - n) + 0.15456 * Math.log10(h)) - 450;
  } else if (sex === "female") {
    const hip = i.hips_cm;
    if (!hip || w + hip - n <= 0) return null;
    pct = 495 / (1.29579 - 0.35004 * Math.log10(w + hip - n) + 0.221 * Math.log10(h)) - 450;
  } else return null;
  if (!Number.isFinite(pct)) return null;
  return Math.round(Math.min(60, Math.max(2, pct)) * 10) / 10;
}
function navyRequiredFields(sex) {
  return sex === "female" ? ["waist_cm", "neck_cm", "hips_cm"] : ["waist_cm", "neck_cm"];
}
function latestNavyBodyFat(measurements, sex, heightCm) {
  const need = navyRequiredFields(sex);
  const m = [...measurements].filter((x) => !x.deleted && need.every((f) => x[f] != null)).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!m) return null;
  const pct = navyBodyFat({ sex, height_cm: heightCm, waist_cm: m.waist_cm, neck_cm: m.neck_cm, hips_cm: m.hips_cm });
  return pct === null ? null : { date: m.date, pct };
}

// src/streaks/streaks.ts
var STREAK_LABELS_DE = {
  training: "Trainingstreue",
  nutrition: "Ern\xE4hrungstracking",
  protein: "Proteinziel",
  steps: "Schrittziel",
  checkin: "T\xE4glicher Check-in",
  weight: "Gewichtstracking"
};
function isPaused(date, pauses) {
  return pauses.some((p) => date >= p.start_date && date <= p.end_date);
}
function computeDailyStreak(kind, doneDates, input) {
  const { today, since, pauses, jokersPerMonth } = input;
  let run = 0;
  let best = 0;
  const jokersUsed = /* @__PURE__ */ new Map();
  const jokerDates = [];
  let first = since;
  for (const d of doneDates) if (d < first) first = d;
  for (const d of dateRange(first, today)) {
    if (isPaused(d, pauses)) continue;
    if (doneDates.has(d)) {
      run += 1;
      best = Math.max(best, run);
      continue;
    }
    if (d === today) break;
    const month = d.slice(0, 7);
    const used = jokersUsed.get(month) ?? 0;
    if (run > 0 && used < jokersPerMonth) {
      jokersUsed.set(month, used + 1);
      jokerDates.push(d);
      continue;
    }
    run = 0;
  }
  const todayDone = doneDates.has(today);
  const paused = isPaused(today, pauses);
  return {
    kind,
    current: run,
    best,
    todayDone,
    atRisk: run > 0 && !todayDone && !paused,
    jokersLeftThisMonth: Math.max(0, jokersPerMonth - (jokersUsed.get(today.slice(0, 7)) ?? 0)),
    paused,
    jokerDates
  };
}
function weeklyQuota(schedule, activeDays) {
  if (schedule.type === "fixed_days") {
    return activeDays.filter((d) => schedule.weekdays.includes(weekdayIndex(d))).length;
  }
  return Math.round(Math.max(0, schedule.perWeek) * activeDays.length / 7);
}
function computeTrainingStreak(input) {
  const { today, since, pauses, schedule, trainedDates: trainedDates2 } = input;
  let run = 0;
  let best = 0;
  let weekDone = 0;
  let weekQuota = 0;
  let trainingNeededToday = false;
  let first = since;
  for (const d of trainedDates2) if (d < first) first = d;
  let weekStart = startOfWeek(first);
  while (weekStart <= today) {
    const days = dateRange(weekStart, addDays(weekStart, 6));
    const active = days.filter((d) => d >= first && !isPaused(d, pauses));
    const quota = weeklyQuota(schedule, active);
    let done = 0;
    for (const d of days) {
      if (d > today) break;
      if (d < first || isPaused(d, pauses)) continue;
      const trained = trainedDates2.has(d);
      if (trained) done += 1;
      const remainingAfter = active.filter((x) => x > d).length;
      const feasible = done + remainingAfter >= quota;
      if (d === today) {
        weekDone = done;
        weekQuota = quota;
        if (trained || feasible) {
          run += 1;
        } else if (done + remainingAfter + 1 >= quota) {
          trainingNeededToday = true;
        } else {
          run = 0;
        }
        best = Math.max(best, run);
        break;
      }
      if (trained || feasible) {
        run += 1;
      } else {
        run = 0;
      }
      best = Math.max(best, run);
    }
    weekStart = addDays(weekStart, 7);
  }
  const paused = isPaused(today, pauses);
  return {
    kind: "training",
    current: run,
    best,
    todayDone: trainedDates2.has(today),
    atRisk: run > 0 && trainingNeededToday && !paused,
    jokersLeftThisMonth: 0,
    paused,
    jokerDates: [],
    weekDone,
    weekQuota,
    trainingNeededToday
  };
}
function computeAllStreaks(input) {
  const common = { today: input.today, since: input.since, pauses: input.pauses, jokersPerMonth: input.jokersPerMonth };
  const training = computeTrainingStreak(input);
  const res = {
    training,
    nutrition: computeDailyStreak("nutrition", input.nutritionDates, common),
    protein: computeDailyStreak("protein", input.proteinDates, common),
    steps: computeDailyStreak("steps", input.stepsDates, common),
    checkin: computeDailyStreak("checkin", input.checkinDates, common),
    weight: input.weightTrackingEnabled ? computeDailyStreak("weight", input.weightDates, common) : { kind: "weight", current: 0, best: 0, todayDone: false, atRisk: false, jokersLeftThisMonth: 0, paused: false, jokerDates: [] }
  };
  return res;
}
function isPlannedTrainingDay(schedule, date) {
  if (schedule.type === "fixed_days") return schedule.weekdays.includes(weekdayIndex(date));
  const n = Math.max(0, Math.min(7, schedule.perWeek));
  const suggested = suggestedWeekdays(n);
  return suggested.includes(weekdayIndex(date));
}
function suggestedWeekdays(n) {
  const presets = {
    0: [],
    1: [2],
    2: [0, 3],
    3: [0, 2, 4],
    4: [0, 1, 3, 4],
    5: [0, 1, 2, 3, 4],
    6: [0, 1, 2, 3, 4, 5],
    7: [0, 1, 2, 3, 4, 5, 6]
  };
  return presets[Math.max(0, Math.min(7, Math.round(n)))];
}
var STREAK_MILESTONES = [7, 30, 60, 100, 180, 365];
function nextMilestone(current) {
  return STREAK_MILESTONES.find((m) => m > current) ?? null;
}

// src/gamification/xp.ts
var XP_RULES = {
  workout: 50,
  cardio: 30,
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
  challenge: 100
};
function xpForDay(a) {
  let xp = 0;
  xp += Math.min(a.workouts, 2) * XP_RULES.workout;
  xp += Math.min(a.cardio ?? 0, 2) * XP_RULES.cardio;
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
function xpForLevel(level) {
  if (level <= 1) return 0;
  return Math.round(150 * Math.pow(level - 1, 1.6));
}
var LEVEL_TITLES = [
  [1, "Neuling"],
  [5, "Einsteiger"],
  [10, "Stammgast"],
  [15, "Athlet"],
  [20, "Fortgeschritten"],
  [30, "Eisenherz"],
  [40, "Profi"],
  [50, "Legende"]
];
function levelFromXp(xp) {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const cur = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const title = [...LEVEL_TITLES].reverse().find(([l]) => level >= l)?.[1] ?? "Neuling";
  return { level, xp, currentLevelXp: cur, nextLevelXp: next, progress: (xp - cur) / (next - cur), title };
}
var streakBadges = ["training", "nutrition", "protein", "steps", "checkin", "weight"].flatMap(
  (kind) => [7, 30, 60, 100].map((m) => ({
    id: `streak-${kind}-${m}`,
    title: `${m} Tage ${STREAK_LABELS_DE[kind]}`,
    description: `Erreiche eine Serie von ${m} Tagen: ${STREAK_LABELS_DE[kind]}.`,
    icon: m >= 100 ? "\u{1F48E}" : m >= 60 ? "\u{1F3C6}" : m >= 30 ? "\u{1F525}" : "\u26A1",
    category: "streak",
    check: (s) => (s.bestStreaks[kind] ?? 0) >= m
  }))
);
var BADGES = [
  { id: "first-workout", title: "Erster Schritt", description: "Dein erstes Training abgeschlossen.", icon: "\u{1F3CB}\uFE0F", category: "training", check: (s) => s.totalWorkouts >= 1 },
  { id: "workouts-10", title: "Dranbleiber", description: "10 Trainings abgeschlossen.", icon: "\u{1F4AA}", category: "training", check: (s) => s.totalWorkouts >= 10 },
  { id: "workouts-50", title: "Gewohnheitstier", description: "50 Trainings abgeschlossen.", icon: "\u{1F9BE}", category: "training", check: (s) => s.totalWorkouts >= 50 },
  { id: "workouts-100", title: "Hundertschaft", description: "100 Trainings abgeschlossen.", icon: "\u{1F3C5}", category: "training", check: (s) => s.totalWorkouts >= 100 },
  { id: "first-pr", title: "Rekordj\xE4ger", description: "Deinen ersten pers\xF6nlichen Rekord aufgestellt.", icon: "\u{1F3AF}", category: "training", check: (s) => s.totalPRs >= 1 },
  { id: "prs-25", title: "Rekordmaschine", description: "25 pers\xF6nliche Rekorde.", icon: "\u{1F680}", category: "training", check: (s) => s.totalPRs >= 25 },
  { id: "volume-100t", title: "100 Tonnen", description: "Insgesamt 100.000 kg bewegt.", icon: "\u{1F3D7}\uFE0F", category: "training", check: (s) => s.totalVolumeKg >= 1e5 },
  { id: "volume-1000t", title: "Tausend Tonnen", description: "Insgesamt 1.000.000 kg bewegt.", icon: "\u{1F30B}", category: "training", check: (s) => s.totalVolumeKg >= 1e6 },
  { id: "early-bird", title: "Fr\xFChaufsteher", description: "5 Trainings vor 8 Uhr gestartet.", icon: "\u{1F305}", category: "training", check: (s) => s.earlyWorkouts >= 5 },
  { id: "nutrition-7", title: "Buchhalter", description: "7 Tage Ern\xE4hrung vollst\xE4ndig getrackt.", icon: "\u{1F4D2}", category: "nutrition", check: (s) => s.nutritionDays >= 7 },
  { id: "nutrition-50", title: "Makro-Meister", description: "50 Tage Ern\xE4hrung getrackt.", icon: "\u{1F957}", category: "nutrition", check: (s) => s.nutritionDays >= 50 },
  { id: "protein-10", title: "Proteinprofi", description: "An 10 Tagen das Proteinziel erreicht.", icon: "\u{1F969}", category: "nutrition", check: (s) => s.proteinDays >= 10 },
  { id: "protein-50", title: "Protein-Legende", description: "An 50 Tagen das Proteinziel erreicht.", icon: "\u{1F357}", category: "nutrition", check: (s) => s.proteinDays >= 50 },
  { id: "steps-10", title: "Spazierg\xE4nger", description: "An 10 Tagen das Schrittziel erreicht.", icon: "\u{1F45F}", category: "steps", check: (s) => s.stepGoalDays >= 10 },
  { id: "steps-20k", title: "Marathon-Tag", description: "Mehr als 20.000 Schritte an einem Tag.", icon: "\u{1F3C3}", category: "steps", check: (s) => s.maxStepsDay >= 2e4 },
  { id: "checkin-30", title: "Reflektiert", description: "30 t\xE4gliche Check-ins.", icon: "\u{1F9D8}", category: "body", check: (s) => s.checkins >= 30 },
  { id: "weighin-30", title: "Datenfreund", description: "30 Mal gewogen.", icon: "\u2696\uFE0F", category: "body", check: (s) => s.weighIns >= 30 },
  { id: "level-10", title: "Level 10", description: "Level 10 erreicht.", icon: "\u2B50", category: "level", check: (s) => s.level >= 10 },
  { id: "level-25", title: "Level 25", description: "Level 25 erreicht.", icon: "\u{1F31F}", category: "level", check: (s) => s.level >= 25 },
  { id: "challenge-1", title: "Herausforderer", description: "Erste Wochen-Challenge geschafft.", icon: "\u{1F396}\uFE0F", category: "level", check: (s) => s.challengesCompleted >= 1 },
  { id: "challenge-10", title: "Challenge-Champion", description: "10 Wochen-Challenges geschafft.", icon: "\u{1F451}", category: "level", check: (s) => s.challengesCompleted >= 10 },
  { id: "friend-1", title: "Trainingspartner", description: "Ersten Freund hinzugef\xFCgt.", icon: "\u{1F91D}", category: "community", check: (s) => s.friends >= 1 },
  ...streakBadges
];
var BADGE_MAP = Object.fromEntries(BADGES.map(({ check: _c, ...b }) => [b.id, b]));
function earnedBadgeIds(stats) {
  return BADGES.filter((b) => b.check(stats)).map((b) => b.id);
}
var CHALLENGE_TEMPLATES = {
  workouts: (t) => ({ title: "Plan erf\xFCllt", description: `Absolviere ${Math.max(1, t.plannedWorkouts)} Trainings diese Woche.`, target: Math.max(1, t.plannedWorkouts) }),
  protein_days: () => ({ title: "Protein-Woche", description: "Erreiche an 5 Tagen dein Proteinziel.", target: 5 }),
  nutrition_days: () => ({ title: "Tracking-Profi", description: "Tracke an 6 Tagen deine Ern\xE4hrung.", target: 6 }),
  steps_total: (t) => ({ title: "Schritt f\xFCr Schritt", description: `Sammle ${Math.round(t.stepTarget * 6 / 1e3) * 1e3} Schritte diese Woche.`, target: Math.round(t.stepTarget * 6 / 1e3) * 1e3 }),
  step_goal_days: () => ({ title: "Aktiv-Woche", description: "Erreiche an 5 Tagen dein Schrittziel.", target: 5 }),
  checkins: () => ({ title: "Achtsam", description: "Mache an 6 Tagen deinen Abend-Check-in.", target: 6 }),
  sets: (t) => ({ title: "Volumen-Woche", description: `Absolviere ${Math.max(20, t.plannedWorkouts * 15)} Arbeitss\xE4tze.`, target: Math.max(20, t.plannedWorkouts * 15) })
};
function weeklyChallenges(weekStartDate, activities, targets) {
  const ws = startOfWeek(weekStartDate);
  const we = endOfWeek(ws);
  const { week, year } = isoWeekNumber(ws);
  const pool = ["protein_days", "nutrition_days", "steps_total", "step_goal_days", "checkins", "sets"];
  const seed = (year * 53 + week) % pool.length;
  const picks = ["workouts", pool[seed], pool[(seed + 3) % pool.length]];
  const inWeek = activities.filter((a) => a.date >= ws && a.date <= we);
  const progressOf = (m) => {
    switch (m) {
      case "workouts":
        return inWeek.reduce((s, a) => s + a.workouts, 0);
      case "protein_days":
        return inWeek.filter((a) => a.proteinHit).length;
      case "nutrition_days":
        return inWeek.filter((a) => a.nutritionLogged).length;
      case "steps_total":
        return inWeek.reduce((s, a) => s + a.steps, 0);
      case "step_goal_days":
        return inWeek.filter((a) => a.stepsHit).length;
      case "checkins":
        return inWeek.filter((a) => a.checkin).length;
      case "sets":
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
      xp: XP_RULES.challenge
    };
  });
}
function summarizeGamification(activities, today, targets, firstDate) {
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
  const start = firstDate ?? (activities.length ? activities.reduce((m, a) => a.date < m ? a.date : m, today) : today);
  let week = startOfWeek(start);
  let current = [];
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
function emptyActivity(date) {
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
    cardio: 0,
    cardioKcal: 0
  };
}
function bestStreaksFrom(results) {
  return Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v.best]));
}

// src/reminders/engine.ts
var DEFAULT_REMINDER_SETTINGS = {
  enabled: true,
  morning_enabled: true,
  morning_time: "07:30",
  pre_workout_enabled: true,
  pre_workout_minutes: 60,
  post_workout_enabled: true,
  evening_enabled: true,
  evening_time: "20:30",
  weight_enabled: true,
  weight_time: "07:00",
  nutrition_enabled: true,
  streak_enabled: true,
  weekly_report_enabled: true,
  quiet_start: "22:00",
  quiet_end: "07:00",
  max_per_day: 5,
  intensity: "normal"
};
function isQuiet(min, quietStart, quietEnd) {
  const s = timeToMinutes(quietStart);
  const e = timeToMinutes(quietEnd);
  if (s === e) return false;
  return s < e ? min >= s && min < e : min >= s || min < e;
}
function pick(arr, seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = h * 31 + seed.charCodeAt(i) >>> 0;
  return arr[h % arr.length];
}
var MOTIVATION = [
  "Kleine Schritte, jeden Tag \u2013 genau so entsteht Fortschritt.",
  "Konstanz schl\xE4gt Perfektion. Du bist dran!",
  "Dein zuk\xFCnftiges Ich wird dir danken.",
  "Heute z\xE4hlt. Nicht perfekt, sondern gemacht.",
  "Jede Wiederholung ist eine Investition in dich.",
  "Stark wird man durch Gewohnheiten, nicht durch Zufall."
];
function planRemindersForDay(settings, st, nowMin) {
  if (!settings.enabled) return [];
  const out = [];
  const add = (r) => {
    const { minutes, ...rest } = r;
    out.push({ ...rest, time: minutesToTime(minutes), id: `${st.date}:${r.category}:${r.tier}`, date: st.date });
  };
  const name = st.displayName ? `, ${st.displayName}` : "";
  const kcal = formatNumberDE(st.calorieTarget, 0);
  const protein = formatNumberDE(st.proteinTarget, 0);
  if (settings.morning_enabled && !st.paused) {
    const training = st.isTrainingDay && !st.workoutDone ? `Heute: ${st.plannedWorkoutName ?? "Training"}.` : "Heute ist Ruhetag \u2013 Regeneration geh\xF6rt zum Plan.";
    const challenges = st.openChallenges.length ? ` Wochenziel: ${st.openChallenges[0]}.` : "";
    add({
      category: "morning",
      tier: 1,
      minutes: timeToMinutes(settings.morning_time),
      title: `Guten Morgen${name}! \u2600\uFE0F`,
      body: `${training} Ziel: ${kcal} kcal \xB7 ${protein} g Protein.${challenges} ${pick(MOTIVATION, st.date)}`.trim(),
      route: "/",
      priority: 6
    });
  }
  if (settings.weight_enabled && st.weightTrackingEnabled && !st.weighed && !st.paused) {
    add({
      category: "weight",
      tier: 1,
      minutes: timeToMinutes(settings.weight_time),
      title: "Kurz auf die Waage? \u2696\uFE0F",
      body: "Morgens nach dem Aufstehen ist dein Gewicht am besten vergleichbar. Einzelwerte schwanken \u2013 der Trend z\xE4hlt.",
      route: "/body/weight",
      priority: 3
    });
  }
  if (settings.nutrition_enabled && st.mealsLogged === 0 && !st.paused) {
    add({
      category: "nutrition",
      tier: 1,
      minutes: 14 * 60,
      title: "Schon etwas gegessen? \u{1F37D}\uFE0F",
      body: "Trag deine ersten Mahlzeiten ein \u2013 dann wei\xDFt du jederzeit, wie viel Protein und Kalorien noch offen sind.",
      route: "/nutrition",
      priority: 4
    });
  }
  if (settings.pre_workout_enabled && st.isTrainingDay && !st.workoutDone && st.activeWorkoutStartedMin === null && !st.paused) {
    const t = timeToMinutes(st.preferredWorkoutTime) - Math.max(0, settings.pre_workout_minutes);
    add({
      category: "pre_workout",
      tier: 1,
      minutes: Math.max(0, t),
      title: `Gleich geht's los: ${st.plannedWorkoutName ?? "Training"} \u{1F4AA}`,
      body: st.workoutHint ?? "Deine Zielgewichte sind vorbereitet. Viel Erfolg!",
      route: "/training",
      priority: 7
    });
  }
  if (settings.post_workout_enabled && st.activeWorkoutStartedMin !== null) {
    add({
      category: "post_workout",
      tier: 1,
      minutes: st.activeWorkoutStartedMin + 120,
      title: "Training noch offen \u{1F3C1}",
      body: "Schlie\xDFe dein Training ab, damit Leistung und neue Rekorde gespeichert werden.",
      route: "/workout/active",
      priority: 8
    });
  }
  if (settings.nutrition_enabled && st.mealsLogged > 0 && st.proteinRemaining >= 25 && !st.paused) {
    add({
      category: "protein",
      tier: 1,
      minutes: Math.max(timeToMinutes(settings.evening_time) - 120, 17 * 60),
      title: `Noch ${formatNumberDE(st.proteinRemaining, 0)} g Protein offen \u{1F95B}`,
      body: proteinIdea(st.proteinRemaining),
      route: "/nutrition",
      priority: 5
    });
  }
  const eveningOpen = !st.checkinDone || !st.stepsLogged;
  if (settings.evening_enabled && eveningOpen && !st.paused) {
    const base = timeToMinutes(settings.evening_time);
    const tiers = settings.intensity === "gentle" ? 1 : settings.intensity === "normal" ? 2 : 3;
    const offsets = [0, 60, 105];
    const quietStart = timeToMinutes(settings.quiet_start);
    const streakTxt = settings.streak_enabled && st.streakAtRisk && st.streakAtRisk.days >= 2 ? ` Deine ${st.streakAtRisk.days}-Tage-Serie (${st.streakAtRisk.label}) l\xE4uft weiter, wenn du heute abschlie\xDFt.` : "";
    const mealsTxt = settings.nutrition_enabled && st.mealsLogged < 2 ? " Falls noch Mahlzeiten fehlen, kannst du sie dabei nachtragen." : "";
    const bodies = [
      `Wie viele Schritte hattest du heute? Dein Tagesabschluss dauert nur 30 Sekunden.${mealsTxt}${streakTxt}`,
      `Kurzer Check-in? Schritte eintragen, Tag abschlie\xDFen \u2013 fertig.${streakTxt}`,
      `Letzte Erinnerung f\xFCr heute: 30 Sekunden f\xFCr deinen Tagesabschluss, danach ist Ruhe. \u{1F634}`
    ];
    const titles = ["Tagesabschluss \u{1F319}", "Noch 1 Minute f\xFCr dich? \u2728", "Letzte Erinnerung heute \u{1F319}"];
    let lastMin = -Infinity;
    for (let i = 0; i < tiers; i++) {
      const latest = quietStart > base ? quietStart - 10 : 1439;
      const m = Math.min(base + offsets[i], latest);
      if (m - lastMin < 20) continue;
      lastMin = m;
      add({
        category: "evening",
        tier: i + 1,
        minutes: m,
        title: titles[i],
        body: bodies[i],
        route: "/checkin",
        priority: i === 0 ? 9 : 5 - i
      });
    }
  }
  if (settings.weekly_report_enabled && st.isWeeklyReportDay) {
    add({
      category: "weekly_report",
      tier: 1,
      minutes: Math.max(0, timeToMinutes(settings.evening_time) - 150),
      title: "Dein Wochenbericht ist da \u{1F4CA}",
      body: "Kraft, Ern\xE4hrung, Gewichtstrend und 3 konkrete Empfehlungen f\xFCr n\xE4chste Woche.",
      route: "/coach/report",
      priority: 4
    });
  }
  let result = out.filter((r) => !isQuiet(timeToMinutes(r.time), settings.quiet_start, settings.quiet_end));
  if (nowMin !== null) result = result.filter((r) => timeToMinutes(r.time) > nowMin);
  const max = Math.max(0, settings.max_per_day);
  result = result.sort((a, b) => b.priority - a.priority).slice(0, max);
  return result.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
}
function proteinIdea(grams) {
  if (grams >= 60) return "Idee: H\xE4hnchenbrust (200 g \u2248 46 g) plus ein Skyr (250 g \u2248 28 g) schlie\xDFen die L\xFCcke.";
  if (grams >= 40) return "Idee: 250 g Magerquark (\u2248 30 g) mit Beeren oder eine Dose Thunfisch (\u2248 25 g).";
  return "Idee: Ein Skyr (\u2248 28 g) oder ein Proteinshake (\u2248 25 g) \u2013 schnell erledigt.";
}
function openTasks(st) {
  const tasks = [];
  if (st.isTrainingDay || st.workoutDone) {
    tasks.push({
      id: "workout",
      title: st.workoutDone ? "Training erledigt" : `Training: ${st.plannedWorkoutName ?? "geplant"}`,
      subtitle: st.workoutDone ? "Stark! \u{1F4AA}" : st.workoutHint ?? "Starte dein geplantes Training",
      route: "/training",
      done: st.workoutDone,
      icon: "\u{1F3CB}\uFE0F"
    });
  }
  tasks.push({
    id: "nutrition",
    title: st.mealsLogged ? `${st.mealsLogged} Eintr\xE4ge heute` : "Mahlzeiten eintragen",
    subtitle: st.proteinRemaining > 0 ? `Noch ${formatNumberDE(Math.max(0, st.caloriesRemaining), 0)} kcal \xB7 ${formatNumberDE(st.proteinRemaining, 0)} g Protein` : "Proteinziel erreicht \u2705",
    route: "/nutrition",
    done: st.mealsLogged >= 3 && st.proteinRemaining <= 0,
    icon: "\u{1F37D}\uFE0F"
  });
  if (st.weightTrackingEnabled) {
    tasks.push({ id: "weight", title: st.weighed ? "Gewicht eingetragen" : "Gewicht eintragen", subtitle: "Der 7-Tage-Schnitt z\xE4hlt", route: "/body/weight", done: st.weighed, icon: "\u2696\uFE0F" });
  }
  tasks.push({
    id: "checkin",
    title: st.checkinDone ? "Tag abgeschlossen" : "Abend-Check-in",
    subtitle: st.stepsLogged ? "Schritte eingetragen" : `Schritte eintragen (Ziel ${formatNumberDE(st.stepTarget, 0)})`,
    route: "/checkin",
    done: st.checkinDone && st.stepsLogged,
    icon: "\u{1F319}"
  });
  return tasks;
}

// src/cardio/energy.ts
var CARDIO_LABELS_DE = { walk: "Spazieren", jog: "Joggen", run: "Laufen", ems: "EMS-Training" };
var CARDIO_ICONS = { walk: "\u{1F6B6}", jog: "\u{1F3C3}", run: "\u{1F3C3}\u200D\u2642\uFE0F", ems: "\u26A1" };
var INTENSITY_LABELS_DE = { light: "Leicht", medium: "Mittel", intense: "Intensiv" };
var DEFAULT_DURATION_MIN = { walk: 30, jog: 30, run: 30, ems: 20 };
var COUNTS_AS_TRAINING = { walk: false, jog: true, run: true, ems: true };
var EMS_MET = { light: 3.5, medium: 4.5, intense: 5.5 };
var WALK_TABLE = [
  [3.2, 2.8],
  [4, 3],
  [4.8, 3.5],
  [5.6, 4.3],
  [6.4, 5],
  [7.2, 7],
  [8, 8.3]
];
var RUN_TABLE = [
  [6.4, 6],
  [8, 8.3],
  [8.4, 9],
  [9.7, 9.8],
  [10.8, 10.5],
  [11.3, 11],
  [12.1, 11.5],
  [12.9, 11.8],
  [13.8, 12.3],
  [14.5, 12.8],
  [16.1, 14.5],
  [17.7, 16],
  [19.3, 19]
];
var DEFAULT_SPEED = {
  walk: { light: 4, medium: 5, intense: 6 },
  jog: { light: 7, medium: 8, intense: 9 },
  run: { light: 9.5, medium: 11, intense: 13 }
};
function interpolate(table, x) {
  if (x <= table[0][0]) return table[0][1] * (x / table[0][0]) ** 0.5;
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i];
    if (x <= x1) {
      const [x0, y0] = table[i - 1];
      return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    }
  }
  const [xa, ya] = table[table.length - 2];
  const [xb, yb] = table[table.length - 1];
  return Math.min(23, yb + (yb - ya) / (xb - xa) * (x - xb));
}
function speedKmh(durationMin, distanceKm) {
  if (!distanceKm || distanceKm <= 0 || !durationMin || durationMin <= 0) return null;
  return distanceKm / (durationMin / 60);
}
function formatPace(durationMin, distanceKm) {
  if (!distanceKm || distanceKm <= 0 || !durationMin) return null;
  const pace = durationMin / distanceKm;
  const m = Math.floor(pace);
  const s = Math.round((pace - m) * 60);
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, "0")}`;
}
function cardioMet(activity, intensity, durationMin, distanceKm) {
  if (activity === "ems") return EMS_MET[intensity];
  const speed = speedKmh(durationMin, distanceKm) ?? DEFAULT_SPEED[activity][intensity];
  return speed >= 7.5 && activity === "walk" ? interpolate(RUN_TABLE, speed) : activity !== "walk" && speed < 6.4 ? interpolate(WALK_TABLE, speed) : interpolate(activity === "walk" ? WALK_TABLE : RUN_TABLE, speed);
}
function cardioKcal(s, weightKg) {
  if (!(s.duration_min > 0) || !(weightKg > 0)) return 0;
  return Math.round(cardioMet(s.activity, s.intensity, s.duration_min, s.distance_km) * weightKg * (s.duration_min / 60));
}
function cardioSummary(sessions, from, to) {
  const out = { sessions: 0, minutes: 0, km: 0, kcal: 0, byActivity: {} };
  for (const s of sessions) {
    if (s.deleted || s.date < from || s.date > to) continue;
    out.sessions++;
    out.minutes += s.duration_min;
    out.km += s.distance_km ?? 0;
    out.kcal += s.kcal;
    out.byActivity[s.activity] = (out.byActivity[s.activity] ?? 0) + 1;
  }
  out.km = Math.round(out.km * 10) / 10;
  return out;
}
function burnedOn(date, sessions) {
  return sessions.reduce((a, s) => !s.deleted && s.date === date ? a + s.kcal : a, 0);
}
function withExerciseCalories(profile, burnedKcal) {
  if (!profile.add_exercise_calories || burnedKcal <= 0) return profile;
  return { ...profile, calorie_target: profile.calorie_target + burnedKcal, carbs_target_g: Math.round(profile.carbs_target_g + burnedKcal / 4) };
}

// src/data/aggregate.ts
function stepsByDate(entries) {
  const out = /* @__PURE__ */ new Map();
  for (const e of entries) {
    if (e.deleted) continue;
    const cur = out.get(e.date);
    if (!cur) {
      out.set(e.date, e);
      continue;
    }
    const curManual = cur.source === "manual";
    const eManual = e.source === "manual";
    if (eManual && !curManual) out.set(e.date, e);
    else if (eManual && curManual && e.updated_at > cur.updated_at) out.set(e.date, e);
    else if (!eManual && !curManual && e.steps > cur.steps) out.set(e.date, e);
  }
  return out;
}
function trainedDates(sessions, cardio = []) {
  const out = new Set(sessions.filter((s) => !s.deleted && s.status === "completed").map((s) => s.date));
  for (const c of cardio) if (!c.deleted && COUNTS_AS_TRAINING[c.activity]) out.add(c.date);
  return out;
}
function buildDailyActivities(data, from, to) {
  const { profile } = data;
  const map = /* @__PURE__ */ new Map();
  const get = (d) => {
    let a = map.get(d);
    if (!a) {
      a = emptyActivity(d);
      map.set(d, a);
    }
    return a;
  };
  const inRange = (d) => d >= from && d <= to;
  const completed = data.sessions.filter((s) => !s.deleted && s.status === "completed");
  const sessionDate = new Map(completed.map((s) => [s.id, s.date]));
  for (const s of completed) if (inRange(s.date)) get(s.date).workouts += 1;
  for (const set of data.sets) {
    if (!isWorkingSet(set)) continue;
    const d = sessionDate.get(set.session_id);
    if (d && inRange(d)) get(d).workingSets += 1;
  }
  const { events } = computePersonalRecords(data.sessions, data.sets);
  const prKeys = /* @__PURE__ */ new Set();
  for (const e of events) {
    const k = `${e.session_id}:${e.exercise_id}`;
    if (prKeys.has(k) || !inRange(e.date)) continue;
    prKeys.add(k);
    get(e.date).prs += 1;
  }
  const mealDates = new Set(data.meals.filter((m) => !m.deleted && inRange(m.date)).map((m) => m.date));
  for (const d of mealDates) {
    const day = dayNutrition(d, data.meals);
    const a = get(d);
    a.mealEntries = day.entries;
    a.nutritionLogged = isDayLogged(day, profile.calorie_target);
    a.proteinHit = isProteinHit(day, profile.protein_target_g);
    a.caloriesOnTarget = isCaloriesOnTarget(day, profile.calorie_target);
  }
  for (const [d, e] of stepsByDate(data.steps)) {
    if (!inRange(d)) continue;
    const a = get(d);
    a.steps = e.steps;
    a.stepsHit = profile.step_target > 0 && e.steps >= profile.step_target;
  }
  for (const c of data.cardio ?? []) {
    if (c.deleted || !inRange(c.date)) continue;
    const a = get(c.date);
    a.cardio += 1;
    a.cardioKcal += c.kcal;
  }
  for (const c of data.checkins) if (!c.deleted && inRange(c.date)) get(c.date).checkin = true;
  for (const w of data.weights) if (!w.deleted && inRange(w.date)) get(w.date).weighed = true;
  return [...map.values()].sort((a, b) => a.date < b.date ? -1 : 1);
}
function firstDataDate(data) {
  const dates = [];
  const push = (d) => d && dates.push(d);
  data.sessions.forEach((s) => !s.deleted && push(s.date));
  data.meals.forEach((m) => !m.deleted && push(m.date));
  data.weights.forEach((w) => !w.deleted && push(w.date));
  data.steps.forEach((s) => !s.deleted && push(s.date));
  data.checkins.forEach((c) => !c.deleted && push(c.date));
  (data.cardio ?? []).forEach((c) => !c.deleted && push(c.date));
  if (!dates.length) return null;
  return dates.reduce((m, d) => d < m ? d : m);
}
function buildStreakInput(data, today, since, jokersPerMonth = 2) {
  const acts = buildDailyActivities(data, "0000-01-01", today);
  const p = data.profile;
  return {
    today,
    since,
    schedule: {
      type: p.schedule_type,
      weekdays: p.schedule_type === "fixed_days" && p.training_weekdays.length ? p.training_weekdays : suggestedWeekdays(p.training_days_per_week),
      perWeek: p.training_days_per_week
    },
    pauses: data.pauses.filter((x) => !x.deleted),
    jokersPerMonth,
    trainedDates: trainedDates(data.sessions, data.cardio),
    nutritionDates: new Set(acts.filter((a) => a.nutritionLogged).map((a) => a.date)),
    proteinDates: new Set(acts.filter((a) => a.proteinHit).map((a) => a.date)),
    stepsDates: new Set(acts.filter((a) => a.stepsHit).map((a) => a.date)),
    checkinDates: new Set(acts.filter((a) => a.checkin).map((a) => a.date)),
    weightDates: new Set(acts.filter((a) => a.weighed).map((a) => a.date)),
    weightTrackingEnabled: p.weight_tracking_enabled
  };
}
function daysBetween(from, to) {
  return dateRange(from, to);
}

// src/coach/report.ts
var avg2 = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
var r0 = (n) => n === null ? null : Math.round(n);
var r12 = (n) => n === null ? null : Math.round(n * 10) / 10;
function exerciseName(id, custom) {
  return EXERCISE_MAP[id]?.name ?? custom?.(id)?.name ?? "\xDCbung";
}
function buildWeeklyReport(data, weekStartDate, opts = {}) {
  const p = data.profile;
  const ws = startOfWeek(weekStartDate);
  const we = endOfWeek(ws);
  const prevWs = addDays(ws, -7);
  const prevWe = addDays(ws, -1);
  const lookup = (id) => EXERCISE_MAP[id] ?? opts.lookup?.(id);
  const name = (id) => exerciseName(id, opts.lookup);
  const sc = strengthChange(data.sessions, data.sets, { from: ws, to: we }, { from: addDays(ws, -28), to: prevWe });
  const { events } = computePersonalRecords(data.sessions, data.sets);
  const prsThisWeek = events.filter((e) => e.date >= ws && e.date <= we);
  const bestPr = /* @__PURE__ */ new Map();
  for (const e of prsThisWeek) {
    const k = `${e.exercise_id}:${e.type}`;
    if (!bestPr.has(k) || bestPr.get(k).value < e.value) bestPr.set(k, e);
  }
  const weekSessionIds = new Set(data.sessions.filter((x) => x.status === "completed" && !x.deleted && x.date >= ws && x.date <= we).map((x) => x.id));
  const trainedThisWeek = new Set(data.sets.filter((s) => isWorkingSet(s) && weekSessionIds.has(s.session_id)).map((s) => s.exercise_id));
  const plateaus = [...trainedThisWeek].filter((id) => detectPlateau(exerciseHistory(id, data.sessions, data.sets).filter((h) => h.date <= we))).map(name);
  const done = data.sessions.filter((s) => !s.deleted && s.status === "completed" && s.date >= ws && s.date <= we);
  const cardioWeek = (data.cardio ?? []).filter((c) => !c.deleted && c.date >= ws && c.date <= we);
  const cardioTrainings = cardioWeek.filter((c) => COUNTS_AS_TRAINING[c.activity]).length;
  const cs = cardioSummary(cardioWeek, ws, we);
  const schedule = {
    type: p.schedule_type,
    weekdays: p.training_weekdays,
    perWeek: p.training_days_per_week
  };
  const activeDays = dateRange(ws, we).filter((d) => !data.pauses.some((x) => !x.deleted && d >= x.start_date && d <= x.end_date));
  const planned = weeklyQuota(schedule, activeDays);
  const acts = buildDailyActivities(data, prevWs, we);
  const cur = acts.filter((a) => a.date >= ws);
  const volume = (from, to) => {
    const ids = new Set(data.sessions.filter((s) => !s.deleted && s.status === "completed" && s.date >= from && s.date <= to).map((s) => s.id));
    return Math.round(data.sets.filter((s) => isWorkingSet(s) && ids.has(s.session_id)).reduce((a, s) => a + s.weight_kg * s.reps, 0));
  };
  const spm = setsPerMuscle(data.sets, data.sessions, lookup, ws, we);
  const spmLabeled = {};
  for (const [m, v] of Object.entries(spm)) spmLabeled[MUSCLE_LABELS_DE[m]] = Math.round((v ?? 0) * 10) / 10;
  const days = dateRange(ws, we).map((d) => dayNutrition(d, data.meals));
  const logged = days.filter((d) => isDayLogged(d, p.calorie_target));
  const entriesWeek = data.meals.filter((m) => !m.deleted && m.date >= ws && m.date <= we);
  const wsum = weightSummary(data.weights, we);
  const stepMap = stepsByDate(data.steps);
  const stepVals = dateRange(ws, we).map((d) => stepMap.get(d)?.steps).filter((x) => typeof x === "number");
  const checks = data.checkins.filter((c) => !c.deleted && c.date >= ws && c.date <= we);
  const stats = {
    weekStart: ws,
    weekEnd: we,
    strength: {
      avgE1rmChangePct: sc.pct,
      improvements: sc.exercises.slice(0, 5).map((e) => ({ exercise: name(e.exercise_id), prev: e.prev, cur: e.cur, pct: e.pct })),
      prs: [...bestPr.values()].map((e) => ({ exercise: name(e.exercise_id), type: e.type, value: e.value, weight_kg: e.weight_kg, reps: e.reps })),
      plateaus
    },
    consistency: {
      workoutsDone: done.length + cardioTrainings,
      workoutsPlanned: planned,
      adherencePct: planned > 0 ? Math.round(Math.min(done.length + cardioTrainings, planned) / planned * 100) : null,
      workingSets: cur.reduce((a, x) => a + x.workingSets, 0),
      volumeKg: volume(ws, we),
      volumePrevKg: volume(prevWs, prevWe),
      setsPerMuscle: spmLabeled,
      cardio: cs.sessions ? { sessions: cs.sessions, minutes: cs.minutes, km: cs.km, kcal: cs.kcal, byActivity: Object.fromEntries(Object.entries(cs.byActivity).map(([k, v]) => [CARDIO_LABELS_DE[k], v])) } : void 0
    },
    nutrition: {
      daysLogged: logged.length,
      avgKcal: r0(avg2(logged.map((d) => d.totals.kcal))),
      avgProtein: r0(avg2(logged.map((d) => d.totals.protein_g))),
      avgCarbs: r0(avg2(logged.map((d) => d.totals.carbs_g))),
      avgFat: r0(avg2(logged.map((d) => d.totals.fat_g))),
      calorieTarget: p.calorie_target,
      proteinTarget: p.protein_target_g,
      proteinDaysHit: logged.filter((d) => d.totals.protein_g >= p.protein_target_g * 0.95).length,
      avgBalanceKcal: r0(avg2(logged.map((d) => d.totals.kcal - p.calorie_target))),
      estimatedShare: entriesWeek.length ? Math.round(entriesWeek.filter((e) => e.is_estimate).length / entriesWeek.length * 100) / 100 : 0
    },
    weight: {
      avg7: wsum.avg7,
      avgPrev7: wsum.avg7Prev,
      change: wsum.avg7 !== null && wsum.avg7Prev !== null ? Math.round((wsum.avg7 - wsum.avg7Prev) * 100) / 100 : null,
      weeklyRate30: wsum.weeklyRate30,
      plannedWeeklyRate: p.weekly_rate_kg,
      daysLogged: data.weights.filter((w) => !w.deleted && w.date >= ws && w.date <= we).length,
      goalWeight: p.goal_weight_kg
    },
    steps: {
      avg: r0(avg2(stepVals)),
      total: stepVals.reduce((a, b) => a + b, 0),
      daysHit: stepVals.filter((s) => s >= p.step_target).length,
      daysLogged: stepVals.length,
      target: p.step_target
    },
    recovery: {
      avgSleep: r12(avg2(checks.map((c) => c.sleep_hours).filter((x) => typeof x === "number"))),
      avgEnergy: r12(avg2(checks.map((c) => c.energy).filter((x) => typeof x === "number"))),
      checkins: checks.length
    },
    achievements: [],
    recommendations: []
  };
  const ach = [];
  if (stats.strength.prs.length) ach.push(`${stats.strength.prs.length} neue pers\xF6nliche Rekorde`);
  if (planned > 0 && done.length >= planned) ach.push(`Trainingsplan zu 100 % erf\xFCllt (${done.length}/${planned})`);
  if (stats.nutrition.proteinDaysHit >= 5) ach.push(`Proteinziel an ${stats.nutrition.proteinDaysHit} Tagen erreicht`);
  if (stats.steps.daysHit >= 5) ach.push(`Schrittziel an ${stats.steps.daysHit} Tagen erreicht`);
  if (stats.nutrition.daysLogged >= 6) ach.push(`Ern\xE4hrung an ${stats.nutrition.daysLogged} Tagen getrackt`);
  for (const b of opts.newBadges ?? []) ach.push(`Abzeichen: ${b}`);
  for (const c of opts.challengesCompleted ?? []) ach.push(`Challenge geschafft: ${c}`);
  stats.achievements = ach;
  stats.recommendations = buildRecommendations(stats, data);
  return stats;
}
function buildRecommendations(s, data) {
  const p = data.profile;
  const recs = [];
  if (s.nutrition.daysLogged < 4) {
    recs.push({
      id: "log-more",
      area: "nutrition",
      title: "Ern\xE4hrung an mehr Tagen tracken",
      text: `Diese Woche waren ${s.nutrition.daysLogged} von 7 Tagen vollst\xE4ndig getrackt. Ziel: mindestens 5 Tage \u2013 dann werden Kalorien- und Proteinempfehlungen deutlich genauer. Tipp: Nutze \u201EMahlzeit wiederholen" f\xFCr Standard-Fr\xFChst\xFCcke.`,
      priority: 70 - s.nutrition.daysLogged * 5
    });
  }
  if (s.nutrition.avgProtein !== null && s.nutrition.daysLogged >= 3 && s.nutrition.avgProtein < p.protein_target_g * 0.9) {
    const gap = p.protein_target_g - s.nutrition.avgProtein;
    recs.push({
      id: "protein",
      area: "nutrition",
      title: `Protein um ca. ${Math.round(gap)} g pro Tag erh\xF6hen`,
      text: `\xD8 ${s.nutrition.avgProtein} g statt ${p.protein_target_g} g Protein. Verteile 30\u201340 g auf 3\u20134 Mahlzeiten, z. B. Skyr/Magerquark zum Fr\xFChst\xFCck, eine Portion H\xE4hnchen, Tofu oder Fisch mittags und abends.`,
      priority: 60 + Math.min(30, gap / 2)
    });
  }
  if (s.consistency.adherencePct !== null && s.consistency.adherencePct < 100) {
    recs.push({
      id: "adherence",
      area: "consistency",
      title: "Trainingstermine fest einplanen",
      text: `${s.consistency.workoutsDone} von ${s.consistency.workoutsPlanned} geplanten Einheiten absolviert. Lege f\xFCr n\xE4chste Woche konkrete Tage und Uhrzeiten fest \u2013 die Erinnerung vor dem Training hilft dabei. Lieber eine k\xFCrzere Einheit als keine.`,
      priority: 55 + (100 - s.consistency.adherencePct) / 4
    });
  }
  const completeness = s.nutrition.daysLogged / 7;
  const adj = adaptiveCalorieAdjustment({
    plannedWeeklyRateKg: p.weekly_rate_kg,
    observedWeeklyRateKg: s.weight.weeklyRate30,
    daysOfData: data.weights.filter((w) => !w.deleted).length >= 10 ? 21 : 0,
    avgLoggedCalories: s.nutrition.avgKcal,
    loggingCompleteness: completeness,
    currentTarget: p.calorie_target
  });
  if (adj) {
    recs.push({
      id: "calories-adjust",
      area: "weight",
      title: `Kalorienziel ${adj.adjustKcal > 0 ? "erh\xF6hen" : "senken"}: ${formatSigned(adj.adjustKcal, 0, "kcal")}`,
      text: adj.reason,
      priority: 58
    });
  } else if (s.weight.daysLogged < 3 && p.weight_tracking_enabled) {
    recs.push({
      id: "weigh-more",
      area: "weight",
      title: "3\u20134\xD7 pro Woche wiegen",
      text: `Diese Woche ${s.weight.daysLogged} Messungen. T\xE4gliche Schwankungen von 0,5\u20131,5 kg sind normal (Wasser, Salz, Kohlenhydrate) \u2013 erst mehrere Messungen ergeben einen verl\xE4sslichen 7-Tage-Schnitt.`,
      priority: 35
    });
  }
  for (const ex2 of s.strength.plateaus.slice(0, 1)) {
    recs.push({
      id: `plateau-${ex2}`,
      area: "training",
      title: `Plateau bei ${ex2} l\xF6sen`,
      text: `Dein gesch\xE4tztes 1RM bei ${ex2} stagniert seit mindestens 3 Einheiten. Optionen: eine leichtere Woche (\u221210 %), den Wiederholungsbereich wechseln (z. B. 8\u201312 statt 5\u20138) oder eine Variante einbauen. Pr\xFCfe au\xDFerdem Schlaf und Kalorien.`,
      priority: 50
    });
  }
  if (p.goal === "muscle_gain" || p.goal === "recomposition") {
    const spm = s.consistency.setsPerMuscle;
    const major = [
      ["Brust", spm["Brust"] ?? 0],
      ["R\xFCcken", (spm["Oberer R\xFCcken"] ?? 0) + (spm["Latissimus"] ?? 0)],
      ["Quadrizeps", spm["Quadrizeps"] ?? 0],
      ["Beinbeuger", spm["Beinbeuger"] ?? 0],
      ["Schultern", spm["Schultern"] ?? 0]
    ];
    const low = major.filter(([, v]) => v < 6).sort((a, b) => a[1] - b[1]);
    if (s.consistency.workoutsDone >= 2 && low.length) {
      const [m, v] = low[0];
      recs.push({
        id: `volume-${m}`,
        area: "training",
        title: `Mehr Volumen f\xFCr ${m}`,
        text: `${m}: nur ${formatNumberDE(v)} harte S\xE4tze diese Woche. F\xFCr Muskelaufbau sind ca. 10\u201320 S\xE4tze pro Muskelgruppe und Woche ein bew\xE4hrter Richtwert. Erg\xE4nze 2\u20134 S\xE4tze in deinem Plan.`,
        priority: 40 + (6 - v) * 2
      });
    }
  }
  if (s.steps.daysLogged >= 3 && s.steps.avg !== null && s.steps.avg < s.steps.target * 0.85) {
    recs.push({
      id: "steps",
      area: "steps",
      title: `Schritte: +${formatNumberDE(Math.round((s.steps.target - s.steps.avg) / 500) * 500, 0)} pro Tag`,
      text: `\xD8 ${formatNumberDE(s.steps.avg, 0)} Schritte bei einem Ziel von ${formatNumberDE(s.steps.target, 0)}. Ein 15-min\xFCtiger Spaziergang nach dem Essen bringt ca. 1.500\u20132.000 Schritte und hilft der Verdauung.`,
      priority: 38
    });
  }
  if (s.recovery.avgSleep !== null && s.recovery.avgSleep < 7) {
    recs.push({
      id: "sleep",
      area: "recovery",
      title: "Schlaf priorisieren",
      text: `\xD8 ${formatNumberDE(s.recovery.avgSleep)} h Schlaf laut Check-in. 7\u20139 h verbessern Regeneration, Kraftleistung und Hungerregulation. Ein fester Zeitpunkt f\xFCrs Zubettgehen hilft am meisten.`,
      priority: 45
    });
  }
  const main = mostTrainedExercises(data.sets, 1)[0];
  if (main) {
    recs.push({
      id: "keep-going",
      area: "training",
      title: `Weiter progressiv steigern: ${exerciseName(main)}`,
      text: `Halte dich an die Zielvorgaben im Training: erst Wiederholungen bis zum oberen Ende des Bereichs, dann Gewicht erh\xF6hen. Konstanz ist dein gr\xF6\xDFter Hebel.`,
      priority: 10
    });
  }
  if (!recs.length) {
    recs.push({
      id: "start",
      area: "consistency",
      title: "Starte mit deinem ersten Training",
      text: "Sobald du trainierst und Mahlzeiten trackst, erh\xE4ltst du hier individuelle Empfehlungen auf Basis deiner Daten.",
      priority: 1
    });
  }
  const sorted = recs.sort((a, b) => b.priority - a.priority);
  const out = [];
  const perArea = /* @__PURE__ */ new Map();
  for (const r of sorted) {
    const n = perArea.get(r.area) ?? 0;
    if (n >= 2) continue;
    out.push(r);
    perArea.set(r.area, n + 1);
    if (out.length === 3) break;
  }
  return out;
}
function renderWeeklyReportText(s) {
  const sections = [];
  const st = s.strength;
  sections.push({
    heading: "1. Kraftentwicklung",
    body: (st.avgE1rmChangePct !== null ? `Gesch\xE4tztes 1RM im Schnitt ${formatSigned(st.avgE1rmChangePct, 1, "%")} gegen\xFCber den 4 Wochen davor.` : "Noch nicht genug Vergleichsdaten f\xFCr einen Krafttrend.") + (st.prs.length ? ` Neue Rekorde: ${[...new Map(st.prs.map((p) => [p.exercise, p])).values()].slice(0, 4).map((p) => `${p.exercise} (${formatNumberDE(p.weight_kg)} kg \xD7 ${p.reps})`).join(", ")}.` : "") + (st.plateaus.length ? ` Stagnation bei: ${st.plateaus.slice(0, 3).join(", ")}${st.plateaus.length > 3 ? ` und ${st.plateaus.length - 3} weiteren \xDCbungen` : ""}.` : "")
  });
  const c = s.consistency;
  sections.push({
    heading: "2. Trainingskonsistenz",
    body: `${c.workoutsDone} von ${c.workoutsPlanned} geplanten Trainings${c.adherencePct !== null ? ` (${c.adherencePct} %)` : ""}. ${c.workingSets} Arbeitss\xE4tze, Volumen ${formatNumberDE(c.volumeKg, 0)} kg (Vorwoche ${formatNumberDE(c.volumePrevKg, 0)} kg).` + (c.cardio ? ` Ausdauer & EMS: ${Object.entries(c.cardio.byActivity).map(([k, v]) => `${k} ${v}\xD7`).join(", ")}, ${c.cardio.minutes} min${c.cardio.km ? `, ${formatNumberDE(c.cardio.km)} km` : ""}, ca. ${formatNumberDE(c.cardio.kcal, 0)} kcal.` : "")
  });
  const n = s.nutrition;
  sections.push({
    heading: "3. Ern\xE4hrung & Kalorienbilanz",
    body: n.daysLogged === 0 ? "Diese Woche wurden keine vollst\xE4ndigen Ern\xE4hrungstage erfasst." : `${n.daysLogged} Tage getrackt. \xD8 ${formatNumberDE(n.avgKcal ?? 0, 0)} kcal (Ziel ${formatNumberDE(n.calorieTarget, 0)}, Bilanz ${formatSigned(n.avgBalanceKcal ?? 0, 0, "kcal")}/Tag), \xD8 ${n.avgProtein} g Protein (Ziel ${n.proteinTarget} g, an ${n.proteinDaysHit} Tagen erreicht).${n.estimatedShare > 0.2 ? ` ${Math.round(n.estimatedShare * 100)} % der Eintr\xE4ge sind Sch\xE4tzungen.` : ""}`
  });
  const w = s.weight;
  sections.push({
    heading: "4. Gewichtstrend",
    body: w.avg7 === null ? "Keine Gewichtsdaten in dieser Woche." : `7-Tage-Schnitt ${formatNumberDE(w.avg7, 1)} kg${w.change !== null ? ` (${formatSigned(w.change, 1, "kg")} zur Vorwoche)` : ""}.${w.weeklyRate30 !== null ? ` 30-Tage-Trend: ${formatSigned(w.weeklyRate30, 2, "kg")}/Woche (geplant ${formatSigned(w.plannedWeeklyRate, 2, "kg")}).` : ""}`
  });
  const stp = s.steps;
  sections.push({
    heading: "5. Schritte",
    body: stp.daysLogged === 0 ? "Keine Schrittzahlen eingetragen." : `\xD8 ${formatNumberDE(stp.avg ?? 0, 0)} Schritte/Tag (Ziel ${formatNumberDE(stp.target, 0)}), Ziel an ${stp.daysHit} von ${stp.daysLogged} Tagen erreicht. Gesamt: ${formatNumberDE(stp.total, 0)}.`
  });
  sections.push({
    heading: "6. Erfolge",
    body: s.achievements.length ? s.achievements.map((a) => `\u2022 ${a}`).join("\n") : "Jede erfasste Einheit z\xE4hlt \u2013 n\xE4chste Woche holst du dir die ersten Erfolge."
  });
  sections.push({
    heading: "7. Empfehlungen f\xFCr n\xE4chste Woche",
    body: s.recommendations.map((r, i) => `${i + 1}. ${r.title}: ${r.text}`).join("\n")
  });
  return { title: `Wochenbericht ${s.weekStart.slice(8, 10)}.${s.weekStart.slice(5, 7)}. \u2013 ${s.weekEnd.slice(8, 10)}.${s.weekEnd.slice(5, 7)}.`, sections };
}

// src/coach/context.ts
function buildCoachContext(data, today, lookup, birthYear, todayPlan = null) {
  const p = data.profile;
  const from = addDays(today, -27);
  const acts = buildDailyActivities(data, from, today);
  const todayNut = dayNutrition(today, data.meals);
  const rem = remainingForDay(todayNut.totals, p);
  const logged = acts.filter((a) => a.nutritionLogged);
  const nutDays = logged.map((a) => dayNutrition(a.date, data.meals));
  const avgOf = (xs) => xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
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
      is_bodyweight: def?.is_bodyweight ?? false
    });
    const last = hist[0];
    return {
      exercise: def?.name ?? id,
      last_date: last?.date ?? null,
      last_sets: last ? last.sets.map((s) => `${formatNumberDE(s.weight_kg)}\xD7${s.reps}${s.rir !== null ? `@RIR${s.rir}` : ""}`).join(", ") : "",
      best_e1rm: records[id]?.bestE1RM?.value ?? null,
      next_suggestion: `${formatNumberDE(sugg.weight_kg)} kg \xD7 ${sugg.reps.join("/")}`,
      plateau: sugg.plateau
    };
  });
  const gaps = [];
  if (logged.length < 7) gaps.push(`Ern\xE4hrung nur an ${logged.length} der letzten 28 Tage vollst\xE4ndig getrackt`);
  if (ws.daysLogged30 < 4) gaps.push("Zu wenige Gewichtsmessungen f\xFCr einen verl\xE4sslichen Trend");
  if (!data.sessions.some((s) => s.status === "completed" && !s.deleted)) gaps.push("Noch keine abgeschlossenen Trainings");
  if (stepsDays.length < 7) gaps.push("Schrittzahl selten eingetragen");
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
      allergies: [...p.allergies, ...p.intolerances]
    },
    today_status: {
      kcal_eaten: todayNut.totals.kcal,
      protein_eaten: todayNut.totals.protein_g,
      kcal_remaining: rem.kcal,
      protein_remaining: rem.protein_g,
      workout_done: acts.some((a) => a.date === today && a.workouts > 0),
      cardio_kcal_today: acts.find((a) => a.date === today)?.cardioKcal ?? 0,
      steps: acts.find((a) => a.date === today)?.steps || null
    },
    last_28_days: {
      workouts,
      avg_workouts_per_week: Math.round(workouts / 4 * 10) / 10,
      days_nutrition_logged: logged.length,
      avg_kcal_logged_days: avgOf(nutDays.map((d) => d.totals.kcal)),
      avg_protein_logged_days: avgOf(nutDays.map((d) => d.totals.protein_g)),
      avg_steps: avgOf(stepsDays.map((a) => a.steps)),
      checkins: acts.filter((a) => a.checkin).length
    },
    weight: {
      latest: ws.latest?.weight ?? null,
      latest_date: ws.latest?.date ?? null,
      avg_7d: ws.avg7,
      avg_prev_7d: ws.avg7Prev,
      weekly_rate_30d: ws.weeklyRate30,
      entries_30d: ws.daysLogged30
    },
    cardio_28_days: (() => {
      const c = cardioSummary(data.cardio ?? [], from, today);
      const last = [...data.cardio ?? []].filter((x) => !x.deleted).sort((a, b) => b.date.localeCompare(a.date))[0];
      return {
        sessions: c.sessions,
        minutes: c.minutes,
        km: c.km,
        kcal: c.kcal,
        by_activity: Object.fromEntries(Object.entries(c.byActivity).map(([k, v]) => [CARDIO_LABELS_DE[k], v])),
        last: last ? `${last.date}: ${CARDIO_LABELS_DE[last.activity]} ${last.duration_min} min${last.distance_km ? `, ${formatNumberDE(last.distance_km)} km` : ""}${last.activity === "ems" ? ` (${last.intensity})` : ""}, ${last.kcal} kcal` : null
      };
    })(),
    key_lifts,
    today_plan: todayPlan,
    data_gaps: gaps
  };
}
var COACH_SYSTEM_PROMPT = `Du bist \u201ECoach", der pers\xF6nliche KI-Fitnesscoach in der App Gymolingo.
Regeln:
- Antworte auf Deutsch, kurz, konkret und motivierend. Keine Schuldzuweisungen, kein Besch\xE4men.
- Nutze AUSSCHLIESSLICH die Fakten aus dem JSON-Block <nutzerdaten>. Erfinde keine Zahlen, Trainings, Mahlzeiten oder Messwerte.
- Wenn Daten fehlen, sage das offen und erkl\xE4re, welche Eingabe helfen w\xFCrde (siehe data_gaps).
- Berechnungen (Durchschnitte, 1RM, Trends, Vorschl\xE4ge) liegen bereits vor \u2013 interpretiere sie, statt neu zu rechnen.
- Gewichts- und Wiederholungsempfehlungen orientieren sich an key_lifts.next_suggestion; weiche nur mit Begr\xFCndung ab.
- Gib keine medizinischen Diagnosen. Bei Schmerzen, Verletzungen, Essst\xF6rungen oder gesundheitlichen Problemen empfiehl \xE4rztlichen Rat.
- Beachte Ern\xE4hrungsform und Allergien des Nutzers bei Lebensmittelvorschl\xE4gen.
- Formatiere mit kurzen Abs\xE4tzen oder Aufz\xE4hlungen, maximal ca. 180 W\xF6rter, au\xDFer der Nutzer fragt nach mehr Details.`;
var WEEKLY_REPORT_PROMPT = `Erstelle aus den Statistiken in <wochenstatistik> einen motivierenden Wochenbericht auf Deutsch.
Struktur (genau diese 7 \xDCberschriften):
1. Kraftentwicklung 2. Trainingskonsistenz 3. Ern\xE4hrung & Kalorienbilanz 4. Gewichtstrend 5. Schritte 6. Erfolge 7. Drei Empfehlungen f\xFCr n\xE4chste Woche
Regeln: Verwende nur die gelieferten Zahlen. Keine neuen Zahlen erfinden. Die drei Empfehlungen basieren auf dem Feld "recommendations" (du darfst sie umformulieren und konkretisieren, aber nicht durch erfundene Fakten ersetzen). Maximal ca. 350 W\xF6rter. Antworte als JSON: {"sections":[{"heading":"...","body":"..."}]}`;
function buildCoachUserMessage(ctx, question) {
  return `<nutzerdaten>
${JSON.stringify(ctx)}
</nutzerdaten>

Frage des Nutzers: ${question}`;
}

// src/coach/offline.ts
function answerOffline(ctx, question) {
  const q = normalize(question);
  const has = (...words) => words.some((w) => q.includes(w));
  const lines = [];
  if (ctx.today_plan && has("heute", "trainier", "workout", "plan") && !has("protein", "kalorie", "gewicht", "schritt")) {
    const tp = ctx.today_plan;
    if (tp.done) return `Dein Training (${tp.name}) ist f\xFCr heute erledigt \u2705. Jetzt z\xE4hlen Regeneration, Protein und Schlaf.`;
    lines.push(tp.is_training_day ? `Heute steht **${tp.name}** an:` : `Heute ist laut Plan Ruhetag. Wenn du trotzdem trainieren m\xF6chtest, w\xE4re **${tp.name}** als N\xE4chstes dran:`);
    for (const e of tp.exercises) lines.push(`\u2022 ${e.exercise}: ${e.target}`);
    lines.push("Die Ziele basieren auf deinem letzten Training (Doppelprogression: erst Wiederholungen, dann Gewicht).");
    return lines.join("\n");
  }
  const lift = ctx.key_lifts.find((l) => q.includes(normalize(l.exercise).split(" ")[0]));
  if (lift) {
    lines.push(`**${lift.exercise}**`);
    if (lift.last_date) lines.push(`Zuletzt (${lift.last_date}): ${lift.last_sets}.`);
    if (lift.best_e1rm) lines.push(`Bestes gesch\xE4tztes 1RM: ${formatNumberDE(lift.best_e1rm)} kg.`);
    lines.push(`Vorschlag f\xFCrs n\xE4chste Training: ${lift.next_suggestion}.`);
    if (lift.plateau) lines.push("Seit einigen Einheiten stagniert die Leistung \u2013 eine leichtere Woche oder ein anderer Wiederholungsbereich kann helfen.");
    return lines.join("\n");
  }
  if (has("lauf", "jogg", "renn", "ems", "cardio", "ausdauer", "spazier", "verbrannt", "verbrauch")) {
    const c = ctx.cardio_28_days;
    if (!c.sessions) return "In den letzten 4 Wochen ist noch kein Lauf-, Spazier- oder EMS-Training eingetragen. Unter Training \u2192 \u201EAusdauer & EMS\u201C tr\xE4gst du es in 10 Sekunden ein \u2013 der Kalorienverbrauch wird automatisch berechnet.";
    lines.push(`Letzte 4 Wochen: ${c.sessions} Einheiten, ${c.minutes} Minuten${c.km ? `, ${formatNumberDE(c.km)} km` : ""}, ca. ${formatNumberDE(c.kcal, 0)} kcal verbrannt.`);
    const parts = Object.entries(c.by_activity).map(([k, v]) => `${k} ${v}\xD7`);
    if (parts.length) lines.push(`Verteilung: ${parts.join(", ")}.`);
    if (c.last) lines.push(`Zuletzt: ${c.last}.`);
    if (ctx.today_status.cardio_kcal_today) lines.push(`Heute bisher: ${ctx.today_status.cardio_kcal_today} kcal durch Aktivit\xE4t.`);
    lines.push("Die Werte sind Sch\xE4tzungen (MET-Methode, EMS nach Studienwerten) \u2013 ideal f\xFCr den Verlauf.");
    return lines.join("\n");
  }
  if (has("protein", "eiweiss")) {
    const t = ctx.today_status;
    lines.push(`Heute: ${formatNumberDE(t.protein_eaten, 0)} g von ${ctx.profile.targets.protein_g} g Protein.`);
    if (t.protein_remaining > 0) lines.push(`Es fehlen noch ${formatNumberDE(t.protein_remaining, 0)} g. ${proteinIdea(t.protein_remaining)}`);
    else lines.push("Ziel erreicht \u2013 stark! \u2705");
    if (ctx.last_28_days.avg_protein_logged_days !== null)
      lines.push(`\xD8 der letzten 4 Wochen (getrackte Tage): ${ctx.last_28_days.avg_protein_logged_days} g.`);
    return lines.join("\n");
  }
  if (has("kalorie", "kcal", "essen", "ernaehrung", "hunger")) {
    const t = ctx.today_status;
    lines.push(`Heute gegessen: ${formatNumberDE(t.kcal_eaten, 0)} kcal \u2013 noch ${formatNumberDE(t.kcal_remaining, 0)} kcal bis zu deinem Ziel von ${formatNumberDE(ctx.profile.targets.kcal, 0)} kcal.`);
    if (ctx.last_28_days.avg_kcal_logged_days !== null)
      lines.push(`\xD8 der getrackten Tage (28 Tage): ${formatNumberDE(ctx.last_28_days.avg_kcal_logged_days, 0)} kcal an ${ctx.last_28_days.days_nutrition_logged} Tagen.`);
    if (has("hunger")) lines.push("Gegen Hunger helfen viel Protein, Gem\xFCse, Ballaststoffe und ausreichend Wasser. Volumenreiche Lebensmittel (Gem\xFCse, Beeren, Kartoffeln) s\xE4ttigen bei wenigen Kalorien.");
    return lines.join("\n");
  }
  if (has("gewicht", "abnehm", "zunehm", "waage", "trend")) {
    const w = ctx.weight;
    if (w.latest === null) return "Ich habe noch keine Gewichtsdaten. Trag dein Gewicht 3\u20134\xD7 pro Woche morgens ein \u2013 dann berechne ich deinen Trend.";
    lines.push(`Letzte Messung: ${formatNumberDE(w.latest)} kg (${w.latest_date}).`);
    if (w.avg_7d !== null) lines.push(`7-Tage-Schnitt: ${formatNumberDE(w.avg_7d)} kg${w.avg_prev_7d !== null ? ` (Vorwoche ${formatNumberDE(w.avg_prev_7d)} kg)` : ""}.`);
    if (w.weekly_rate_30d !== null)
      lines.push(`Trend (30 Tage): ${formatSigned(w.weekly_rate_30d, 2, "kg")}/Woche, geplant ${formatSigned(ctx.profile.planned_weekly_rate_kg, 2, "kg")}/Woche.`);
    else lines.push("F\xFCr einen 30-Tage-Trend brauche ich Messungen \xFCber mindestens 2 Wochen.");
    return lines.join("\n");
  }
  if (has("schritt", "laufen", "spazier")) {
    lines.push(`Dein Schrittziel: ${formatNumberDE(ctx.profile.targets.steps, 0)} pro Tag.`);
    if (ctx.last_28_days.avg_steps !== null) lines.push(`\xD8 der letzten 4 Wochen: ${formatNumberDE(ctx.last_28_days.avg_steps, 0)} Schritte.`);
    lines.push("Tipp: 10\u201315 Minuten Spaziergang nach den Mahlzeiten bringen schnell 1.500\u20132.000 Schritte.");
    return lines.join("\n");
  }
  if (has("plateau", "stagn", "fortschritt", "steiger", "training", "gewichte")) {
    if (!ctx.key_lifts.length) return "Sobald du ein paar Trainings geloggt hast, gebe ich dir konkrete Gewichts- und Wiederholungsziele.";
    lines.push("Deine n\xE4chsten Ziele:");
    for (const l of ctx.key_lifts) lines.push(`\u2022 ${l.exercise}: ${l.next_suggestion}${l.plateau ? " (Plateau \u2013 Variation/Deload pr\xFCfen)" : ""}`);
    lines.push(`Trainings in den letzten 4 Wochen: ${ctx.last_28_days.workouts} (\xD8 ${formatNumberDE(ctx.last_28_days.avg_workouts_per_week)}/Woche bei Plan ${ctx.profile.training_days_per_week}).`);
    return lines.join("\n");
  }
  if (has("regeneration", "schlaf", "muede", "erholung", "pause")) {
    return "Regeneration: 7\u20139 h Schlaf, ausreichend Kalorien und Protein sowie 1\u20132 Ruhetage pro Woche. Wenn du dich mehrere Tage schlapp f\xFChlst, plane eine leichtere Woche mit ca. 10 % weniger Gewicht und einem Satz weniger pro \xDCbung.";
  }
  lines.push("Hier dein aktueller Stand:");
  lines.push(`\u2022 Heute: ${formatNumberDE(ctx.today_status.kcal_remaining, 0)} kcal und ${formatNumberDE(Math.max(0, ctx.today_status.protein_remaining), 0)} g Protein offen${ctx.today_status.workout_done ? ", Training erledigt \u2705" : ""}.`);
  lines.push(`\u2022 4 Wochen: ${ctx.last_28_days.workouts} Trainings, Ern\xE4hrung an ${ctx.last_28_days.days_nutrition_logged} Tagen getrackt.`);
  if (ctx.data_gaps.length) lines.push(`\u2022 Datenl\xFCcken: ${ctx.data_gaps.join("; ")}.`);
  lines.push('Frag mich z. B. nach Protein, Kalorien, Gewichtstrend, Schritten oder einer \xDCbung wie \u201EBankdr\xFCcken".');
  return lines.join("\n");
}

// src/sync/engine.ts
function shouldApplyRemote(local, remote, localDirty) {
  if (!local) return true;
  if (remote.updated_at > local.updated_at) return true;
  if (remote.updated_at < local.updated_at) return false;
  return !localDirty;
}
function mergeRemoteRows(local, table, rows) {
  const accepted = [];
  for (const r of rows) {
    if (shouldApplyRemote(local.getRow(table, r.id), r, local.isDirty(table, r.id))) accepted.push(r);
  }
  if (accepted.length) local.upsertFromRemote(table, accepted);
  return accepted;
}
var PUSH_BATCH = 200;
var PULL_LIMIT = 500;
async function syncAll(tables, local, remote, now = () => /* @__PURE__ */ new Date(), overlapMs = 3e4, isFatal = (m) => /failed to fetch|network|timeout|disconnected|offline/i.test(m)) {
  const report = { pushed: {}, pulled: {}, errors: [], startedAt: now().toISOString(), finishedAt: "" };
  const fatal = () => report.errors.some((e) => isFatal(e.message));
  for (const table of tables) {
    if (fatal()) break;
    const dirty = local.getDirty(table);
    if (!dirty.length) continue;
    try {
      for (let i = 0; i < dirty.length; i += PUSH_BATCH) {
        const batch = dirty.slice(i, i + PUSH_BATCH).map(stripLocalFields);
        await remote.push(table, batch);
        local.markClean(table, batch);
        report.pushed[table] = (report.pushed[table] ?? 0) + batch.length;
      }
    } catch (e) {
      report.errors.push({ table, phase: "push", message: errorMessage(e) });
    }
  }
  for (const table of tables) {
    if (fatal()) break;
    try {
      const stored = local.getCursor(table);
      let cursor = stored ? new Date(new Date(stored).getTime() - overlapMs).toISOString() : null;
      for (; ; ) {
        const rows = await remote.pull(table, cursor, PULL_LIMIT);
        if (!rows.length) break;
        const accepted = mergeRemoteRows(local, table, rows);
        report.pulled[table] = (report.pulled[table] ?? 0) + accepted.length;
        const last = rows[rows.length - 1].server_updated_at;
        if (last) {
          cursor = last;
          if (!stored || last > stored) local.setCursor(table, last);
        }
        if (rows.length < PULL_LIMIT || !last) break;
      }
    } catch (e) {
      report.errors.push({ table, phase: "pull", message: errorMessage(e) });
    }
  }
  report.finishedAt = now().toISOString();
  return report;
}
function stripLocalFields(row) {
  const out = { ...row };
  for (const k of Object.keys(out)) {
    if (k.startsWith("_") || k.startsWith("local_") || k === "server_updated_at") delete out[k];
  }
  return out;
}
function errorMessage(e) {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String(e.message);
  return String(e);
}

// src/training/templates.ts
var SUBSTITUTES = {
  "bench-press": ["db-bench-press", "machine-chest-press", "push-up"],
  "incline-bench-press": ["incline-db-press", "smith-incline-press", "push-up"],
  "incline-db-press": ["incline-bench-press", "push-up"],
  "db-bench-press": ["bench-press", "machine-chest-press", "push-up"],
  squat: ["hack-squat", "leg-press", "goblet-squat", "bulgarian-split-squat"],
  "leg-press": ["hack-squat", "goblet-squat", "bulgarian-split-squat"],
  "barbell-row": ["db-row", "machine-row", "seated-cable-row"],
  "seated-cable-row": ["machine-row", "db-row", "barbell-row"],
  "lat-pulldown": ["pull-up", "chin-up", "db-row"],
  "overhead-press": ["db-shoulder-press", "machine-shoulder-press", "push-up"],
  "db-shoulder-press": ["overhead-press", "machine-shoulder-press"],
  "romanian-deadlift": ["db-romanian-deadlift", "back-extension"],
  "lying-leg-curl": ["seated-leg-curl", "db-romanian-deadlift", "romanian-deadlift"],
  "leg-extension": ["bulgarian-split-squat", "lunge"],
  "cable-fly": ["pec-deck", "db-fly"],
  "lateral-raise": ["cable-lateral-raise", "band-pull-apart"],
  "face-pull": ["reverse-fly", "band-pull-apart"],
  "triceps-pushdown": ["db-triceps-extension", "overhead-triceps-extension", "dips"],
  "db-curl": ["cable-curl", "barbell-curl"],
  "hammer-curl": ["db-curl", "cable-curl"],
  "standing-calf-raise": ["seated-calf-raise"],
  "hip-thrust": ["kb-swing", "db-romanian-deadlift"],
  "cable-crunch": ["hanging-leg-raise", "plank"]
};
function available(id, equipment) {
  const e = EXERCISE_MAP[id];
  if (!e) return false;
  if (e.equipment === "bodyweight") return true;
  if (e.equipment === "smith") return equipment.includes("smith") || equipment.includes("machine");
  return equipment.includes(e.equipment);
}
function resolveExercise(id, equipment) {
  if (available(id, equipment)) return id;
  for (const alt of SUBSTITUTES[id] ?? []) if (available(alt, equipment)) return alt;
  return null;
}
var DAYS = {
  fullA: { name: "Ganzk\xF6rper A", slots: [["squat", 3], ["bench-press", 3], ["barbell-row", 3], ["romanian-deadlift", 2], ["lateral-raise", 2], ["db-curl", 2]] },
  fullB: { name: "Ganzk\xF6rper B", slots: [["leg-press", 3], ["overhead-press", 3], ["lat-pulldown", 3], ["lying-leg-curl", 2], ["incline-db-press", 2], ["triceps-pushdown", 2]] },
  fullC: { name: "Ganzk\xF6rper C", slots: [["romanian-deadlift", 3], ["incline-bench-press", 3], ["seated-cable-row", 3], ["bulgarian-split-squat", 2], ["face-pull", 2], ["hammer-curl", 2]] },
  upperA: { name: "Oberk\xF6rper A", slots: [["bench-press", 3], ["barbell-row", 3], ["overhead-press", 2], ["lat-pulldown", 3], ["lateral-raise", 3], ["triceps-pushdown", 2], ["db-curl", 2]] },
  lowerA: { name: "Unterk\xF6rper A", slots: [["squat", 3], ["romanian-deadlift", 3], ["leg-extension", 2], ["lying-leg-curl", 3], ["standing-calf-raise", 3], ["cable-crunch", 2]] },
  upperB: { name: "Oberk\xF6rper B", slots: [["incline-db-press", 3], ["seated-cable-row", 3], ["db-shoulder-press", 2], ["pull-up", 3], ["cable-fly", 2], ["face-pull", 2], ["hammer-curl", 2]] },
  lowerB: { name: "Unterk\xF6rper B", slots: [["leg-press", 3], ["hip-thrust", 3], ["bulgarian-split-squat", 2], ["seated-leg-curl", 3], ["seated-calf-raise", 3], ["hanging-leg-raise", 2]] },
  push: { name: "Push", slots: [["bench-press", 3], ["incline-db-press", 3], ["overhead-press", 2], ["lateral-raise", 3], ["cable-fly", 2], ["triceps-pushdown", 3]] },
  pull: { name: "Pull", slots: [["barbell-row", 3], ["lat-pulldown", 3], ["seated-cable-row", 2], ["face-pull", 3], ["db-curl", 3], ["hammer-curl", 2]] },
  legs: { name: "Beine", slots: [["squat", 3], ["romanian-deadlift", 3], ["leg-press", 2], ["lying-leg-curl", 3], ["standing-calf-raise", 3], ["cable-crunch", 2]] }
};
var SPLITS = {
  1: { name: "Ganzk\xF6rper 1\xD7", description: "Eine intensive Ganzk\xF6rpereinheit pro Woche.", days: ["fullA"] },
  2: { name: "Ganzk\xF6rper 2\xD7", description: "Zwei Ganzk\xF6rpereinheiten (A/B) pro Woche.", days: ["fullA", "fullB"] },
  3: { name: "Ganzk\xF6rper 3\xD7", description: "Drei Ganzk\xF6rpereinheiten (A/B/C) \u2013 ideal f\xFCr Einsteiger und Wiedereinsteiger.", days: ["fullA", "fullB", "fullC"] },
  4: { name: "Oberk\xF6rper/Unterk\xF6rper", description: "Klassischer 4er-Split mit hoher Frequenz pro Muskelgruppe.", days: ["upperA", "lowerA", "upperB", "lowerB"] },
  5: { name: "Push/Pull/Beine + OK/UK", description: "F\xFCnf Einheiten: Push, Pull, Beine, Oberk\xF6rper, Unterk\xF6rper.", days: ["push", "pull", "legs", "upperB", "lowerB"] },
  6: { name: "Push/Pull/Beine 2\xD7", description: "Sechs Einheiten f\xFCr Fortgeschrittene.", days: ["push", "pull", "legs", "push", "pull", "legs"] }
};
function generatePlanTemplate(params) {
  const n = Math.max(1, Math.min(6, Math.round(params.daysPerWeek || 3)));
  const split = SPLITS[params.experience === "beginner" && n > 4 ? 4 : n];
  const equipment = params.equipment.length ? params.equipment : ["bodyweight"];
  const counts = /* @__PURE__ */ new Map();
  const days = split.days.map((key) => {
    const d = DAYS[key];
    counts.set(key, (counts.get(key) ?? 0) + 1);
    const suffix = split.days.filter((k) => k === key).length > 1 ? ` ${counts.get(key) === 1 ? "A" : "B"}` : "";
    const used = /* @__PURE__ */ new Set();
    const exercises = [];
    for (const [id, sets] of d.slots) {
      const resolved = resolveExercise(id, equipment);
      if (!resolved || used.has(resolved)) continue;
      used.add(resolved);
      const def = EXERCISE_MAP[resolved];
      const strength = params.goal === "strength" && def.category === "compound";
      exercises.push({
        exercise_id: resolved,
        target_sets: params.experience === "beginner" ? Math.min(sets, 3) : sets,
        rep_min: strength ? 4 : def.default_rep_min,
        rep_max: strength ? 6 : def.default_rep_max,
        target_rir: params.experience === "beginner" ? 3 : 2,
        rest_seconds: def.category === "compound" ? strength ? 180 : 150 : 90
      });
    }
    return { name: `${d.name}${suffix}`, exercises };
  });
  return { name: split.name, description: split.description, days };
}

// src/nutrition/tips.ts
var PROTEIN_SOURCES = {
  omnivore: "Magerquark, Skyr, H\xE4hnchen, Thunfisch oder Eier",
  vegetarian: "Magerquark, Skyr, Eier, Harzer K\xE4se oder Linsen",
  vegan: "Tofu, Tempeh, Seitan, Linsen oder Sojadrink",
  pescetarian: "Skyr, Thunfisch, Lachs, Garnelen oder Eier",
  keto: "Eier, H\xE4hnchen, Lachs, Harzer K\xE4se oder Thunfisch",
  other: "Magerquark, Skyr, H\xFClsenfr\xFCchte oder mageres Fleisch"
};
function nutritionTips(profile, meals, today, nowHour = 12) {
  const tips = [];
  const days = dateRange(addDays(today, -7), addDays(today, -1)).map((d) => dayNutrition(d, meals));
  const logged = days.filter((d) => isDayLogged(d, profile.calorie_target));
  const todayN = dayNutrition(today, meals);
  const sources = PROTEIN_SOURCES[profile.diet_type] ?? PROTEIN_SOURCES.other;
  const avg3 = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
  if (logged.length < 4) {
    tips.push({
      id: "consistency",
      icon: "\u{1F4D2}",
      title: "Regelm\xE4\xDFig tracken",
      text: `In den letzten 7 Tagen waren ${logged.length} Tage vollst\xE4ndig erfasst. Ab 5 Tagen pro Woche werden deine Auswertungen und Kalorienempfehlungen verl\xE4sslich.`,
      priority: 40
    });
  }
  if (logged.length >= 3) {
    const p = avg3(logged.map((d) => d.totals.protein_g));
    if (p < profile.protein_target_g * 0.85) {
      tips.push({
        id: "protein-avg",
        icon: "\u{1F969}",
        title: `Protein: \xD8 ${formatNumberDE(p, 0)} g von ${profile.protein_target_g} g`,
        text: `Dir fehlen im Schnitt ${formatNumberDE(profile.protein_target_g - p, 0)} g pro Tag. Plane pro Mahlzeit eine Proteinquelle ein, z. B. ${sources}.`,
        priority: 60
      });
    }
    const kcal = avg3(logged.map((d) => d.totals.kcal));
    if (kcal > profile.calorie_target * 1.1) {
      tips.push({
        id: "kcal-high",
        icon: "\u2696\uFE0F",
        title: `\xD8 ${formatNumberDE(kcal, 0)} kcal \u2013 \xFCber deinem Ziel`,
        text: `Das sind ca. ${formatNumberDE(kcal - profile.calorie_target, 0)} kcal/Tag mehr als geplant. Kleine Hebel: Getr\xE4nke ohne Zucker, \xD6l abmessen, Snacks vorportionieren.`,
        priority: profile.goal === "fat_loss" ? 55 : 30
      });
    } else if (kcal < profile.calorie_target * 0.8 && profile.goal !== "fat_loss") {
      tips.push({
        id: "kcal-low",
        icon: "\u{1F35A}",
        title: `\xD8 ${formatNumberDE(kcal, 0)} kcal \u2013 deutlich unter deinem Ziel`,
        text: "F\xFCr Muskelaufbau und Leistung brauchst du genug Energie. Erg\xE4nze kalorienreiche, einfache Snacks wie Haferflocken mit Milch, N\xFCsse oder Bananen.",
        priority: 50
      });
    }
    const fiber = avg3(logged.map((d) => d.totals.fiber_g));
    if (fiber < 25) {
      tips.push({
        id: "fiber",
        icon: "\u{1F966}",
        title: `Ballaststoffe: \xD8 ${formatNumberDE(fiber, 0)} g`,
        text: "Empfohlen sind mindestens 30 g t\xE4glich. Gem\xFCse, Vollkornbrot, Haferflocken und H\xFClsenfr\xFCchte s\xE4ttigen gut und helfen der Verdauung.",
        priority: 25
      });
    }
    const breakfastProtein = avg3(logged.map((d) => d.byMeal.breakfast.protein_g));
    if (breakfastProtein < 20 && p < profile.protein_target_g * 0.95) {
      tips.push({
        id: "breakfast-protein",
        icon: "\u{1F963}",
        title: "Proteinreiches Fr\xFChst\xFCck",
        text: `Dein Fr\xFChst\xFCck liefert im Schnitt ${formatNumberDE(breakfastProtein, 0)} g Protein. Mit 25\u201330 g am Morgen (z. B. Skyr mit Haferflocken) wird das Tagesziel leichter.`,
        priority: 35
      });
    }
  }
  const estimated = meals.filter((m) => !m.deleted && m.date >= addDays(today, -7) && m.date <= today);
  const estShare = estimated.length ? estimated.filter((m) => m.is_estimate).length / estimated.length : 0;
  if (estimated.length >= 5 && estShare > 0.3) {
    tips.push({
      id: "estimates",
      icon: "\u{1F50D}",
      title: `${Math.round(estShare * 100)} % deiner Eintr\xE4ge sind Sch\xE4tzungen`,
      text: "Wo m\xF6glich: Barcode scannen oder abwiegen. F\xFCr Gerichte kannst du eigene Rezepte anlegen \u2013 das macht die Werte deutlich genauer.",
      priority: 20
    });
  }
  const remainingProtein = profile.protein_target_g - todayN.totals.protein_g;
  if (nowHour >= 16 && todayN.entries > 0 && remainingProtein >= 30) {
    tips.push({
      id: "protein-today",
      icon: "\u23F1\uFE0F",
      title: `Heute noch ${formatNumberDE(remainingProtein, 0)} g Protein offen`,
      text: `F\xFCr den Rest des Tages: ${sources}.`,
      priority: 65
    });
  }
  return tips.sort((a, b) => b.priority - a.priority).slice(0, 3);
}

// src/dev/demo.ts
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = a + 1831565813 >>> 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
var START_WEIGHTS = {
  "bench-press": 70,
  "barbell-row": 60,
  "overhead-press": 40,
  "lat-pulldown": 55,
  "lateral-raise": 8,
  "triceps-pushdown": 25,
  "db-curl": 12,
  squat: 85,
  "romanian-deadlift": 70,
  "leg-extension": 45,
  "lying-leg-curl": 35,
  "standing-calf-raise": 60,
  "cable-crunch": 30,
  "incline-db-press": 24,
  "seated-cable-row": 55,
  "db-shoulder-press": 20,
  "pull-up": 0,
  "cable-fly": 15,
  "face-pull": 20,
  "hammer-curl": 12,
  "leg-press": 140,
  "hip-thrust": 80,
  "bulgarian-split-squat": 14,
  "seated-leg-curl": 35,
  "seated-calf-raise": 40,
  "hanging-leg-raise": 0
};
var MEALS = {
  breakfast: [
    [["builtin:haferflocken", 70], ["builtin:milch-15", 250], ["builtin:banane", 120]],
    [["builtin:skyr", 250], ["builtin:beeren-tk", 100], ["builtin:haferflocken", 40]],
    [["builtin:vollkornbrot", 100], ["builtin:ei", 110], ["builtin:kochschinken", 40]]
  ],
  lunch: [
    [["builtin:reis-gekocht", 250], ["builtin:haehnchenbrust-gegart", 180], ["builtin:brokkoli", 200]],
    [["builtin:nudeln-gekocht", 300], ["builtin:rinderhack-mager", 150], ["builtin:tomate", 150]],
    [["builtin:kartoffeln", 300], ["builtin:lachs", 150], ["builtin:gemuesemischung", 200]]
  ],
  dinner: [
    [["builtin:vollkornbrot", 100], ["builtin:huettenkaese", 200], ["builtin:gurke", 150]],
    [["builtin:wrap", 124], ["builtin:putenbrust", 150], ["builtin:paprika", 150], ["builtin:mozzarella-light", 60]],
    [["builtin:magerquark", 250], ["builtin:whey", 30], ["builtin:heidelbeeren", 125]]
  ],
  snack: [[["builtin:whey", 30], ["builtin:apfel", 150]], [["builtin:proteinriegel", 60]], [["builtin:skyr", 450]], [["builtin:magerquark", 250], ["builtin:mandeln", 20]]]
};
function generateDemoData(opts) {
  const rnd = prng(opts.seed ?? 42);
  const weeks = opts.weeks ?? 12;
  const start = addDays(opts.today, -weeks * 7 + 1);
  const uid = () => {
    const h = Array.from({ length: 32 }, () => Math.floor(rnd() * 16).toString(16)).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${"89ab"[Math.floor(rnd() * 4)]}${h.slice(17, 20)}-${h.slice(20, 32)}`;
  };
  const ts = (date, hour, min = 0) => `${date}T${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:00.000Z`;
  const base = (date, hour = 8) => ({ id: uid(), user_id: opts.userId, created_at: ts(date, hour), updated_at: ts(date, hour), deleted: false });
  const pick2 = (arr) => arr[Math.floor(rnd() * arr.length)];
  const noise = (sd) => (rnd() + rnd() + rnd() - 1.5) * sd * 1.2;
  const startWeight = 88;
  const t = calculateTargets({ sex: "male", age: 32, height_cm: 182, weight_kg: startWeight, activity_level: "moderate", training_days_per_week: 4, goal: "fat_loss" });
  const profile = {
    ...base(start),
    id: opts.userId,
    display_name: "Demo",
    birth_year: Number(opts.today.slice(0, 4)) - 32,
    sex: "male",
    height_cm: 182,
    start_weight_kg: startWeight,
    goal_weight_kg: 82,
    experience_level: "intermediate",
    training_years: 3,
    goal: "fat_loss",
    activity_level: "moderate",
    schedule_type: "fixed_days",
    training_days_per_week: 4,
    training_weekdays: [0, 1, 3, 4],
    preferred_workout_time: "18:00",
    equipment: ["barbell", "dumbbell", "machine", "cable", "bodyweight"],
    diet_type: "omnivore",
    allergies: [],
    intolerances: [],
    targets_mode: "auto",
    calorie_target: t.calorie_target,
    protein_target_g: t.protein_target_g,
    carbs_target_g: t.carbs_target_g,
    fat_target_g: t.fat_target_g,
    fiber_target_g: t.fiber_target_g,
    step_target: 1e4,
    weekly_rate_kg: t.weekly_rate_kg,
    weight_tracking_enabled: true,
    onboarding_completed: true
  };
  const tpl = generatePlanTemplate({ daysPerWeek: 4, equipment: profile.equipment, goal: "fat_loss", experience: "intermediate" });
  const plan = { ...base(start), name: tpl.name, description: tpl.description, is_active: true, sort_order: 0 };
  const days = [];
  const pex = [];
  tpl.days.forEach((d, i) => {
    const day = { ...base(start), plan_id: plan.id, name: d.name, weekday: profile.training_weekdays[i], sort_order: i };
    days.push(day);
    d.exercises.forEach((e, j) => pex.push({ ...base(start), plan_day_id: day.id, exercise_id: e.exercise_id, sort_order: j, target_sets: e.target_sets, rep_min: e.rep_min, rep_max: e.rep_max, target_rir: e.target_rir, rest_seconds: e.rest_seconds, increment_kg: null, notes: null }));
  });
  const sessions = [];
  const sets = [];
  const history = /* @__PURE__ */ new Map();
  const meals = [];
  const weights = [];
  const steps = [];
  const checkins = [];
  const measurements = [];
  const cardio = [];
  let trueWeight = startWeight;
  for (const date of dateRange(start, opts.today)) {
    const wd = weekdayIndex(date);
    const isToday = date === opts.today;
    trueWeight += -0.055 + noise(0.02);
    if (rnd() < 0.85) weights.push({ ...base(date, 7), date, weight_kg: Math.round((trueWeight + noise(0.5)) * 10) / 10, body_fat_pct: wd === 0 ? Math.round((22 - (startWeight - trueWeight) * 0.6 + noise(0.4)) * 10) / 10 : null, source: "manual", note: null });
    const dayIdx = profile.training_weekdays.indexOf(wd);
    if (dayIdx >= 0 && !isToday && rnd() < 0.9) {
      const day = days[dayIdx];
      const startMin = 17 * 60 + Math.floor(rnd() * 120);
      const session = {
        ...base(date, 17),
        plan_day_id: day.id,
        name: day.name,
        date,
        started_at: ts(date, Math.floor(startMin / 60), startMin % 60),
        ended_at: ts(date, Math.floor((startMin + 65) / 60), (startMin + 65) % 60),
        status: "completed",
        paused_at: null,
        paused_seconds: 0,
        notes: null
      };
      sessions.push(session);
      pex.filter((p) => p.plan_day_id === day.id).forEach((p, order) => {
        const def = EXERCISE_MAP[p.exercise_id];
        const hist = history.get(p.exercise_id) ?? [];
        const sugg = suggestProgression(hist, { rep_min: p.rep_min, rep_max: p.rep_max, target_sets: p.target_sets, target_rir: p.target_rir, increment_kg: def.increment_kg, is_bodyweight: def.is_bodyweight });
        const weight = sugg.kind === "first_time" ? START_WEIGHTS[p.exercise_id] ?? 20 : sugg.weight_kg;
        const performed = Array.from({ length: p.target_sets }, (_, i) => {
          const target = sugg.reps[i] ?? p.rep_min + 2;
          const reps = Math.max(1, Math.min(p.rep_max + 1, target + (rnd() < 0.7 ? 0 : rnd() < 0.6 ? 1 : -1) - (i === p.target_sets - 1 && rnd() < 0.3 ? 1 : 0)));
          return { weight_kg: weight, reps, rir: Math.max(0, Math.min(4, Math.round(p.target_rir + noise(0.8)))), rpe: null, set_type: "working" };
        });
        history.set(p.exercise_id, [{ date, sets: performed }, ...hist]);
        performed.forEach(
          (s, i) => sets.push({ ...base(date, 18), session_id: session.id, exercise_id: p.exercise_id, exercise_order: order, set_index: i, set_type: "working", weight_kg: s.weight_kg, reps: s.reps, rir: s.rir, rpe: null, completed: true, completed_at: ts(date, 18), rest_seconds: p.rest_seconds, target_weight_kg: sugg.weight_kg, target_reps: sugg.reps[i] ?? null })
        );
      });
    }
    if (rnd() < 0.88) {
      const mealsToday = isToday ? ["breakfast", "lunch"] : ["breakfast", "lunch", "dinner", ...rnd() < 0.7 ? ["snack"] : []];
      for (const m of mealsToday) {
        for (const [ref, grams] of pick2(MEALS[m])) {
          const food = FOOD_MAP[ref];
          if (!food) continue;
          const g = Math.round(grams * (0.85 + rnd() * 0.3));
          const n = nutrientsForAmount(food, g);
          const hour = m === "breakfast" ? 7 : m === "lunch" ? 12 : m === "dinner" ? 19 : 16;
          meals.push({ ...base(date, hour), date, meal: m, food_ref: ref, name: food.name, brand: null, amount_g: g, serving_label: null, kcal: n.kcal, protein_g: n.protein_g, carbs_g: n.carbs_g, fat_g: n.fat_g, fiber_g: n.fiber_g, source: "builtin", is_estimate: food.is_estimate, estimate_note: null, logged_at: ts(date, hour) });
        }
      }
    }
    if (!isToday) {
      steps.push({ ...base(date, 21), date, steps: Math.round(Math.max(2500, 9e3 + noise(2500) + (wd >= 5 ? 1500 : 0))), source: "manual" });
      if (rnd() < 0.75) checkins.push({ ...base(date, 21), date, mood: Math.max(1, Math.min(5, Math.round(3.8 + noise(0.8)))), energy: Math.max(1, Math.min(5, Math.round(3.5 + noise(0.9)))), sleep_hours: Math.round((7 + noise(0.8)) * 2) / 2, note: null, day_closed: true, completed_at: ts(date, 21) });
    }
    if (!isToday && (wd === 2 || wd === 5 || wd === 6 && rnd() < 0.5)) {
      const activity = wd === 2 ? "ems" : wd === 5 ? "jog" : "walk";
      const duration_min = activity === "ems" ? 20 : activity === "jog" ? Math.round(30 + rnd() * 12) : Math.round(40 + rnd() * 30);
      const distance_km = activity === "ems" ? null : Math.round(duration_min / 60 * (activity === "jog" ? 8.6 + noise(0.5) : 5 + noise(0.3)) * 10) / 10;
      const intensity = activity === "ems" ? rnd() < 0.6 ? "intense" : "medium" : "medium";
      const row = { activity, duration_min, distance_km, intensity };
      cardio.push({ ...base(date, activity === "ems" ? 18 : 9), date, ...row, kcal: cardioKcal(row, trueWeight), kcal_manual: false, note: null });
    }
    if (wd === 6) {
      const lost = startWeight - trueWeight;
      measurements.push({ ...base(date, 9), date, waist_cm: Math.round((94 - lost * 0.9 + noise(0.4)) * 10) / 10, chest_cm: Math.round((106 - lost * 0.3 + noise(0.4)) * 10) / 10, hips_cm: Math.round((102 - lost * 0.4 + noise(0.4)) * 10) / 10, arm_cm: Math.round((37 + noise(0.2)) * 10) / 10, thigh_cm: Math.round((60 - lost * 0.2 + noise(0.3)) * 10) / 10, neck_cm: 40, note: null });
    }
  }
  return {
    athlete_profiles: [profile],
    workout_plans: [plan],
    plan_days: days,
    plan_exercises: pex,
    workout_sessions: sessions,
    workout_sets: sets,
    meal_entries: meals,
    weight_entries: weights,
    step_entries: steps,
    daily_checkins: checkins,
    body_measurements: measurements,
    cardio_sessions: cardio
  };
}

// src/ai/gemini.ts
var GEMINI_API_BASE = "https://generativelanguage.googleapis.com";
var GEMINI_TEXT_MODEL = "gemini-flash-lite-latest";
var GEMINI_VISION_MODEL = "gemini-flash-latest";
var GeminiError = class extends Error {
  constructor(message, status, code, retryAfterSec = 60, daily = false) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfterSec = retryAfterSec;
    this.daily = daily;
  }
};
function secondsUntilDailyReset(now = /* @__PURE__ */ new Date()) {
  const pt = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const next = new Date(pt);
  next.setHours(24, 0, 0, 0);
  return Math.max(60, Math.round((next.getTime() - pt.getTime()) / 1e3) + 60);
}
function rateLimitInfo(details, now = /* @__PURE__ */ new Date()) {
  const text = JSON.stringify(details ?? "");
  if (/PerDay/i.test(text)) return { daily: true, retryAfterSec: secondsUntilDailyReset(now) };
  const m = text.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  return { daily: false, retryAfterSec: m ? Math.ceil(Number(m[1])) : 60 };
}
function toGeminiSchema(s) {
  if (Array.isArray(s)) return s.map(toGeminiSchema);
  if (s && typeof s === "object") {
    const out = {};
    for (const [k, v] of Object.entries(s)) if (k !== "additionalProperties") out[k] = toGeminiSchema(v);
    return out;
  }
  return s;
}
async function timedFetch(f, url, init, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await f(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}
var BLOCK_REASONS = ["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "IMAGE_SAFETY", "RECITATION"];
async function geminiGenerate(key, p, cfg = {}) {
  const f = cfg.fetchImpl ?? fetch;
  const generationConfig = { temperature: p.temperature ?? 0.4, maxOutputTokens: p.maxOutputTokens ?? 4096 };
  if (p.jsonSchema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseJsonSchema = toGeminiSchema(p.jsonSchema);
  }
  let res;
  try {
    res = await timedFetch(
      f,
      `${cfg.base ?? GEMINI_API_BASE}/v1beta/models/${encodeURIComponent(p.model)}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: p.system }] }, contents: p.contents, generationConfig })
      },
      p.timeoutMs ?? 45e3
    );
  } catch (e) {
    throw new GeminiError(`KI-Dienst nicht erreichbar (${e instanceof Error ? e.name : "Netzwerk"}).`, 502, "unavailable");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body.error?.message ?? res.statusText;
    if (res.status === 429) {
      const info = rateLimitInfo(body.error?.details);
      throw new GeminiError(
        info.daily ? "Das kostenlose KI-Tageskontingent ist aufgebraucht \u2013 die KI ist bis morgen gesperrt." : "Das KI-Kontingent ist gerade ausgesch\xF6pft \u2013 bitte in einer Minute erneut versuchen.",
        429,
        "rate_limited",
        info.retryAfterSec,
        info.daily
      );
    }
    if (res.status === 401 || res.status === 403 || /API key/i.test(msg)) throw new GeminiError("Der Gemini-Schl\xFCssel ist ung\xFCltig.", 503, "bad_key");
    if (res.status === 400) throw new GeminiError(`Ung\xFCltige KI-Anfrage: ${msg}`, 400, "bad_request");
    throw new GeminiError(`KI-Dienst nicht erreichbar (${res.status}).`, 502, "unavailable");
  }
  const used = body.modelVersion ?? p.model;
  if (body.promptFeedback?.blockReason) return { text: null, model: used, blocked: true };
  const cand = body.candidates?.[0];
  if (BLOCK_REASONS.includes(cand?.finishReason ?? "")) return { text: null, model: used, blocked: true };
  const text = (cand?.content?.parts ?? []).filter((x) => !x.thought && typeof x.text === "string").map((x) => x.text).join("").trim();
  return { text: text || null, model: used, blocked: false };
}
function normalizeGeminiKey(raw) {
  return raw.replace(/[\s\u200B-\u200D\uFEFF"'„“”‚‘’`]/g, "");
}
function looksLikeGeminiKey(key) {
  return /^[A-Za-z0-9._~+/=-]{20,300}$/.test(key);
}
async function geminiCheckKey(key, cfg = {}) {
  const f = cfg.fetchImpl ?? fetch;
  try {
    const res = await timedFetch(f, `${cfg.base ?? GEMINI_API_BASE}/v1beta/models?pageSize=1`, { headers: { "x-goog-api-key": key } }, 15e3);
    if (res.ok || res.status === 429) return { result: "ok" };
    const body = await res.json().catch(() => ({}));
    const message = body.error?.message?.slice(0, 300);
    if ([400, 401, 403].includes(res.status)) return { result: "invalid", message };
    return { result: "unavailable", message: message ?? `HTTP ${res.status}` };
  } catch (e) {
    return { result: "unavailable", message: e instanceof Error ? e.message : String(e) };
  }
}
async function geminiValidateKey(key, cfg = {}) {
  return (await geminiCheckKey(key, cfg)).result;
}
async function geminiGuarded(key, models, p, store, cfg = {}) {
  let last = null;
  for (const model of [...new Set(models)]) {
    if (await store.isBlocked(model)) continue;
    try {
      return await geminiGenerate(key, { ...p, model }, cfg);
    } catch (e) {
      if (!(e instanceof GeminiError) || e.code !== "rate_limited") throw e;
      last = e;
      await store.block(model, e.retryAfterSec, e.daily ? "daily quota" : "rate limit");
    }
  }
  throw last ?? new GeminiError("Das kostenlose KI-Kontingent ist aufgebraucht \u2013 die KI ist vor\xFCbergehend gesperrt.", 429, "rate_limited", 60, true);
}
function describeGeminiError(e) {
  if (e instanceof GeminiError) return { status: e.status, message: e.message };
  if (e instanceof SyntaxError) return { status: 502, message: "Die KI-Antwort war unvollst\xE4ndig." };
  return { status: 500, message: e instanceof Error ? e.message : String(e) };
}

// src/ai/tasks.ts
var REPORT_SCHEMA = {
  type: "object",
  properties: {
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: { heading: { type: "string" }, body: { type: "string" } },
        required: ["heading", "body"],
        additionalProperties: false
      }
    }
  },
  required: ["sections"],
  additionalProperties: false
};
var MEAL_PHOTO_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          grams: { type: "number" },
          kcal: { type: "number" },
          protein_g: { type: "number" },
          carbs_g: { type: "number" },
          fat_g: { type: "number" },
          confidence: { type: "string", enum: ["low", "medium", "high"] }
        },
        required: ["name", "grams", "kcal", "protein_g", "carbs_g", "fat_g", "confidence"],
        additionalProperties: false
      }
    },
    note: { type: "string" }
  },
  required: ["items", "note"],
  additionalProperties: false
};
var MEAL_PHOTO_SYSTEM = `Du sch\xE4tzt Lebensmittel und N\xE4hrwerte auf Fotos von Mahlzeiten f\xFCr eine deutsche Fitness-App.
- Erkenne die einzelnen Komponenten (deutsche Bezeichnungen) und sch\xE4tze das Gewicht in Gramm.
- N\xE4hrwerte (kcal, Protein, Kohlenhydrate, Fett) f\xFCr die gesch\xE4tzte Menge, orientiert an typischen deutschen Durchschnittswerten.
- confidence: "low" bei verdeckten Zutaten/unklaren Mengen, "medium" im Normalfall, "high" nur bei eindeutig erkennbaren, portionierten Lebensmitteln.
- Ber\xFCcksichtige typisches Bratfett/So\xDFen, wenn sichtbar, und erw\xE4hne Unsicherheiten kurz in "note" (Deutsch, 1\u20132 S\xE4tze).
- Wenn kein Essen erkennbar ist: leere items-Liste und Erkl\xE4rung in "note".`;
var BODY_FAT_SCHEMA = {
  type: "object",
  properties: {
    usable: { type: "boolean" },
    body_fat_pct: { type: "number" },
    range_low: { type: "number" },
    range_high: { type: "number" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    cues: { type: "string" },
    photo_tips: { type: "string" }
  },
  required: ["usable", "body_fat_pct", "range_low", "range_high", "confidence", "cues", "photo_tips"],
  additionalProperties: false
};
var BODY_FAT_SYSTEM = `Du sch\xE4tzt f\xFCr eine deutsche Fitness-App den K\xF6rperfettanteil (KFA) einer erwachsenen Person anhand von Fortschrittsfotos \u2013 so, wie es ein erfahrener Coach visuell tun w\xFCrde.
- Nutze sichtbare Merkmale: Definition von Bauch, Schultern, Armen und R\xFCcken, Taillenform, Fettverteilung, Venen/Separation. Ber\xFCcksichtige Geschlecht, Alter, Gr\xF6\xDFe und Gewicht, falls angegeben.
- Gib einen Punktwert und eine realistische Spanne (mindestens 4 Prozentpunkte breit) an. Visuelle Sch\xE4tzungen haben typischerweise \xB13\u20135 Prozentpunkte Fehler.
- confidence: "low" bei weiter Kleidung, schlechtem Licht, ung\xFCnstigem Winkel oder nur einem Foto; "medium" im Normalfall; "high" nur bei guten, eng anliegenden Front- und Seitenfotos.
- cues: 1\u20132 sachliche S\xE4tze auf Deutsch, woran du dich orientierst. Keine Bewertung des Aussehens, keine Kommentare zur Attraktivit\xE4t, nicht wertend.
- photo_tips: 1 Satz, wie die n\xE4chsten Fotos vergleichbarer werden (Licht, Abstand, Pose, Kleidung).
- Wenn keine erwachsene Person erkennbar oder der Oberk\xF6rper nicht beurteilbar ist: usable=false, Werte 0 und Erkl\xE4rung in cues.`;
var POSE_DE = { front: "von vorne", side: "seitlich", back: "von hinten" };
var conf = (v) => ["low", "medium", "high"].includes(String(v)) ? v : "low";
function sanitizeMealItems(parsed) {
  return (parsed.items ?? []).map((i) => ({
    name: String(i.name ?? "").slice(0, 120),
    grams: Math.max(1, Math.min(3e3, Number(i.grams) || 0)),
    kcal: Math.max(0, Math.min(5e3, Number(i.kcal) || 0)),
    protein_g: Math.max(0, Number(i.protein_g) || 0),
    carbs_g: Math.max(0, Number(i.carbs_g) || 0),
    fat_g: Math.max(0, Number(i.fat_g) || 0),
    confidence: conf(i.confidence)
  })).filter((i) => i.name && i.grams > 0);
}
function sanitizeBodyFat(o, model) {
  const clamp2 = (v) => Math.round(Math.max(3, Math.min(60, Number(v) || 0)) * 10) / 10;
  if (!o.usable || !(Number(o.body_fat_pct) > 0)) return { usable: false, cues: String(o.cues ?? "").slice(0, 400), model };
  const est = clamp2(o.body_fat_pct);
  let lo = Math.min(clamp2(o.range_low), est);
  let hi = Math.max(clamp2(o.range_high), est);
  if (hi - lo < 4) {
    lo = Math.max(3, Math.round((est - 2) * 10) / 10);
    hi = Math.min(60, Math.round((est + 2) * 10) / 10);
  }
  return {
    usable: true,
    body_fat_pct: est,
    range_low: lo,
    range_high: hi,
    confidence: conf(o.confidence),
    cues: String(o.cues ?? "").slice(0, 400),
    photo_tips: String(o.photo_tips ?? "").slice(0, 300),
    model
  };
}
function bodyFatFacts(profile, latest, year = (/* @__PURE__ */ new Date()).getFullYear()) {
  const facts = [
    profile?.sex === "male" ? "Geschlecht: m\xE4nnlich" : profile?.sex === "female" ? "Geschlecht: weiblich" : null,
    profile?.birth_year ? `Alter: ca. ${year - Number(profile.birth_year)} Jahre` : null,
    profile?.height_cm ? `Gr\xF6\xDFe: ${Number(profile.height_cm)} cm` : null,
    latest?.weight_kg ? `Gewicht: ${Number(latest.weight_kg)} kg (${latest.date})` : null
  ].filter(Boolean);
  return facts.length ? `Angaben: ${facts.join(", ")}.` : "Keine weiteren Angaben.";
}
var textModels = (cfg) => [cfg?.textModel ?? GEMINI_TEXT_MODEL];
var photoModels = (cfg) => [cfg?.visionModel ?? GEMINI_VISION_MODEL, cfg?.textModel ?? GEMINI_TEXT_MODEL];
async function aiCoachReply(r, ctx, question, history) {
  const turns = history.filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim()).slice(-10).map((m) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.content.slice(0, 4e3) }] }));
  while (turns.length && turns[0].role !== "user") turns.shift();
  const res = await geminiGuarded(r.key, textModels(r.cfg), { system: COACH_SYSTEM_PROMPT, contents: [...turns, { role: "user", parts: [{ text: buildCoachUserMessage(ctx, question.slice(0, 2e3)) }] }], temperature: 0.5 }, r.store, r.cfg);
  return res.blocked || !res.text ? null : { text: res.text, model: res.model };
}
async function aiWeeklyReportSections(r, stats, displayName, goal) {
  const res = await geminiGuarded(
    r.key,
    textModels(r.cfg),
    {
      system: `${COACH_SYSTEM_PROMPT}

${WEEKLY_REPORT_PROMPT}`,
      contents: [{ role: "user", parts: [{ text: `<wochenstatistik>
${JSON.stringify(stats)}
</wochenstatistik>

Nutzer: ${displayName || "Athlet"}, Ziel: ${goal}.` }] }],
      jsonSchema: REPORT_SCHEMA,
      temperature: 0.4,
      maxOutputTokens: 8192
    },
    r.store,
    r.cfg
  );
  if (res.blocked || !res.text) return null;
  const parsed = JSON.parse(res.text);
  if (!Array.isArray(parsed.sections) || parsed.sections.length < 3) return null;
  return { sections: parsed.sections.map((s) => ({ heading: String(s.heading).slice(0, 120), body: String(s.body).slice(0, 2e3) })), model: res.model };
}
async function aiMealPhoto(r, image, hint) {
  const parts = [{ inlineData: { mimeType: image.mediaType, data: image.data } }, { text: hint ? `Hinweis des Nutzers: ${hint.slice(0, 300)}` : "Bitte analysiere diese Mahlzeit." }];
  const res = await geminiGuarded(r.key, photoModels(r.cfg), { system: MEAL_PHOTO_SYSTEM, jsonSchema: MEAL_PHOTO_SCHEMA, temperature: 0.2, contents: [{ role: "user", parts }] }, r.store, r.cfg);
  if (res.blocked || !res.text) return null;
  const parsed = JSON.parse(res.text);
  return { items: sanitizeMealItems(parsed), note: String(parsed.note ?? ""), model: res.model };
}
async function aiBodyFat(r, images, facts) {
  const parts = [];
  for (const img of images.slice(0, 3)) {
    parts.push({ text: `Foto ${POSE_DE[img.pose] ?? ""}`.trim() });
    parts.push({ inlineData: { mimeType: img.mediaType, data: img.data } });
  }
  parts.push({ text: facts });
  const res = await geminiGuarded(r.key, photoModels(r.cfg), { system: BODY_FAT_SYSTEM, jsonSchema: BODY_FAT_SCHEMA, temperature: 0.2, contents: [{ role: "user", parts }] }, r.store, r.cfg);
  if (res.blocked || !res.text) return null;
  return sanitizeBodyFat(JSON.parse(res.text), res.model);
}
export {
  ACTIVITY_FACTORS,
  ACTIVITY_LABELS_DE,
  ALLERGEN_LABELS_DE,
  BADGES,
  BADGE_MAP,
  BODY_FAT_SCHEMA,
  BODY_FAT_SYSTEM,
  CARDIO_ICONS,
  CARDIO_LABELS_DE,
  COACH_SYSTEM_PROMPT,
  COUNTS_AS_TRAINING,
  DEFAULT_DURATION_MIN,
  DEFAULT_REMINDER_SETTINGS,
  EMPTY_TOTALS,
  EMS_MET,
  EQUIPMENT_LABELS_DE,
  EXERCISES,
  EXERCISE_MAP,
  FOODS,
  FOOD_MAP,
  GEMINI_API_BASE,
  GEMINI_TEXT_MODEL,
  GEMINI_VISION_MODEL,
  GeminiError,
  INTENSITY_LABELS_DE,
  MAX_REPS_FOR_ESTIMATE,
  MEAL_LABELS_DE,
  MEAL_ORDER,
  MEAL_PHOTO_SCHEMA,
  MEAL_PHOTO_SYSTEM,
  MUSCLE_GROUP_BUCKETS,
  MUSCLE_LABELS_DE,
  OFF_BASE,
  OFF_USER_AGENT,
  PERIOD_DAYS,
  REPORT_SCHEMA,
  STREAK_LABELS_DE,
  STREAK_MILESTONES,
  WEEKDAY_LONG_DE,
  WEEKDAY_SHORT_DE,
  WEEKLY_REPORT_PROMPT,
  XP_RULES,
  adaptiveCalorieAdjustment,
  addDays,
  ageFromBirthYear,
  aiBodyFat,
  aiCoachReply,
  aiMealPhoto,
  aiWeeklyReportSections,
  answerOffline,
  bestStreaksFrom,
  bmi,
  bodyFatFacts,
  buildCoachContext,
  buildCoachUserMessage,
  buildDailyActivities,
  buildRecommendations,
  buildStreakInput,
  buildWeeklyReport,
  burnedOn,
  calculateTargets,
  cardioKcal,
  cardioMet,
  cardioSummary,
  completedSessions,
  computeAllStreaks,
  computeDailyStreak,
  computePersonalRecords,
  computeTrainingStreak,
  dailyBodyFat,
  dailyWeights,
  dateRange,
  dayNutrition,
  daysBetween,
  describeGeminiError,
  detectPlateau,
  diffDays,
  e1rmSeries,
  earnedBadgeIds,
  effectiveRir,
  emptyActivity,
  endOfWeek,
  estimate1RM,
  exerciseHistory,
  exerciseName,
  fetchOffProduct,
  firstDataDate,
  floorToIncrement,
  foodWarnings,
  formatDateDE,
  formatDuration,
  formatKg,
  formatLastSeen,
  formatNumberDE,
  formatPace,
  formatSigned,
  geminiCheckKey,
  geminiGenerate,
  geminiGuarded,
  geminiValidateKey,
  generateDemoData,
  generatePlanTemplate,
  isBetween,
  isCaloriesOnTarget,
  isDayLogged,
  isPaused,
  isPlannedTrainingDay,
  isProteinHit,
  isQuiet,
  isValidBarcode,
  isWorkingSet,
  isoWeekNumber,
  kcalFromMacros,
  lastPerformedSets,
  latestNavyBodyFat,
  levelFromXp,
  linearSlope,
  looksLikeGeminiKey,
  mealsByDate,
  mergeRemoteRows,
  mifflinStJeor,
  minutesToTime,
  mostTrainedExercises,
  movingAverage,
  navyBodyFat,
  navyRequiredFields,
  nextMilestone,
  normalize,
  normalizeGeminiKey,
  nutrientsForAmount,
  nutritionTips,
  openTasks,
  parseISODate,
  parseOffProduct,
  periodRange,
  planRemindersForDay,
  progressReps,
  proteinIdea,
  rateLimitInfo,
  recipeNutrients,
  remainingForDay,
  renderWeeklyReportText,
  repsAtWeight,
  resolveExercise,
  roundToIncrement,
  sanitizeBodyFat,
  sanitizeMealItems,
  searchExercises,
  searchFoods,
  searchOff,
  secondsUntilDailyReset,
  sessionDurationSec,
  sessionE1RM,
  sessionPRs,
  sessionPerformanceE1RM,
  setVolume,
  setsPerMuscle,
  shouldApplyRemote,
  smoothedTrend,
  speedKmh,
  startOfMonth,
  startOfWeek,
  stepsByDate,
  strengthChange,
  stripLocalFields,
  suggestProgression,
  suggestStepTarget,
  suggestedWeekdays,
  sumTotals,
  summarizeGamification,
  summarizeSession,
  syncAll,
  timeToMinutes,
  toGeminiSchema,
  toISODate,
  todayISO,
  trainedDates,
  validateNutrients,
  volumeSeries,
  weekdayIndex,
  weeklyChallenges,
  weeklyQuota,
  weightForReps,
  weightSummary,
  withExerciseCalories,
  workingSets,
  xpForDay,
  xpForLevel
};
