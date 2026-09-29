import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, Row } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { ProgressBar } from '@/ui/ProgressBar';
import { spacing } from '@/ui/theme';
import { useDB } from '@/data/store';
import { AiError, aiUsageToday, LOCAL_DAILY_LIMIT, refreshSharedKey, removeDeviceKey, saveDeviceKey, shareKeyWithAll, stopSharingKey } from '@/lib/ai';
import { confirm } from '@/lib/dialog';

const AI_STUDIO = 'https://aistudio.google.com/apikey';

/** Gemini key on this device: free tier, hard daily limit, automatic block when Google's quota is used up. */
export default function AiSettings() {
  const key = useDB((s) => s.prefs.geminiKey);
  const fallback = useDB((s) => !!s.accountUserId && !!s.prefs.aiKey?.fallback);
  const account = useDB((s) => s.accountUserId);
  const shared = useDB((s) => (s.accountUserId ? s.prefs.sharedAi : null));
  const [shareBusy, setShareBusy] = useState(false);
  useEffect(() => {
    void refreshSharedKey();
  }, [account]);
  useDB((s) => s.prefs.aiUsage?.count);
  const blocks = useDB((s) => s.prefs.aiBlocks);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'danger' | 'success'; text: string } | null>(null);
  const used = aiUsageToday();
  const now = new Date().toISOString();
  const blockedUntil = Object.values(blocks ?? {}).filter((u) => u > now).sort()[0];

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await saveDeviceKey(input);
      setInput('');
      setMsg({ tone: 'success', text: 'Schlüssel geprüft und gespeichert. Die KI ist jetzt aktiv.' });
    } catch (e) {
      setMsg({ tone: 'danger', text: e instanceof AiError || e instanceof Error ? e.message : 'Speichern fehlgeschlagen.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="KI (Google Gemini)" back testID="ai-settings">
      <Card variant="accent">
        <Text variant="h3">Kostenlos mit Googles Gratis-Kontingent</Text>
        <Text tone="secondary" style={{ marginTop: 6 }}>
          Ein Schlüssel reicht für alle: Der Besitzer trägt ihn einmal ein und gibt ihn frei – alle angemeldeten Nutzer verwenden ihn dann automatisch. Pro Person sind höchstens {LOCAL_DAILY_LIMIT} KI-Anfragen am Tag möglich; meldet Google ein erschöpftes Kontingent, sperrt die App die KI sofort bis zum Reset. Ohne KI antwortet der Coach regelbasiert.
        </Text>
      </Card>

      <Card testID="ai-key-status">
        {key ? (
          <>
            <Text variant="bodyMedium">✅ Schlüssel auf diesem Gerät hinterlegt (…{key.slice(-4)})</Text>
            <Text variant="small" tone="secondary" style={{ marginTop: spacing.sm }} testID="ai-usage">
              Heute {used} von {LOCAL_DAILY_LIMIT} KI-Anfragen genutzt
            </Text>
            <View style={{ marginTop: 6 }}>
              <ProgressBar progress={used / LOCAL_DAILY_LIMIT} height={6} />
            </View>
            {blockedUntil && (
              <Text variant="small" tone="warning" style={{ marginTop: spacing.sm }} testID="ai-blocked">
                Google-Kontingent erschöpft – KI gesperrt bis {new Date(blockedUntil).toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}.
              </Text>
            )}
            <Button
              title="Schlüssel entfernen"
              variant="secondary"
              size="sm"
              style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
              testID="ai-key-delete"
              onPress={async () => {
                if (await confirm('Schlüssel entfernen?', 'Danach antwortet der Coach wieder ohne KI.', 'Entfernen', true)) removeDeviceKey();
              }}
            />
          </>
        ) : shared && !shared.isOwner ? (
          <>
            <Text variant="bodyMedium" testID="ai-shared-active">
              ✅ KI aktiv über den Schlüssel von {shared.ownerName} – du musst nichts tun.
            </Text>
            <Text variant="small" tone="secondary" style={{ marginTop: spacing.sm }} testID="ai-usage">
              Heute {used} von {LOCAL_DAILY_LIMIT} KI-Anfragen genutzt
            </Text>
          </>
        ) : fallback ? (
          <Text>Die KI läuft über den gemeinsamen Server-Schlüssel. Ein eigener Schlüssel ist optional.</Text>
        ) : !account ? (
          <Text>Noch keine KI aktiv. Melde dich an (Einstellungen → Konto) – ist ein gemeinsamer Schlüssel freigegeben, nutzt du ihn automatisch.</Text>
        ) : (
          <Text>Noch kein Schlüssel freigegeben – Coach und Wochenbericht laufen ohne KI.</Text>
        )}
      </Card>

      {key && (
        <Card testID="ai-share-card">
          <Text variant="h3">Für alle Nutzer freigeben</Text>
          {!account ? (
            <>
              <Text tone="secondary" style={{ marginTop: 6 }}>
                Melde dich an und gib den Schlüssel einmal frei – dann nutzen alle angemeldeten Nutzer die KI automatisch, ohne selbst etwas einzutragen.
              </Text>
              <Button title="Konto erstellen / anmelden" variant="secondary" size="sm" style={{ marginTop: spacing.md, alignSelf: 'flex-start' }} onPress={() => router.push('/auth')} />
            </>
          ) : shared?.isOwner ? (
            <>
              <Text tone="secondary" style={{ marginTop: 6 }} testID="ai-share-status">
                ✅ Freigegeben (…{shared.hint}): Alle angemeldeten Nutzer verwenden deinen Schlüssel automatisch. Jede Person hat höchstens {LOCAL_DAILY_LIMIT} Anfragen am Tag.
              </Text>
              <Button
                title="Freigabe beenden"
                variant="secondary"
                size="sm"
                loading={shareBusy}
                style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
                testID="ai-share-stop"
                onPress={async () => {
                  setShareBusy(true);
                  await stopSharingKey().catch(() => undefined);
                  setShareBusy(false);
                }}
              />
            </>
          ) : shared ? (
            <Text tone="secondary" style={{ marginTop: 6 }}>
              {shared.ownerName} hat bereits einen Schlüssel für alle freigegeben.
            </Text>
          ) : (
            <>
              <Text tone="secondary" style={{ marginTop: 6 }}>
                Einmal tippen – alle angemeldeten Nutzer verwenden dann deinen Schlüssel automatisch (je höchstens {LOCAL_DAILY_LIMIT} Anfragen pro Tag).
              </Text>
              <Button
                title="Für alle Nutzer freigeben"
                icon="people-outline"
                loading={shareBusy}
                style={{ marginTop: spacing.md }}
                testID="ai-share"
                onPress={async () => {
                  setShareBusy(true);
                  setMsg(null);
                  try {
                    await shareKeyWithAll();
                  } catch (e) {
                    setMsg({ tone: 'danger', text: e instanceof Error ? e.message : 'Freigabe fehlgeschlagen.' });
                  } finally {
                    setShareBusy(false);
                  }
                }}
              />
            </>
          )}
        </Card>
      )}

      <Card>
        <Text variant="h3">So geht's (2 Minuten)</Text>
        <Text tone="secondary" style={{ marginTop: 6 }}>
          1. Google AI Studio öffnen und mit dem Google-Konto anmelden.{'\n'}2. „API-Schlüssel erstellen“ tippen und kopieren (neue Schlüssel beginnen mit „AQ.“). Kein Zahlungsmittel hinterlegen.{'\n'}3. Hier einfügen, speichern und „Für alle Nutzer freigeben“ tippen – fertig.
        </Text>
        <Button title="Google AI Studio öffnen" icon="open-outline" variant="secondary" style={{ marginTop: spacing.md }} onPress={() => Linking.openURL(AI_STUDIO)} />
        <Input
          containerStyle={{ marginTop: spacing.md }}
          label={key ? 'Anderen Schlüssel einfügen' : 'Gemini-API-Schlüssel'}
          value={input}
          onChangeText={setInput}
          placeholder="AQ.… oder AIza…"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          testID="ai-key-input"
        />
        <Row style={{ marginTop: spacing.sm }}>
          <Button title="Prüfen & speichern" onPress={save} loading={busy} disabled={input.trim().length < 20} style={{ flex: 1 }} testID="ai-key-save" />
        </Row>
        {msg && (
          <Text tone={msg.tone} variant="small" style={{ marginTop: spacing.sm }} testID="ai-key-msg">
            {msg.text}
          </Text>
        )}
      </Card>

      <Text variant="small" tone="muted">
        Datenschutz: Anfragen gehen direkt von diesem Gerät an Google Gemini und enthalten deine Trainings- und Ernährungszahlen bzw. – nur nach Einwilligung – verkleinerte Fotos. Für Nutzer in der EU gelten laut Google auch im Gratis-Kontingent die Datenschutzregeln der bezahlten Dienste.
      </Text>
    </Screen>
  );
}
