import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { EQUIPMENT_LABELS_DE, MUSCLE_LABELS_DE, type Equipment, type MuscleGroup } from '@gymolingo/core';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Input, parseDecimal } from '@/ui/Input';
import { ChipGroup } from '@/ui/Chip';
import { Button } from '@/ui/Button';
import { Row } from '@/ui/Screen';
import { insert } from '@/data/store';
import { addExerciseToDay, addExerciseToSession } from '@/data/actions';
import { defaultConfig } from '@/features/planner';
import { requestSync } from '@/data/sync';

export default function NewExercise() {
  const { mode, id } = useLocalSearchParams<{ mode?: 'session' | 'day'; id?: string }>();
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup>('chest');
  const [equipment, setEquipment] = useState<Equipment>('machine');
  const [category, setCategory] = useState<'compound' | 'isolation'>('compound');
  const [inc, setInc] = useState('2,5');
  const [repMin, setRepMin] = useState('8');
  const [repMax, setRepMax] = useState('12');
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const incN = parseDecimal(inc);
    const lo = parseDecimal(repMin);
    const hi = parseDecimal(repMax);
    if (name.trim().length < 2) return setError('Bitte einen Namen eingeben.');
    if (incN === null || incN < 0 || incN > 50) return setError('Gewichtsschritt zwischen 0 und 50 kg.');
    if (!lo || !hi || lo > hi) return setError('Ungültiger Wiederholungsbereich.');
    const row = insert('custom_exercises', {
      name: name.trim(),
      primary_muscle: muscle,
      secondary_muscles: [],
      equipment,
      category,
      increment_kg: incN,
      is_bodyweight: equipment === 'bodyweight',
      default_rep_min: Math.round(lo),
      default_rep_max: Math.round(hi),
      instructions: null,
    });
    requestSync();
    const def = { ...row, increment_kg: incN, instructions: undefined };
    if (mode === 'session' && id) addExerciseToSession(id, defaultConfig(def));
    if (mode === 'day' && id) addExerciseToDay(id, def);
    router.back();
    if (mode) router.back();
  };

  return (
    <Screen title="Eigene Übung" back footer={<Button title="Speichern" onPress={save} testID="save-exercise" />}>
      <Input label="Name" value={name} onChangeText={setName} placeholder="z. B. Kabelrudern einarmig" error={error} testID="custom-exercise-name" />
      <Text variant="smallMedium" tone="secondary">
        Hauptmuskel
      </Text>
      <ChipGroup options={(Object.keys(MUSCLE_LABELS_DE) as MuscleGroup[]).filter((m) => m !== 'cardio' && m !== 'full_body').map((m) => ({ value: m, label: MUSCLE_LABELS_DE[m] }))} value={muscle} onChange={(v) => setMuscle(v as MuscleGroup)} />
      <Text variant="smallMedium" tone="secondary">
        Equipment
      </Text>
      <ChipGroup options={(Object.keys(EQUIPMENT_LABELS_DE) as Equipment[]).map((e) => ({ value: e, label: EQUIPMENT_LABELS_DE[e] }))} value={equipment} onChange={(v) => setEquipment(v as Equipment)} />
      <ChipGroup options={[{ value: 'compound', label: 'Mehrgelenkig' }, { value: 'isolation', label: 'Isolation' }]} value={category} onChange={(v) => setCategory(v as 'compound' | 'isolation')} />
      <Input label="Kleinster Gewichtsschritt" value={inc} onChangeText={setInc} suffix="kg" keyboardType="decimal-pad" hint="z. B. 2,5 kg Langhantel, 5 kg Maschine, 2 kg Kurzhanteln" />
      <Row>
        <Input containerStyle={{ flex: 1 }} label="Wdh. min" value={repMin} onChangeText={setRepMin} keyboardType="number-pad" />
        <Input containerStyle={{ flex: 1 }} label="Wdh. max" value={repMax} onChangeText={setRepMax} keyboardType="number-pad" />
      </Row>
    </Screen>
  );
}
