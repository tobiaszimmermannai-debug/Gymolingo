import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Screen, Row, Section } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { spacing } from '@/ui/theme';
import { useDB, dirtyCount } from '@/data/store';
import { syncNow } from '@/data/sync';
import { isBackendConfigured } from '@/lib/supabase';
import { signOut, useAuth } from '@/features/account';
import { deleteAccount, exportAllData } from '@/features/gdpr';
import { confirm, notify } from '@/lib/dialog';

export default function AccountSettings() {
  const email = useAuth((s) => s.email);
  const account = useDB((s) => s.accountUserId);
  const syncState = useDB((s) => s.syncState);
  const syncError = useDB((s) => s.syncError);
  const lastSync = useDB((s) => s.lastSyncAt);
  useDB((s) => s.dirty);
  const pending = dirtyCount();
  const [busy, setBusy] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  return (
    <Screen title="Konto, Sync & Daten" back testID="account-settings">
      <Section title="Konto">
        <Card>
          {account ? (
            <>
              <Text variant="bodyMedium" testID="account-email">
                {email ?? 'Angemeldet'}
              </Text>
              <Text variant="small" tone="secondary" style={{ marginTop: 4 }}>
                Status: {syncState === 'syncing' ? 'synchronisiert …' : syncState === 'offline' ? 'offline – Änderungen werden später übertragen' : syncState === 'error' ? 'Fehler' : 'synchronisiert'}
                {lastSync ? ` · zuletzt ${new Date(lastSync).toLocaleString('de-DE')}` : ''}
                {pending ? ` · ${pending} Änderungen ausstehend` : ''}
              </Text>
              {syncError && (
                <Text variant="small" tone="danger" style={{ marginTop: 4 }}>
                  {syncError}
                </Text>
              )}
              <Row style={{ marginTop: spacing.md }}>
                <Button title="Jetzt synchronisieren" size="sm" icon="sync" variant="secondary" loading={syncState === 'syncing'} onPress={() => syncNow()} testID="sync-now" />
                <Button
                  title="Abmelden"
                  size="sm"
                  variant="ghost"
                  testID="sign-out"
                  onPress={async () => {
                    if (!(await confirm('Abmelden?', 'Ausstehende Änderungen werden hochgeladen. Danach werden deine Daten von diesem Gerät entfernt.', 'Abmelden'))) return;
                    await signOut();
                    router.replace('/onboarding');
                  }}
                />
              </Row>
            </>
          ) : isBackendConfigured ? (
            <>
              <Text variant="bodyMedium">Lokaler Modus</Text>
              <Text variant="small" tone="secondary" style={{ marginTop: 4 }}>
                Mit einem kostenlosen Konto werden deine Daten verschlüsselt übertragen und geräteübergreifend synchronisiert. Außerdem schaltest du Community und KI-Coach frei. Deine bisherigen Daten werden übernommen.
              </Text>
              <Row style={{ marginTop: spacing.md }}>
                <Button title="Konto erstellen" size="sm" onPress={() => router.push('/auth?mode=signup')} testID="go-signup" />
                <Button title="Anmelden" size="sm" variant="secondary" onPress={() => router.push('/auth?mode=signin')} testID="go-signin" />
              </Row>
            </>
          ) : (
            <Text variant="small" tone="secondary">
              Diese Installation läuft ohne Server (EXPO_PUBLIC_SUPABASE_URL nicht gesetzt). Alle Daten bleiben ausschließlich auf diesem Gerät.
            </Text>
          )}
        </Card>
      </Section>

      <Section title="Deine Daten (DSGVO)">
        <Card>
          <Text variant="bodyMedium">Datenexport</Text>
          <Text variant="small" tone="secondary" style={{ marginTop: 4 }}>
            Alle gespeicherten Daten als JSON-Datei (Trainings, Ernährung, Körperdaten, Einstellungen).
          </Text>
          <Button
            title="Daten exportieren"
            icon="download-outline"
            variant="secondary"
            style={{ marginTop: spacing.md }}
            loading={busy}
            testID="export-data"
            onPress={async () => {
              setBusy(true);
              try {
                await exportAllData();
              } catch (e) {
                notify('Export fehlgeschlagen', String(e));
              } finally {
                setBusy(false);
              }
            }}
          />
        </Card>
        <Card variant="outline">
          <Text variant="bodyMedium" tone="danger">
            {account ? 'Konto löschen' : 'Alle Daten löschen'}
          </Text>
          <Text variant="small" tone="secondary" style={{ marginTop: 4 }}>
            {account
              ? 'Löscht dein Konto und alle Daten unwiderruflich – auf dem Server (inkl. Fotos) und auf diesem Gerät.'
              : 'Löscht alle Daten unwiderruflich von diesem Gerät.'}{' '}
            Tippe zur Bestätigung LÖSCHEN ein.
          </Text>
          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            <Input value={confirmText} onChangeText={setConfirmText} placeholder="LÖSCHEN" autoCapitalize="characters" testID="delete-confirm" />
            <Button
              title={account ? 'Konto endgültig löschen' : 'Daten endgültig löschen'}
              variant="danger"
              icon="trash-outline"
              disabled={confirmText.trim().toUpperCase() !== 'LÖSCHEN'}
              testID="delete-account"
              onPress={async () => {
                setBusy(true);
                const r = await deleteAccount();
                setBusy(false);
                if (!r.ok) return notify('Löschen fehlgeschlagen', r.error ?? 'Unbekannter Fehler');
                router.replace('/onboarding');
              }}
            />
          </View>
        </Card>
      </Section>
    </Screen>
  );
}
