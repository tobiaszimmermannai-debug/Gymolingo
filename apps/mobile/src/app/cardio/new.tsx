import { useLocalSearchParams } from 'expo-router';
import { ACTIVITY_MAP } from '@gymolingo/core';
import { CardioForm } from '@/features/CardioForm';

export default function NewCardio() {
  const { activity } = useLocalSearchParams<{ activity?: string }>();
  return <CardioForm initialActivity={activity && ACTIVITY_MAP[activity] ? activity : 'jog'} />;
}
