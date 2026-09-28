import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { addDays, dailyBodyFat, dailyWeights, formatDateDE, formatNumberDE, formatSigned, movingAverage, todayISO, weightSummary } from '@gymolingo/core';
import { Screen, Row, Section } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { Button, IconButton } from '@/ui/Button';
import { Input, parseDecimal } from '@/ui/Input';
import { Segmented } from '@/ui/Chip';
import { LineChart } from '@/ui/Charts';
import { colors, spacing } from '@/ui/theme';
import { useProfileOrDefault, useRows } from '@/data/hooks';
import { logWeight } from '@/data/actions';
import { remove } from '@/data/store';
import { requestSync } from '@/data/sync';
import { confirm } from '@/lib/dialog';
import { haptic } from '@/lib/haptics';

export default function Weight() {
  const weights = useRows('weight_entries');
  const p = useProfileOrDefault();
  const today = todayISO();
  const todays = weights.find((w) => w.date === today);
  const [value, setValue] = useState(todays ? String(todays.weight_kg).replace('.', ',') : '');
  const [bf, setBf] = useState(todays?.body_fat_pct ? String(todays.body_fat_pct).replace('.', ',') : '');
  const [range, setRange] = useState<'30' | '90' | '365'>('30');
  const [err, setErr] = useState<string | null>(null);
  const sum = useMemo(() => weightSummary(weights, today), [weights, today]);
  const from = addDays(today, -(Number(range) - 1));
  const daily = useMemo(() => dailyWeights(weights).filter((x) => x.date >= from), [weights, from]);
  const avg = useMemo(() => movingAverage(dailyWeights(weights), 7).filter((x) => x.date >= from), [weights, from]);
  const fat = useMemo(() => dailyBodyFat(weights).filter((x) => x.date >= from), [weights, from]);
  const list = useMemo(() => [...weights].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30), [weights]);

  const save = () => {
    const w = parseDecimal(value);
    const b = bf ? parseDecimal(bf) : null;
    if (w === null || w < 20 || w > 400) return setErr('Bitte ein Gewicht zwischen 20 und 400 kg eingeben.');
    if (b !== null && (b < 2 || b > 70)) return setErr('Körperfett zwischen 2 und 70 %.');
    setErr(null);
    logWeight(today, Math.round(w * 100) / 100, b);
    haptic('success');
  };

  return (
    <Screen title="Körpergewicht" back testID="weight-screen" right={<IconButton icon="body-outline" accessibilityLabel="Körpermaße" onPress={() => router.push('/body/measurements')} />}>
      <Card variant="accent">
        <Text variant="caption" tone="secondary">
          Heute wiegen
        </Text>
        <Row style={{ marginTop: spacing.sm, alignItems: 'flex-start' }}>
          <Input testID="weight-input" containerStyle={{ flex: 1 }} value={value} onChangeText={setValue} keyboardType="decimal-pad" suffix="kg" placeholder={sum.latest ? formatNumberDE(sum.latest.weight, 1) : '80,0'} />
          <Input containerStyle={{ flex: 1 }} value={bf} onChangeText={setBf} keyboardType="decimal-pad" suffix="% KFA" placeholder="optional" accessibilityLabel="Körperfett in Prozent" />
        </Row>
        {err && (
          <Text tone="danger" variant="small" style={{ marginTop: 4 }}>
            {err}
          </Text>
        )}
        <Button testID="save-weight" title={todays ? 'Aktualisieren' : 'Speichern'} style={{ marginTop: spacing.md }} onPress={save} />
        <Text variant="small" tone="muted" style={{ marginTop: spacing.sm }}>
          Am besten morgens nach dem Toilettengang, vor dem Frühstück. Tagesschwankungen von 0,5–1,5 kg sind normal.
        </Text>
      </Card>

      <Row style={{ alignItems: 'stretch' }}>
        <Stat label="Ø 7 Tage" value={sum.avg7 !== null ? `${formatNumberDE(sum.avg7, 1)} kg` : '–'} sub={sum.avg7 !== null && sum.avg7Prev !== null ? `${formatSigned(sum.avg7 - sum.avg7Prev, 1, 'kg')} zur Vorwoche` : 'noch keine Vorwoche'} testID="avg7" />
        <Stat label="Trend 30 Tage" value={sum.weeklyRate30 !== null ? `${formatSigned(sum.weeklyRate30, 2, 'kg')}/Wo.` : '–'} sub={sum.weeklyRate30 !== null ? `Plan: ${formatSigned(p.weekly_rate_kg, 2, 'kg')}/Wo.` : 'mind. 2 Wochen Daten nötig'} />
      </Row>
      {p.goal_weight_kg && sum.avg7 !== null && (
        <Card padding={spacing.md}>
          <Text variant="small" tone="secondary">
            Zielgewicht {formatNumberDE(p.goal_weight_kg, 1)} kg · noch {formatNumberDE(Math.abs(sum.avg7 - p.goal_weight_kg), 1)} kg
            {sum.weeklyRate30 && Math.sign(sum.weeklyRate30) === Math.sign(p.goal_weight_kg - sum.avg7) && Math.abs(sum.weeklyRate30) > 0.05
              ? ` · bei aktuellem Trend ca. ${Math.ceil(Math.abs((p.goal_weight_kg - sum.avg7) / sum.weeklyRate30))} Wochen`
              : ''}
          </Text>
        </Card>
      )}

      <Section title="Verlauf" action={<View style={{ width: 200 }}><Segmented options={[{ value: '30', label: '30 T' }, { value: '90', label: '90 T' }, { value: '365', label: '1 J' }]} value={range} onChange={(v) => setRange(v as '30' | '90' | '365')} /></View>}>
        <Card>
          <LineChart
            testID="weight-chart"
            unit="kg"
            area={false}
            series={[
              { label: 'Tageswert', color: colors.textMuted, kind: 'dots', points: daily.map((d) => ({ x: d.date, y: d.weight })) },
              { label: 'Ø 7 Tage', color: colors.weight, points: avg.map((d) => ({ x: d.date, y: d.weight })) },
            ]}
          />
        </Card>
        {fat.length > 0 && (
          <Card>
            <Text variant="smallMedium" style={{ marginBottom: 6 }}>
              Körperfettanteil
            </Text>
            <LineChart unit="%" series={[{ label: 'Körperfett', color: colors.fat, points: fat.map((d) => ({ x: d.date, y: d.value })) }]} />
          </Card>
        )}
      </Section>

      <Section title="Einträge">
        {list.map((w) => (
          <Row key={w.id} style={{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ flex: 1 }}>{formatDateDE(w.date, true)}</Text>
            <Text variant="bodyMedium">{formatNumberDE(w.weight_kg, 1)} kg</Text>
            {w.body_fat_pct !== null && (
              <Text variant="small" tone="secondary">
                {formatNumberDE(w.body_fat_pct, 1)} %
              </Text>
            )}
            <IconButton
              icon="trash-outline"
              size={30}
              background="transparent"
              color={colors.textMuted}
              accessibilityLabel="Eintrag löschen"
              onPress={async () => {
                if (await confirm('Eintrag löschen?', `${formatDateDE(w.date)}: ${formatNumberDE(w.weight_kg, 1)} kg`, 'Löschen', true)) {
                  remove('weight_entries', w.id);
                  requestSync();
                }
              }}
            />
          </Row>
        ))}
      </Section>
    </Screen>
  );
}

function Stat({ label, value, sub, testID }: { label: string; value: string; sub: string; testID?: string }) {
  return (
    <Card style={{ flex: 1 }} padding={spacing.md}>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <Text variant="h2" testID={testID} style={{ marginTop: 4 }}>
        {value}
      </Text>
      <Text variant="small" tone="muted">
        {sub}
      </Text>
    </Card>
  );
}
