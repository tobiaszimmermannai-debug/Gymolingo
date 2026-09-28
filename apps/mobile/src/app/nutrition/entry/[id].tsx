import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { formatNumberDE, MEAL_LABELS_DE, MEAL_ORDER, nutrientsForAmount, validateNutrients, type MealType } from '@gymolingo/core';
import { Screen, Row } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Input, parseDecimal } from '@/ui/Input';
import { Badge, ChipGroup } from '@/ui/Chip';
import { spacing } from '@/ui/theme';
import { useRow } from '@/data/hooks';
import { deleteMealEntry, updateMealEntry } from '@/data/actions';
import { confirm } from '@/lib/dialog';
import { resolveFood, SOURCE_LABEL } from '@/features/foods';

/** Edit a logged entry: amount, meal, or – for estimates – correct the nutrient values directly. */
export default function EditEntry() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const e = useRow('meal_entries', id);
  const [grams, setGrams] = useState(e ? String(e.amount_g).replace('.', ',') : '');
  const [meal, setMeal] = useState<MealType>(e?.meal ?? 'lunch');
  const [manual, setManual] = useState(!!e?.food_ref.startsWith('quick:'));
  const [kcal, setKcal] = useState(e ? String(Math.round(e.kcal)) : '');
  const [p, setP] = useState(e ? String(e.protein_g).replace('.', ',') : '');
  const [c, setC] = useState(e ? String(e.carbs_g).replace('.', ',') : '');
  const [f, setF] = useState(e ? String(e.fat_g).replace('.', ',') : '');
  const [error, setError] = useState<string | null>(null);

  if (!e || e.deleted) {
    return (
      <Screen title="Eintrag" back>
        <Text tone="secondary">Eintrag nicht gefunden.</Text>
      </Screen>
    );
  }
  const food = resolveFood(e.food_ref);
  const isQuick = e.food_ref.startsWith('quick:');
  const g = isQuick ? Number(e.amount_g) : parseDecimal(grams) ?? 0;

  const save = () => {
    if (!(g > 0)) return setError('Bitte eine gültige Menge eingeben.');
    if (manual) {
      const vals = [parseDecimal(kcal), parseDecimal(p), parseDecimal(c), parseDecimal(f)];
      if (vals.some((v) => v === null || v < 0)) return setError('Bitte alle Nährwerte angeben.');
      const [k, pp, cc, ff] = vals as number[];
      if (k > 5000) return setError('Maximal 5000 kcal pro Eintrag.');
      const issues = isQuick ? [] : validateNutrients({ kcal_100: (k / g) * 100, protein_100: (pp / g) * 100, carbs_100: (cc / g) * 100, fat_100: (ff / g) * 100, fiber_100: null, sugar_100: null, salt_100: null });
      if (issues.some((i) => !i.includes('passen nicht'))) return setError(issues.join(' '));
      updateMealEntry(e.id, { amount_g: g, meal, kcal: k, protein_g: pp, carbs_g: cc, fat_g: ff, is_estimate: false, estimate_note: 'Manuell korrigiert' });
    } else if (food) {
      const n = nutrientsForAmount(food, g);
      updateMealEntry(e.id, { amount_g: g, meal, kcal: n.kcal, protein_g: n.protein_g, carbs_g: n.carbs_g, fat_g: n.fat_g, fiber_g: n.fiber_g, serving_label: g === Number(e.amount_g) ? e.serving_label : null });
    } else {
      // food no longer available: scale the stored snapshot
      const factor = g / Number(e.amount_g);
      updateMealEntry(e.id, { amount_g: g, meal, kcal: Math.round(e.kcal * factor), protein_g: e.protein_g * factor, carbs_g: e.carbs_g * factor, fat_g: e.fat_g * factor });
    }
    router.back();
  };

  return (
    <Screen title={e.name} subtitle={e.brand ?? undefined} back testID="edit-entry" footer={<Button title="Speichern" onPress={save} testID="save-entry" />}>
      <Row gap={spacing.sm} wrap>
        <Badge label={SOURCE_LABEL[e.source] ?? e.source} tone="muted" />
        {e.is_estimate && <Badge label="~ Schätzwert – bitte prüfen" tone="warning" />}
      </Row>
      {e.estimate_note && (
        <Text variant="small" tone="secondary">
          Hinweis: {e.estimate_note}
        </Text>
      )}
      <Card>
        <Text variant="small" tone="secondary">
          Aktuell: {formatNumberDE(e.kcal, 0)} kcal · P {formatNumberDE(e.protein_g, 1)} g · K {formatNumberDE(e.carbs_g, 1)} g · F {formatNumberDE(e.fat_g, 1)} g
        </Text>
      </Card>
      {!isQuick && <Input label="Menge" value={grams} onChangeText={setGrams} keyboardType="decimal-pad" suffix="g" testID="entry-grams" />}
      <ChipGroup options={MEAL_ORDER.map((m) => ({ value: m, label: MEAL_LABELS_DE[m] }))} value={meal} onChange={(v) => setMeal(v as MealType)} />
      <Button title={manual ? 'Werte automatisch berechnen' : 'Nährwerte manuell korrigieren'} variant="secondary" icon="create-outline" onPress={() => setManual((m) => !m)} testID="toggle-manual" />
      {manual && (
        <>
          <Row>
            <Input containerStyle={{ flex: 1 }} label="Kalorien" value={kcal} onChangeText={setKcal} keyboardType="decimal-pad" suffix="kcal" testID="manual-kcal" />
            <Input containerStyle={{ flex: 1 }} label="Protein" value={p} onChangeText={setP} keyboardType="decimal-pad" suffix="g" testID="manual-protein" />
          </Row>
          <Row>
            <Input containerStyle={{ flex: 1 }} label="Kohlenhydrate" value={c} onChangeText={setC} keyboardType="decimal-pad" suffix="g" />
            <Input containerStyle={{ flex: 1 }} label="Fett" value={f} onChangeText={setF} keyboardType="decimal-pad" suffix="g" />
          </Row>
          <Text variant="small" tone="muted">
            Werte gelten für die gesamte Menge. Korrigierte Einträge werden nicht mehr als Schätzung markiert.
          </Text>
        </>
      )}
      {error && <Text tone="danger">{error}</Text>}
      <Button
        title="Eintrag löschen"
        variant="danger"
        icon="trash-outline"
        onPress={async () => {
          if (await confirm('Eintrag löschen?', e.name, 'Löschen', true)) {
            deleteMealEntry(e.id);
            router.back();
          }
        }}
      />
    </Screen>
  );
}
