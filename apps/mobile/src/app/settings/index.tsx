import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { colors, spacing } from '@/ui/theme';
import { useDB } from '@/data/store';
import { useAuth } from '@/features/account';

const ITEMS: { route: string; icon: keyof typeof Ionicons.glyphMap; title: string; sub: string; testID: string }[] = [
  { route: '/settings/profile', icon: 'person-outline', title: 'Profil & Ziele', sub: 'Körperdaten, Ziel, Kalorien & Makros, Trainingsplan', testID: 'settings-profile' },
  { route: '/settings/reminders', icon: 'notifications-outline', title: 'Erinnerungen', sub: 'Zeiten, Ruhezeiten, Kategorien, Intensität', testID: 'settings-reminders' },
  { route: '/settings/privacy', icon: 'lock-closed-outline', title: 'Datenschutz & Teilen', sub: 'Was deine Freunde sehen dürfen', testID: 'settings-privacy' },
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
      <Text variant="small" tone="muted" align="center">
        Gymolingo 0.1 · Richtwerte, keine medizinische Beratung.
      </Text>
    </Screen>
  );
}
