import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Card } from '@/ui/Card';
import { Text } from '@/ui/Text';
import { Button } from '@/ui/Button';
import { Row } from '@/ui/Screen';
import { spacing } from '@/ui/theme';
import { setPrefs, useDB } from '@/data/store';
import { inviteInfo } from './invite';

/** Home: open invite (→ create an account) or "you are now friends". */
export function InviteCard() {
  const pending = useDB((s) => s.prefs.pendingInvite);
  const joined = useDB((s) => s.prefs.inviteJoined);
  const account = useDB((s) => s.accountUserId);
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    if (pending && !account) void inviteInfo(pending).then((i) => setName(i ? i.display_name || 'Ein Freund' : null));
  }, [pending, account]);

  if (joined)
    return (
      <Card variant="accent" testID="invite-joined">
        <Row>
          <Text variant="h1">{joined.emoji}</Text>
          <Text variant="bodyMedium" style={{ flex: 1 }}>
            Du und {joined.name} seid jetzt Freunde 🎉
          </Text>
        </Row>
        <Row style={{ marginTop: spacing.md }}>
          <Button title="Zur Community" size="sm" onPress={() => { setPrefs({ inviteJoined: null }); router.push('/community'); }} />
          <Button title="OK" size="sm" variant="ghost" onPress={() => setPrefs({ inviteJoined: null })} testID="invite-joined-ok" />
        </Row>
      </Card>
    );
  if (!pending || account || !name) return null;
  return (
    <Card variant="accent" testID="invite-pending">
      <Text variant="bodyMedium">{name} hat dich eingeladen 👋</Text>
      <Text variant="small" tone="secondary" style={{ marginTop: 4 }}>
        Erstelle ein kostenloses Konto – dann seid ihr automatisch befreundet.
      </Text>
      <Row style={{ marginTop: spacing.md }}>
        <Button title="Konto erstellen" size="sm" onPress={() => router.push('/auth?mode=signup')} testID="invite-pending-signup" />
        <Button title="Später" size="sm" variant="ghost" onPress={() => setPrefs({ pendingInvite: null })} />
      </Row>
    </Card>
  );
}
