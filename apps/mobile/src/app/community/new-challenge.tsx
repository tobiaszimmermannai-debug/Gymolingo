import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { addDays, todayISO } from '@gymolingo/core';
import { Screen, Row } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { ChipGroup } from '@/ui/Chip';
import { spacing } from '@/ui/theme';
import { community, METRIC_LABELS, type ChallengeRow, type FriendRow } from '@/features/community';

export default function NewChallenge() {
  const [title, setTitle] = useState('');
  const [metric, setMetric] = useState<ChallengeRow['metric']>('steps');
  const [days, setDays] = useState('7');
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [invite, setInvite] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    community.friends().then((f) => setFriends(f.filter((x) => x.status === 'accepted'))).catch(() => undefined);
  }, []);
  const create = async () => {
    const n = parseInt(days, 10);
    if (title.trim().length < 3) return setErr('Bitte einen Titel mit mindestens 3 Zeichen eingeben.');
    if (!(n >= 1 && n <= 92)) return setErr('Dauer zwischen 1 und 92 Tagen.');
    setBusy(true);
    try {
      const start = todayISO();
      await community.createChallenge(title.trim(), metric, start, addDays(start, n - 1), invite);
      router.back();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen title="Neue Challenge" back footer={<Button title="Challenge starten" onPress={create} loading={busy} testID="create-challenge" />}>
      <Input label="Titel" value={title} onChangeText={setTitle} placeholder="z. B. Schritte-Duell" testID="challenge-title" />
      <Text variant="smallMedium" tone="secondary">
        Wertung
      </Text>
      <ChipGroup options={(Object.keys(METRIC_LABELS) as ChallengeRow['metric'][]).map((m) => ({ value: m, label: METRIC_LABELS[m].label }))} value={metric} onChange={(v) => setMetric(v as ChallengeRow['metric'])} />
      <Row>
        <Input containerStyle={{ flex: 1 }} label="Dauer" value={days} onChangeText={setDays} keyboardType="number-pad" suffix="Tage ab heute" />
      </Row>
      <Text variant="smallMedium" tone="secondary">
        Freunde einladen
      </Text>
      {friends.length === 0 ? (
        <Text variant="small" tone="muted">
          Du hast noch keine Freunde – die Challenge startet dann nur mit dir. Füge zuerst Freunde hinzu, um sie einzuladen.
        </Text>
      ) : (
        <ChipGroup multi options={friends.map((f) => ({ value: f.user_id, label: `${f.avatar_emoji} ${f.display_name}` }))} value={invite} onChange={(v) => setInvite(v as string[])} testIDPrefix="invite" />
      )}
      <Text variant="small" tone="muted" style={{ marginTop: spacing.sm }}>
        Private Challenges sind nur für eingeladene Freunde sichtbar. Jede Person entscheidet selbst, ob ihr Wert geteilt wird.
      </Text>
      {err && <Text tone="danger">{err}</Text>}
    </Screen>
  );
}
