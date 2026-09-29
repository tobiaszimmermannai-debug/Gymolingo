import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { activityDef, addDays, formatNumberDE, formatPace, hasLevels, isNetActivity, levelLabel, speedKmh, todayISO, type CardioActivity, type CardioIntensity, type CardioSession } from '@gymolingo/core';
import { Screen, Row } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Input, parseDecimal } from '@/ui/Input';
import { ChipGroup } from '@/ui/Chip';
import { spacing } from '@/ui/theme';
import { confirm } from '@/lib/dialog';
import { haptic } from '@/lib/haptics';
import { computedKcal, currentWeightKg, deleteCardio, saveCardio } from './cardio';

const LEVELS: CardioIntensity[] = ['light', 'medium', 'intense'];
/** MET follows the speed when a distance is entered */
const SPEED_BASED = ['walk', 'jog', 'run', 'bike'];
const str = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n).replace('.', ','));

/** Log or edit any catalog activity (sport or everyday) with a live calorie estimate. */
export function CardioForm({ initialActivity, existing }: { initialActivity?: CardioActivity; existing?: CardioSession }) {
  const today = todayISO();
  const activity = existing?.activity ?? initialActivity ?? 'jog';
  const def = activityDef(activity);
  const [date, setDate] = useState(existing?.date ?? today);
  const [duration, setDuration] = useState(str(existing?.duration_min ?? def.duration));
  const [distance, setDistance] = useState(str(existing?.distance_km));
  const [intensity, setIntensity] = useState<CardioIntensity>(existing?.intensity ?? 'medium');
  const [kcalOverride, setKcalOverride] = useState(existing?.kcal_manual ? String(existing.kcal) : '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [err, setErr] = useState<string | null>(null);

  const isEms = activity === 'ems';
  const net = isNetActivity(activity);
  const dur = parseDecimal(duration) ?? 0;
  const dist = def.distance ? parseDecimal(distance) : null;
  const showLevels = hasLevels(activity) && !(SPEED_BASED.includes(activity) && dist);
  const auto = useMemo(() => (dur > 0 ? computedKcal({ activity, intensity, duration_min: dur, distance_km: dist }) : 0), [activity, intensity, dur, dist]);
  const pace = formatPace(dur, dist);
  const speed = speedKmh(dur, dist);
  const weight = currentWeightKg();

  const save = () => {
    if (!(dur > 0 && dur <= 1440)) return setErr('Bitte eine Dauer in Minuten eingeben.');
    if (dist !== null && !(dist > 0 && dist <= 500)) return setErr('Bitte eine realistische Distanz in km eingeben (oder leer lassen).');
    const manual = kcalOverride.trim() ? parseDecimal(kcalOverride) : null;
    if (manual !== null && !(manual >= 0 && manual <= 10000)) return setErr('Kalorien zwischen 0 und 10.000.');
    saveCardio({ date, activity, duration_min: dur, distance_km: dist, intensity, kcal: manual, note: note.trim() || null }, existing?.id);
    haptic('success');
    router.back();
  };

  return (
    <Screen title={existing ? 'Aktivität bearbeiten' : 'Aktivität eintragen'} back testID="cardio-form" footer={<Button title="Speichern" onPress={save} testID="cardio-save" />}>
      <Card padding={spacing.md} testID="cardio-activity">
        <Row>
          <Text variant="h2">{def.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text variant="h3">{def.label}</Text>
            <Text variant="small" tone="secondary">
              {def.training ? 'Zählt als Trainingstag' : net ? 'Alltagsaktivität – zählt den Mehrverbrauch' : 'Aktivität'}
            </Text>
          </View>
          {!existing && <Button title="Ändern" size="sm" variant="ghost" onPress={() => router.replace('/cardio/pick')} testID="cardio-change" />}
        </Row>
      </Card>
      <ChipGroup
        options={[
          { value: today, label: 'Heute' },
          { value: addDays(today, -1), label: 'Gestern' },
          { value: addDays(today, -2), label: 'Vorgestern' },
          ...(existing && existing.date < addDays(today, -2) ? [{ value: existing.date, label: existing.date }] : []),
        ]}
        value={date}
        onChange={(v) => setDate(v as string)}
      />
      <Row style={{ alignItems: 'flex-start' }}>
        <Input containerStyle={{ flex: 1 }} label="Dauer" value={duration} onChangeText={setDuration} keyboardType="decimal-pad" suffix="min" testID="cardio-duration" />
        {def.distance && <Input containerStyle={{ flex: 1 }} label="Distanz (optional)" value={distance} onChangeText={setDistance} keyboardType="decimal-pad" suffix="km" placeholder="z. B. 5" testID="cardio-distance" />}
      </Row>
      {showLevels && (
        <View style={{ gap: 6 }}>
          <Text variant="smallMedium">{isEms ? 'Intensität (Stromstärke & Übungen)' : SPEED_BASED.includes(activity) ? 'Tempo' : 'Intensität'}</Text>
          <ChipGroup options={LEVELS.map((i) => ({ value: i, label: levelLabel(activity, i) }))} value={intensity} onChange={(v) => setIntensity(v as CardioIntensity)} testIDPrefix="cardio-intensity" />
        </View>
      )}

      <Card variant="accent" testID="cardio-estimate">
        <Text variant="caption" tone="secondary">
          Geschätzter Verbrauch
        </Text>
        <Text variant="h1" testID="cardio-kcal">
          ≈ {formatNumberDE(auto, 0)} kcal
        </Text>
        {pace && speed && (
          <Text variant="bodyMedium" testID="cardio-pace">
            {pace} min/km · {formatNumberDE(speed, 1)} km/h
          </Text>
        )}
        <Text variant="small" tone="secondary" style={{ marginTop: 6 }}>
          {isEms
            ? `EMS-Studien messen ca. 70–150 kcal pro 20 Minuten; danach kann der Grundumsatz für einige Stunden erhöht sein. Berechnet mit ${formatNumberDE(weight, 1)} kg Körpergewicht.`
            : net
              ? `Nur der Mehrverbrauch gegenüber Ruhe zählt – normaler Alltag steckt schon in deinem Kalorienbedarf. MET-Werte nach dem Compendium of Physical Activities, ${formatNumberDE(weight, 1)} kg Körpergewicht.`
              : `Berechnet nach MET-Werten (Compendium of Physical Activities${SPEED_BASED.includes(activity) ? (dist ? ', Tempo aus Distanz und Dauer' : ', typisches Tempo für die Stufe') : ''}) und ${formatNumberDE(weight, 1)} kg Körpergewicht.`}
        </Text>
      </Card>

      <Input label="Eigener Wert, z. B. von der Uhr (optional)" value={kcalOverride} onChangeText={setKcalOverride} keyboardType="number-pad" suffix="kcal" placeholder={String(auto)} testID="cardio-kcal-override" />
      <Input label={activity === 'other' ? 'Was hast du gemacht?' : 'Notiz (optional)'} value={note} onChangeText={setNote} placeholder={isEms ? 'z. B. Programm, Trainer' : activity === 'other' ? 'z. B. Kletterpark' : def.distance ? 'z. B. Strecke' : ''} testID="cardio-note" />
      {err && (
        <Text tone="danger" testID="cardio-error">
          {err}
        </Text>
      )}
      {existing && (
        <Button
          title="Eintrag löschen"
          variant="ghost"
          icon="trash-outline"
          testID="cardio-delete"
          onPress={async () => {
            if (await confirm('Eintrag löschen?', `${def.label} vom ${existing.date}`, 'Löschen', true)) {
              deleteCardio(existing.id);
              router.back();
            }
          }}
        />
      )}
    </Screen>
  );
}
