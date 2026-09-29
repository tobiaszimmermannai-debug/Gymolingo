import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { colors, spacing } from '@/ui/theme';
import { useDB } from '@/data/store';
import { useAuth } from '@/features/account';
import { DEV_TOOLS, loadDemoData } from '@/features/devtools';
import { Button } from '@/ui/Button';
import { confirm, notify } from '@/lib/dialog';
import { ToggleRow } from '@/ui/Toggle';
import { setPrefs } from '@/data/store';
import { getHealthProvider, syncHealthSteps } from '@/lib/health';
import { AI_ENABLED } from '@/lib/config';

const ITEMS: { route: string; icon: keyof typeof Ionicons.glyphMap; title: string; sub: string; testID: string }[] = [
  { route: '/settings/profile', icon: 'person-outline', title: 'Profil & Ziele', sub: 'Körperdaten, Ziel, Kalorien & Makros, Trainingsplan', testID: 'settings-profile' },
  { route: '/settings/reminders', icon: 'notifications-outline', title: 'Erinnerungen', sub: 'Zeiten, Ruhezeiten, Kategorien, Intensität', testID: 'settings-reminders' },
  { route: '/settings/privacy', icon: 'lock-closed-outline', title: 'Datenschutz & Teilen', sub: 'Was deine Freunde sehen dürfen', testID: 'settings-privacy' },
  ...(AI_ENABLED ? [{ route: '/settings/ai', icon: 'sparkles-outline' as const, title: 'KI (Google Gemini)', sub: 'Eigener kostenloser Schlüssel für Coach & Foto-Analyse', testID: 'settings-ai' }] : []),
  { route: '/settings/account', icon: 'cloud-outline', title: 'Konto, Sync & Daten', sub: 'Anmeldung, Synchronisierung, Export, Löschung', testID: 'settings-account' },
  { route: '/achievements', icon: 'trophy-outline', title: 'Erfolge & Streak-Schutz', sub: 'Level, Abzeichen, Urlaub/Krankheit pausieren', testID: 'settings-achievements' },
  { route: '/body/measurements', icon: 'body-outline', title: 'Körpermaße & Fotos', sub: 'Umfänge und private Fortschrittsbilder', testID: 'settings-body' },
];

export default function Settings() {
  const email = useAuth((s) => s.email);
  const account = useDB((s) => s.accountUserId);
  return (
    <Screen title="Einstellungen" back testID="settings-screen">
      <Card padding={spacing.md}>
        <Text variant="small" tone="secondary">
          {account ? `Angemeldet als ${email ?? 'Konto'} – Daten werden synchronisiert.` : 'Lokaler Modus – deine Daten sind nur auf diesem Gerät gespeichert.'}
        </Text>
      </Card>
      <Card padding={spacing.xs}>
        {ITEMS.map((it, i) => (
          <Pressable key={it.route} testID={it.testID} onPress={() => router.push(it.route as never)} accessibilityRole="button" accessibilityLabel={it.title} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border, opacity: pressed ? 0.7 : 1 })}>
            <Ionicons name={it.icon} size={22} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium">{it.title}</Text>
              <Text variant="small" tone="secondary">
                {it.sub}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))}
      </Card>
      <HealthCard />
      {DEV_TOOLS && (
        <Card variant="outline" testID="dev-tools">
          <Text variant="caption" tone="warning">
            Entwicklung
          </Text>
          <Button
            title="Demo-Daten laden (12 Wochen)"
            size="sm"
            variant="secondary"
            style={{ marginTop: spacing.sm }}
            testID="load-demo"
            onPress={async () => {
              if (await confirm('Demo-Daten laden?', 'Fügt 12 Wochen realistische Beispieldaten hinzu (nur für Tests).', 'Laden')) {
                loadDemoData();
                router.replace('/');
              }
            }}
          />
        </Card>
      )}
      <Text variant="small" tone="muted" align="center">
        Gymolingo 0.1 · Richtwerte, keine medizinische Beratung.{'\n'}Produktdaten: Open Food Facts (ODbL) · Schrift: Inter (OFL)
      </Text>
    </Screen>
  );
}

/** Only shown when a native health adapter is registered (see docs/HEALTH_INTEGRATION.md). */
function HealthCard() {
  const source = useDB((s) => s.prefs.healthSource ?? 'none');
  const provider = getHealthProvider();
  if (!provider) return null;
  const on = source === provider.source;
  return (
    <Card testID="health-card">
      <ToggleRow
        label={`Schritte aus ${provider.label}`}
        description="Liest Schritte und Gewicht (nur lesen). Manuelle Einträge haben Vorrang."
        value={on}
        testID="health-toggle"
        onChange={async (v) => {
          if (!v) return setPrefs({ healthSource: 'none' });
          if (!(await provider.isAvailable()) || !(await provider.requestPermissions())) {
            notify('Kein Zugriff', `${provider.label} ist nicht verfügbar oder der Zugriff wurde verweigert.`);
            return;
          }
          setPrefs({ healthSource: provider.source });
          void syncHealthSteps();
        }}
      />
    </Card>
  );
}
