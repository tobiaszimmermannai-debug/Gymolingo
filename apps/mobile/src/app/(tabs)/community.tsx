import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { addDays, formatDateDE, formatNumberDE, startOfWeek, todayISO } from '@gymolingo/core';
import { Screen, Row, Section } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { Chip, Segmented, Badge } from '@/ui/Chip';
import { colors, radius, spacing } from '@/ui/theme';
import { useDB, setPrefs } from '@/data/store';
import { isBackendConfigured } from '@/lib/supabase';
import { community, METRIC_LABELS, type ChallengeRow, type FriendRow, type LeaderRow, type PublicProfile, type SearchRow } from '@/features/community';
import { confirm, notify } from '@/lib/dialog';
import { refreshFriendsActivity } from '@/features/presence';

type Tab = 'leaderboard' | 'friends' | 'challenges';
const AVATARS = ['💪', '🏋️', '🔥', '⚡', '🦾', '🏃', '🧘', '🚴', '🥇', '🐺', '🦁', '🐻'];

export default function Community() {
  const account = useDB((s) => s.accountUserId);
  const [me, setMe] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('leaderboard');

  const loadMe = useCallback(async () => {
    if (!account) return;
    try {
      setMe(await community.myProfile(account));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  if (!isBackendConfigured || !account) {
    return (
      <Screen title="Community" tabBarPadding testID="community-screen">
        <Card variant="accent">
          <Text variant="h2">Gemeinsam dranbleiben 🤝</Text>
          <Text tone="secondary" style={{ marginTop: 6 }}>
            Freunde hinzufügen, wöchentliche Ranglisten, private Challenges und Vergleiche der Zielerfüllung. Du bestimmst selbst, was geteilt wird – Gewicht, Körperfett, Ernährung und Fotos bleiben standardmäßig privat.
          </Text>
          {isBackendConfigured ? (
            <Button title="Kostenloses Konto erstellen" style={{ marginTop: spacing.md }} onPress={() => router.push('/auth?mode=signup')} testID="community-signup" />
          ) : (
            <Text variant="small" tone="muted" style={{ marginTop: spacing.md }}>
              Diese Installation läuft ohne Server (lokaler Modus). Für die Community muss ein Supabase-Projekt verbunden werden (siehe README – der Free-Plan reicht).
            </Text>
          )}
          <Button title="App mit Freunden teilen" icon="share-social-outline" variant="secondary" style={{ marginTop: spacing.sm }} onPress={() => router.push('/community/invite')} testID="open-invite" />
        </Card>
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen title="Community" tabBarPadding>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  if (error && !me) {
    return (
      <Screen title="Community" tabBarPadding>
        <Card>
          <Text tone="warning">Keine Verbindung zur Community ({error}). Deine Trainingsdaten sind davon nicht betroffen.</Text>
          <Button title="Erneut versuchen" variant="secondary" style={{ marginTop: spacing.md }} onPress={loadMe} />
        </Card>
      </Screen>
    );
  }

  if (!me?.username) return <UsernameSetup me={me} userId={account} onDone={loadMe} />;

  return (
    <Screen title="Community" subtitle={`${me.avatar_emoji} @${me.username}`} tabBarPadding testID="community-screen" right={
        <Row gap={spacing.sm}>
          <Button title="Einladen" icon="person-add-outline" size="sm" onPress={() => router.push('/community/invite')} testID="open-invite" />
          <Button title="Profil" size="sm" variant="secondary" onPress={() => setMe({ ...me, username: null })} />
        </Row>
      }>
      <Segmented
        testIDPrefix="community-tab"
        options={[
          { value: 'leaderboard', label: 'Rangliste' },
          { value: 'friends', label: 'Freunde' },
          { value: 'challenges', label: 'Challenges' },
        ]}
        value={tab}
        onChange={(v) => setTab(v as Tab)}
      />
      {tab === 'leaderboard' && <Leaderboard />}
      {tab === 'friends' && <Friends />}
      {tab === 'challenges' && <Challenges />}
    </Screen>
  );
}

function UsernameSetup({ me, userId, onDone }: { me: PublicProfile | null; userId: string; onDone: () => void }) {
  const [username, setUsername] = useState(me?.username ?? '');
  const [name, setName] = useState(me?.display_name ?? '');
  const [avatar, setAvatar] = useState(me?.avatar_emoji ?? '💪');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Screen title="Dein Community-Profil" tabBarPadding testID="username-setup">
      <Text tone="secondary">Wähle einen Benutzernamen, über den dich Freunde finden können.</Text>
      <Card>
        <Input label="Benutzername" value={username} onChangeText={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9_.]/g, ''))} autoCapitalize="none" placeholder="z. B. alex_lifts" testID="username-input" hint="3–20 Zeichen: a–z, 0–9, Punkt, Unterstrich" />
        <Input label="Anzeigename" value={name} onChangeText={setName} containerStyle={{ marginTop: spacing.sm }} />
        <Text variant="smallMedium" tone="secondary" style={{ marginTop: spacing.md }}>
          Avatar
        </Text>
        <Row gap={spacing.sm} wrap style={{ marginTop: 6 }}>
          {AVATARS.map((a) => (
            <Pressable key={a} onPress={() => setAvatar(a)} accessibilityLabel={`Avatar ${a}`} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: avatar === a ? colors.accentSoft : colors.surface2, borderWidth: 1, borderColor: avatar === a ? colors.accent : 'transparent' }}>
              <Text variant="h3">{a}</Text>
            </Pressable>
          ))}
        </Row>
        {err && (
          <Text tone="danger" variant="small" style={{ marginTop: spacing.sm }}>
            {err}
          </Text>
        )}
        <Button
          title="Speichern"
          style={{ marginTop: spacing.md }}
          loading={busy}
          testID="save-username"
          disabled={username.length < 3}
          onPress={async () => {
            setBusy(true);
            const e = await community.updateProfile(userId, { username, display_name: name.trim() || username, avatar_emoji: avatar });
            setBusy(false);
            if (e) return setErr(e);
            onDone();
          }}
        />
      </Card>
    </Screen>
  );
}

type Metric = 'goal_completion_pct' | 'steps' | 'workouts' | 'volume_kg';
const LB_METRICS: { value: Metric; label: string; unit: string }[] = [
  { value: 'goal_completion_pct', label: 'Zielerfüllung', unit: '%' },
  { value: 'steps', label: 'Schritte', unit: '' },
  { value: 'workouts', label: 'Trainings', unit: '' },
  { value: 'volume_kg', label: 'Volumen', unit: 'kg' },
];

function Leaderboard() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [metric, setMetric] = useState<Metric>('goal_completion_pct');
  const [rows, setRows] = useState<LeaderRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const from = addDays(startOfWeek(todayISO()), -7 * weekOffset);
  const to = weekOffset === 0 ? todayISO() : addDays(from, 6);
  useFocusEffect(
    useCallback(() => {
      community
        .leaderboard(from, to)
        .then((r) => {
          setRows(r);
          setErr(null);
        })
        .catch((e) => setErr(String(e.message ?? e)));
    }, [from, to]),
  );
  const sorted = useMemo(() => [...(rows ?? [])].sort((a, b) => (Number(b[metric] ?? -1) - Number(a[metric] ?? -1))), [rows, metric]);
  const unit = LB_METRICS.find((m) => m.value === metric)!.unit;

  return (
    <>
      <Row style={{ justifyContent: 'space-between' }}>
        <Chip label="Diese Woche" selected={weekOffset === 0} onPress={() => setWeekOffset(0)} />
        <Chip label="Letzte Woche" selected={weekOffset === 1} onPress={() => setWeekOffset(1)} />
        <Text variant="small" tone="muted">
          {formatDateDE(from)} – {formatDateDE(to)}
        </Text>
      </Row>
      <Row gap={spacing.sm} wrap>
        {LB_METRICS.map((m) => (
          <Chip key={m.value} label={m.label} selected={metric === m.value} onPress={() => setMetric(m.value)} testID={`lb-${m.value}`} />
        ))}
      </Row>
      {err && <Text tone="warning">{err}</Text>}
      {!rows && !err && <ActivityIndicator color={colors.accent} />}
      <Card padding={spacing.xs} testID="leaderboard">
        {sorted.map((r, i) => (
          <Pressable
            key={r.user_id}
            onPress={() => !r.is_me && router.push(`/community/friend/${r.user_id}`)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border, backgroundColor: r.is_me ? colors.accentSofter : 'transparent', borderRadius: radius.md }}
            accessibilityRole="button"
            accessibilityLabel={r.display_name}
          >
            <Text variant="h3" tone={i < 3 ? 'accent' : 'muted'} style={{ width: 26 }}>
              {i + 1}
            </Text>
            <Text variant="h2">{r.avatar_emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium">
                {r.display_name}
                {r.is_me ? ' (du)' : ''}
              </Text>
              {r.username && (
                <Text variant="small" tone="muted">
                  @{r.username}
                </Text>
              )}
            </View>
            <Text variant="bodyMedium" tone={r[metric] === null ? 'muted' : 'default'}>
              {r[metric] === null ? '🔒 privat' : `${formatNumberDE(Number(r[metric]), 0)}${unit ? ` ${unit}` : ''}`}
            </Text>
          </Pressable>
        ))}
        {rows && rows.length <= 1 && (
          <Text variant="small" tone="muted" style={{ padding: spacing.md }}>
            Füge Freunde hinzu, um euch zu vergleichen.
          </Text>
        )}
      </Card>
      <Text variant="small" tone="muted">
        Zielerfüllung = Durchschnitt aus Trainingsplan, Schrittziel- und Proteinziel-Tagen. Werte, die jemand nicht teilt, bleiben privat.
      </Text>
    </>
  );
}

function Friends() {
  const [friends, setFriends] = useState<FriendRow[] | null>(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const f = await community.friends();
      setFriends(f);
      void refreshFriendsActivity(true);
      setPrefs({ friendsCount: f.filter((x) => x.status === 'accepted').length });
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  useEffect(() => {
    if (q.trim().length < 2) return setResults([]);
    const t = setTimeout(() => community.search(q.trim()).then(setResults).catch(() => setResults([])), 300);
    return () => clearTimeout(t);
  }, [q]);

  const incoming = (friends ?? []).filter((f) => f.status === 'pending' && f.direction === 'incoming');
  const outgoing = (friends ?? []).filter((f) => f.status === 'pending' && f.direction === 'outgoing');
  const accepted = (friends ?? []).filter((f) => f.status === 'accepted');
  const activity = useDB((s) => s.prefs.friendsActivity?.rows);
  const statusOf: Record<string, string> = Object.fromEntries((activity ?? []).filter((a) => a.status_emoji).map((a) => [a.user_id, `${a.status_emoji} ${a.status_text ?? ''}`.trim()]));

  return (
    <>
      <Card variant="accent" padding={spacing.md} onPress={() => router.push('/community/invite')} testID="invite-card" accessibilityLabel="Freunde einladen">
        <Row>
          <Text variant="h2">📲</Text>
          <View style={{ flex: 1 }}>
            <Text variant="bodyMedium">Freunde einladen</Text>
            <Text variant="small" tone="secondary">
              Per WhatsApp, Link oder QR-Code – ihr seid sofort befreundet
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Row>
      </Card>
      <Input placeholder="Freunde suchen (Benutzername)" value={q} onChangeText={setQ} autoCapitalize="none" testID="friend-search" />
      {results.map((r) => (
        <Card key={r.id} padding={spacing.md}>
          <Row>
            <Text variant="h2">{r.avatar_emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium">{r.display_name}</Text>
              <Text variant="small" tone="muted">
                @{r.username}
              </Text>
            </View>
            {r.friendship_status === 'friends' ? (
              <Badge label="Befreundet" />
            ) : r.friendship_status === 'outgoing' ? (
              <Badge label="Angefragt" tone="muted" />
            ) : (
              <Button
                title={r.friendship_status === 'incoming' ? 'Annehmen' : 'Hinzufügen'}
                size="sm"
                testID={`add-friend-${r.username}`}
                onPress={async () => {
                  try {
                    await community.sendRequest(r.username);
                    setQ('');
                    await load();
                  } catch (e) {
                    notify('Fehler', e instanceof Error ? e.message : String(e));
                  }
                }}
              />
            )}
          </Row>
        </Card>
      ))}
      {err && <Text tone="warning">{err}</Text>}
      {incoming.length > 0 && (
        <Section title="Anfragen">
          {incoming.map((f) => (
            <Card key={f.request_id} padding={spacing.md} testID={`incoming-${f.username}`}>
              <Row>
                <Text variant="h2">{f.avatar_emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium">{f.display_name}</Text>
                  <Text variant="small" tone="muted">
                    @{f.username} möchte dein Trainingspartner sein
                  </Text>
                </View>
                <Button title="Annehmen" size="sm" testID={`accept-${f.username}`} onPress={async () => { await community.respond(f.request_id, true); await load(); }} />
                <Button title="Ablehnen" size="sm" variant="ghost" onPress={async () => { await community.respond(f.request_id, false); await load(); }} />
              </Row>
            </Card>
          ))}
        </Section>
      )}
      <Section title={`Freunde (${accepted.length})`}>
        {friends === null && !err && <ActivityIndicator color={colors.accent} />}
        {accepted.length === 0 && friends !== null && (
          <Text variant="small" tone="muted">
            Noch keine Freunde. Suche oben nach dem Benutzernamen deiner Trainingspartner.
          </Text>
        )}
        {accepted.map((f) => (
          <Card key={f.request_id} padding={spacing.md} onPress={() => router.push(`/community/friend/${f.user_id}`)} testID={`friend-${f.username}`} accessibilityLabel={f.display_name}>
            <Row>
              <Text variant="h2">{f.avatar_emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium">{f.display_name}</Text>
                <Text variant="small" tone="muted">
                  @{f.username}
                </Text>
                {statusOf[f.user_id] && (
                  <Text variant="small" numberOfLines={2} style={{ marginTop: 2 }} testID={`friend-status-${f.username}`}>
                    {statusOf[f.user_id]}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Row>
          </Card>
        ))}
        {outgoing.map((f) => (
          <Row key={f.request_id} style={{ paddingVertical: 4 }}>
            <Text variant="small" tone="muted" style={{ flex: 1 }}>
              Anfrage an @{f.username} ausstehend
            </Text>
            <Button
              title="Zurückziehen"
              size="sm"
              variant="ghost"
              onPress={async () => {
                if (await confirm('Anfrage zurückziehen?', `@${f.username}`, 'Zurückziehen')) {
                  await community.remove(f.user_id);
                  await load();
                }
              }}
            />
          </Row>
        ))}
      </Section>
    </>
  );
}

function Challenges() {
  const [list, setList] = useState<ChallengeRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => {
    community
      .challenges()
      .then((c) => {
        setList(c);
        setErr(null);
      })
      .catch((e) => setErr(String(e.message ?? e)));
  }, []);
  useFocusEffect(load);
  const today = todayISO();
  return (
    <>
      <Button title="Neue private Challenge" icon="add" onPress={() => router.push('/community/new-challenge')} testID="new-challenge" />
      {err && <Text tone="warning">{err}</Text>}
      {list === null && !err && <ActivityIndicator color={colors.accent} />}
      {list?.length === 0 && (
        <Text variant="small" tone="muted">
          Noch keine Challenges. Fordere deine Freunde heraus – z. B. „Wer schafft diese Woche die meisten Schritte?"
        </Text>
      )}
      {list?.map((c) => {
        const active = c.start_date <= today && c.end_date >= today;
        return (
          <Card key={c.id} padding={spacing.md} onPress={c.my_status === 'joined' ? () => router.push(`/community/challenge/${c.id}`) : undefined} testID={`challenge-${c.title}`}>
            <Row>
              <View style={{ flex: 1 }}>
                <Row gap={spacing.sm}>
                  <Text variant="bodyMedium">{c.title}</Text>
                  <Badge label={active ? 'Läuft' : c.end_date < today ? 'Beendet' : 'Geplant'} tone={active ? 'accent' : 'muted'} />
                </Row>
                <Text variant="small" tone="secondary">
                  {METRIC_LABELS[c.metric].label} · {formatDateDE(c.start_date)} – {formatDateDE(c.end_date)} · {c.participants} Teilnehmer · von {c.creator_name}
                </Text>
              </View>
              {c.my_status === 'invited' ? (
                <Row gap={spacing.xs}>
                  <Button title="Mitmachen" size="sm" onPress={async () => { await community.respondChallenge(c.id, true); load(); }} testID={`join-${c.title}`} />
                  <Button title="Nein" size="sm" variant="ghost" onPress={async () => { await community.respondChallenge(c.id, false); load(); }} />
                </Row>
              ) : (
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              )}
            </Row>
          </Card>
        );
      })}
    </>
  );
}
