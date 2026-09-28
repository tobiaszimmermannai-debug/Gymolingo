import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  addDays,
  BADGES,
  formatDateDE,
  formatNumberDE,
  nextMilestone,
  STREAK_LABELS_DE,
  todayISO,
  type PauseReason,
  type StreakKind,
} from '@gymolingo/core';
import { Screen, Row, Section } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { ChipGroup, Segmented } from '@/ui/Chip';
import { Input } from '@/ui/Input';
import { ProgressBar } from '@/ui/ProgressBar';
import { colors, radius, spacing } from '@/ui/theme';
import { useRows } from '@/data/hooks';
import { insert, remove, update } from '@/data/store';
import { requestSync } from '@/data/sync';
import { useTodayState } from '@/features/today';
import { confirm } from '@/lib/dialog';

const KINDS: StreakKind[] = ['training', 'nutrition', 'protein', 'steps', 'checkin', 'weight'];
const REASONS: { value: PauseReason; label: string }[] = [
  { value: 'vacation', label: '🏖️ Urlaub' },
  { value: 'sick', label: '🤒 Krankheit' },
  { value: 'other', label: 'Sonstiges' },
];

export default function Achievements() {
  const t = useTodayState();
  const unlocked = useRows('user_achievements');
  const pauses = useRows('streak_pauses');
  const [tab, setTab] = useState<'streaks' | 'badges'>('streaks');
  const [reason, setReason] = useState<PauseReason>('vacation');
  const [days, setDays] = useState('7');
  const unlockedMap = useMemo(() => new Map(unlocked.map((u) => [u.badge_id, u])), [unlocked]);
  const lvl = t.game.level;

  useEffect(() => {
    // mark all as seen when the screen is opened
    for (const u of unlocked) if (!u.seen) update('user_achievements', u.id, { seen: true });
  }, [unlocked.length]);

  const addPause = () => {
    const n = Math.max(1, Math.min(60, parseInt(days, 10) || 1));
    const start = todayISO();
    insert('streak_pauses', { start_date: start, end_date: addDays(start, n - 1), reason });
    requestSync();
  };

  return (
    <Screen title="Erfolge" back testID="achievements-screen">
      <Card variant="accent">
        <Row>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="h1" color={colors.onAccent}>
              {lvl.level}
            </Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="h2">{lvl.title}</Text>
            <Text variant="small" tone="secondary" testID="xp-total">
              {formatNumberDE(lvl.xp, 0)} XP · noch {formatNumberDE(lvl.nextLevelXp - lvl.xp, 0)} bis Level {lvl.level + 1}
            </Text>
            <ProgressBar progress={lvl.progress} height={8} />
          </View>
        </Row>
        <Text variant="small" tone="secondary" style={{ marginTop: spacing.md }}>
          XP gibt es für Konstanz: Trainings, Tracking, Proteinziel, Schritte, Check-ins und Challenges – nicht für Gewichtsverlust.
        </Text>
      </Card>

      <Segmented options={[{ value: 'streaks', label: 'Serien' }, { value: 'badges', label: `Abzeichen (${unlocked.length}/${BADGES.length})` }]} value={tab} onChange={(v) => setTab(v as 'streaks' | 'badges')} testIDPrefix="ach-tab" />

      {tab === 'streaks' && (
        <>
          {KINDS.filter((k) => k !== 'weight' || t.profile.weight_tracking_enabled).map((k) => {
            const s = t.streaks[k];
            const next = nextMilestone(s.current);
            return (
              <Card key={k} padding={spacing.md} testID={`streak-${k}`}>
                <Row>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyMedium">{STREAK_LABELS_DE[k]}</Text>
                    <Text variant="small" tone="secondary">
                      Rekord {s.best} Tage{k !== 'training' ? ` · ${s.jokersLeftThisMonth} Joker diesen Monat übrig` : ` · Woche ${t.streaks.trainingMeta.weekDone}/${t.streaks.trainingMeta.weekQuota}`}
                    </Text>
                  </View>
                  <Text variant="h2" tone={s.todayDone ? 'accent' : 'default'}>
                    {s.current} 🔥
                  </Text>
                </Row>
                {next && (
                  <View style={{ marginTop: spacing.sm, gap: 4 }}>
                    <ProgressBar progress={s.current / next} height={5} />
                    <Text variant="small" tone="muted">
                      Nächster Meilenstein: {next} Tage
                    </Text>
                  </View>
                )}
                {s.atRisk && (
                  <Text variant="small" tone="warning" style={{ marginTop: 4 }}>
                    Heute noch offen – deine Serie läuft weiter, sobald du es erledigst.
                  </Text>
                )}
              </Card>
            );
          })}
          <Text variant="small" tone="muted">
            Joker: bis zu 2 verpasste Tage pro Monat werden automatisch überbrückt. Ruhetage zählen bei der Trainingstreue mit, solange dein Wochenplan erreichbar bleibt.
          </Text>

          <Section title="Streak-Schutz (Urlaub & Krankheit)">
            <Card>
              <Text variant="small" tone="secondary">
                Pausierte Tage unterbrechen keine Serie und es gibt keine Erinnerungen. Gesundheit geht vor.
              </Text>
              <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                <ChipGroup options={REASONS} value={reason} onChange={(v) => setReason(v as PauseReason)} />
                <Row>
                  <Input containerStyle={{ flex: 1 }} value={days} onChangeText={setDays} keyboardType="number-pad" suffix="Tage ab heute" accessibilityLabel="Dauer in Tagen" />
                  <Button title="Pausieren" onPress={addPause} testID="add-pause" />
                </Row>
              </View>
            </Card>
            {pauses
              .sort((a, b) => b.start_date.localeCompare(a.start_date))
              .map((p) => (
                <Row key={p.id} style={{ paddingVertical: 6 }}>
                  <Text style={{ flex: 1 }}>
                    {REASONS.find((r) => r.value === p.reason)?.label} · {formatDateDE(p.start_date)} – {formatDateDE(p.end_date)}
                  </Text>
                  <Button
                    title="Beenden"
                    size="sm"
                    variant="ghost"
                    onPress={async () => {
                      if (!(await confirm('Pause beenden?', 'Ab morgen zählen die Serien wieder normal.', 'Beenden'))) return;
                      const today = todayISO();
                      if (p.start_date >= today) remove('streak_pauses', p.id);
                      else update('streak_pauses', p.id, { end_date: addDays(today, -1) < p.start_date ? p.start_date : addDays(today, -1) });
                      requestSync();
                    }}
                  />
                </Row>
              ))}
          </Section>
        </>
      )}

      {tab === 'badges' && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {BADGES.map((b) => {
            const u = unlockedMap.get(b.id);
            return (
              <View key={b.id} testID={`badge-${b.id}`} style={{ width: '31.5%', padding: spacing.sm, borderRadius: radius.lg, backgroundColor: u ? colors.accentSofter : colors.surface, borderWidth: 1, borderColor: u ? 'rgba(198,244,50,0.3)' : colors.border, alignItems: 'center', gap: 4, opacity: u ? 1 : 0.45 }}>
                <Text variant="h1">{u ? b.icon : '🔒'}</Text>
                <Text variant="smallMedium" align="center" numberOfLines={2}>
                  {b.title}
                </Text>
                <Text variant="small" tone="muted" align="center" numberOfLines={3} style={{ fontSize: 11, lineHeight: 14 }}>
                  {u ? `${formatDateDE(u.unlocked_at.slice(0, 10))}` : b.description}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
