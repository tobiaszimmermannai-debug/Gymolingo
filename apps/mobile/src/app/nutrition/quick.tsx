import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { kcalFromMacros, MEAL_LABELS_DE, MEAL_ORDER, todayISO, type MealType } from '@gymolingo/core';
import { Screen, Row } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Button } from '@/ui/Button';
import { Input, parseDecimal } from '@/ui/Input';
import { ChipGroup } from '@/ui/Chip';
import { insert, nowISO } from '@/data/store';
import { requestSync } from '@/data/sync';

/** Quick entry: calories/macros without a food (e.g. restaurant estimate). Always flagged as estimate. */
export default function QuickAdd() {
  const { date = todayISO(), meal = 'lunch' } = useLocalSearchParams<{ date?: string; meal?: MealType }>();
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [p, setP] = useState('');
  const [c, setC] = useState('');
  const [f, setF] = useState('');
  const [m, setM] = useState<MealType>(meal as MealType);
  const [err, setErr] = useState<string | null>(null);
  const macroKcal = kcalFromMacros(parseDecimal(p) ?? 0, parseDecimal(c) ?? 0, parseDecimal(f) ?? 0);

  const save = () => {
    const k = parseDecimal(kcal) ?? (macroKcal > 0 ? macroKcal : null);
    if (k === null || k <= 0 || k > 5000) return setErr('Bitte Kalorien (1–5000) oder Makros angeben.');
    insert('meal_entries', {
      date,
      meal: m,
      food_ref: `quick:${Date.now()}`,
      name: name.trim() || 'Schnelleintrag',
      brand: null,
      amount_g: 1,
      serving_label: 'Schnelleintrag',
      kcal: Math.round(k),
      protein_g: parseDecimal(p) ?? 0,
      carbs_g: parseDecimal(c) ?? 0,
      fat_g: parseDecimal(f) ?? 0,
      fiber_g: null,
      source: 'custom',
      is_estimate: true,
      estimate_note: 'Manuell geschätzt',
      logged_at: nowISO(),
    });
    requestSync();
    router.dismissTo('/nutrition' as never);
  };

  return (
    <Screen title="Schnelleintrag" back footer={<Button title="Hinzufügen" onPress={save} testID="quick-save" />}>
      <Input label="Bezeichnung (optional)" value={name} onChangeText={setName} placeholder="z. B. Pasta im Restaurant" />
      <Input label="Kalorien" value={kcal} onChangeText={setKcal} keyboardType="decimal-pad" suffix="kcal" placeholder={macroKcal ? String(macroKcal) : ''} testID="quick-kcal" hint={macroKcal ? `Aus Makros berechnet: ${macroKcal} kcal` : undefined} />
      <Row>
        <Input containerStyle={{ flex: 1 }} label="Protein" value={p} onChangeText={setP} keyboardType="decimal-pad" suffix="g" testID="quick-protein" />
        <Input containerStyle={{ flex: 1 }} label="Kohlenh." value={c} onChangeText={setC} keyboardType="decimal-pad" suffix="g" />
        <Input containerStyle={{ flex: 1 }} label="Fett" value={f} onChangeText={setF} keyboardType="decimal-pad" suffix="g" />
      </Row>
      <ChipGroup options={MEAL_ORDER.map((x) => ({ value: x, label: MEAL_LABELS_DE[x] }))} value={m} onChange={(v) => setM(v as MealType)} />
      <Text variant="small" tone="muted">
        Schnelleinträge werden als Schätzung (~) markiert und können jederzeit korrigiert werden.
      </Text>
      {err && <Text tone="danger">{err}</Text>}
    </Screen>
  );
}
