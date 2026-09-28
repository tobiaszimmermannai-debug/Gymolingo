import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  addDays,
  dateRange,
  dayNutrition,
  formatDateDE,
  formatNumberDE,
  MEAL_LABELS_DE,
  MEAL_ORDER,
  remainingForDay,
  todayISO,
  weekdayIndex,
  WEEKDAY_SHORT_DE,
  type MealEntry,
  type MealType,
} from '@gymolingo/core';
import { Screen, Row, Section } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { IconButton } from '@/ui/Button';
import { ProgressRing } from '@/ui/ProgressRing';
import { ProgressBar } from '@/ui/ProgressBar';
import { BarChart } from '@/ui/Charts';
import { Badge } from '@/ui/Chip';
import { colors, radius, spacing } from '@/ui/theme';
import { useProfileOrDefault, useRows } from '@/data/hooks';
import { deleteMealEntry, repeatMeal } from '@/data/actions';
import { confirm, notify } from '@/lib/dialog';
import { nutritionTips } from '@/features/nutritionTips';

export default function Nutrition() {
  const [date, setDate] = useState(todayISO());
  const p = useProfileOrDefault();
  const meals = useRows('meal_entries');
  const day = useMemo(() => dayNutrition(date, meals), [date, meals]);
  const rem = remainingForDay(day.totals, p);
  const isToday = date === todayISO();
  const week = useMemo(() => dateRange(addDays(date, -6), date).map((d) => ({ x: d, y: dayNutrition(d, meals).totals.kcal })), [date, meals]);
  const tips = useMemo(() => nutritionTips(p, meals, date), [p, meals, date]);

  return (
    <Screen
      title="Ernährung"
      tabBarPadding
      testID="nutrition-screen"
      right={
        <Row gap={spacing.sm}>
          <IconButton icon="book-outline" accessibilityLabel="Rezepte" onPress={() => router.push('/nutrition/recipes')} />
          <IconButton icon="barcode-outline" accessibilityLabel="Barcode scannen" testID="open-scanner" onPress={() => router.push(`/nutrition/scan?date=${date}&meal=${defaultMeal()}`)} />
        </Row>
      }
    >
      {/* Day switcher */}
      <Row style={{ justifyContent: 'space-between' }}>
        <IconButton icon="chevron-back" accessibilityLabel="Vorheriger Tag" testID="prev-day" onPress={() => setDate(addDays(date, -1))} />
        <Pressable onPress={() => setDate(todayISO())} accessibilityRole="button" accessibilityLabel="Heute">
          <Text variant="h3" testID="nutrition-date">
            {isToday ? 'Heute' : date === addDays(todayISO(), -1) ? 'Gestern' : `${WEEKDAY_SHORT_DE[weekdayIndex(date)]}, ${formatDateDE(date)}`}
          </Text>
        </Pressable>
        <IconButton icon="chevron-forward" accessibilityLabel="Nächster Tag" onPress={() => setDate(addDays(date, 1))} />
      </Row>

      <Card testID="nutrition-summary">
        <Row gap={spacing.lg}>
          <ProgressRing size={128} stroke={12} progress={p.calorie_target ? day.totals.kcal / p.calorie_target : 0} overColor={colors.warning}>
            <Text variant="number" testID="nutrition-kcal-remaining">
              {formatNumberDE(Math.abs(rem.kcal), 0)}
            </Text>
            <Text variant="caption" tone="secondary">
              {rem.kcal >= 0 ? 'übrig' : 'drüber'}
            </Text>
          </ProgressRing>
          <View style={{ flex: 1, gap: spacing.sm }}>
            <KV label="Gegessen" value={`${formatNumberDE(day.totals.kcal, 0)} kcal`} />
            <KV label="Ziel" value={`${formatNumberDE(p.calorie_target, 0)} kcal`} />
            <KV label="Ballaststoffe" value={`${formatNumberDE(day.totals.fiber_g, 0)} / ${p.fiber_target_g} g`} />
          </View>
        </Row>
        <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
          <MacroRow label="Protein" value={day.totals.protein_g} target={p.protein_target_g} color={colors.protein} testID="macro-protein" />
          <MacroRow label="Kohlenhydrate" value={day.totals.carbs_g} target={p.carbs_target_g} color={colors.carbs} />
          <MacroRow label="Fett" value={day.totals.fat_g} target={p.fat_target_g} color={colors.fat} />
        </View>
        {day.estimatedEntries > 0 && (
          <Row gap={6} style={{ marginTop: spacing.md }}>
            <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
            <Text variant="small" tone="secondary" style={{ flex: 1 }}>
              {day.estimatedEntries} Eintrag{day.estimatedEntries === 1 ? '' : 'e'} basier{day.estimatedEntries === 1 ? 't' : 'en'} auf Schätzwerten (~) und können abweichen.
            </Text>
          </Row>
        )}
      </Card>

      {MEAL_ORDER.map((m) => (
        <MealSection key={m} meal={m} date={date} entries={meals.filter((e) => e.date === date && e.meal === m).sort((a, b) => a.logged_at.localeCompare(b.logged_at))} kcal={day.byMeal[m].kcal} protein={day.byMeal[m].protein_g} />
      ))}

      {tips.length > 0 && (
        <Section title="Tipps für dich">
          {tips.map((t) => (
            <Card key={t.id} padding={spacing.md}>
              <Row style={{ alignItems: 'flex-start' }}>
                <Text variant="h3">{t.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium">{t.title}</Text>
                  <Text variant="small" tone="secondary">
                    {t.text}
                  </Text>
                </View>
              </Row>
            </Card>
          ))}
        </Section>
      )}

      <Section title="Kalorien der letzten 7 Tage">
        <Card>
          <BarChart data={week} unit="kcal" target={p.calorie_target} highlightLast labelFormat={(x) => formatDateDE(x)} testID="week-kcal-chart" />
          <Text variant="small" tone="muted" style={{ marginTop: spacing.sm }}>
            Gestrichelte Linie = Kalorienziel
          </Text>
        </Card>
      </Section>
    </Screen>
  );
}

function defaultMeal(): MealType {
  const h = new Date().getHours();
  return h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snack';
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Text variant="small" tone="secondary">
        {label}
      </Text>
      <Text variant="smallMedium">{value}</Text>
    </Row>
  );
}

function MacroRow({ label, value, target, color, testID }: { label: string; value: number; target: number; color: string; testID?: string }) {
  const left = target - value;
  return (
    <View style={{ gap: 5 }} testID={testID}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={6}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
          <Text variant="smallMedium">{label}</Text>
        </Row>
        <Text variant="small" tone="secondary">
          {formatNumberDE(value, 0)} / {formatNumberDE(target, 0)} g · {left > 0 ? `noch ${formatNumberDE(left, 0)} g` : '✓'}
        </Text>
      </Row>
      <ProgressBar progress={target ? value / target : 0} color={color} height={7} />
    </View>
  );
}

function MealSection({ meal, date, entries, kcal, protein }: { meal: MealType; date: string; entries: MealEntry[]; kcal: number; protein: number }) {
  const yesterday = addDays(date, -1);
  return (
    <Card padding={spacing.md} testID={`meal-${meal}`}>
      <Row>
        <View style={{ flex: 1 }}>
          <Text variant="h3">{MEAL_LABELS_DE[meal]}</Text>
          <Text variant="small" tone="secondary">
            {formatNumberDE(kcal, 0)} kcal · {formatNumberDE(protein, 0)} g Protein
          </Text>
        </View>
        <IconButton
          icon="repeat"
          size={34}
          accessibilityLabel={`${MEAL_LABELS_DE[meal]} von gestern wiederholen`}
          testID={`repeat-${meal}`}
          onPress={async () => {
            if (!(await confirm('Mahlzeit wiederholen?', `${MEAL_LABELS_DE[meal]} von gestern (${formatDateDE(yesterday)}) übernehmen?`, 'Übernehmen'))) return;
            const n = repeatMeal(yesterday, meal, date);
            if (n === 0) notify('Nichts gefunden', `Gestern wurde kein ${MEAL_LABELS_DE[meal]} eingetragen.`);
          }}
        />
        <IconButton icon="add" size={34} background={colors.accent} color={colors.onAccent} accessibilityLabel={`${MEAL_LABELS_DE[meal]} hinzufügen`} testID={`add-${meal}`} onPress={() => router.push(`/nutrition/add?date=${date}&meal=${meal}`)} />
      </Row>
      {entries.map((e) => (
        <Pressable
          key={e.id}
          testID={`entry-${e.id}`}
          onPress={() => router.push(`/nutrition/entry/${e.id}`)}
          onLongPress={async () => {
            if (await confirm('Eintrag löschen?', e.name, 'Löschen', true)) deleteMealEntry(e.id);
          }}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 6, opacity: pressed ? 0.6 : 1 })}
          accessibilityRole="button"
          accessibilityLabel={`${e.name} bearbeiten`}
        >
          <View style={{ flex: 1 }}>
            <Row gap={6}>
              <Text variant="bodyMedium" numberOfLines={1} style={{ flexShrink: 1 }}>
                {e.name}
              </Text>
              {e.is_estimate && <Badge label="~ Schätzung" tone="warning" />}
            </Row>
            <Text variant="small" tone="secondary" numberOfLines={1}>
              {e.serving_label ? `${e.serving_label} · ` : ''}
              {formatNumberDE(e.amount_g, 0)} g{e.brand ? ` · ${e.brand}` : ''}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text variant="smallMedium">{formatNumberDE(e.kcal, 0)} kcal</Text>
            <Text variant="small" tone="secondary">
              P {formatNumberDE(e.protein_g, 0)} · K {formatNumberDE(e.carbs_g, 0)} · F {formatNumberDE(e.fat_g, 0)}
            </Text>
          </View>
        </Pressable>
      ))}
      {entries.length === 0 && (
        <Pressable onPress={() => router.push(`/nutrition/add?date=${date}&meal=${meal}`)} style={{ marginTop: spacing.sm, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border }} accessibilityRole="button">
          <Text variant="small" tone="muted" align="center">
            Noch nichts eingetragen – tippe auf +
          </Text>
        </Pressable>
      )}
    </Card>
  );
}

