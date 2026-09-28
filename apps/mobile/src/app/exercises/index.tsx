import { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { EQUIPMENT_LABELS_DE, EXERCISES, MUSCLE_LABELS_DE, searchExercises, type ExerciseDef, type MuscleGroup } from '@gymolingo/core';
import { Screen, Row } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Input } from '@/ui/Input';
import { Chip } from '@/ui/Chip';
import { Button } from '@/ui/Button';
import { colors, radius, spacing } from '@/ui/theme';
import { useRows } from '@/data/hooks';
import { addExerciseToDay, addExerciseToSession } from '@/data/actions';
import { defaultConfig } from '@/features/planner';

const MUSCLE_FILTERS: MuscleGroup[] = ['chest', 'back', 'lats', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'abs'];

/**
 * Exercise library. Modes:
 *  - browse (default): opens exercise statistics
 *  - mode=session&id=<sessionId>: adds the exercise to the running workout
 *  - mode=day&id=<planDayId>: adds the exercise to a plan day
 */
export default function Exercises() {
  const { mode, id } = useLocalSearchParams<{ mode?: 'session' | 'day'; id?: string }>();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const custom = useRows('custom_exercises');
  const all = useMemo<ExerciseDef[]>(
    () => [
      ...custom.map((c) => ({ ...c, increment_kg: Number(c.increment_kg), instructions: c.instructions ?? undefined })),
      ...EXERCISES,
    ],
    [custom],
  );
  const list = useMemo(() => searchExercises(all, q, muscle ? { muscle } : undefined), [all, q, muscle]);

  const pick = (ex: ExerciseDef) => {
    if (mode === 'session' && id) {
      addExerciseToSession(id, defaultConfig(ex));
      router.back();
    } else if (mode === 'day' && id) {
      addExerciseToDay(id, ex);
      router.back();
    } else {
      router.push(`/exercises/${ex.id}`);
    }
  };

  return (
    <Screen title={mode ? 'Übung auswählen' : 'Übungen'} subtitle={`${list.length} Übungen`} back scroll={false} testID="exercise-picker" right={<Button title="Eigene" size="sm" variant="secondary" icon="add" onPress={() => router.push(`/exercises/new${mode && id ? `?mode=${mode}&id=${id}` : ''}`)} />}>
      <Input testID="exercise-search" placeholder="Suchen, z. B. Bankdrücken" value={q} onChangeText={setQ} autoFocus={!!mode} />
      <View>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={MUSCLE_FILTERS}
          keyExtractor={(m) => m}
          contentContainerStyle={{ gap: spacing.sm }}
          renderItem={({ item }) => <Chip label={MUSCLE_LABELS_DE[item]} selected={muscle === item} onPress={() => setMuscle(muscle === item ? null : item)} />}
        />
      </View>
      <FlatList
        style={{ flex: 1 }}
        data={list}
        keyExtractor={(e) => e.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <Pressable
            testID={`exercise-item-${item.id}`}
            onPress={() => pick(item)}
            accessibilityRole="button"
            accessibilityLabel={item.name}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, opacity: pressed ? 0.6 : 1 })}
          >
            <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="barbell-outline" size={20} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium">{item.name}</Text>
              <Text variant="small" tone="secondary">
                {MUSCLE_LABELS_DE[item.primary_muscle]} · {EQUIPMENT_LABELS_DE[item.equipment]}
              </Text>
            </View>
            <Ionicons name={mode ? 'add-circle' : 'chevron-forward'} size={mode ? 24 : 18} color={mode ? colors.accent : colors.textMuted} />
          </Pressable>
        )}
        ListEmptyComponent={
          <Row style={{ paddingVertical: spacing.xl }}>
            <Text tone="secondary">Keine Übung gefunden – lege eine eigene an.</Text>
          </Row>
        }
      />
    </Screen>
  );
}
