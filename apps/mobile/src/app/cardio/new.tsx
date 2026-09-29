import { useLocalSearchParams } from 'expo-router';
import type { CardioActivity } from '@gymolingo/core';
import { CardioForm } from '@/features/CardioForm';

export default function NewCardio() {
  const { activity } = useLocalSearchParams<{ activity?: CardioActivity }>();
  return <CardioForm initialActivity={activity && ['walk', 'jog', 'run', 'ems'].includes(activity) ? activity : 'jog'} />;
}
