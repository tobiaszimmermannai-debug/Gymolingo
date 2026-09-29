import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { colors, spacing } from '@/ui/theme';
import { setPrefs, useDB } from '@/data/store';
import { acceptPendingInvite, cleanInviteCode, inviteInfo, type InviteInfo } from '@/features/invite';

/** Landing page of an invite link: remembers the code and shows who invites. */
export default function InviteLanding() {
  const { c } = useLocalSearchParams<{ c?: string }>();
  const code = cleanInviteCode(c ?? '');
  const account = useDB((s) => s.accountUserId);
  const onboarded = useDB((s) => !!s.tables.athlete_profiles[s.userId]?.onboarding_completed);
  const [info, setInfo] = useState<InviteInfo | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return setInfo(null);
    setPrefs({ pendingInvite: code });
    void inviteInfo(code).then(setInfo);
  }, [code]);

  const name = info?.display_name || (info?.username ? `@${info.username}` : 'Ein Freund');

  const accept = async () => {
    setBusy(true);
    const res = await acceptPendingInvite();
    setBusy(false);
    if (res === 'accepted') router.replace('/community');
    else setMsg(res === 'invalid' ? 'Diese Einladung ist ungültig oder wurde erneuert.' : 'Das hat nicht geklappt – bitte später erneut versuchen.');
  };

  return (
    <Screen testID="invite-landing">
      <View style={{ alignItems: 'center', paddingTop: spacing.xl * 2, gap: spacing.md }}>
        {info === undefined ? (
          <ActivityIndicator color={colors.accent} />
        ) : info ? (
          <>
            <Text style={{ fontSize: 64, lineHeight: 76 }}>{info.avatar_emoji}</Text>
            <Text variant="h1" style={{ textAlign: 'center' }} testID="invite-from">
              {name} lädt dich ein
            </Text>
          </>
        ) : (
          <>
            <Text style={{ fontSize: 64, lineHeight: 76 }}>💪</Text>
            <Text variant="h1" style={{ textAlign: 'center' }} testID="invite-from">
              Willkommen bei Gymolingo
            </Text>
            {code ? (
              <Text tone="warning" style={{ textAlign: 'center' }} testID="invite-invalid">
                Die Einladung ist ungültig oder wurde erneuert – du kannst die App trotzdem nutzen.
              </Text>
            ) : null}
          </>
        )}
        <Text tone="secondary" style={{ textAlign: 'center' }}>
          Training, Ernährung, KI-Coach und Streaks – kostenlos. Über „Zum Home-Bildschirm“ im Browser-Menü bekommst du das App-Icon.
        </Text>
      </View>

      <Card style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        {!onboarded ? (
          <>
            <Text variant="small" tone="secondary">
              {info ? `Richte kurz dein Profil ein und erstelle ein Konto – dann seid ihr automatisch befreundet.` : 'Richte kurz dein Profil ein.'}
            </Text>
            <Button title="Los geht's" icon="arrow-forward" onPress={() => router.replace('/onboarding')} testID="invite-start" />
          </>
        ) : !account ? (
          <>
            <Text variant="small" tone="secondary">
              {info ? `Mit einem kostenlosen Konto werdet ihr automatisch Freunde.` : 'Mit einem kostenlosen Konto kannst du Freunde hinzufügen.'}
            </Text>
            <Button title="Konto erstellen" onPress={() => router.push('/auth?mode=signup')} testID="invite-signup" />
            <Button title="Ich habe schon ein Konto" variant="ghost" onPress={() => router.push('/auth?mode=signin')} />
          </>
        ) : info ? (
          <Button title={`Mit ${name} befreunden`} icon="people-outline" loading={busy} onPress={accept} testID="invite-accept" />
        ) : (
          <Button title="Zur App" onPress={() => router.replace('/')} />
        )}
        {msg && (
          <Text variant="small" tone="warning" testID="invite-msg">
            {msg}
          </Text>
        )}
      </Card>
    </Screen>
  );
}
