import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { formatDateDE, formatNumberDE, formatSigned, todayISO, type BodyMeasurement } from '@gymolingo/core';
import { Screen, Row, Section } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Input, parseDecimal } from '@/ui/Input';
import { Chip } from '@/ui/Chip';
import { LineChart } from '@/ui/Charts';
import { colors, spacing } from '@/ui/theme';
import { useRows } from '@/data/hooks';
import { insert, update } from '@/data/store';
import { requestSync } from '@/data/sync';
import { BodyFatCard } from '@/features/BodyFatCard';

const FIELDS: { key: keyof Pick<BodyMeasurement, 'waist_cm' | 'chest_cm' | 'hips_cm' | 'arm_cm' | 'thigh_cm' | 'neck_cm'>; label: string }[] = [
  { key: 'waist_cm', label: 'Taille' },
  { key: 'chest_cm', label: 'Brust' },
  { key: 'hips_cm', label: 'Hüfte' },
  { key: 'arm_cm', label: 'Oberarm' },
  { key: 'thigh_cm', label: 'Oberschenkel' },
  { key: 'neck_cm', label: 'Hals' },
];

export default function Measurements() {
  const rows = useRows('body_measurements');
  const today = todayISO();
  const todays = rows.find((r) => r.date === today);
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(FIELDS.map((f) => [f.key, todays?.[f.key] ? String(todays[f.key]).replace('.', ',') : ''])));
  const [chart, setChart] = useState<(typeof FIELDS)[number]['key']>('waist_cm');
  const [err, setErr] = useState<string | null>(null);
  const sorted = useMemo(() => [...rows].sort((a, b) => a.date.localeCompare(b.date)), [rows]);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const save = () => {
    const data: Partial<BodyMeasurement> = {};
    for (const f of FIELDS) {
      const v = vals[f.key] ? parseDecimal(vals[f.key]) : null;
      if (v !== null && (v < 10 || v > 250)) return setErr(`${f.label}: unplausibler Wert.`);
      (data as Record<string, number | null>)[f.key] = v;
    }
    if (FIELDS.every((f) => data[f.key] === null)) return setErr('Bitte mindestens einen Wert eintragen.');
    setErr(null);
    if (todays) update('body_measurements', todays.id, data);
    else insert('body_measurements', { date: today, note: null, waist_cm: null, chest_cm: null, hips_cm: null, arm_cm: null, thigh_cm: null, neck_cm: null, ...data });
    requestSync();
  };

  return (
    <Screen title="Körpermaße" back testID="measurements-screen" right={<Button title="Fotos" size="sm" variant="secondary" icon="images-outline" onPress={() => router.push('/body/photos')} />}>
      <Card>
        <Text variant="small" tone="secondary" style={{ marginBottom: spacing.sm }}>
          Maßband locker anlegen, immer an derselben Stelle und zur gleichen Tageszeit messen.
        </Text>
        {[0, 2, 4].map((i) => (
          <Row key={i} style={{ marginBottom: spacing.sm }}>
            {FIELDS.slice(i, i + 2).map((f) => (
              <Input key={f.key} containerStyle={{ flex: 1 }} label={f.label} value={vals[f.key]} onChangeText={(v) => setVals((s) => ({ ...s, [f.key]: v }))} keyboardType="decimal-pad" suffix="cm" testID={`m-${f.key}`} />
            ))}
          </Row>
        ))}
        {err && <Text tone="danger">{err}</Text>}
        <Button title="Speichern" onPress={save} testID="save-measurements" />
      </Card>
      <BodyFatCard />
      {sorted.length > 0 && (
        <Section title="Verlauf">
          <Row gap={spacing.sm} wrap>
            {FIELDS.map((f) => (
              <Chip key={f.key} label={f.label} selected={chart === f.key} onPress={() => setChart(f.key)} />
            ))}
          </Row>
          <Card>
            <LineChart unit="cm" series={[{ label: FIELDS.find((f) => f.key === chart)!.label, color: colors.accent, points: sorted.filter((r) => r[chart] !== null).map((r) => ({ x: r.date, y: Number(r[chart]) })) }]} />
          </Card>
          {first && last && first.id !== last.id && (
            <Card padding={spacing.md}>
              <Text variant="smallMedium">
                Veränderung seit {formatDateDE(first.date)}
              </Text>
              {FIELDS.filter((f) => first[f.key] !== null && last[f.key] !== null).map((f) => (
                <Row key={f.key} style={{ justifyContent: 'space-between', marginTop: 4 }}>
                  <Text variant="small" tone="secondary">
                    {f.label}
                  </Text>
                  <Text variant="small">
                    {formatNumberDE(Number(last[f.key]), 1)} cm ({formatSigned(Number(last[f.key]) - Number(first[f.key]), 1, 'cm')})
                  </Text>
                </Row>
              ))}
            </Card>
          )}
        </Section>
      )}
    </Screen>
  );
}
