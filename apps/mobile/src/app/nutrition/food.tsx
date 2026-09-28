import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { foodWarnings, formatNumberDE, MEAL_LABELS_DE, MEAL_ORDER, nutrientsForAmount, todayISO, type FoodItem, type MealType } from '@gymolingo/core';
import { Screen, Row } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Input, parseDecimal } from '@/ui/Input';
import { Badge, Chip, ChipGroup } from '@/ui/Chip';
import { colors, spacing } from '@/ui/theme';
import { logFood } from '@/data/actions';
import { useProfileOrDefault } from '@/data/hooks';
import { persistOffFood, resolveFood, SOURCE_LABEL } from '@/features/foods';
import { haptic } from '@/lib/haptics';

export default function FoodAmount() {
  const { ref, date = todayISO(), meal = 'lunch' } = useLocalSearchParams<{ ref: string; date?: string; meal?: MealType }>();
  const food = useMemo(() => (ref ? resolveFood(decodeURIComponent(ref)) : undefined), [ref]);
  const profile = useProfileOrDefault();
  const firstServing = food?.servings[0];
  const [grams, setGrams] = useState(firstServing ? String(firstServing.grams) : '100');
  const [servingLabel, setServingLabel] = useState<string | null>(firstServing?.label ?? null);
  const [mealSel, setMealSel] = useState<MealType>(meal as MealType);

  if (!food) {
    return (
      <Screen title="Lebensmittel" back>
        <Text tone="secondary">Lebensmittel nicht gefunden.</Text>
      </Screen>
    );
  }
  const g = parseDecimal(grams) ?? 0;
  const n = nutrientsForAmount(food, g);
  const warnings = foodWarnings(food, profile);

  const add = () => {
    if (!(g > 0) || g > 5000) return;
    const toLog: FoodItem = food.source === 'off' ? persistOffFood(food) : food;
    logFood({ date, meal: mealSel, food: toLog, grams: g, servingLabel });
    haptic('success');
    router.dismissTo(`/nutrition` as never);
  };

  return (
    <Screen title={food.name} subtitle={food.brand ?? undefined} back testID="food-amount-screen" footer={<Button testID="log-food" title={`Hinzufügen · ${formatNumberDE(n.kcal, 0)} kcal`} icon="add" onPress={add} disabled={!(g > 0) || g > 5000} />}>
      <Row gap={spacing.sm} wrap>
        <Badge label={SOURCE_LABEL[food.source] ?? food.source} tone="muted" />
        {food.is_estimate && <Badge label="~ Schätzwert" tone="warning" />}
      </Row>
      {warnings.length > 0 && (
        <Card variant="outline" padding={spacing.md}>
          <Row>
            <Ionicons name="warning-outline" size={18} color={colors.warning} />
            <Text variant="smallMedium" tone="warning" style={{ flex: 1 }}>
              {warnings.join(' · ')}
            </Text>
          </Row>
        </Card>
      )}

      <Card>
        <Row style={{ justifyContent: 'space-around' }}>
          <Big label="kcal" value={formatNumberDE(n.kcal, 0)} testID="amount-kcal" />
          <Big label="Protein" value={`${formatNumberDE(n.protein_g, 1)} g`} color={colors.protein} testID="amount-protein" />
          <Big label="Kohlenh." value={`${formatNumberDE(n.carbs_g, 1)} g`} color={colors.carbs} />
          <Big label="Fett" value={`${formatNumberDE(n.fat_g, 1)} g`} color={colors.fat} />
        </Row>
      </Card>

      <Input
        testID="amount-grams"
        label="Menge"
        value={grams}
        onChangeText={(v) => {
          setGrams(v);
          setServingLabel(null);
        }}
        keyboardType="decimal-pad"
        suffix="g"
        error={g > 5000 ? 'Maximal 5 kg pro Eintrag' : null}
      />
      <Row gap={spacing.sm} wrap>
        {food.servings.map((s) => (
          <Chip
            key={s.label}
            label={`${s.label} (${formatNumberDE(s.grams, 0)} g)`}
            selected={servingLabel === s.label}
            onPress={() => {
              setGrams(String(s.grams));
              setServingLabel(s.label);
            }}
          />
        ))}
        {[50, 100, 150, 200].map((v) => (
          <Chip key={v} label={`${v} g`} selected={!servingLabel && g === v} onPress={() => {
            setGrams(String(v));
            setServingLabel(null);
          }} />
        ))}
      </Row>

      <Text variant="smallMedium" tone="secondary">
        Mahlzeit
      </Text>
      <ChipGroup options={MEAL_ORDER.map((m) => ({ value: m, label: MEAL_LABELS_DE[m] }))} value={mealSel} onChange={(v) => setMealSel(v as MealType)} />

      <Card padding={spacing.md}>
        <Text variant="smallMedium" style={{ marginBottom: 6 }}>
          Nährwerte pro 100 g
        </Text>
        <Per100 label="Energie" value={`${formatNumberDE(food.kcal_100, 0)} kcal`} />
        <Per100 label="Protein" value={`${formatNumberDE(food.protein_100, 1)} g`} />
        <Per100 label="Kohlenhydrate" value={`${formatNumberDE(food.carbs_100, 1)} g`} />
        {food.sugar_100 !== null && <Per100 label="davon Zucker" value={`${formatNumberDE(food.sugar_100, 1)} g`} />}
        <Per100 label="Fett" value={`${formatNumberDE(food.fat_100, 1)} g`} />
        {food.fiber_100 !== null && <Per100 label="Ballaststoffe" value={`${formatNumberDE(food.fiber_100, 1)} g`} />}
        {food.salt_100 !== null && <Per100 label="Salz" value={`${formatNumberDE(food.salt_100, 2)} g`} />}
        {food.source === 'builtin' && (
          <Text variant="small" tone="muted" style={{ marginTop: 6 }}>
            Durchschnittswerte – einzelne Produkte können abweichen. Für exakte Werte den Barcode scannen.
          </Text>
        )}
      </Card>
    </Screen>
  );
}

function Big({ label, value, color, testID }: { label: string; value: string; color?: string; testID?: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <Text variant="h3" testID={testID} color={color}>
        {value}
      </Text>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
    </View>
  );
}

function Per100({ label, value }: { label: string; value: string }) {
  return (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 2 }}>
      <Text variant="small" tone="secondary">
        {label}
      </Text>
      <Text variant="small">{value}</Text>
    </Row>
  );
}
