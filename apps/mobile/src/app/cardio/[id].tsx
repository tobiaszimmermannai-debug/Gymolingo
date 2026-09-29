import { useLocalSearchParams } from 'expo-router';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { useDB } from '@/data/store';
import { CardioForm } from '@/features/CardioForm';

export default function EditCardio() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const row = useDB((s) => s.tables.cardio_sessions[id]);
  if (!row || row.deleted)
    return (
      <Screen title="Aktivität" back>
        <Text tone="secondary">Dieser Eintrag existiert nicht mehr.</Text>
      </Screen>
    );
  return <CardioForm existing={row} />;
}
