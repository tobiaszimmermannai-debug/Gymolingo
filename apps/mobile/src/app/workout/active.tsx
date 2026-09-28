import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  formatDuration,
  formatKg,
  formatNumberDE,
  MUSCLE_LABELS_DE,
  sessionDurationSec,
  type ExerciseDef,
  type ProgressionSuggestion,
  type WorkoutSet,
} from '@gymolingo/core';
import { Screen, Row } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { Button, IconButton } from '@/ui/Button';
import { Badge } from '@/ui/Chip';
import { parseDecimal } from '@/ui/Input';
import { colors, fonts, radius, spacing } from '@/ui/theme';
import { useDB } from '@/data/store';
import { useExerciseLookup, useRows } from '@/data/hooks';
import {
  addSet,
  discardWorkout,
  finishWorkout,
  pauseWorkout,
  removeExerciseFromSession,
  removeSet,
  resumeWorkout,
  suggestionFor,
  toggleSetComplete,
  updateSet,
} from '@/data/actions';
import { confirm } from '@/lib/dialog';
import { haptic } from '@/lib/haptics';
import { lastPerformedSets } from '@gymolingo/core';

const SET_TYPES: WorkoutSet['set_type'][] = ['working', 'warmup', 'drop', 'failure'];
const SET_TYPE_LABEL: Record<WorkoutSet['set_type'], string> = { working: '', warmup: 'W', drop: 'D', failure: 'F' };
const RIR_CYCLE: (number | null)[] = [null, 0, 1, 2, 3, 4, 5];

export default function ActiveWorkout() {
  const session = useDB((s) => Object.values(s.tables.workout_sessions).find((x) => !x.deleted && (x.status === 'active' || x.status === 'paused')));
  const allSets = useRows('workout_sets');
  const allSessions = useRows('workout_sessions');
  const planExercises = useRows('plan_exercises');
  const lookup = useExerciseLookup();
  const [now, setNow] = useState(Date.now());
  const [rest, setRest] = useState<{ until: number; total: number } | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (rest && now >= rest.until) {
      haptic('success');
      setRest(null);
    }
  }, [now, rest]);

  const sets = useMemo(() => (session ? allSets.filter((s) => s.session_id === session.id) : []), [allSets, session]);
  const groups = useMemo(() => {
    const m = new Map<string, WorkoutSet[]>();
    for (const s of [...sets].sort((a, b) => a.exercise_order - b.exercise_order || a.set_index - b.set_index)) {
      const arr = m.get(s.exercise_id) ?? [];
      arr.push(s);
      m.set(s.exercise_id, arr);
    }
    return [...m.entries()];
  }, [sets]);

  if (!session) {
    return (
      <Screen title="Training" back>
        <Card>
          <Text variant="h3">Kein aktives Training</Text>
          <Text tone="secondary" style={{ marginTop: 6 }}>
            Starte ein Training über den Trainings-Tab oder die Startseite.
          </Text>
          <Button title="Zum Training" style={{ marginTop: spacing.md }} onPress={() => router.replace('/training')} />
        </Card>
      </Screen>
    );
  }

  const elapsed = sessionDurationSec(session, new Date(now));
  const done = sets.filter((s) => s.completed).length;
  const paused = session.status === 'paused';

  const onFinish = async () => {
    const open = sets.filter((s) => !s.completed).length;
    if (done === 0) {
      const ok = await confirm('Training verwerfen?', 'Es wurde noch kein Satz abgeschlossen. Möchtest du das Training verwerfen?', 'Verwerfen', true);
      if (ok) {
        discardWorkout(session);
        router.replace('/training');
      }
      return;
    }
    const ok = await confirm('Training abschließen?', open ? `${open} nicht abgehakte Sätze werden nicht gespeichert.` : 'Stark! Alle Sätze sind erledigt.', 'Abschließen');
    if (!ok) return;
    finishWorkout(session);
    haptic('success');
    router.replace(`/workout/${session.id}?done=1`);
  };

  const onComplete = (set: WorkoutSet) => {
    toggleSetComplete(set);
    if (!set.completed) {
      haptic('medium');
      const r = set.rest_seconds ?? 120;
      if (r > 0) setRest({ until: Date.now() + r * 1000, total: r });
    }
  };

  return (
    <Screen
      testID="active-workout"
      title={session.name}
      subtitle={`${formatDuration(elapsed)} · ${done}/${sets.length} Sätze${paused ? ' · pausiert' : ''}`}
      back
      right={
        <Row gap={spacing.sm}>
          <IconButton
            testID="pause-workout"
            icon={paused ? 'play' : 'pause'}
            accessibilityLabel={paused ? 'Fortsetzen' : 'Pausieren'}
            onPress={() => (paused ? resumeWorkout(session) : pauseWorkout(session))}
          />
          <Button testID="finish-workout" title="Fertig" size="sm" onPress={onFinish} />
        </Row>
      }
      footer={
        rest ? (
          <RestTimer rest={rest} now={now} onAdd={() => setRest((r) => (r ? { ...r, until: r.until + 15000, total: r.total + 15 } : r))} onSkip={() => setRest(null)} />
        ) : undefined
      }
    >
      {paused && (
        <Card variant="accent" onPress={() => resumeWorkout(session)} accessibilityLabel="Training fortsetzen">
          <Row>
            <Ionicons name="pause-circle" size={28} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium">Training pausiert</Text>
              <Text variant="small" tone="secondary">
                Die Pausenzeit zählt nicht zur Trainingsdauer. Tippen zum Fortsetzen.
              </Text>
            </View>
          </Row>
        </Card>
      )}

      {groups.map(([exerciseId, exSets]) => {
        const ex = lookup(exerciseId);
        const pe = session.plan_day_id ? planExercises.find((p) => p.plan_day_id === session.plan_day_id && p.exercise_id === exerciseId) : undefined;
        return (
          <ExerciseBlock
            key={exerciseId}
            sessionId={session.id}
            exercise={ex}
            exerciseId={exerciseId}
            sets={exSets}
            lastSets={lastPerformedSets(exerciseId, allSessions, allSets, session.id)}
            config={
              ex
                ? {
                    exercise: ex,
                    target_sets: pe?.target_sets ?? Math.max(1, exSets.filter((s) => s.set_type !== 'warmup').length),
                    rep_min: pe?.rep_min ?? ex.default_rep_min,
                    rep_max: pe?.rep_max ?? ex.default_rep_max,
                    target_rir: pe?.target_rir ?? 2,
                    rest_seconds: pe?.rest_seconds ?? 120,
                    increment_kg: pe?.increment_kg ?? ex.increment_kg,
                  }
                : null
            }
            onComplete={onComplete}
          />
        );
      })}

      <Button testID="add-exercise" title="Übung hinzufügen" variant="secondary" icon="add" onPress={() => router.push(`/exercises?mode=session&id=${session.id}`)} />
      <Button
        title="Training verwerfen"
        variant="ghost"
        onPress={async () => {
          if (await confirm('Training verwerfen?', 'Alle Sätze dieses Trainings werden gelöscht.', 'Verwerfen', true)) {
            discardWorkout(session);
            router.replace('/training');
          }
        }}
      />
    </Screen>
  );
}

function ExerciseBlock({
  sessionId,
  exercise,
  exerciseId,
  sets,
  lastSets,
  config,
  onComplete,
}: {
  sessionId: string;
  exercise: ExerciseDef | undefined;
  exerciseId: string;
  sets: WorkoutSet[];
  lastSets: WorkoutSet[];
  config: Parameters<typeof suggestionFor>[0] | null;
  onComplete: (s: WorkoutSet) => void;
}) {
  const [showWhy, setShowWhy] = useState(false);
  const suggestion: ProgressionSuggestion | null = useMemo(() => (config ? suggestionFor(config, sessionId) : null), [config?.exercise.id, sessionId, config?.rep_min, config?.rep_max]);
  const working = sets.filter((s) => s.set_type !== 'warmup');
  const lastWorking = lastSets.filter((s) => s.set_type !== 'warmup');

  const applySuggestion = () => {
    if (!suggestion) return;
    working.forEach((s, i) => {
      if (s.completed) return;
      updateSet(s.id, { weight_kg: suggestion.weight_kg, reps: suggestion.reps[i] ?? suggestion.reps[suggestion.reps.length - 1] });
    });
    haptic('light');
  };

  return (
    <Card padding={spacing.md} testID={`exercise-${exerciseId}`}>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text variant="h3">{exercise?.name ?? 'Unbekannte Übung'}</Text>
          {exercise && (
            <Text variant="small" tone="secondary">
              {MUSCLE_LABELS_DE[exercise.primary_muscle]}
              {config ? ` · Ziel ${config.rep_min}–${config.rep_max} Wdh. · ${config.target_rir} RIR` : ''}
            </Text>
          )}
        </View>
        <IconButton
          icon="trash-outline"
          size={32}
          color={colors.textMuted}
          background="transparent"
          accessibilityLabel="Übung entfernen"
          onPress={async () => {
            if (await confirm('Übung entfernen?', `${exercise?.name ?? 'Übung'} aus diesem Training entfernen?`, 'Entfernen', true)) removeExerciseFromSession(sessionId, exerciseId);
          }}
        />
      </Row>

      {suggestion && (
        <Pressable onPress={() => setShowWhy((v) => !v)} style={{ marginTop: spacing.sm, backgroundColor: colors.accentSofter, borderRadius: radius.md, padding: spacing.sm, borderWidth: 1, borderColor: 'rgba(198,244,50,0.18)' }} accessibilityRole="button" accessibilityLabel="Begründung anzeigen">
          <Row>
            <Ionicons name="trending-up" size={16} color={colors.accent} />
            <Text variant="smallMedium" style={{ flex: 1 }} testID={`suggestion-${exerciseId}`}>
              {suggestion.kind === 'first_time'
                ? 'Erstes Mal – finde dein Arbeitsgewicht'
                : `Ziel: ${formatKg(suggestion.weight_kg)} × ${suggestion.reps.join('/')}`}
            </Text>
            {suggestion.kind !== 'first_time' && (
              <Pressable testID={`apply-suggestion-${exerciseId}`} onPress={applySuggestion} hitSlop={8} accessibilityRole="button" accessibilityLabel="Vorschlag übernehmen">
                <Text variant="smallMedium" tone="accent">
                  Übernehmen
                </Text>
              </Pressable>
            )}
          </Row>
          {showWhy && (
            <Text variant="small" tone="secondary" style={{ marginTop: 6 }}>
              {suggestion.rationale}
            </Text>
          )}
          {suggestion.plateau && suggestion.kind !== 'deload' && <Badge label="Plateau erkannt" tone="warning" />}
        </Pressable>
      )}

      <Row style={{ marginTop: spacing.md, paddingHorizontal: 4 }}>
        <Text variant="caption" tone="muted" style={{ width: 34 }}>
          Satz
        </Text>
        <Text variant="caption" tone="muted" style={{ flex: 1.1 }}>
          Zuletzt
        </Text>
        <Text variant="caption" tone="muted" style={{ flex: 1, textAlign: 'center' }}>
          kg
        </Text>
        <Text variant="caption" tone="muted" style={{ flex: 0.8, textAlign: 'center' }}>
          Wdh.
        </Text>
        <Text variant="caption" tone="muted" style={{ width: 40, textAlign: 'center' }}>
          RIR
        </Text>
        <View style={{ width: 40 }} />
      </Row>
      {sets.map((s) => {
        const wIndex = working.indexOf(s);
        const prev = s.set_type === 'warmup' ? lastSets.filter((x) => x.set_type === 'warmup')[sets.filter((x) => x.set_type === 'warmup').indexOf(s)] : lastWorking[wIndex];
        return <SetRow key={s.id} set={s} label={s.set_type === 'working' ? String(wIndex + 1) : SET_TYPE_LABEL[s.set_type]} prev={prev} onComplete={() => onComplete(s)} />;
      })}
      <Row style={{ marginTop: spacing.sm }}>
        <Button testID={`add-set-${exerciseId}`} title="Satz" icon="add" size="sm" variant="secondary" onPress={() => addSet(sessionId, exerciseId)} style={{ flex: 1 }} />
        <Button title="Aufwärmsatz" icon="add" size="sm" variant="ghost" onPress={() => addSet(sessionId, exerciseId, 'warmup')} style={{ flex: 1 }} />
      </Row>
    </Card>
  );
}

function SetRow({ set, label, prev, onComplete }: { set: WorkoutSet; label: string; prev?: WorkoutSet; onComplete: () => void }) {
  const [w, setW] = useState(formatNumberDE(set.weight_kg, 2).replace(/\./g, ''));
  const [r, setR] = useState(String(set.reps));
  const focusW = useRef(false);
  const focusR = useRef(false);

  useEffect(() => {
    if (!focusW.current) setW(formatNumberDE(set.weight_kg, 2).replace(/\./g, ''));
    if (!focusR.current) setR(String(set.reps));
  }, [set.weight_kg, set.reps]);

  const commitW = (v: string) => {
    const n = parseDecimal(v);
    if (n !== null && n >= 0 && n < 1000) updateSet(set.id, { weight_kg: Math.round(n * 100) / 100 });
  };
  const commitR = (v: string) => {
    const n = parseDecimal(v);
    if (n !== null && n >= 0 && n < 1000) updateSet(set.id, { reps: Math.round(n) });
  };
  const cycleType = () => {
    const i = SET_TYPES.indexOf(set.set_type);
    updateSet(set.id, { set_type: SET_TYPES[(i + 1) % SET_TYPES.length] });
  };
  const cycleRir = () => {
    const i = RIR_CYCLE.indexOf(set.rir === null ? null : Math.round(set.rir));
    updateSet(set.id, { rir: RIR_CYCLE[(i + 1) % RIR_CYCLE.length] });
  };
  const inputStyle = {
    backgroundColor: set.completed ? 'transparent' : colors.surface3,
    color: colors.text,
    borderRadius: radius.sm,
    paddingVertical: 8,
    textAlign: 'center' as const,
    fontFamily: fonts.semibold,
    fontSize: 16,
    outlineStyle: 'none',
    minWidth: 0,
    flexBasis: 0,
    width: '100%',
  };
  const beatTarget = set.target_weight_kg !== null && set.target_reps !== null && set.completed && (set.weight_kg > set.target_weight_kg || (set.weight_kg >= set.target_weight_kg && set.reps >= set.target_reps));

  return (
    <View
      testID={`set-row-${set.id}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 5, paddingHorizontal: 4, marginTop: 2, borderRadius: radius.sm, backgroundColor: set.completed ? colors.accentSofter : 'transparent' }}
    >
      <Pressable onPress={cycleType} onLongPress={() => removeSet(set.id)} style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2 }} accessibilityRole="button" accessibilityLabel={`Satztyp ändern (lange drücken: löschen)`}>
        <Text variant="smallMedium" tone={set.set_type === 'working' ? 'default' : 'warning'}>
          {label}
        </Text>
      </Pressable>
      <Text variant="small" tone="muted" style={{ flex: 1.1 }} numberOfLines={1}>
        {prev ? `${formatNumberDE(prev.weight_kg, 2)}×${prev.reps}` : '–'}
      </Text>
      <TextInput
        testID={`weight-${set.id}`}
        value={w}
        onChangeText={setW}
        onFocus={() => (focusW.current = true)}
        onBlur={() => {
          focusW.current = false;
          commitW(w);
        }}
        onSubmitEditing={() => commitW(w)}
        keyboardType="decimal-pad"
        selectTextOnFocus
        accessibilityLabel="Gewicht in kg"
        style={[inputStyle as never, { flex: 1 }]}
      />
      <TextInput
        testID={`reps-${set.id}`}
        value={r}
        onChangeText={setR}
        onFocus={() => (focusR.current = true)}
        onBlur={() => {
          focusR.current = false;
          commitR(r);
        }}
        onSubmitEditing={() => commitR(r)}
        keyboardType="number-pad"
        selectTextOnFocus
        accessibilityLabel="Wiederholungen"
        style={[inputStyle as never, { flex: 0.8 }]}
      />
      <Pressable testID={`rir-${set.id}`} onPress={cycleRir} style={{ width: 40, paddingVertical: 8, borderRadius: radius.sm, backgroundColor: colors.surface2, alignItems: 'center' }} accessibilityRole="button" accessibilityLabel="Reps in Reserve">
        <Text variant="smallMedium" tone={set.rir === null ? 'muted' : 'default'}>
          {set.rir === null ? '–' : set.rir >= 5 ? '5+' : formatNumberDE(set.rir, 0)}
        </Text>
      </Pressable>
      <Pressable
        testID={`complete-${set.id}`}
        onPress={() => {
          commitW(w);
          commitR(r);
          onComplete();
        }}
        style={{ width: 40, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: set.completed ? colors.accent : colors.surface3 }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: set.completed }}
        accessibilityLabel="Satz abhaken"
      >
        <Ionicons name={beatTarget ? 'trophy' : 'checkmark'} size={20} color={set.completed ? colors.onAccent : colors.textMuted} />
      </Pressable>
    </View>
  );
}

function RestTimer({ rest, now, onAdd, onSkip }: { rest: { until: number; total: number }; now: number; onAdd: () => void; onSkip: () => void }) {
  const left = Math.max(0, Math.round((rest.until - now) / 1000));
  return (
    <View testID="rest-timer" style={{ gap: spacing.sm }}>
      <Row>
        <Ionicons name="timer-outline" size={22} color={colors.accent} />
        <Text variant="h2" style={{ flex: 1 }}>
          Pause {formatDuration(left)}
        </Text>
        <Button title="+15 s" size="sm" variant="secondary" onPress={onAdd} />
        <Button title="Weiter" size="sm" onPress={onSkip} />
      </Row>
      <View style={{ height: 4, backgroundColor: colors.surface3, borderRadius: 2, overflow: 'hidden' }}>
        <View style={{ width: `${(left / rest.total) * 100}%`, height: 4, backgroundColor: colors.accent }} />
      </View>
    </View>
  );
}
