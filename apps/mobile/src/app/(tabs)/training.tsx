import { useMemo } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  activityIcon,
  activityLabel,
  hasLevels,
  levelLabel,
  cardioSummary,
  completedSessions,
  formatDateDE,
  formatDuration,
  formatNumberDE,
  sessionPRs,
  startOfWeek,
  summarizeSession,
  todayISO,
  volumeSeries,
  addDays,
} from '@gymolingo/core';
import { Screen, Row, Section } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Badge } from '@/ui/Chip';
import { BarChart } from '@/ui/Charts';
import { colors, spacing } from '@/ui/theme';
import { useExerciseLookup, useRows } from '@/data/hooks';
import { useActivePlan, useTodayState } from '@/features/today';
import { startWorkoutForDay } from '@/features/workoutStart';
import { startWorkout } from '@/data/actions';
import { quickActivities } from '@/features/cardio';

export default function Training() {
  const t = useTodayState();
  const structure = useActivePlan();
  const plans = useRows('workout_plans');
  const sessions = useRows('workout_sessions');
  const sets = useRows('workout_sets');
  const lookup = useExerciseLookup();
  const today = todayISO();

  const recent = useMemo(() => completedSessions(sessions).slice(0, 5), [sessions]);
  const cardio = useRows('cardio_sessions');
  const recentCardio = useMemo(() => [...cardio].sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)).slice(0, 5), [cardio]);
  const cardioWeek = useMemo(() => cardioSummary(cardio, startOfWeek(today), today), [cardio, today]);
  const quick = useMemo(() => quickActivities(cardio), [cardio]);
  const weekly = useMemo(() => volumeSeries(sessions, sets, addDays(startOfWeek(today), -7 * 7), today, 'week'), [sessions, sets, today]);

  const start = (name: string, dayId: string | null, exercises: Parameters<typeof startWorkoutForDay>[2]) => {
    startWorkoutForDay(name, dayId, exercises, lookup);
    router.push('/workout/active');
  };

  return (
    <Screen title="Training" tabBarPadding testID="training-screen" right={<Button title="Übungen" size="sm" variant="secondary" icon="list" onPress={() => router.push('/exercises')} />}>
      {t.activeSession && (
        <Card variant="accent" onPress={() => router.push('/workout/active')} testID="resume-banner" accessibilityLabel="Laufendes Training öffnen">
          <Row>
            <Ionicons name="flash" size={22} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium">{t.activeSession.name} läuft</Text>
              <Text variant="small" tone="secondary">
                Tippen zum Fortsetzen
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Row>
        </Card>
      )}

      <Section
        title={structure ? structure.plan.name : 'Trainingsplan'}
        action={<Button title={structure ? 'Pläne' : 'Plan erstellen'} size="sm" variant="ghost" onPress={() => router.push('/plans')} />}
      >
        {!structure && (
          <Card>
            <Text variant="h3">Noch kein Trainingsplan</Text>
            <Text tone="secondary" style={{ marginTop: 4 }}>
              Erstelle einen Plan oder lass dir einen passend zu Ziel & Equipment generieren.
            </Text>
            <Button title="Plan erstellen" style={{ marginTop: spacing.md }} onPress={() => router.push('/plans')} />
          </Card>
        )}
        {structure?.days.map(({ day, exercises }) => {
          const isNext = t.nextDay?.day.id === day.id;
          const lastDone = completedSessions(sessions).find((s) => s.plan_day_id === day.id);
          return (
            <Card key={day.id} variant={isNext ? 'elevated' : 'default'} padding={spacing.md} testID={`plan-day-${day.name}`}>
              <Row>
                <View style={{ flex: 1, gap: 2 }}>
                  <Row gap={spacing.sm}>
                    <Text variant="h3">{day.name}</Text>
                    {isNext && <Badge label={t.workoutDone ? 'Heute erledigt' : 'Als Nächstes'} />}
                  </Row>
                  <Text variant="small" tone="secondary" numberOfLines={2}>
                    {exercises.map((e) => lookup(e.exercise_id)?.name ?? '?').join(' · ') || 'Noch keine Übungen'}
                  </Text>
                  <Text variant="small" tone="muted">
                    {lastDone ? `Zuletzt ${formatDateDE(lastDone.date, true)}` : 'Noch nicht trainiert'}
                  </Text>
                </View>
                <Button
                  testID={`start-day-${day.name}`}
                  title="Start"
                  size="sm"
                  icon="play"
                  variant={isNext ? 'primary' : 'secondary'}
                  disabled={!!t.activeSession || exercises.length === 0}
                  onPress={() => start(day.name, day.id, exercises)}
                />
              </Row>
            </Card>
          );
        })}
        <Button
          testID="start-empty-workout"
          title="Freies Training starten"
          variant="outline"
          icon="add"
          disabled={!!t.activeSession}
          onPress={() => {
            startWorkout({ name: 'Freies Training', planDayId: null, exercises: [] });
            router.push('/workout/active');
          }}
        />
      </Section>

      <Section title="Aktivitäten & Sport" action={cardioWeek.sessions ? <Text variant="small" tone="secondary">Diese Woche: {cardioWeek.sessions}× · {formatNumberDE(cardioWeek.kcal, 0)} kcal</Text> : undefined}>
        <Row gap={spacing.sm} wrap>
          {quick.map((a) => (
            <Button key={a} title={`${activityIcon(a)} ${activityLabel(a)}`} variant="secondary" size="sm" testID={`add-cardio-${a}`} onPress={() => router.push(`/cardio/new?activity=${a}`)} />
          ))}
          <Button title="Alle Aktivitäten" icon="search" size="sm" testID="add-cardio-all" onPress={() => router.push('/cardio/pick')} />
        </Row>
        {recentCardio.map((c) => (
          <Card key={c.id} padding={spacing.md} onPress={() => router.push(`/cardio/${c.id}`)} testID="cardio-entry" accessibilityLabel={`${activityLabel(c.activity)} bearbeiten`}>
            <Row>
              <Text variant="h3">{activityIcon(c.activity)}</Text>
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium">
                  {activityLabel(c.activity)}
                  {hasLevels(c.activity) && !c.distance_km && !['walk', 'jog', 'run'].includes(c.activity) ? ` · ${levelLabel(c.activity, c.intensity)}` : ''}
                </Text>
                <Text variant="small" tone="secondary">
                  {formatDateDE(c.date, true)} · {formatNumberDE(c.duration_min, 0)} min{c.distance_km ? ` · ${formatNumberDE(c.distance_km, 1)} km` : ''}
                </Text>
              </View>
              <Text variant="bodyMedium">{formatNumberDE(c.kcal, 0)} kcal</Text>
            </Row>
          </Card>
        ))}
      </Section>

      <Section title="Volumen pro Woche">
        <Card>
          <BarChart data={weekly.map((w) => ({ x: w.date, y: w.volumeKg }))} unit="kg" highlightLast labelFormat={(x) => `KW ab ${formatDateDE(x)}`} testID="weekly-volume-chart" />
          <Text variant="small" tone="secondary" style={{ marginTop: spacing.sm }}>
            Gesamtlast (Gewicht × Wdh.) der Arbeitssätze · {plans.length} Plan{plans.length === 1 ? '' : 'e'}
          </Text>
        </Card>
      </Section>

      <Section title="Letzte Trainings" action={<Button title="Alle" size="sm" variant="ghost" onPress={() => router.push('/workout/history')} />}>
        {recent.length === 0 && (
          <Text tone="secondary" variant="small">
            Noch keine abgeschlossenen Trainings.
          </Text>
        )}
        {recent.map((s) => {
          const sum = summarizeSession(s, sets, sessionPRs(s.id, sessions, sets).length);
          return (
            <Card key={s.id} padding={spacing.md} onPress={() => router.push(`/workout/${s.id}`)} accessibilityLabel={`Training ${s.name}`}>
              <Row>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium">{s.name}</Text>
                  <Text variant="small" tone="secondary">
                    {formatDateDE(s.date, true)} · {formatDuration(sum.durationSec)} · {sum.workingSets} Sätze · {formatNumberDE(sum.volumeKg, 0)} kg
                  </Text>
                </View>
                {sum.prs > 0 && <Badge label={`${sum.prs} PR`} />}
              </Row>
            </Card>
          );
        })}
      </Section>
    </Screen>
  );
}
