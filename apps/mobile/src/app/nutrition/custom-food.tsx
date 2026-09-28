import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { validateNutrients, todayISO, type MealType } from '@gymolingo/core';
import { Screen, Row } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Button } from '@/ui/Button';
import { Input, parseDecimal } from '@/ui/Input';
import { insert } from '@/data/store';
import { requestSync } from '@/data/sync';

/** Create an own food (per 100 g) – e.g. from a product label. */
export default function CustomFood() {
  const { date = todayISO(), meal = 'lunch', name: initialName = '', barcode = '' } = useLocalSearchParams<{ date?: string; meal?: MealType; name?: string; barcode?: string }>();
  const [name, setName] = useState(decodeURIComponent(initialName));
  const [brand, setBrand] = useState('');
  const [kcal, setKcal] = useState('');
  const [p, setP] = useState('');
  const [c, setC] = useState('');
  const [f, setF] = useState('');
  const [fiber, setFiber] = useState('');
  const [sugar, setSugar] = useState('');
  const [salt, setSalt] = useState('');
  const [servingLabel, setServingLabel] = useState('');
  const [servingG, setServingG] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const save = () => {
    const vals = { kcal_100: parseDecimal(kcal), protein_100: parseDecimal(p), carbs_100: parseDecimal(c), fat_100: parseDecimal(f) };
    if (name.trim().length < 2) return setErrors(['Bitte einen Namen eingeben.']);
    if (Object.values(vals).some((v) => v === null)) return setErrors(['Bitte Kalorien, Protein, Kohlenhydrate und Fett pro 100 g angeben.']);
    const n = { ...(vals as Record<keyof typeof vals, number>), fiber_100: parseDecimal(fiber), sugar_100: parseDecimal(sugar), salt_100: parseDecimal(salt) };
    const issues = validateNutrients(n);
    if (issues.length) return setErrors(issues);
    const row = insert('custom_foods', {
      name: name.trim(),
      brand: brand.trim() || null,
      barcode: barcode ? String(barcode) : null,
      ...n,
      serving_label: servingLabel.trim() || null,
      serving_g: parseDecimal(servingG),
      source: 'custom',
      is_estimate: false,
      favorite: false,
    });
    requestSync();
    router.replace(`/nutrition/food?ref=${encodeURIComponent(`food:${row.id}`)}&date=${date}&meal=${meal}`);
  };

  return (
    <Screen title="Eigenes Lebensmittel" back footer={<Button title="Speichern & eintragen" onPress={save} testID="save-custom-food" />}>
      <Text variant="small" tone="secondary">
        Werte pro 100 g bzw. 100 ml – steht auf der Nährwerttabelle der Verpackung.
      </Text>
      <Input label="Name" value={name} onChangeText={setName} testID="cf-name" />
      <Input label="Marke (optional)" value={brand} onChangeText={setBrand} />
      <Row>
        <Input containerStyle={{ flex: 1 }} label="Kalorien" value={kcal} onChangeText={setKcal} keyboardType="decimal-pad" suffix="kcal" testID="cf-kcal" />
        <Input containerStyle={{ flex: 1 }} label="Protein" value={p} onChangeText={setP} keyboardType="decimal-pad" suffix="g" testID="cf-protein" />
      </Row>
      <Row>
        <Input containerStyle={{ flex: 1 }} label="Kohlenhydrate" value={c} onChangeText={setC} keyboardType="decimal-pad" suffix="g" testID="cf-carbs" />
        <Input containerStyle={{ flex: 1 }} label="Fett" value={f} onChangeText={setF} keyboardType="decimal-pad" suffix="g" testID="cf-fat" />
      </Row>
      <Row>
        <Input containerStyle={{ flex: 1 }} label="Ballaststoffe" value={fiber} onChangeText={setFiber} keyboardType="decimal-pad" suffix="g" />
        <Input containerStyle={{ flex: 1 }} label="Zucker" value={sugar} onChangeText={setSugar} keyboardType="decimal-pad" suffix="g" />
        <Input containerStyle={{ flex: 1 }} label="Salz" value={salt} onChangeText={setSalt} keyboardType="decimal-pad" suffix="g" />
      </Row>
      <Row>
        <Input containerStyle={{ flex: 2 }} label="Portion (optional)" value={servingLabel} onChangeText={setServingLabel} placeholder="z. B. 1 Riegel" />
        <Input containerStyle={{ flex: 1 }} label="Gramm" value={servingG} onChangeText={setServingG} keyboardType="decimal-pad" suffix="g" />
      </Row>
      {errors.map((e) => (
        <Text key={e} tone="danger" variant="small">
          {e}
        </Text>
      ))}
    </Screen>
  );
}
