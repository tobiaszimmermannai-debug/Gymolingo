import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatNumberDE, MEAL_LABELS_DE, todayISO, type FoodItem, type MealType } from '@gymolingo/core';
import { Screen, Row, Section } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Input } from '@/ui/Input';
import { Badge } from '@/ui/Chip';
import { Card } from '@/ui/Card';
import { colors, radius, spacing } from '@/ui/theme';
import { useRows } from '@/data/hooks';
import { recentFoods, useFoodSearch } from '@/features/foods';

export default function AddFood() {
  const { date = todayISO(), meal = 'lunch' } = useLocalSearchParams<{ date?: string; meal?: MealType }>();
  const [q, setQ] = useState('');
  const entries = useRows('meal_entries');
  const res = useFoodSearch(q);
  const recent = recentFoods(entries);
  const open = (ref: string) => router.push(`/nutrition/food?ref=${encodeURIComponent(ref)}&date=${date}&meal=${meal}`);

  return (
    <Screen title={`${MEAL_LABELS_DE[meal as MealType] ?? 'Mahlzeit'} hinzufügen`} back testID="add-food-screen">
      <Input testID="food-search" placeholder="Lebensmittel suchen, z. B. Magerquark" value={q} onChangeText={setQ} autoFocus />
      <Row gap={spacing.sm}>
        <QuickAction icon="barcode-outline" label="Barcode" testID="action-scan" onPress={() => router.push(`/nutrition/scan?date=${date}&meal=${meal}`)} />
        <QuickAction icon="camera-outline" label="Foto (KI)" testID="action-photo" onPress={() => router.push(`/nutrition/photo?date=${date}&meal=${meal}`)} />
        <QuickAction icon="flash-outline" label="Schnell" testID="action-quick" onPress={() => router.push(`/nutrition/quick?date=${date}&meal=${meal}`)} />
        <QuickAction icon="create-outline" label="Eigenes" testID="action-custom" onPress={() => router.push(`/nutrition/custom-food?date=${date}&meal=${meal}&name=${encodeURIComponent(q)}`)} />
      </Row>

      {!q && recent.length > 0 && (
        <Section title="Zuletzt verwendet">
          <Card padding={spacing.xs}>
            {recent.map((r, i) => (
              <FoodRow key={r.ref} first={i === 0} name={r.name} sub={`${r.lastServing ?? `${formatNumberDE(r.lastAmount, 0)} g`}${r.brand ? ` · ${r.brand}` : ''}`} kcal={r.kcal100} onPress={() => open(r.ref)} testID={`recent-${i}`} />
            ))}
          </Card>
        </Section>
      )}

      {res.own.length > 0 && (
        <Section title="Eigene Lebensmittel & Rezepte">
          <Card padding={spacing.xs}>
            {res.own.map((f, i) => (
              <FoodItemRow key={f.ref} food={f} first={i === 0} onPress={() => open(f.ref)} />
            ))}
          </Card>
        </Section>
      )}

      {q.length > 0 && (
        <Section title="Basis-Datenbank (Durchschnittswerte)">
          {res.builtin.length === 0 ? (
            <Text variant="small" tone="muted">
              Kein Treffer in der Basis-Datenbank.
            </Text>
          ) : (
            <Card padding={spacing.xs}>
              {res.builtin.map((f, i) => (
                <FoodItemRow key={f.ref} food={f} first={i === 0} onPress={() => open(f.ref)} testID={`food-result-${i}`} />
              ))}
            </Card>
          )}
        </Section>
      )}

      {q.trim().length >= 3 && (
        <Section title="Markenprodukte (Open Food Facts)">
          {res.offLoading && <ActivityIndicator color={colors.accent} />}
          {res.offError && (
            <Text variant="small" tone="warning">
              {res.offError}
            </Text>
          )}
          {!res.offLoading && !res.offError && res.off.length === 0 && (
            <Text variant="small" tone="muted">
              Keine Markenprodukte gefunden.
            </Text>
          )}
          {res.off.length > 0 && (
            <Card padding={spacing.xs}>
              {res.off.map((f, i) => (
                <FoodItemRow key={f.ref} food={f} first={i === 0} onPress={() => open(f.ref)} />
              ))}
            </Card>
          )}
        </Section>
      )}

      {!q && recent.length === 0 && (
        <Text tone="secondary" variant="small">
          Tipp: Suche nach „Haferflocken", „Hähnchen" oder scanne den Barcode eines Produkts.
        </Text>
      )}
    </Screen>
  );
}

function QuickAction({ icon, label, onPress, testID }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 4, paddingVertical: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.7 : 1 })}>
      <Ionicons name={icon} size={22} color={colors.accent} />
      <Text variant="small">{label}</Text>
    </Pressable>
  );
}

function FoodItemRow({ food, first, onPress, testID }: { food: FoodItem; first: boolean; onPress: () => void; testID?: string }) {
  return (
    <FoodRow
      first={first}
      name={food.name}
      sub={`${food.brand ? `${food.brand} · ` : ''}P ${formatNumberDE(food.protein_100, 1)} · K ${formatNumberDE(food.carbs_100, 1)} · F ${formatNumberDE(food.fat_100, 1)} / 100 g`}
      kcal={food.kcal_100}
      estimate={food.is_estimate}
      onPress={onPress}
      testID={testID}
    />
  );
}

function FoodRow({ name, sub, kcal, first, onPress, estimate, testID }: { name: string; sub: string; kcal: number; first: boolean; onPress: () => void; estimate?: boolean; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={name} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderTopWidth: first ? 0 : 1, borderTopColor: colors.border, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ flex: 1 }}>
        <Row gap={6}>
          <Text variant="bodyMedium" numberOfLines={1} style={{ flexShrink: 1 }}>
            {name}
          </Text>
          {estimate && <Badge label="~" tone="warning" />}
        </Row>
        <Text variant="small" tone="secondary" numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <Text variant="smallMedium" tone="secondary">
        {formatNumberDE(kcal, 0)} kcal
      </Text>
      <Ionicons name="add-circle" size={24} color={colors.accent} />
    </Pressable>
  );
}
