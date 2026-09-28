import { useMemo } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { computePersonalRecords, e1rmSeries, EQUIPMENT_LABELS_DE, exerciseHistory, formatDateDE, formatKg, MUSCLE_LABELS_DE, suggestProgression } from '@gymolingo/core';
import { Screen, Row, Section } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { LineChart } from '@/ui/Charts';
import { colors, spacing } from '@/ui/theme';
import { useExerciseLookup, useRows } from '@/data/hooks';

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const lookup = useExerciseLookup();
  const ex = lookup(id);
  const sessions = useRows('workout_sessions');
  const sets = useRows('workout_sets');
  const series = useMemo(() => e1rmSeries(id, sessions, sets), [id, sessions, sets]);
  const history = useMemo(() => exerciseHistory(id, sessions, sets, { limit: 20 }), [id, sessions, sets]);
  const rec = useMemo(() => computePersonalRecords(sessions, sets).records[id], [id, sessions, sets]);
  const sugg = useMemo(
    () =>
      ex
        ? suggestProgression(history, { rep_min: ex.default_rep_min, rep_max: ex.default_rep_max, target_sets: Math.max(1, history[0]?.sets.length ?? 3), target_rir: 2, increment_kg: ex.increment_kg, is_bodyweight: ex.is_bodyweight })
        : null,
    [ex, history],
  );

  if (!ex) {
    return (
      <Screen title="Übung" back>
        <Text tone="secondary">Übung nicht gefunden.</Text>
      </Screen>
    );
  }
  return (
    <Screen title={ex.name} subtitle={`${MUSCLE_LABELS_DE[ex.primary_muscle]} · ${EQUIPMENT_LABELS_DE[ex.equipment]}`} back testID="exercise-detail">
      <Row style={{ alignItems: 'stretch' }}>
        <Card style={{ flex: 1 }} padding={spacing.md}>
          <Text variant="caption" tone="secondary">
            Bestes 1RM (geschätzt)
          </Text>
          <Text variant="h2" testID="best-e1rm">
            {rec?.bestE1RM ? formatKg(rec.bestE1RM.value) : '–'}
          </Text>
        </Card>
        <Card style={{ flex: 1 }} padding={spacing.md}>
          <Text variant="caption" tone="secondary">
            Höchstes Gewicht
          </Text>
          <Text variant="h2">{rec?.maxWeight ? `${formatKg(rec.maxWeight.value)} × ${rec.maxWeight.reps}` : '–'}</Text>
        </Card>
      </Row>
      {sugg && (
        <Card variant="accent">
          <Text variant="caption" tone="secondary">
            Nächstes Training
          </Text>
          <Text variant="h3" style={{ marginTop: 2 }}>
            {sugg.kind === 'first_time' ? 'Arbeitsgewicht finden' : `${formatKg(sugg.weight_kg)} × ${sugg.reps.join('/')}`}
          </Text>
          <Text variant="small" tone="secondary" style={{ marginTop: 4 }}>
            {sugg.rationale}
          </Text>
        </Card>
      )}
      <Section title="Kraftentwicklung (geschätztes 1RM)">
        <Card>
          <LineChart series={[{ label: 'e1RM', color: colors.accent, points: series.map((p) => ({ x: p.date, y: p.e1rm })) }]} unit="kg" testID="e1rm-chart" />
        </Card>
      </Section>
      <Section title="Verlauf">
        {history.length === 0 && <Text tone="secondary">Noch nicht trainiert.</Text>}
        {history.map((h, i) => (
          <Card key={`${h.date}-${i}`} padding={spacing.md}>
            <Row>
              <Text variant="bodyMedium" style={{ width: 90 }}>
                {formatDateDE(h.date, true)}
              </Text>
              <View style={{ flex: 1 }}>
                <Text variant="small" tone="secondary">
                  {h.sets.map((s) => `${formatKg(s.weight_kg)}×${s.reps}${s.rir !== null ? ` @${s.rir}` : ''}`).join('  ·  ')}
                </Text>
              </View>
            </Row>
          </Card>
        ))}
      </Section>
      {ex.instructions && (
        <Card>
          <Text tone="secondary">{ex.instructions}</Text>
        </Card>
      )}
    </Screen>
  );
}
