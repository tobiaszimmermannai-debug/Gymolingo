import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  e1rmSeries,
  formatDateDE,
  formatKg,
  formatNumberDE,
  formatSigned,
  MUSCLE_GROUP_BUCKETS,
  mostTrainedExercises,
  STREAK_LABELS_DE,
  todayISO,
  type PeriodKey,
  type StreakKind,
} from '@gymolingo/core';
import { Screen, Row, Section } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { Button } from '@/ui/Button';
import { BarChart, LineChart } from '@/ui/Charts';
import { ProgressBar } from '@/ui/ProgressBar';
import { colors, spacing } from '@/ui/theme';
import { useExerciseLookup, useUserData } from '@/data/hooks';
import { computeProgress, pctChange } from '@/features/progress';
import { useStreaks } from '@/features/today';

const PERIODS: { value: PeriodKey; label: string }[] = [
  { value: '7d', label: '7 T' },
  { value: '30d', label: '30 T' },
  { value: '90d', label: '90 T' },
  { value: '6m', label: '6 M' },
  { value: '1y', label: '1 J' },
  { value: 'all', label: 'Alles' },
];

export default function Progress() {
  const [period, setPeriod] = useState<PeriodKey>('30d');
  const data = useUserData();
  const lookup = useExerciseLookup();
  const today = todayISO();
  const pr = useMemo(() => computeProgress(data, period, today, lookup), [data, period, today, lookup]);
  const streaks = useStreaks(data, today);
  const keyLifts = useMemo(() => mostTrainedExercises(data.sets, 6), [data.sets]);
  const [lift, setLift] = useState<string | null>(null);
  const selectedLift = lift ?? keyLifts[0] ?? null;
  const liftSeries = useMemo(() => (selectedLift ? e1rmSeries(selectedLift, data.sessions, data.sets).filter((p) => p.date >= pr.range.from) : []), [selectedLift, data, pr.range.from]);
  const p = data.profile;
  const { cur, prev } = pr;
  const muscleBuckets = Object.entries(MUSCLE_GROUP_BUCKETS).map(([label, ms]) => ({ label, sets: ms.reduce((a, m) => a + (pr.muscles[m] ?? 0), 0) }));
  const weeks = Math.max(1, pr.range.days / 7);
  const maxMuscle = Math.max(1, ...muscleBuckets.map((m) => m.sets / weeks));

  return (
    <Screen title="Fortschritt" tabBarPadding testID="progress-screen" right={<Button title="Bericht" icon="document-text-outline" size="sm" variant="secondary" onPress={() => router.push('/coach/report')} />}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {PERIODS.map((o) => (
          <Chip key={o.value} label={o.label} selected={period === o.value} onPress={() => setPeriod(o.value)} testID={`period-${o.value}`} />
        ))}
      </ScrollView>
      <Text variant="small" tone="muted">
        {formatDateDE(pr.range.from)} – {formatDateDE(pr.range.to)} · Vergleich mit {formatDateDE(pr.range.prevFrom)} – {formatDateDE(pr.range.prevTo)}
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Kpi label="Trainings" value={String(cur.workouts)} delta={cur.workouts - prev.workouts} deltaText={formatSigned(cur.workouts - prev.workouts, 0)} testID="kpi-workouts" />
        <Kpi label="Volumen" value={`${formatNumberDE(cur.volumeKg / 1000, 1)} t`} delta={pctChange(cur.volumeKg, prev.volumeKg)} deltaText={pct(pctChange(cur.volumeKg, prev.volumeKg))} />
        <Kpi label="Kraft (e1RM)" value={pr.strength.pct === null ? '–' : formatSigned(pr.strength.pct, 1, '%')} delta={pr.strength.pct} deltaText={pr.strength.pct === null ? 'zu wenig Vergleichsdaten' : `${pr.strength.exercises.length} Übungen`} />
        <Kpi label="Ø Kalorien" value={cur.avgKcal === null ? '–' : formatNumberDE(cur.avgKcal, 0)} delta={null} deltaText={`Ziel ${formatNumberDE(p.calorie_target, 0)}`} />
        <Kpi label="Ø Protein" value={cur.avgProtein === null ? '–' : `${formatNumberDE(cur.avgProtein, 0)} g`} delta={pctChange(cur.avgProtein, prev.avgProtein)} deltaText={`Ziel ${p.protein_target_g} g`} />
        <Kpi label="Ø Schritte" value={cur.avgSteps === null ? '–' : formatNumberDE(cur.avgSteps, 0)} delta={pctChange(cur.avgSteps, prev.avgSteps)} deltaText={pct(pctChange(cur.avgSteps, prev.avgSteps))} />
        <Kpi
          label="Ø Gewicht"
          value={cur.avgWeight === null ? '–' : `${formatNumberDE(cur.avgWeight, 1)} kg`}
          delta={null}
          deltaText={cur.avgWeight !== null && prev.avgWeight !== null ? `${formatSigned(cur.avgWeight - prev.avgWeight, 1, 'kg')} vs. vorher` : 'kein Vergleich'}
        />
        <Kpi label="Getrackte Tage" value={`${cur.nutritionDays}/${pr.range.days}`} delta={cur.nutritionDays - prev.nutritionDays} deltaText={formatSigned(cur.nutritionDays - prev.nutritionDays, 0)} />
      </View>

      <Section title="Körpergewicht" action={<Button title="Eintragen" size="sm" variant="ghost" onPress={() => router.push('/body/weight')} />}>
        <Card>
          <LineChart
            testID="progress-weight-chart"
            unit="kg"
            area={false}
            series={[
              { label: 'Tageswert', color: colors.textMuted, kind: 'dots', points: pr.weightInRange.map((d) => ({ x: d.date, y: d.weight })) },
              { label: 'Ø 7 Tage', color: colors.weight, points: pr.weightAvg.map((d) => ({ x: d.date, y: d.weight })) },
            ]}
          />
        </Card>
        {pr.bodyFat.length > 0 && (
          <Card>
            <Text variant="smallMedium">Körperfett</Text>
            <LineChart unit="%" series={[{ label: 'Körperfett', color: colors.fat, points: pr.bodyFat.map((d) => ({ x: d.date, y: d.value })) }]} height={140} />
          </Card>
        )}
      </Section>

      <Section title="Kraftentwicklung">
        {keyLifts.length === 0 ? (
          <Text tone="muted" variant="small">
            Sobald du trainierst, siehst du hier dein geschätztes 1RM pro Übung.
          </Text>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {keyLifts.map((id) => (
                <Chip key={id} label={lookup(id)?.name ?? id} selected={selectedLift === id} onPress={() => setLift(id)} />
              ))}
            </ScrollView>
            <Card onPress={selectedLift ? () => router.push(`/exercises/${selectedLift}`) : undefined}>
              <LineChart unit="kg" series={[{ label: 'e1RM', color: colors.accent, points: liftSeries.map((d) => ({ x: d.date, y: d.e1rm })) }]} testID="progress-e1rm-chart" />
            </Card>
          </>
        )}
      </Section>

      <Section title={pr.bucket === 'day' ? 'Trainingsvolumen pro Tag' : 'Trainingsvolumen pro Woche'}>
        <Card>
          <BarChart data={pr.volume.map((v) => ({ x: v.date, y: v.volumeKg }))} unit="kg" />
        </Card>
      </Section>

      <Section title="Sätze pro Muskelgruppe (Ø pro Woche)">
        <Card padding={spacing.md}>
          {muscleBuckets.map((m) => (
            <View key={m.label} style={{ marginVertical: 5 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text variant="small">{m.label}</Text>
                <Text variant="small" tone="secondary">
                  {formatNumberDE(m.sets / weeks, 1)} Sätze
                </Text>
              </Row>
              <ProgressBar progress={m.sets / weeks / maxMuscle} height={6} />
            </View>
          ))}
          <Text variant="small" tone="muted" style={{ marginTop: 6 }}>
            Richtwert Muskelaufbau: ca. 10–20 harte Sätze pro Muskelgruppe und Woche.
          </Text>
        </Card>
      </Section>

      <Section title={pr.bucket === 'day' ? 'Kalorien pro Tag' : 'Kalorien (Ø der getrackten Tage pro Woche)'}>
        <Card>
          <BarChart data={pr.kcalSeries} unit="kcal" target={p.calorie_target} color={colors.carbs} testID="progress-kcal-chart" />
        </Card>
      </Section>
      <Section title="Protein">
        <Card>
          <BarChart data={pr.proteinSeries} unit="g" target={p.protein_target_g} color={colors.protein} />
          <Text variant="small" tone="secondary" style={{ marginTop: 6 }}>
            Proteinziel an {cur.proteinDays} Tagen erreicht (vorher {prev.proteinDays})
          </Text>
        </Card>
      </Section>
      <Section title="Schritte">
        <Card>
          <BarChart data={pr.stepsSeries} unit="Schritte" target={p.step_target} color={colors.steps} />
          <Text variant="small" tone="secondary" style={{ marginTop: 6 }}>
            Schrittziel an {cur.stepGoalDays} Tagen erreicht (vorher {prev.stepGoalDays})
          </Text>
        </Card>
      </Section>

      <Section title="Serien">
        <Card padding={spacing.md}>
          {(['training', 'nutrition', 'protein', 'steps', 'checkin', 'weight'] as StreakKind[])
            .filter((k) => k !== 'weight' || p.weight_tracking_enabled)
            .map((k) => (
              <Row key={k} style={{ justifyContent: 'space-between', paddingVertical: 5 }}>
                <Text variant="small">{STREAK_LABELS_DE[k]}</Text>
                <Text variant="smallMedium">
                  {streaks[k].current} <Text variant="small" tone="muted">(Rekord {streaks[k].best})</Text>
                </Text>
              </Row>
            ))}
        </Card>
      </Section>

      <Section title={`Persönliche Rekorde im Zeitraum (${pr.prs.length})`}>
        {pr.prs.length === 0 && (
          <Text variant="small" tone="muted">
            Noch keine neuen Rekorde in diesem Zeitraum.
          </Text>
        )}
        {pr.prs
          .slice(-12)
          .reverse()
          .map((e, i) => (
            <Row key={`${e.set_id}-${e.type}-${i}`} style={{ paddingVertical: 4 }}>
              <Ionicons name="trophy" size={16} color={colors.accent} />
              <Text variant="small" style={{ flex: 1 }}>
                {lookup(e.exercise_id)?.name ?? 'Übung'}
              </Text>
              <Text variant="small" tone="secondary">
                {e.type === 'reps' ? `${e.reps} Wdh. @ ${formatKg(e.weight_kg)}` : e.type === 'e1rm' ? `e1RM ${formatKg(e.value)}` : `${formatKg(e.value)} × ${e.reps}`} · {formatDateDE(e.date)}
              </Text>
            </Row>
          ))}
      </Section>
    </Screen>
  );
}

const pct = (v: number | null) => (v === null ? 'kein Vergleich' : `${formatSigned(v, 1, '%')} vs. vorher`);

function Kpi({ label, value, delta, deltaText, testID }: { label: string; value: string; delta: number | null; deltaText: string; testID?: string }) {
  const tone = delta === null || delta === 0 ? 'muted' : delta > 0 ? 'success' : 'warning';
  return (
    <Card style={{ width: '48.5%' }} padding={spacing.md} testID={testID}>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <Text variant="h2" style={{ marginTop: 2 }}>
        {value}
      </Text>
      <Text variant="small" tone={tone}>
        {deltaText}
      </Text>
    </Card>
  );
}
