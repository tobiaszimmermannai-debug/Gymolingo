import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CATEGORY_LABELS_DE, formatNumberDE, kcalPer30Min, searchActivities, type ActivityCategory, type ActivityDef } from '@gymolingo/core';
import { Screen, Row, Section } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/Input';
import { ChipGroup } from '@/ui/Chip';
import { colors, spacing } from '@/ui/theme';
import { currentWeightKg } from '@/features/cardio';

type Filter = 'all' | ActivityCategory;
const FILTERS: { value: Filter; label: string }[] = [{ value: 'all', label: 'Alle' }, ...(Object.keys(CATEGORY_LABELS_DE) as ActivityCategory[]).map((c) => ({ value: c, label: CATEGORY_LABELS_DE[c] }))];

/** All sports and everyday activities with typical calories for the user's weight. */
export default function PickActivity() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const weight = currentWeightKg();
  const groups = useMemo(() => {
    const list = searchActivities(q).filter((a) => filter === 'all' || a.category === filter);
    const by = new Map<ActivityCategory, ActivityDef[]>();
    for (const a of list) by.set(a.category, [...(by.get(a.category) ?? []), a]);
    return [...by.entries()];
  }, [q, filter]);

  return (
    <Screen title="Aktivität wählen" back testID="activity-picker">
      <Input placeholder="Suchen, z. B. Fußball, Staubsaugen, Sex …" value={q} onChangeText={setQ} autoCorrect={false} testID="activity-search" />
      <ChipGroup options={FILTERS} value={filter} onChange={(v) => setFilter(v as Filter)} testIDPrefix="activity-filter" />
      <Text variant="small" tone="muted">
        Werte für 30 Minuten bei mittlerer Intensität und {formatNumberDE(weight, 1)} kg. Bei Alltag, Haushalt und Garten zählt nur der Mehrverbrauch gegenüber Ruhe.
      </Text>
      {groups.length === 0 && (
        <Card>
          <Text tone="secondary">Nichts gefunden – nimm „Sonstige Aktivität“ und trag den Namen als Notiz ein.</Text>
        </Card>
      )}
      {groups.map(([cat, items]) => (
        <Section key={cat} title={CATEGORY_LABELS_DE[cat]}>
          <View style={{ gap: spacing.sm }}>
            {items.map((a) => (
              <Card key={a.id} padding={spacing.md} onPress={() => router.replace(`/cardio/new?activity=${a.id}`)} testID={`pick-${a.id}`} accessibilityLabel={a.label}>
                <Row>
                  <Text variant="h3">{a.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyMedium">{a.label}</Text>
                    {a.training && (
                      <Text variant="caption" tone="accent">
                        zählt als Training
                      </Text>
                    )}
                  </View>
                  <Text variant="small" tone="secondary">
                    ≈ {formatNumberDE(kcalPer30Min(a.id, weight), 0)} kcal
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Row>
              </Card>
            ))}
          </View>
        </Section>
      ))}
    </Screen>
  );
}
