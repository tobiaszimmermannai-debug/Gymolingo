import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { router } from 'expo-router';
import { Screen, Row } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { spacing } from '@/ui/theme';
import { useDB } from '@/data/store';
import { AiError, deleteAiKey, refreshAiKeyStatus, saveAiKey } from '@/lib/ai';
import { confirm } from '@/lib/dialog';

const AI_STUDIO = 'https://aistudio.google.com/apikey';

/** Personal Gemini key: everyone uses Google's free tier with their own key → no costs. */
export default function AiSettings() {
  const account = useDB((s) => s.accountUserId);
  const status = useDB((s) => s.prefs.aiKey);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'danger' | 'success'; text: string } | null>(null);

  useEffect(() => {
    void refreshAiKeyStatus();
  }, [account]);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await saveAiKey(key);
      setKey('');
      setMsg({ tone: 'success', text: 'Schlüssel geprüft und sicher gespeichert. Die KI ist jetzt aktiv.' });
    } catch (e) {
      setMsg({ tone: 'danger', text: e instanceof AiError || e instanceof Error ? e.message : 'Speichern fehlgeschlagen.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="KI (Google Gemini)" back testID="ai-settings">
      <Card variant="accent">
        <Text variant="h3">Kostenlos mit deinem eigenen Schlüssel</Text>
        <Text tone="secondary" style={{ marginTop: 6 }}>
          Jede Person nutzt ihren eigenen, kostenlosen Gemini-Schlüssel. So bleibt alles in Googles Gratis-Kontingent – ohne Kreditkarte, ohne Kosten. Ist das Tageskontingent aufgebraucht, antwortet der eingebaute Coach ohne KI.
        </Text>
      </Card>

      {!account ? (
        <Card>
          <Text>Melde dich zuerst an – der Schlüssel wird verschlüsselt auf dem Server deines Kontos gespeichert, nie in der App.</Text>
          <Button title="Anmelden / Konto erstellen" style={{ marginTop: spacing.md }} onPress={() => router.push('/auth')} />
        </Card>
      ) : (
        <>
          <Card testID="ai-key-status">
            {status?.configured ? (
              <>
                <Text variant="bodyMedium">✅ Dein Schlüssel ist hinterlegt (…{status.hint})</Text>
                <Button
                  title="Schlüssel entfernen"
                  variant="secondary"
                  size="sm"
                  style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
                  testID="ai-key-delete"
                  onPress={async () => {
                    if (await confirm('Schlüssel entfernen?', 'Danach antwortet der Coach wieder ohne KI.', 'Entfernen', true)) {
                      setBusy(true);
                      await deleteAiKey().catch(() => undefined);
                      setBusy(false);
                    }
                  }}
                />
              </>
            ) : status?.fallback ? (
              <Text>Die KI läuft über den gemeinsamen Server-Schlüssel. Ein eigener Schlüssel ist optional.</Text>
            ) : (
              <Text>Noch kein Schlüssel hinterlegt – Coach und Wochenbericht laufen ohne KI.</Text>
            )}
          </Card>

          <Card>
            <Text variant="h3">So geht's (2 Minuten)</Text>
            <Text tone="secondary" style={{ marginTop: 6 }}>
              1. Google AI Studio öffnen und mit deinem Google-Konto anmelden.{'\n'}2. „API-Schlüssel erstellen“ tippen und kopieren (beginnt mit „AIza…“).{'\n'}3. Hier einfügen und speichern – fertig.
            </Text>
            <Button title="Google AI Studio öffnen" icon="open-outline" variant="secondary" style={{ marginTop: spacing.md }} onPress={() => Linking.openURL(AI_STUDIO)} />
            <Input
              containerStyle={{ marginTop: spacing.md }}
              label={status?.configured ? 'Neuen Schlüssel einfügen' : 'Gemini-API-Schlüssel'}
              value={key}
              onChangeText={setKey}
              placeholder="AIza…"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              testID="ai-key-input"
            />
            <Row style={{ marginTop: spacing.sm }}>
              <Button title="Prüfen & speichern" onPress={save} loading={busy} disabled={key.trim().length < 20} style={{ flex: 1 }} testID="ai-key-save" />
            </Row>
            {msg && (
              <Text tone={msg.tone} variant="small" style={{ marginTop: spacing.sm }} testID="ai-key-msg">
                {msg.text}
              </Text>
            )}
          </Card>

          <Text variant="small" tone="muted">
            Datenschutz: Der Schlüssel wird verschlüsselt gespeichert und nie an die App zurückgegeben. Anfragen an Gemini enthalten deine Trainings-/Ernährungszahlen bzw. – nur nach Einwilligung – verkleinerte Fotos. Für Nutzer in der EU gelten laut Google auch im Gratis-Kontingent die Datenschutzregeln der bezahlten Dienste.
          </Text>
        </>
      )}
    </Screen>
  );
}
