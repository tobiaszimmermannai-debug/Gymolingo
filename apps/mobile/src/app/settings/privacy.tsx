import { Screen, Section } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { ToggleRow } from '@/ui/Toggle';
import { usePrivacy } from '@/data/hooks';
import { savePrivacy } from '@/data/actions';

/**
 * Per-user sharing controls. Enforced server-side: friends only receive
 * aggregated values through RPCs that check these flags (see migrations).
 */
export default function PrivacySettings() {
  const p = usePrivacy();
  return (
    <Screen title="Datenschutz & Teilen" back testID="privacy-settings">
      <Text variant="small" tone="secondary">
        Nur bestätigte Freunde sehen, was du hier freigibst – und nur als zusammengefasste Werte (z. B. Anzahl Trainings, Schritte der Woche). Rohdaten wie einzelne Mahlzeiten sind nie für andere lesbar.
      </Text>
      <Card>
        <ToggleRow label="In der Suche auffindbar" description="Andere können dich über deinen Benutzernamen finden" value={p.searchable} onChange={(v) => savePrivacy({ searchable: v })} testID="privacy-searchable" />
      </Card>
      <Section title="Mit Freunden teilen">
        <Card>
          <ToggleRow label="Trainings & Volumen" value={p.share_workouts} onChange={(v) => savePrivacy({ share_workouts: v })} testID="privacy-workouts" />
          <ToggleRow label="Schritte" value={p.share_steps} onChange={(v) => savePrivacy({ share_steps: v })} testID="privacy-steps" />
          <ToggleRow label="Serien (Streaks)" value={p.share_streaks} onChange={(v) => savePrivacy({ share_streaks: v })} />
          <ToggleRow label="Zielerfüllung in %" description="Anteil erreichter Trainings-, Schritt- und Proteinziele" value={p.share_goal_completion} onChange={(v) => savePrivacy({ share_goal_completion: v })} />
          <ToggleRow label="Persönliche Rekorde" value={p.share_prs} onChange={(v) => savePrivacy({ share_prs: v })} />
          <ToggleRow label="Level & Abzeichen" value={p.share_level} onChange={(v) => savePrivacy({ share_level: v })} />
        </Card>
      </Section>
      <Section title="Sensible Daten (standardmäßig privat)">
        <Card>
          <ToggleRow label="Körpergewicht" value={p.share_weight} onChange={(v) => savePrivacy({ share_weight: v })} testID="privacy-weight" />
          <ToggleRow label="Körperfettanteil" value={p.share_body_fat} onChange={(v) => savePrivacy({ share_body_fat: v })} />
          <ToggleRow label="Ernährung (Ø Kalorien & Protein)" value={p.share_nutrition} onChange={(v) => savePrivacy({ share_nutrition: v })} />
          <ToggleRow label="Fortschrittsbilder" value={p.share_photos} onChange={(v) => savePrivacy({ share_photos: v })} />
        </Card>
      </Section>
    </Screen>
  );
}
