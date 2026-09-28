import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WEEKDAY_SHORT_DE, type PlanExercise } from '@gymolingo/core';
import { Screen, Row } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { Button, IconButton } from '@/ui/Button';
import { parseDecimal } from '@/ui/Input';
import { CommitInput } from '@/ui/CommitInput';
import { Badge } from '@/ui/Chip';
import { colors, radius, spacing } from '@/ui/theme';
import { useExerciseLookup, useRow, useRows } from '@/data/hooks';
import { insert, remove, update } from '@/data/store';
import { activatePlan, deletePlan, moveInList } from '@/data/actions';
import { requestSync } from '@/data/sync';
import { confirm } from '@/lib/dialog';

export default function PlanEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const plan = useRow('workout_plans', id);
  const allDays = useRows('plan_days');
  const allEx = useRows('plan_exercises');
  const lookup = useExerciseLookup();
  const days = useMemo(() => allDays.filter((d) => d.plan_id === id).sort((a, b) => a.sort_order - b.sort_order), [allDays, id]);

  if (!plan || plan.deleted) {
    return (
      <Screen title="Plan" back>
        <Text tone="secondary">Plan nicht gefunden.</Text>
      </Screen>
    );
  }

  return (
    <Screen title={plan.name} back testID="plan-editor" right={plan.is_active ? <Badge label="Aktiv" /> : <Button title="Aktivieren" size="sm" onPress={() => activatePlan(plan.id)} />}>
      <CommitInput label="Planname" value={plan.name} onCommit={(v) => v.trim() && update('workout_plans', plan.id, { name: v.trim() })} />
      {days.map((day, di) => {
        const exs = allEx.filter((e) => e.plan_day_id === day.id).sort((a, b) => a.sort_order - b.sort_order);
        return (
          <Card key={day.id} padding={spacing.md} testID={`editor-day-${di}`}>
            <Row>
              <CommitInput containerStyle={{ flex: 1 }} value={day.name} onCommit={(v) => v.trim() && update('plan_days', day.id, { name: v.trim() })} accessibilityLabel="Name des Trainingstags" />
              <IconButton icon="arrow-up" size={30} accessibilityLabel="Tag nach oben" onPress={() => moveInList('plan_days', days, di, -1)} />
              <IconButton icon="arrow-down" size={30} accessibilityLabel="Tag nach unten" onPress={() => moveInList('plan_days', days, di, 1)} />
              <IconButton
                icon="trash-outline"
                size={30}
                accessibilityLabel="Tag löschen"
                onPress={async () => {
                  if (await confirm('Trainingstag löschen?', `${day.name} und alle Übungen darin löschen?`, 'Löschen', true)) {
                    exs.forEach((e) => remove('plan_exercises', e.id));
                    remove('plan_days', day.id);
                    requestSync();
                  }
                }}
              />
            </Row>
            <Row gap={6} wrap style={{ marginTop: spacing.sm }}>
              <Text variant="small" tone="secondary">
                Fester Tag:
              </Text>
              {[null, 0, 1, 2, 3, 4, 5, 6].map((w) => (
                <Pressable
                  key={String(w)}
                  onPress={() => update('plan_days', day.id, { weekday: w })}
                  style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: day.weekday === w ? colors.accent : colors.surface2 }}
                  accessibilityRole="button"
                  accessibilityLabel={w === null ? 'Kein fester Tag' : WEEKDAY_SHORT_DE[w]}
                >
                  <Text variant="small" color={day.weekday === w ? colors.onAccent : colors.textSecondary}>
                    {w === null ? 'flexibel' : WEEKDAY_SHORT_DE[w]}
                  </Text>
                </Pressable>
              ))}
            </Row>
            {exs.map((pe, i) => (
              <PlanExerciseRow key={pe.id} pe={pe} name={lookup(pe.exercise_id)?.name ?? 'Unbekannt'} onUp={() => moveInList('plan_exercises', exs, i, -1)} onDown={() => moveInList('plan_exercises', exs, i, 1)} />
            ))}
            <Button testID={`add-exercise-day-${di}`} title="Übung hinzufügen" icon="add" size="sm" variant="secondary" style={{ marginTop: spacing.md }} onPress={() => router.push(`/exercises?mode=day&id=${day.id}`)} />
          </Card>
        );
      })}
      <Button
        testID="add-day"
        title="Trainingstag hinzufügen"
        variant="outline"
        icon="add"
        onPress={() => {
          insert('plan_days', { plan_id: plan.id, name: `Tag ${String.fromCharCode(65 + days.length)}`, weekday: null, sort_order: days.length });
          requestSync();
        }}
      />
      <Button
        title="Plan löschen"
        variant="danger"
        icon="trash-outline"
        onPress={async () => {
          if (await confirm('Plan löschen?', 'Der Plan wird gelöscht. Deine bisherigen Trainings bleiben erhalten.', 'Löschen', true)) {
            deletePlan(plan.id);
            router.back();
          }
        }}
      />
    </Screen>
  );
}

function PlanExerciseRow({ pe, name, onUp, onDown }: { pe: PlanExercise; name: string; onUp: () => void; onDown: () => void }) {
  const [open, setOpen] = useState(false);
  const num = (v: string, fallback: number, min: number, max: number) => {
    const n = parseDecimal(v);
    return n === null ? fallback : Math.max(min, Math.min(max, Math.round(n)));
  };
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.sm, paddingTop: spacing.sm }}>
      <Pressable onPress={() => setOpen((o) => !o)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }} accessibilityRole="button" accessibilityLabel={`${name} bearbeiten`}>
        <View style={{ flex: 1 }}>
          <Text variant="bodyMedium">{name}</Text>
          <Text variant="small" tone="secondary">
            {pe.target_sets} × {pe.rep_min}–{pe.rep_max} Wdh. · RIR {pe.target_rir} · Pause {Math.round(pe.rest_seconds / 60 * 10) / 10} min
          </Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
      </Pressable>
      {open && (
        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          <Row>
            <CommitInput containerStyle={{ flex: 1 }} label="Sätze" value={String(pe.target_sets)} keyboardType="number-pad" onCommit={(t) => update('plan_exercises', pe.id, { target_sets: num(t, pe.target_sets, 1, 20) })} />
            <CommitInput containerStyle={{ flex: 1 }} label="Wdh. min" value={String(pe.rep_min)} keyboardType="number-pad" onCommit={(t) => update('plan_exercises', pe.id, { rep_min: num(t, pe.rep_min, 1, 100) })} />
            <CommitInput containerStyle={{ flex: 1 }} label="Wdh. max" value={String(pe.rep_max)} keyboardType="number-pad" onCommit={(t) => update('plan_exercises', pe.id, { rep_max: Math.max(pe.rep_min, num(t, pe.rep_max, 1, 100)) })} />
          </Row>
          <Row>
            <CommitInput containerStyle={{ flex: 1 }} label="Ziel-RIR" value={String(pe.target_rir)} keyboardType="number-pad" onCommit={(t) => update('plan_exercises', pe.id, { target_rir: num(t, pe.target_rir, 0, 5) })} />
            <CommitInput containerStyle={{ flex: 1 }} label="Pause (s)" value={String(pe.rest_seconds)} keyboardType="number-pad" onCommit={(t) => update('plan_exercises', pe.id, { rest_seconds: num(t, pe.rest_seconds, 0, 900) })} />
            <CommitInput containerStyle={{ flex: 1 }} label="Schritt kg" value={pe.increment_kg === null ? '' : String(pe.increment_kg).replace('.', ',')} placeholder="Std." keyboardType="decimal-pad" onCommit={(t) => {
              const n = parseDecimal(t);
              update('plan_exercises', pe.id, { increment_kg: n !== null && n >= 0 ? n : null });
            }} />
          </Row>
          <Row>
            <Button title="Hoch" icon="arrow-up" size="sm" variant="secondary" onPress={onUp} style={{ flex: 1 }} />
            <Button title="Runter" icon="arrow-down" size="sm" variant="secondary" onPress={onDown} style={{ flex: 1 }} />
            <Button title="Entfernen" icon="trash-outline" size="sm" variant="danger" onPress={() => { remove('plan_exercises', pe.id); requestSync(); }} style={{ flex: 1 }} />
          </Row>
        </View>
      )}
    </View>
  );
}
