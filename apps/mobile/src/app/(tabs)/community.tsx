import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { calculateTargets } from '@gymolingo/core';
export default function S() {
  const t = calculateTargets({ sex: 'male', age: 30, height_cm: 180, weight_kg: 80, activity_level: 'moderate', training_days_per_week: 3, goal: 'fat_loss' });
  return <Screen title="community"><Text>{t.calorie_target}</Text></Screen>;
}
