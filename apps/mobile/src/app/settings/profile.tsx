import { useState } from 'react';
import { View } from 'react-native';
import {
  ACTIVITY_LABELS_DE,
  EQUIPMENT_LABELS_DE,
  WEEKDAY_SHORT_DE,
  calculateTargets,
  suggestStepTarget,
  suggestedWeekdays,
  type ActivityLevel,
  type DietType,
  type Equipment,
  type Goal,
  type Sex,
} from '@gymolingo/core';
import { Screen, Row, Section } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { parseDecimal } from '@/ui/Input';
import { CommitInput } from '@/ui/CommitInput';
import { ChipGroup } from '@/ui/Chip';
import { ToggleRow } from '@/ui/Toggle';
import { spacing } from '@/ui/theme';
import { useProfileOrDefault, useRows } from '@/data/hooks';
import { saveProfile } from '@/data/actions';
import { weightSummary, todayISO } from '@gymolingo/core';
import { notify } from '@/lib/dialog';

export default function ProfileSettings() {
  const p = useProfileOrDefault();
  const weights = useRows('weight_entries');
  const [msg, setMsg] = useState<string | null>(null);
  const num = (v: string) => parseDecimal(v);
  const age = p.birth_year ? new Date().getFullYear() - p.birth_year : null;
  const currentWeight = weightSummary(weights, todayISO()).avg7 ?? weightSummary(weights, todayISO()).latest?.weight ?? p.start_weight_kg;

  const recalc = () => {
    if (!age || !p.height_cm || !currentWeight) return notify('Daten fehlen', 'Bitte Alter, Größe und Gewicht angeben.');
    const t = calculateTargets({ sex: p.sex, age, height_cm: Number(p.height_cm), weight_kg: Number(currentWeight), activity_level: p.activity_level, training_days_per_week: p.training_days_per_week, goal: p.goal, diet_type: p.diet_type });
    saveProfile({
      targets_mode: 'auto',
      calorie_target: t.calorie_target,
      protein_target_g: t.protein_target_g,
      carbs_target_g: t.carbs_target_g,
      fat_target_g: t.fat_target_g,
      fiber_target_g: t.fiber_target_g,
      weekly_rate_kg: t.weekly_rate_kg,
      step_target: suggestStepTarget(p.goal, p.activity_level),
    });
    setMsg(`Neu berechnet mit ${String(Math.round(Number(currentWeight) * 10) / 10).replace('.', ',')} kg: ${t.calorie_target} kcal, ${t.protein_target_g} g Protein.`);
  };

  return (
    <Screen title="Profil & Ziele" back testID="profile-settings">
      <Section title="Über dich">
        <Card>
          <CommitInput label="Name" value={p.display_name} onCommit={(v) => saveProfile({ display_name: v.trim() })} />
          <ChipGroup options={[{ value: 'male', label: 'Männlich' }, { value: 'female', label: 'Weiblich' }, { value: 'diverse', label: 'Divers' }]} value={p.sex ?? 'diverse'} onChange={(v) => saveProfile({ sex: v as Sex })} />
          <Row style={{ marginTop: spacing.sm }}>
            <CommitInput containerStyle={{ flex: 1 }} label="Alter" value={age ? String(age) : ''} keyboardType="number-pad" onCommit={(v) => {
              const a = num(v);
              if (a && a >= 14 && a <= 100) saveProfile({ birth_year: new Date().getFullYear() - Math.round(a) });
            }} />
            <CommitInput containerStyle={{ flex: 1 }} label="Größe" suffix="cm" value={p.height_cm ? String(p.height_cm) : ''} keyboardType="decimal-pad" onCommit={(v) => {
              const h = num(v);
              if (h && h >= 120 && h <= 230) saveProfile({ height_cm: h });
            }} />
            <CommitInput containerStyle={{ flex: 1 }} label="Zielgewicht" suffix="kg" value={p.goal_weight_kg ? String(p.goal_weight_kg).replace('.', ',') : ''} keyboardType="decimal-pad" onCommit={(v) => saveProfile({ goal_weight_kg: v.trim() ? num(v) : null })} />
          </Row>
        </Card>
      </Section>

      <Section title="Ziel & Alltag">
        <Card>
          <ChipGroup
            options={[
              { value: 'muscle_gain', label: 'Muskelaufbau' },
              { value: 'fat_loss', label: 'Fettabbau' },
              { value: 'recomposition', label: 'Recomposition' },
              { value: 'strength', label: 'Kraft' },
            ]}
            value={p.goal}
            onChange={(v) => saveProfile({ goal: v as Goal })}
          />
          <Text variant="smallMedium" tone="secondary" style={{ marginTop: spacing.md, marginBottom: 6 }}>
            Aktivität im Alltag
          </Text>
          <ChipGroup options={(Object.keys(ACTIVITY_LABELS_DE) as ActivityLevel[]).map((a) => ({ value: a, label: ACTIVITY_LABELS_DE[a].split(' (')[0] }))} value={p.activity_level} onChange={(v) => saveProfile({ activity_level: v as ActivityLevel })} />
          <Text variant="smallMedium" tone="secondary" style={{ marginTop: spacing.md, marginBottom: 6 }}>
            Ernährungsform
          </Text>
          <ChipGroup
            options={[
              { value: 'omnivore', label: 'Alles' },
              { value: 'vegetarian', label: 'Vegetarisch' },
              { value: 'vegan', label: 'Vegan' },
              { value: 'pescetarian', label: 'Pescetarisch' },
              { value: 'keto', label: 'Low Carb' },
            ]}
            value={p.diet_type}
            onChange={(v) => saveProfile({ diet_type: v as DietType })}
          />
        </Card>
      </Section>

      <Section title="Training">
        <Card>
          <Text variant="smallMedium" tone="secondary" style={{ marginBottom: 6 }}>
            Trainings pro Woche
          </Text>
          <ChipGroup options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: String(n), label: String(n) }))} value={String(p.training_days_per_week)} onChange={(v) => saveProfile({ training_days_per_week: Number(v), training_weekdays: p.schedule_type === 'fixed_days' ? p.training_weekdays : suggestedWeekdays(Number(v)) })} />
          <Row style={{ marginTop: spacing.md }}>
            <ChipGroup options={[{ value: 'per_week', label: 'Flexibel' }, { value: 'fixed_days', label: 'Feste Tage' }]} value={p.schedule_type} onChange={(v) => saveProfile({ schedule_type: v as 'per_week' | 'fixed_days' })} />
          </Row>
          {p.schedule_type === 'fixed_days' && (
            <View>
              <ChipGroup multi options={WEEKDAY_SHORT_DE.map((d, i) => ({ value: String(i), label: d }))} value={p.training_weekdays.map(String)} onChange={(v) => {
                const days = (v as string[]).map(Number).sort();
                saveProfile({ training_weekdays: days, training_days_per_week: days.length });
              }} />
            </View>
          )}
          <CommitInput containerStyle={{ marginTop: spacing.md }} label="Bevorzugte Trainingszeit" value={p.preferred_workout_time} onCommit={(v) => /^\d{1,2}:\d{2}$/.test(v) && saveProfile({ preferred_workout_time: v })} />
          <Text variant="smallMedium" tone="secondary" style={{ marginTop: spacing.md, marginBottom: 6 }}>
            Equipment
          </Text>
          <ChipGroup multi options={(Object.keys(EQUIPMENT_LABELS_DE) as Equipment[]).map((e) => ({ value: e, label: EQUIPMENT_LABELS_DE[e] }))} value={p.equipment} onChange={(v) => saveProfile({ equipment: v as Equipment[] })} />
        </Card>
      </Section>

      <Section title="Tagesziele">
        <Card>
          <Row>
            <CommitInput containerStyle={{ flex: 1 }} label="Kalorien" suffix="kcal" value={String(p.calorie_target)} keyboardType="number-pad" testID="target-kcal-input" onCommit={(v) => {
              const n = num(v);
              if (n && n >= 1000 && n <= 6000) saveProfile({ calorie_target: Math.round(n), targets_mode: 'manual' });
            }} />
            <CommitInput containerStyle={{ flex: 1 }} label="Protein" suffix="g" value={String(p.protein_target_g)} keyboardType="number-pad" onCommit={(v) => {
              const n = num(v);
              if (n && n >= 30 && n <= 400) saveProfile({ protein_target_g: Math.round(n), targets_mode: 'manual' });
            }} />
          </Row>
          <Row style={{ marginTop: spacing.sm }}>
            <CommitInput containerStyle={{ flex: 1 }} label="Kohlenhydrate" suffix="g" value={String(p.carbs_target_g)} keyboardType="number-pad" onCommit={(v) => {
              const n = num(v);
              if (n !== null && n >= 0 && n <= 900) saveProfile({ carbs_target_g: Math.round(n), targets_mode: 'manual' });
            }} />
            <CommitInput containerStyle={{ flex: 1 }} label="Fett" suffix="g" value={String(p.fat_target_g)} keyboardType="number-pad" onCommit={(v) => {
              const n = num(v);
              if (n && n >= 20 && n <= 400) saveProfile({ fat_target_g: Math.round(n), targets_mode: 'manual' });
            }} />
          </Row>
          <CommitInput containerStyle={{ marginTop: spacing.sm }} label="Schrittziel" suffix="Schritte" value={String(p.step_target)} keyboardType="number-pad" onCommit={(v) => {
            const n = num(v);
            if (n && n >= 1000 && n <= 50000) saveProfile({ step_target: Math.round(n) });
          }} />
          <Text variant="small" tone="muted" style={{ marginTop: spacing.sm }}>
            Modus: {p.targets_mode === 'auto' ? 'automatisch berechnet' : 'manuell angepasst'} · geplante Veränderung {String(p.weekly_rate_kg).replace('.', ',')} kg/Woche
          </Text>
          <Button title="Ziele neu berechnen" icon="calculator-outline" variant="secondary" style={{ marginTop: spacing.md }} onPress={recalc} testID="recalc-targets" />
          {msg && (
            <Text variant="small" tone="accent" style={{ marginTop: spacing.sm }}>
              {msg}
            </Text>
          )}
        </Card>
      </Section>

      <Card>
        <ToggleRow label="Körpergewicht tracken" description="Morgendliche Erinnerung, Gewichts-Serie und Trend" value={p.weight_tracking_enabled} onChange={(v) => saveProfile({ weight_tracking_enabled: v })} />
      </Card>
    </Screen>
  );
}

