import { useMemo } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { completedSessions, formatDateDE, formatDuration, formatNumberDE, computePersonalRecords, summarizeSession } from '@gymolingo/core';
import { Screen, Row } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { Badge } from '@/ui/Chip';
import { spacing } from '@/ui/theme';
import { useRows } from '@/data/hooks';

export default function History() {
  const sessions = useRows('workout_sessions');
  const sets = useRows('workout_sets');
  const list = useMemo(() => {
    const { events } = computePersonalRecords(sessions, sets);
    const prBySession = new Map<string, number>();
    for (const e of events) prBySession.set(e.session_id, (prBySession.get(e.session_id) ?? 0) + 1);
    return completedSessions(sessions).map((s) => summarizeSession(s, sets, prBySession.get(s.id) ?? 0));
  }, [sessions, sets]);
  const byMonth = new Map<string, typeof list>();
  for (const s of list) byMonth.set(s.date.slice(0, 7), [...(byMonth.get(s.date.slice(0, 7)) ?? []), s]);
  const monthName = (ym: string) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  return (
    <Screen title="Trainingsverlauf" subtitle={`${list.length} Trainings`} back testID="history-screen">
      {list.length === 0 && <Text tone="secondary">Noch keine abgeschlossenen Trainings.</Text>}
      {[...byMonth.entries()].map(([ym, items]) => (
        <View key={ym} style={{ gap: spacing.sm }}>
          <Text variant="caption" tone="secondary">
            {monthName(ym)} · {items.length} Trainings · {formatNumberDE(items.reduce((a, s) => a + s.volumeKg, 0), 0)} kg
          </Text>
          {items.map((s) => (
            <Card key={s.session_id} padding={spacing.md} onPress={() => router.push(`/workout/${s.session_id}`)} accessibilityLabel={`Training ${s.name}`}>
              <Row>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium">{s.name}</Text>
                  <Text variant="small" tone="secondary">
                    {formatDateDE(s.date, true)} · {formatDuration(s.durationSec)} · {s.exercises} Übungen · {s.workingSets} Sätze · {formatNumberDE(s.volumeKg, 0)} kg
                  </Text>
                </View>
                {s.prs > 0 && <Badge label={`${s.prs} PR`} />}
              </Row>
            </Card>
          ))}
        </View>
      ))}
    </Screen>
  );
}
