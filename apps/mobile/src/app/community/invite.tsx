import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, Row } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { QrCode } from '@/ui/QrCode';
import { colors, spacing } from '@/ui/theme';
import { useDB } from '@/data/store';
import { isBackendConfigured } from '@/lib/supabase';
import { confirm } from '@/lib/dialog';
import { canShareNatively, copyInvite, inviteUrl, myInviteCode, openWhatsApp, shareInvite } from '@/features/invite';

/** Invite friends: personal link as QR code, via WhatsApp, share sheet or clipboard. */
export default function InviteFriends() {
  const account = useDB((s) => s.accountUserId);
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!account);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'ok' | 'failed' | null>(null);

  const load = useCallback(async (renew = false) => {
    if (!account) return;
    setLoading(true);
    try {
      setCode(await myInviteCode(renew));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [account]);
  useEffect(() => {
    void load();
  }, [load]);

  const url = inviteUrl(code);
  const personal = !!code;

  return (
    <Screen title="Freunde einladen" back testID="invite-screen">
      <Card variant="accent">
        <Text variant="h3">Trainiert zusammen 🤝</Text>
        <Text tone="secondary" style={{ marginTop: 6 }}>
          {personal
            ? 'Wer deinen Link öffnet und sich anmeldet, ist sofort mit dir befreundet – ihr seht Streaks, „zuletzt online“ und eure Status.'
            : account && isBackendConfigured
              ? 'Der Link führt direkt zur App.'
              : 'Der Link führt direkt zur App. Mit Konto wird daraus dein persönlicher Link, über den ihr sofort befreundet seid.'}
        </Text>
      </Card>

      <Card style={{ alignItems: 'center' }}>
        {loading ? (
          <View style={{ height: 240, justifyContent: 'center' }}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <>
            <QrCode value={url} size={240} testID="invite-qr" />
            <Text variant="small" tone="secondary" style={{ marginTop: spacing.md, textAlign: 'center' }}>
              Mit der Handy-Kamera scannen
            </Text>
            <Text variant="small" selectable style={{ marginTop: 4, textAlign: 'center' }} testID="invite-url">
              {url}
            </Text>
          </>
        )}
      </Card>
      {error && (
        <Text variant="small" tone="warning" testID="invite-error">
          {error}
        </Text>
      )}

      <View style={{ gap: spacing.sm }}>
        <Button title="Per WhatsApp senden" icon="logo-whatsapp" disabled={loading} onPress={() => openWhatsApp(url)} testID="invite-whatsapp" />
        {canShareNatively() && <Button title="Teilen …" icon="share-outline" variant="secondary" disabled={loading} onPress={() => shareInvite(url)} testID="invite-share" />}
        <Button
          title={copied === 'ok' ? 'Link kopiert ✓' : copied === 'failed' ? 'Bitte Link oben markieren' : 'Link kopieren'}
          icon="copy-outline"
          variant="secondary"
          disabled={loading}
          testID="invite-copy"
          onPress={async () => {
            setCopied(await copyInvite(url).then(() => 'ok' as const, () => 'failed' as const));
            setTimeout(() => setCopied(null), 2500);
          }}
        />
      </View>

      {!account && isBackendConfigured && (
        <Button title="Konto erstellen für persönlichen Link" variant="ghost" onPress={() => router.push('/auth?mode=signup')} testID="invite-signup" />
      )}
      {personal && (
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="small" tone="muted" style={{ flex: 1 }}>
            Teile den Link nur mit Leuten, die du kennst. Erneuern macht alte Links ungültig.
          </Text>
          <Button
            title="Erneuern"
            size="sm"
            variant="ghost"
            testID="invite-renew"
            onPress={async () => {
              if (await confirm('Link erneuern?', 'Bereits verschickte Links funktionieren danach nicht mehr.', 'Erneuern')) await load(true);
            }}
          />
        </Row>
      )}
    </Screen>
  );
}
