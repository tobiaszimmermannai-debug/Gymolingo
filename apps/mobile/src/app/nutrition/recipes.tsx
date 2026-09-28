import { useState } from 'react';
import { router } from 'expo-router';
import { formatNumberDE } from '@gymolingo/core';
import { Screen, Section } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { spacing } from '@/ui/theme';
import { useRows } from '@/data/hooks';
import { insert } from '@/data/store';
import { requestSync } from '@/data/sync';
import { recipeToItem } from '@/features/foods';

export default function Recipes() {
  const recipes = useRows('recipes');
  const items = useRows('recipe_items');
  const [name, setName] = useState('');
  return (
    <Screen title="Rezepte" back testID="recipes-screen">
      <Card>
        <Input label="Neues Rezept" value={name} onChangeText={setName} placeholder="z. B. Protein-Porridge" testID="recipe-name" />
        <Button
          title="Anlegen"
          icon="add"
          style={{ marginTop: spacing.md }}
          disabled={name.trim().length < 2}
          testID="create-recipe"
          onPress={() => {
            const r = insert('recipes', { name: name.trim(), servings: 1, notes: null });
            requestSync();
            setName('');
            router.push(`/nutrition/recipe/${r.id}`);
          }}
        />
      </Card>
      <Section title={`${recipes.length} Rezepte`}>
        {recipes.length === 0 && <Text tone="secondary">Rezepte berechnen Nährwerte aus den Zutaten – ideal für Gerichte, die du öfter kochst.</Text>}
        {recipes.map((r) => {
          const f = recipeToItem(r, items);
          const portion = f.servings[0];
          return (
            <Card key={r.id} padding={spacing.md} onPress={() => router.push(`/nutrition/recipe/${r.id}`)} accessibilityLabel={r.name}>
              <Text variant="bodyMedium">{r.name}</Text>
              <Text variant="small" tone="secondary">
                {items.filter((i) => i.recipe_id === r.id).length} Zutaten ·{' '}
                {portion ? `${formatNumberDE((f.kcal_100 * portion.grams) / 100, 0)} kcal / Portion` : `${formatNumberDE(f.kcal_100, 0)} kcal / 100 g`}
              </Text>
            </Card>
          );
        })}
      </Section>
    </Screen>
  );
}
