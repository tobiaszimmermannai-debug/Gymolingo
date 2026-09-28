import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatNumberDE, recipeNutrients, todayISO, type FoodItem } from '@gymolingo/core';
import { Screen, Row, Section } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { Button, IconButton } from '@/ui/Button';
import { Input, parseDecimal } from '@/ui/Input';
import { CommitInput } from '@/ui/CommitInput';
import { colors, spacing } from '@/ui/theme';
import { useRow, useRows } from '@/data/hooks';
import { insert, remove, update } from '@/data/store';
import { requestSync } from '@/data/sync';
import { persistOffFood, useFoodSearch } from '@/features/foods';
import { confirm } from '@/lib/dialog';

export default function RecipeEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipe = useRow('recipes', id);
  const allItems = useRows('recipe_items');
  const items = useMemo(() => allItems.filter((i) => i.recipe_id === id), [allItems, id]);
  const [q, setQ] = useState('');
  const search = useFoodSearch(q);
  const totals = useMemo(() => recipeNutrients(items.map((i) => ({ ...i, amount_g: Number(i.amount_g) }))), [items]);

  if (!recipe || recipe.deleted) {
    return (
      <Screen title="Rezept" back>
        <Text tone="secondary">Rezept nicht gefunden.</Text>
      </Screen>
    );
  }
  const servings = Math.max(1, Number(recipe.servings));
  const perPortion = (v: number) => formatNumberDE(v / servings, 0);

  const addIngredient = (food: FoodItem) => {
    const f = food.source === 'off' ? persistOffFood(food) : food;
    insert('recipe_items', {
      recipe_id: recipe.id,
      food_ref: f.ref,
      name: f.name,
      amount_g: f.servings[0]?.grams ?? 100,
      kcal_100: f.kcal_100,
      protein_100: f.protein_100,
      carbs_100: f.carbs_100,
      fat_100: f.fat_100,
      fiber_100: f.fiber_100,
      sugar_100: f.sugar_100,
      salt_100: f.salt_100,
    });
    requestSync();
    setQ('');
  };

  const results = [...search.own.filter((f) => f.ref !== `recipe:${recipe.id}`), ...search.builtin, ...search.off].slice(0, 12);

  return (
    <Screen title={recipe.name} back testID="recipe-editor">
      <Row>
        <CommitInput containerStyle={{ flex: 2 }} label="Name" value={recipe.name} onCommit={(v) => v.trim() && update('recipes', recipe.id, { name: v.trim() })} />
        <CommitInput containerStyle={{ flex: 1 }} label="Portionen" value={String(recipe.servings).replace('.', ',')} keyboardType="decimal-pad" onCommit={(v) => {
          const n = parseDecimal(v);
          if (n && n > 0 && n <= 100) update('recipes', recipe.id, { servings: n });
        }} />
      </Row>

      <Card variant="accent" testID="recipe-totals">
        <Text variant="caption" tone="secondary">
          Pro Portion ({formatNumberDE(totals.totalGrams / servings, 0)} g)
        </Text>
        <Text variant="h2">{perPortion(totals.totals.kcal)} kcal</Text>
        <Text variant="small" tone="secondary">
          Protein {perPortion(totals.totals.protein_g)} g · Kohlenhydrate {perPortion(totals.totals.carbs_g)} g · Fett {perPortion(totals.totals.fat_g)} g
        </Text>
        <Text variant="small" tone="muted" style={{ marginTop: 4 }}>
          Gesamt {formatNumberDE(totals.totals.kcal, 0)} kcal · {formatNumberDE(totals.totalGrams, 0)} g (Rohgewichte)
        </Text>
      </Card>

      <Section title="Zutaten">
        {items.map((i) => (
          <Card key={i.id} padding={spacing.md}>
            <Row>
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium">{i.name}</Text>
                <Text variant="small" tone="secondary">
                  {formatNumberDE((Number(i.kcal_100) * Number(i.amount_g)) / 100, 0)} kcal · P {formatNumberDE((Number(i.protein_100) * Number(i.amount_g)) / 100, 1)} g
                </Text>
              </View>
              <CommitInput containerStyle={{ width: 100 }} value={String(i.amount_g).replace('.', ',')} suffix="g" keyboardType="decimal-pad" accessibilityLabel={`Menge ${i.name}`} onCommit={(v) => {
                const n = parseDecimal(v);
                if (n && n > 0 && n < 10000) update('recipe_items', i.id, { amount_g: n });
              }} />
              <IconButton icon="trash-outline" size={32} background="transparent" color={colors.textMuted} accessibilityLabel="Zutat entfernen" onPress={() => { remove('recipe_items', i.id); requestSync(); }} />
            </Row>
          </Card>
        ))}
        <Input placeholder="Zutat suchen …" value={q} onChangeText={setQ} testID="ingredient-search" />
        {q.length > 0 &&
          results.map((f, i) => (
            <Pressable key={f.ref} testID={`ingredient-result-${i}`} onPress={() => addIngredient(f)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border, opacity: pressed ? 0.6 : 1 })} accessibilityRole="button" accessibilityLabel={`${f.name} hinzufügen`}>
              <Text style={{ flex: 1 }} numberOfLines={1}>
                {f.name}
                {f.brand ? ` · ${f.brand}` : ''}
              </Text>
              <Text variant="small" tone="secondary">
                {formatNumberDE(f.kcal_100, 0)} kcal/100 g
              </Text>
              <Ionicons name="add-circle" size={22} color={colors.accent} />
            </Pressable>
          ))}
      </Section>

      <Button title="Portion eintragen" icon="add" disabled={items.length === 0} testID="log-recipe" onPress={() => router.push(`/nutrition/food?ref=${encodeURIComponent(`recipe:${recipe.id}`)}&date=${todayISO()}&meal=lunch`)} />
      <Button
        title="Rezept löschen"
        variant="danger"
        icon="trash-outline"
        onPress={async () => {
          if (await confirm('Rezept löschen?', recipe.name, 'Löschen', true)) {
            items.forEach((i) => remove('recipe_items', i.id));
            remove('recipes', recipe.id);
            requestSync();
            router.back();
          }
        }}
      />
    </Screen>
  );
}
