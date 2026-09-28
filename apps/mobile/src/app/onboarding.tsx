import { useMemo, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ACTIVITY_LABELS_DE,
  EQUIPMENT_LABELS_DE,
  WEEKDAY_SHORT_DE,
  calculateTargets,
  generatePlanTemplate,
  suggestStepTarget,
  suggestedWeekdays,
  todayISO,
  type ActivityLevel,
  type DietType,
  type Equipment,
  type ExperienceLevel,
  type Goal,
  type Sex,
} from '@gymolingo/core';
import { Screen, Row } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Input, parseDecimal } from '@/ui/Input';
import { ChipGroup } from '@/ui/Chip';
import { ProgressBar } from '@/ui/ProgressBar';
import { colors, radius, spacing } from '@/ui/theme';
import { createPlanFromTemplate, ensureSettingsRows, logWeight, saveProfile, saveReminderSettings } from '@/data/actions';
import { isBackendConfigured } from '@/lib/supabase';
import { requestNotificationPermission } from '@/lib/notifications';

type Step = 'welcome' | 'basics' | 'experience' | 'goal' | 'training' | 'activity' | 'diet' | 'targets' | 'plan' | 'reminders';
const STEPS: Step[] = ['welcome', 'basics', 'experience', 'goal', 'training', 'activity', 'diet', 'targets', 'plan', 'reminders'];

const GOALS: { value: Goal; title: string; text: string; icon: string }[] = [
  { value: 'muscle_gain', title: 'Muskelaufbau', text: 'Mehr Muskelmasse mit leichtem Kalorienüberschuss', icon: '💪' },
  { value: 'fat_loss', title: 'Fettabbau', text: 'Körperfett reduzieren, Muskeln erhalten', icon: '🔥' },
  { value: 'recomposition', title: 'Recomposition', text: 'Gleichzeitig Fett verlieren und Muskeln aufbauen', icon: '⚖️' },
  { value: 'strength', title: 'Kraftsteigerung', text: 'Stärker werden in den Grundübungen', icon: '🏋️' },
];

const ALLERGENS = [
  { value: 'gluten', label: 'Gluten' },
  { value: 'lactose', label: 'Laktose' },
  { value: 'nuts', label: 'Nüsse' },
  { value: 'peanuts', label: 'Erdnüsse' },
  { value: 'egg', label: 'Ei' },
  { value: 'soy', label: 'Soja' },
  { value: 'fish', label: 'Fisch' },
  { value: 'crustaceans', label: 'Krebstiere' },
];

export default function Onboarding() {
  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState('');
  const [sex, setSex] = useState<Sex>('male');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [goalWeight, setGoalWeight] = useState('');
  const [experience, setExperience] = useState<ExperienceLevel>('beginner');
  const [years, setYears] = useState('');
  const [goal, setGoal] = useState<Goal>('muscle_gain');
  const [days, setDays] = useState(3);
  const [scheduleType, setScheduleType] = useState<'per_week' | 'fixed_days'>('per_week');
  const [weekdays, setWeekdays] = useState<number[]>(suggestedWeekdays(3));
  const [workoutTime, setWorkoutTime] = useState('18:00');
  const [equipment, setEquipment] = useState<Equipment[]>(['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight']);
  const [activity, setActivity] = useState<ActivityLevel>('light');
  const [diet, setDiet] = useState<DietType>('omnivore');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<{ kcal?: string; protein?: string; carbs?: string; fat?: string; steps?: string }>({});
  const [trackWeight, setTrackWeight] = useState(true);
  const [createPlan, setCreatePlan] = useState(true);
  const [reminders, setReminders] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const idx = STEPS.indexOf(step);
  const ageN = parseDecimal(age);
  const heightN = parseDecimal(height);
  const weightN = parseDecimal(weight);

  const targets = useMemo(() => {
    if (!ageN || !heightN || !weightN) return null;
    return calculateTargets({ sex, age: ageN, height_cm: heightN, weight_kg: weightN, activity_level: activity, training_days_per_week: days, goal, diet_type: diet });
  }, [sex, ageN, heightN, weightN, activity, days, goal, diet]);
  const stepTarget = suggestStepTarget(goal, activity);
  const template = useMemo(() => generatePlanTemplate({ daysPerWeek: days, equipment, goal, experience }), [days, equipment, goal, experience]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (step === 'basics') {
      if (!name.trim()) e.name = 'Wie dürfen wir dich nennen?';
      if (!ageN || ageN < 14 || ageN > 100) e.age = 'Bitte ein Alter zwischen 14 und 100 angeben.';
      if (!heightN || heightN < 120 || heightN > 230) e.height = 'Größe in cm (120–230).';
      if (!weightN || weightN < 35 || weightN > 300) e.weight = 'Gewicht in kg (35–300).';
    }
    if (step === 'goal' && goalWeight && !(parseDecimal(goalWeight)! > 35)) e.goalWeight = 'Ungültiges Zielgewicht.';
    if (step === 'training') {
      if (!/^\d{1,2}:\d{2}$/.test(workoutTime)) e.time = 'Format HH:MM, z. B. 18:00';
      if (scheduleType === 'fixed_days' && weekdays.length === 0) e.weekdays = 'Wähle mindestens einen Tag.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (!validate()) return;
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  };
  const back = () => idx > 0 && setStep(STEPS[idx - 1]);

  const finish = async () => {
    if (!targets || !weightN || !heightN || !ageN) return;
    const num = (v: string | undefined, fallback: number) => {
      const n = v !== undefined ? parseDecimal(v) : null;
      return n && n > 0 ? Math.round(n) : fallback;
    };
    const manual = Object.values(overrides).some((v) => v !== undefined && v !== '');
    const perWeek = scheduleType === 'fixed_days' ? weekdays.length : days;
    saveProfile({
      display_name: name.trim(),
      birth_year: new Date().getFullYear() - Math.round(ageN),
      sex,
      height_cm: heightN,
      start_weight_kg: weightN,
      goal_weight_kg: goalWeight ? parseDecimal(goalWeight) : null,
      experience_level: experience,
      training_years: years ? parseDecimal(years) : null,
      goal,
      activity_level: activity,
      schedule_type: scheduleType,
      training_days_per_week: perWeek,
      training_weekdays: scheduleType === 'fixed_days' ? [...weekdays].sort() : suggestedWeekdays(perWeek),
      preferred_workout_time: workoutTime,
      equipment,
      diet_type: diet,
      allergies: allergies.filter((a) => a !== 'lactose'),
      intolerances: allergies.filter((a) => a === 'lactose'),
      targets_mode: manual ? 'manual' : 'auto',
      calorie_target: num(overrides.kcal, targets.calorie_target),
      protein_target_g: num(overrides.protein, targets.protein_target_g),
      carbs_target_g: num(overrides.carbs, targets.carbs_target_g),
      fat_target_g: num(overrides.fat, targets.fat_target_g),
      fiber_target_g: targets.fiber_target_g,
      step_target: num(overrides.steps, stepTarget),
      weekly_rate_kg: targets.weekly_rate_kg,
      weight_tracking_enabled: trackWeight,
      onboarding_completed: true,
    });
    ensureSettingsRows();
    logWeight(todayISO(), weightN);
    if (createPlan) createPlanFromTemplate(template, true, scheduleType === 'fixed_days' ? [...weekdays].sort() : []);
    saveReminderSettings({ enabled: reminders });
    if (reminders && Platform.OS !== 'web') await requestNotificationPermission();
    router.replace('/');
  };

  if (step === 'welcome') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <LinearGradient colors={['rgba(198,244,50,0.18)', 'rgba(11,12,14,0)']} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 420 }} />
        <Screen scroll={false} contentStyle={{ justifyContent: 'space-between', paddingVertical: spacing.huge }}>
          <View style={{ gap: spacing.lg, marginTop: spacing.huge }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Text variant="display" color={colors.onAccent}>
                G
              </Text>
            </View>
            <Text variant="display">Gymolingo</Text>
            <Text variant="h3" tone="secondary" style={{ fontFamily: 'Inter_500Medium' }}>
              Dein Coach für Training, Ernährung und Fortschritt. Jeden Tag wissen, was zu tun ist.
            </Text>
            <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
              {['Intelligente Gewichtsvorschläge für jedes Training', 'Kalorien & Protein mit deutscher Lebensmitteldatenbank', 'Streaks, Challenges und ein KI-Coach, der deine echten Daten kennt'].map((t) => (
                <Row key={t} gap={spacing.sm}>
                  <Text tone="accent">✓</Text>
                  <Text tone="secondary" style={{ flex: 1 }}>
                    {t}
                  </Text>
                </Row>
              ))}
            </View>
          </View>
          <View style={{ gap: spacing.md }}>
            <Button testID="onboarding-start" title="Los geht's" size="lg" onPress={() => setStep('basics')} />
            {isBackendConfigured && <Button testID="onboarding-login" title="Ich habe bereits ein Konto" variant="ghost" onPress={() => router.push('/auth?mode=signin')} />}
            <Text variant="small" tone="muted" align="center">
              Deine Daten bleiben zuerst nur auf diesem Gerät. Ein Konto für Sync & Community kannst du jederzeit anlegen.
            </Text>
          </View>
        </Screen>
      </View>
    );
  }

  const footer = (
    <Row>
      <Button title="Zurück" variant="secondary" onPress={back} style={{ flex: 1 }} testID="onboarding-back" />
      {step === 'reminders' ? (
        <Button title="Fertig" onPress={finish} style={{ flex: 2 }} testID="onboarding-finish" icon="checkmark" />
      ) : (
        <Button title="Weiter" onPress={next} style={{ flex: 2 }} testID="onboarding-next" disabled={step === 'targets' && !targets} />
      )}
    </Row>
  );

  return (
    <Screen footer={footer} testID={`onboarding-${step}`}>
      <View style={{ gap: spacing.sm, paddingTop: spacing.md }}>
        <ProgressBar progress={idx / (STEPS.length - 1)} height={4} />
        <Text variant="caption" tone="muted">
          Schritt {idx} von {STEPS.length - 1}
        </Text>
      </View>

      {step === 'basics' && (
        <>
          <Heading title="Erzähl uns von dir" text="Damit berechnen wir deinen Energiebedarf." />
          <Input testID="input-name" label="Name" value={name} onChangeText={setName} placeholder="z. B. Alex" error={errors.name} autoComplete="given-name" />
          <Text variant="smallMedium" tone="secondary">
            Geschlecht (für die Grundumsatzformel)
          </Text>
          <ChipGroup testIDPrefix="sex" options={[{ value: 'male', label: 'Männlich' }, { value: 'female', label: 'Weiblich' }, { value: 'diverse', label: 'Divers' }]} value={sex} onChange={(v) => setSex(v as Sex)} />
          <Row>
            <Input testID="input-age" containerStyle={{ flex: 1 }} label="Alter" value={age} onChangeText={setAge} keyboardType="number-pad" suffix="Jahre" error={errors.age} />
            <Input testID="input-height" containerStyle={{ flex: 1 }} label="Größe" value={height} onChangeText={setHeight} keyboardType="decimal-pad" suffix="cm" error={errors.height} />
          </Row>
          <Input testID="input-weight" label="Aktuelles Gewicht" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" suffix="kg" error={errors.weight} />
        </>
      )}

      {step === 'experience' && (
        <>
          <Heading title="Deine Trainingserfahrung" text="Bestimmt Startplan, Satzzahl und Steigerungstempo." />
          {(
            [
              ['beginner', 'Einsteiger', 'Weniger als 1 Jahr regelmäßiges Krafttraining'],
              ['intermediate', 'Fortgeschritten', '1–3 Jahre, Grundübungen sitzen'],
              ['advanced', 'Erfahren', 'Mehr als 3 Jahre strukturiertes Training'],
            ] as const
          ).map(([v, t, d]) => (
            <SelectCard key={v} testID={`exp-${v}`} selected={experience === v} title={t} text={d} onPress={() => setExperience(v)} />
          ))}
          <Input label="Trainingsjahre (optional)" value={years} onChangeText={setYears} keyboardType="decimal-pad" suffix="Jahre" />
        </>
      )}

      {step === 'goal' && (
        <>
          <Heading title="Was ist dein Hauptziel?" text="Du kannst es jederzeit ändern." />
          {GOALS.map((g) => (
            <SelectCard key={g.value} testID={`goal-${g.value}`} selected={goal === g.value} title={`${g.icon}  ${g.title}`} text={g.text} onPress={() => setGoal(g.value)} />
          ))}
          <Input label="Zielgewicht (optional)" value={goalWeight} onChangeText={setGoalWeight} keyboardType="decimal-pad" suffix="kg" error={errors.goalWeight} />
        </>
      )}

      {step === 'training' && (
        <>
          <Heading title="Dein Trainingsplan" text="Wie oft möchtest du trainieren?" />
          <Row gap={spacing.sm}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <Pressable
                key={n}
                testID={`days-${n}`}
                onPress={() => {
                  setDays(n);
                  setWeekdays(suggestedWeekdays(n));
                }}
                style={{ flex: 1, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: days === n ? colors.accent : colors.surface2, borderWidth: 1, borderColor: days === n ? colors.accent : colors.border }}
              >
                <Text variant="h2" color={days === n ? colors.onAccent : colors.text}>
                  {n}
                </Text>
              </Pressable>
            ))}
          </Row>
          <Text tone="secondary" variant="small">
            Trainings pro Woche
          </Text>
          <ChipGroup
            options={[
              { value: 'per_week', label: 'Flexibel pro Woche' },
              { value: 'fixed_days', label: 'Feste Wochentage' },
            ]}
            value={scheduleType}
            onChange={(v) => setScheduleType(v as 'per_week' | 'fixed_days')}
          />
          {scheduleType === 'fixed_days' && (
            <>
              <ChipGroup
                multi
                options={WEEKDAY_SHORT_DE.map((d, i) => ({ value: String(i), label: d }))}
                value={weekdays.map(String)}
                onChange={(v) => setWeekdays((v as string[]).map(Number))}
              />
              {errors.weekdays && <Text tone="danger" variant="small">{errors.weekdays}</Text>}
            </>
          )}
          <Input label="Bevorzugte Trainingszeit" value={workoutTime} onChangeText={setWorkoutTime} placeholder="18:00" error={errors.time} hint="Für die Erinnerung vor dem Training" />
          <Text variant="smallMedium" tone="secondary">
            Verfügbares Equipment
          </Text>
          <ChipGroup
            multi
            testIDPrefix="equip"
            options={(Object.keys(EQUIPMENT_LABELS_DE) as Equipment[]).map((e) => ({ value: e, label: EQUIPMENT_LABELS_DE[e] }))}
            value={equipment}
            onChange={(v) => setEquipment(v as Equipment[])}
          />
        </>
      )}

      {step === 'activity' && (
        <>
          <Heading title="Wie aktiv ist dein Alltag?" text="Ohne Training – Beruf, Wege, Freizeit." />
          {(Object.keys(ACTIVITY_LABELS_DE) as ActivityLevel[]).map((a) => (
            <SelectCard key={a} testID={`activity-${a}`} selected={activity === a} title={ACTIVITY_LABELS_DE[a].split(' (')[0]} text={ACTIVITY_LABELS_DE[a].match(/\((.*)\)/)?.[1] ?? ''} onPress={() => setActivity(a)} />
          ))}
        </>
      )}

      {step === 'diet' && (
        <>
          <Heading title="Ernährung" text="Wir berücksichtigen das bei Lebensmitteln und Tipps." />
          <ChipGroup
            testIDPrefix="diet"
            options={[
              { value: 'omnivore', label: 'Alles' },
              { value: 'vegetarian', label: 'Vegetarisch' },
              { value: 'vegan', label: 'Vegan' },
              { value: 'pescetarian', label: 'Pescetarisch' },
              { value: 'keto', label: 'Low Carb / Keto' },
            ]}
            value={diet}
            onChange={(v) => setDiet(v as DietType)}
          />
          <Text variant="smallMedium" tone="secondary">
            Allergien & Unverträglichkeiten
          </Text>
          <ChipGroup multi options={ALLERGENS} value={allergies} onChange={(v) => setAllergies(v as string[])} />
        </>
      )}

      {step === 'targets' && targets && (
        <>
          <Heading title="Deine Startwerte" text="Berechnet aus deinen Angaben – die App passt sie später an deinen echten Verlauf an." />
          <Card variant="accent">
            <Text variant="caption" tone="secondary">
              Tägliches Kalorienziel
            </Text>
            <Text variant="numberLarge" testID="target-kcal">
              {overrides.kcal || targets.calorie_target} kcal
            </Text>
            <Text variant="small" tone="secondary">
              Grundumsatz {targets.bmr} kcal · Gesamtumsatz ≈ {targets.tdee} kcal
            </Text>
          </Card>
          <Row>
            <Input containerStyle={{ flex: 1 }} label="Kalorien" value={overrides.kcal ?? String(targets.calorie_target)} onChangeText={(v) => setOverrides((o) => ({ ...o, kcal: v }))} keyboardType="number-pad" suffix="kcal" />
            <Input containerStyle={{ flex: 1 }} label="Protein" value={overrides.protein ?? String(targets.protein_target_g)} onChangeText={(v) => setOverrides((o) => ({ ...o, protein: v }))} keyboardType="number-pad" suffix="g" />
          </Row>
          <Row>
            <Input containerStyle={{ flex: 1 }} label="Kohlenhydrate" value={overrides.carbs ?? String(targets.carbs_target_g)} onChangeText={(v) => setOverrides((o) => ({ ...o, carbs: v }))} keyboardType="number-pad" suffix="g" />
            <Input containerStyle={{ flex: 1 }} label="Fett" value={overrides.fat ?? String(targets.fat_target_g)} onChangeText={(v) => setOverrides((o) => ({ ...o, fat: v }))} keyboardType="number-pad" suffix="g" />
          </Row>
          <Input label="Schrittziel" value={overrides.steps ?? String(stepTarget)} onChangeText={(v) => setOverrides((o) => ({ ...o, steps: v }))} keyboardType="number-pad" suffix="Schritte" />
          <Card>
            <Text variant="smallMedium" style={{ marginBottom: 6 }}>
              So wurde gerechnet
            </Text>
            {targets.explanation.map((e) => (
              <Text key={e} variant="small" tone="secondary">
                • {e}
              </Text>
            ))}
            <Text variant="small" tone="muted" style={{ marginTop: 6 }}>
              Richtwerte, keine medizinische Beratung. Geplante Veränderung: {targets.weekly_rate_kg > 0 ? '+' : ''}
              {targets.weekly_rate_kg.toFixed(2).replace('.', ',')} kg/Woche.
            </Text>
          </Card>
          <SelectCard selected={trackWeight} title="Körpergewicht tracken" text="Tägliche Abfrage am Morgen, Streak & 7-Tage-Schnitt" onPress={() => setTrackWeight((v) => !v)} />
        </>
      )}

      {step === 'plan' && (
        <>
          <Heading title="Dein Startplan" text={`${template.name}: ${template.description}`} />
          {template.days.map((d) => (
            <Card key={d.name} padding={spacing.md}>
              <Text variant="h3">{d.name}</Text>
              <Text variant="small" tone="secondary">
                {d.exercises.length} Übungen · {d.exercises.reduce((s, e) => s + e.target_sets, 0)} Sätze
              </Text>
            </Card>
          ))}
          <SelectCard testID="create-plan" selected={createPlan} title="Diesen Plan verwenden" text="Du kannst Übungen, Sätze und Wiederholungen jederzeit anpassen." onPress={() => setCreatePlan((v) => !v)} />
        </>
      )}

      {step === 'reminders' && (
        <>
          <Heading title="Erinnerungen" text="Motivierend, nicht nervig. Ruhezeiten (22–7 Uhr) und ein Tageslimit sind voreingestellt." />
          {[
            ['☀️', 'Morgens', 'Tagesziele, heutiges Training, Motivation'],
            ['💪', 'Vor dem Training', 'Plan und Zielgewichte'],
            ['🌙', 'Abends', 'Schritte eintragen, Tagesabschluss, offenes Protein'],
          ].map(([i, t, d]) => (
            <Row key={t} style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border }}>
              <Text variant="h2">{i}</Text>
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium">{t}</Text>
                <Text variant="small" tone="secondary">
                  {d}
                </Text>
              </View>
            </Row>
          ))}
          <SelectCard testID="reminders-toggle" selected={reminders} title="Erinnerungen aktivieren" text="Kategorien, Zeiten und Intensität später in den Einstellungen." onPress={() => setReminders((v) => !v)} />
        </>
      )}
    </Screen>
  );
}

function Heading({ title, text }: { title: string; text: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text variant="h1">{title}</Text>
      <Text tone="secondary">{text}</Text>
    </View>
  );
}

function SelectCard({ title, text, selected, onPress, testID }: { title: string; text: string; selected: boolean; onPress: () => void; testID?: string }) {
  return (
    <Card testID={testID} onPress={onPress} variant={selected ? 'accent' : 'default'} padding={spacing.md} accessibilityLabel={title}>
      <Row>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyMedium">{title}</Text>
          {!!text && (
            <Text variant="small" tone="secondary">
              {text}
            </Text>
          )}
        </View>
        <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: selected ? colors.accent : colors.borderStrong, backgroundColor: selected ? colors.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {selected && (
            <Text variant="smallMedium" color={colors.onAccent} style={{ fontSize: 12, lineHeight: 14 }}>
              ✓
            </Text>
          )}
        </View>
      </Row>
    </Card>
  );
}
