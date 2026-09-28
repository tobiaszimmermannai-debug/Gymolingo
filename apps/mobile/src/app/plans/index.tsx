import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { generatePlanTemplate } from '@gymolingo/core';
import { Screen, Row, Section } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Badge } from '@/ui/Chip';
import { Input } from '@/ui/Input';
import { spacing } from '@/ui/theme';
import { useProfileOrDefault, useRows } from '@/data/hooks';
import { activatePlan, createEmptyPlan, createPlanFromTemplate } from '@/data/actions';

export default function Plans() {
  const plans = useRows('workout_plans');
  const days = useRows('plan_days');
  const profile = useProfileOrDefault();
  const [name, setName] = useState('');
  const sorted = useMemo(() => [...plans].sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.created_at.localeCompare(b.created_at)), [plans]);
  const tpl = useMemo(
    () => generatePlanTemplate({ daysPerWeek: profile.training_days_per_week, equipment: profile.equipment, goal: profile.goal, experience: profile.experience_level }),
    [profile],
  );

  return (
    <Screen title="Trainingspläne" back testID="plans-screen">
      {sorted.map((p) => (
        <Card key={p.id} padding={spacing.md} onPress={() => router.push(`/plans/${p.id}`)} accessibilityLabel={`Plan ${p.name}`}>
          <Row>
            <View style={{ flex: 1 }}>
              <Row gap={spacing.sm}>
                <Text variant="h3">{p.name}</Text>
                {p.is_active && <Badge label="Aktiv" />}
              </Row>
              <Text variant="small" tone="secondary">
                {days.filter((d) => d.plan_id === p.id).length} Trainingstage{p.description ? ` · ${p.description}` : ''}
              </Text>
            </View>
            {!p.is_active && <Button title="Aktivieren" size="sm" variant="secondary" onPress={() => activatePlan(p.id)} />}
          </Row>
        </Card>
      ))}

      <Section title="Neuen Plan anlegen">
        <Card>
          <Input testID="new-plan-name" label="Name" value={name} onChangeText={setName} placeholder="z. B. Mein Push/Pull/Beine" />
          <Button
            testID="create-plan"
            title="Leeren Plan erstellen"
            icon="add"
            style={{ marginTop: spacing.md }}
            disabled={name.trim().length < 2}
            onPress={() => {
              const plan = createEmptyPlan(name.trim());
              setName('');
              router.push(`/plans/${plan.id}`);
            }}
          />
        </Card>
        <Card variant="accent">
          <Text variant="h3">Vorschlag: {tpl.name}</Text>
          <Text variant="small" tone="secondary" style={{ marginTop: 4 }}>
            {tpl.description} Passend zu {profile.training_days_per_week} Trainings/Woche und deinem Equipment.
          </Text>
          <Text variant="small" tone="secondary" style={{ marginTop: 4 }}>
            {tpl.days.map((d) => d.name).join(' · ')}
          </Text>
          <Button
            testID="create-template-plan"
            title="Vorschlag übernehmen"
            style={{ marginTop: spacing.md }}
            onPress={() => {
              const plan = createPlanFromTemplate(tpl, true);
              router.push(`/plans/${plan.id}`);
            }}
          />
        </Card>
      </Section>
    </Screen>
  );
}
