import { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatDateDE, formatDuration, formatKg, formatNumberDE, sessionPRs, summarizeSession, XP_RULES, type WorkoutSet } from '@gymolingo/core';
import { Screen, Row, Section } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { parseDecimal } from '@/ui/Input';
import { colors, fonts, radius, spacing } from '@/ui/theme';
import { useExerciseLookup, useRow, useRows } from '@/data/hooks';
import { deleteSession, updateSet } from '@/data/actions';
import { confirm } from '@/lib/dialog';

const PR_LABEL = { weight: 'Höchstes Gewicht', e1rm: 'Bestes geschätztes 1RM', reps: 'Meiste Wiederholungen', volume: 'Volumen' } as const;

export default function WorkoutDetail() {
  const { id, done } = useLocalSearchParams<{ id: string; done?: string }>();
  const session = useRow('workout_sessions', id);
  const sessions = useRows('workout_sessions');
  const sets = useRows('workout_sets');
  const lookup = useExerciseLookup();
  const [editing, setEditing] = useState(false);

  const mine = useMemo(() => sets.filter((s) => s.session_id === id).sort((a, b) => a.exercise_order - b.exercise_order || a.set_index - b.set_index), [sets, id]);
  const prs = useMemo(() => (session ? sessionPRs(session.id, sessions, sets) : []), [session, sessions, sets]);
  if (!session || session.deleted) {
    return (
      <Screen title="Training" back>
        <Text tone="secondary">Training nicht gefunden.</Text>
      </Screen>
    );
  }
  const sum = summarizeSession(session, sets, prs.length);
  const groups = new Map<string, WorkoutSet[]>();
  for (const s of mine) groups.set(s.exercise_id, [...(groups.get(s.exercise_id) ?? []), s]);
  const xp = XP_RULES.workout + Math.min(sum.workingSets * XP_RULES.perSet, XP_RULES.maxSetXp) + Math.min(new Set(prs.map((p) => p.exercise_id)).size * XP_RULES.pr, XP_RULES.maxPrXpPerDay);

  return (
    <Screen testID="workout-detail" title={session.name} subtitle={formatDateDE(session.date, true)} back right={<Button title={editing ? 'Fertig' : 'Bearbeiten'} size="sm" variant="secondary" onPress={() => setEditing((e) => !e)} />}>
      {done === '1' && (
        <Card variant="accent" testID="workout-complete-banner">
          <Text variant="h1">Training abgeschlossen! 🎉</Text>
          <Text tone="secondary" style={{ marginTop: 4 }}>
            +{xp} XP{prs.length ? ` · ${prs.length} neue Rekorde` : ''}. Prüfe deine Sätze – falls etwas nicht stimmt, tippe auf „Bearbeiten".
          </Text>
        </Card>
      )}

      <Row style={{ alignItems: 'stretch' }}>
        <Stat label="Dauer" value={formatDuration(sum.durationSec)} />
        <Stat label="Sätze" value={String(sum.workingSets)} />
        <Stat label="Volumen" value={`${formatNumberDE(sum.volumeKg, 0)} kg`} />
      </Row>

      {prs.length > 0 && (
        <Section title="Persönliche Rekorde 🏆">
          <Card padding={spacing.md} testID="pr-list">
            {prs.map((p) => (
              <Row key={`${p.exercise_id}-${p.type}`} style={{ paddingVertical: 6 }}>
                <Ionicons name="trophy" size={18} color={colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium">{lookup(p.exercise_id)?.name ?? 'Übung'}</Text>
                  <Text variant="small" tone="secondary">
                    {PR_LABEL[p.type]}: {p.type === 'reps' ? `${p.value} Wdh. mit ${formatKg(p.weight_kg)}` : p.type === 'e1rm' ? `${formatKg(p.value)} (aus ${formatKg(p.weight_kg)} × ${p.reps})` : `${formatKg(p.value)} × ${p.reps}`}
                  </Text>
                </View>
              </Row>
            ))}
          </Card>
        </Section>
      )}

      <Section title="Übungen">
        {[...groups.entries()].map(([exId, exSets]) => (
          <Card key={exId} padding={spacing.md} onPress={editing ? undefined : () => router.push(`/exercises/${exId}`)}>
            <Text variant="h3">{lookup(exId)?.name ?? 'Übung'}</Text>
            {exSets.map((s, i) =>
              editing ? (
                <EditSetRow key={s.id} set={s} index={i} />
              ) : (
                <Row key={s.id} style={{ paddingVertical: 3 }}>
                  <Text variant="small" tone="muted" style={{ width: 24 }}>
                    {s.set_type === 'warmup' ? 'W' : s.set_type === 'drop' ? 'D' : s.set_type === 'failure' ? 'F' : i + 1 - exSets.slice(0, i).filter((x) => x.set_type === 'warmup').length}
                  </Text>
                  <Text variant="bodyMedium" style={{ flex: 1 }}>
                    {formatKg(s.weight_kg)} × {s.reps}
                  </Text>
                  {s.rir !== null && (
                    <Text variant="small" tone="secondary">
                      RIR {formatNumberDE(s.rir, 1)}
                    </Text>
                  )}
                </Row>
              ),
            )}
          </Card>
        ))}
      </Section>

      <Button
        title="Training löschen"
        variant="danger"
        icon="trash-outline"
        onPress={async () => {
          if (await confirm('Training löschen?', 'Das Training und alle Sätze werden gelöscht. Rekorde und Statistiken werden neu berechnet.', 'Löschen', true)) {
            deleteSession(session.id);
            router.replace('/training');
          }
        }}
      />
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ flex: 1 }} padding={spacing.md}>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <Text variant="h2" style={{ marginTop: 4 }}>
        {value}
      </Text>
    </Card>
  );
}

function EditSetRow({ set, index }: { set: WorkoutSet; index: number }) {
  const [w, setW] = useState(String(set.weight_kg).replace('.', ','));
  const [r, setR] = useState(String(set.reps));
  const [rir, setRir] = useState(set.rir === null ? '' : String(set.rir));
  const style = { flex: 1, minWidth: 0, flexBasis: 0, backgroundColor: colors.surface3, color: colors.text, borderRadius: radius.sm, padding: 8, textAlign: 'center' as const, fontFamily: fonts.semibold, outlineStyle: 'none' } as never;
  const commit = () => {
    const wn = parseDecimal(w);
    const rn = parseDecimal(r);
    const rirn = rir === '' ? null : parseDecimal(rir);
    updateSet(set.id, {
      weight_kg: wn !== null && wn >= 0 ? wn : set.weight_kg,
      reps: rn !== null && rn >= 0 ? Math.round(rn) : set.reps,
      rir: rirn !== null && rirn >= 0 && rirn <= 10 ? rirn : null,
    });
  };
  return (
    <Row style={{ paddingVertical: 4 }}>
      <Text variant="small" tone="muted" style={{ width: 24 }}>
        {index + 1}
      </Text>
      <TextInput value={w} onChangeText={setW} onBlur={commit} keyboardType="decimal-pad" style={style} accessibilityLabel="Gewicht" />
      <Text tone="muted">×</Text>
      <TextInput value={r} onChangeText={setR} onBlur={commit} keyboardType="number-pad" style={style} accessibilityLabel="Wiederholungen" />
      <TextInput value={rir} onChangeText={setRir} onBlur={commit} keyboardType="decimal-pad" placeholder="RIR" placeholderTextColor={colors.textMuted} style={style} accessibilityLabel="RIR" />
    </Row>
  );
}
