import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { formatNumberDE } from '@gymolingo/core';
import { Screen, Row } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { colors, spacing } from '@/ui/theme';
import { community, METRIC_LABELS, type ChallengeLeaderRow, type ChallengeRow } from '@/features/community';

export default function ChallengeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [rows, setRows] = useState<ChallengeLeaderRow[] | null>(null);
  const [info, setInfo] = useState<ChallengeRow | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([community.challengeLeaderboard(id), community.challenges()])
      .then(([r, list]) => {
        setRows([...r].sort((a, b) => Number(b.value ?? -1) - Number(a.value ?? -1)));
        setInfo(list.find((c) => c.id === id) ?? null);
      })
      .catch((e) => setErr(String(e.message ?? e)));
  }, [id]);
  const unit = info ? METRIC_LABELS[info.metric].unit : '';
  return (
    <Screen title={info?.title ?? 'Challenge'} subtitle={info ? METRIC_LABELS[info.metric].label : undefined} back testID="challenge-detail">
      {err && <Text tone="warning">{err}</Text>}
      {!rows && !err && <ActivityIndicator color={colors.accent} />}
      {rows?.map((r, i) => (
        <Card key={r.user_id} padding={spacing.md} variant={r.is_me ? 'accent' : 'default'}>
          <Row>
            <Text variant="h2" tone={i === 0 ? 'accent' : 'muted'} style={{ width: 30 }}>
              {i + 1}
            </Text>
            <Text variant="h2">{r.avatar_emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium">
                {r.display_name}
                {r.is_me ? ' (du)' : ''}
              </Text>
            </View>
            <Text variant="bodyMedium">{r.shared && r.value !== null ? `${formatNumberDE(Number(r.value), 0)} ${unit}` : '🔒 privat'}</Text>
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
