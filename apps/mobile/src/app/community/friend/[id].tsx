import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { EXERCISE_MAP, formatDateDE, formatKg, formatNumberDE, STREAK_LABELS_DE, type StreakKind } from '@gymolingo/core';
import { Screen, Row, Section } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { colors, spacing } from '@/ui/theme';
import { community } from '@/features/community';
import { confirm } from '@/lib/dialog';

type Profile = {
  display_name: string;
  username: string | null;
  avatar_emoji: string;
  level: number | null;
  total_xp: number | null;
  badges: number | null;
  streaks: Record<string, { current: number; best: number }> | null;
  recent_prs: { exercise_id: string; type: string; value: number; weight_kg: number; reps: number; date: string }[] | null;
  week_workouts: number | null;
  week_volume_kg: number | null;
  week_steps: number | null;
  week_goal_completion_pct: number | null;
  latest_weight?: { date: string; weight_kg: number } | null;
  latest_body_fat?: { date: string; body_fat_pct: number } | null;
  nutrition_7d?: { avg_kcal: number | null; avg_protein_g: number | null; days: number } | null;
};

const PRIVATE = '🔒 privat';

export default function FriendProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [p, setP] = useState<Profile | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    community.profile(id).then((d) => setP(d as unknown as Profile)).catch((e) => setErr(String(e.message ?? e)));
  }, [id]);

  if (err) {
    return (
      <Screen title="Profil" back>
        <Text tone="warning">{err}</Text>
      </Screen>
    );
  }
  if (!p) {
    return (
      <Screen title="Profil" back>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }
  return (
    <Screen title={p.display_name} subtitle={p.username ? `@${p.username}` : undefined} back testID="friend-profile">
      <Card variant="accent">
        <Row>
          <Text variant="display">{p.avatar_emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text variant="h2">{p.level !== null ? `Level ${p.level}` : PRIVATE}</Text>
            <Text variant="small" tone="secondary">
              {p.total_xp !== null ? `${formatNumberDE(p.total_xp, 0)} XP · ${p.badges ?? 0} Abzeichen` : 'Level nicht geteilt'}
            </Text>
          </View>
        </Row>
      </Card>
      <Section title="Diese Woche">
        <Row style={{ alignItems: 'stretch' }}>
          <Stat label="Trainings" value={p.week_workouts === null ? PRIVATE : String(p.week_workouts)} testID="friend-week-workouts" />
          <Stat label="Schritte" value={p.week_steps === null ? PRIVATE : formatNumberDE(p.week_steps, 0)} testID="friend-week-steps" />
        </Row>
        <Row style={{ alignItems: 'stretch' }}>
          <Stat label="Volumen" value={p.week_volume_kg === null ? PRIVATE : `${formatNumberDE(p.week_volume_kg / 1000, 1)} t`} />
          <Stat label="Zielerfüllung" value={p.week_goal_completion_pct === null ? PRIVATE : `${p.week_goal_completion_pct} %`} />
        </Row>
      </Section>
      <Section title="Serien">
        <Card padding={spacing.md}>
          {p.streaks
            ? (['training', 'nutrition', 'protein', 'steps', 'checkin'] as StreakKind[]).map((k) => (
                <Row key={k} style={{ justifyContent: 'space-between', paddingVertical: 3 }}>
                  <Text variant="small">{STREAK_LABELS_DE[k]}</Text>
                  <Text variant="smallMedium">{p.streaks?.[k]?.current ?? 0} 🔥</Text>
                </Row>
              ))
            : <Text variant="small" tone="muted">{PRIVATE}</Text>}
        </Card>
      </Section>
      <Section title="Letzte Rekorde">
        <Card padding={spacing.md}>
          {p.recent_prs === null ? (
            <Text variant="small" tone="muted">{PRIVATE}</Text>
          ) : p.recent_prs.length === 0 ? (
            <Text variant="small" tone="muted">Noch keine Rekorde.</Text>
          ) : (
            p.recent_prs.map((r, i) => (
              <Text key={i} variant="small" style={{ paddingVertical: 2 }}>
                🏆 {EXERCISE_MAP[r.exercise_id]?.name ?? 'Eigene Übung'}: {formatKg(r.weight_kg)} × {r.reps} · {formatDateDE(r.date)}
              </Text>
            ))
          )}
        </Card>
      </Section>
      {(p.latest_weight !== undefined || p.latest_body_fat !== undefined || p.nutrition_7d !== undefined) && (
        <Section title="Freigegebene Körper- & Ernährungsdaten">
          <Card padding={spacing.md}>
            {p.latest_weight !== undefined && <Text variant="small">Gewicht: {p.latest_weight ? `${formatNumberDE(p.latest_weight.weight_kg, 1)} kg (${formatDateDE(p.latest_weight.date)})` : 'keine Daten'}</Text>}
            {p.latest_body_fat !== undefined && <Text variant="small">Körperfett: {p.latest_body_fat ? `${formatNumberDE(p.latest_body_fat.body_fat_pct, 1)} %` : 'keine Daten'}</Text>}
            {p.nutrition_7d !== undefined && <Text variant="small">Ernährung Ø 7 Tage: {p.nutrition_7d?.avg_kcal ? `${formatNumberDE(p.nutrition_7d.avg_kcal, 0)} kcal · ${formatNumberDE(p.nutrition_7d.avg_protein_g ?? 0, 0)} g Protein` : 'keine Daten'}</Text>}
          </Card>
        </Section>
      )}
      <Button
        title="Freundschaft beenden"
        variant="ghost"
        onPress={async () => {
          if (!(await confirm('Freundschaft beenden?', `${p.display_name} sieht danach keine deiner Werte mehr.`, 'Beenden', true))) return;
          await community.remove(id);
          router.back();
        }}
      />
    </Screen>
  );
}

function Stat({ label, value, testID }: { label: string; value: string; testID?: string }) {
  return (
    <Card style={{ flex: 1 }} padding={spacing.md}>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <Text variant="h3" testID={testID} style={{ marginTop: 2 }}>
        {value}
      </Text>
    </Card>
  );
}
