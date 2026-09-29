import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { STATUS_DURATION_LABELS, STATUS_EMOJIS, STATUS_GROUPS, STATUS_MAX_TEXT, type StatusDuration } from '@gymolingo/core';
import { Screen, Row, Section } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { Segmented } from '@/ui/Chip';
import { colors, radius, spacing } from '@/ui/theme';
import { useDB } from '@/data/store';
import { clearStatus, setStatus, useMyStatus, type StatusSync } from '@/features/status';

const DURATIONS = (Object.keys(STATUS_DURATION_LABELS) as StatusDuration[]).map((value) => ({ value, label: STATUS_DURATION_LABELS[value] }));

const SYNC_MSG: Record<Exclude<StatusSync, 'synced'>, string> = {
  local: 'Gespeichert. Melde dich an, damit deine Freunde deinen Status sehen.',
  needs_update: 'Gespeichert – deine Freunde sehen ihn, sobald das Datenbank-Update (Supabase) eingespielt ist.',
  error: 'Gespeichert – wird übertragen, sobald du wieder online bist.',
};

/** Fun status for friends: pick a sport meme or write your own. */
export default function StatusScreen() {
  const current = useMyStatus();
  const account = useDB((s) => s.accountUserId);
  const [duration, setDuration] = useState<StatusDuration>('today');
  const [emoji, setEmoji] = useState(STATUS_EMOJIS[0]);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const apply = async (e: string, t: string) => {
    const res = await setStatus(e, t, duration);
    if (res === 'synced') {
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } else setMsg(SYNC_MSG[res]);
  };

  return (
    <Screen title="Status" back testID="status-screen">
      <Card variant="accent" testID="status-current">
        <Text variant="caption" tone="secondary">
          Dein Status {account ? '(sehen deine Freunde)' : ''}
        </Text>
        {current ? (
          <>
            <Text variant="h3" style={{ marginTop: 4 }}>
              {current.emoji} {current.text}
            </Text>
            <Text variant="small" tone="secondary" style={{ marginTop: 2 }}>
              {current.until ? `bis ${new Date(current.until).toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}` : 'bis du ihn änderst'}
            </Text>
            <Button
              title="Status entfernen"
              variant="secondary"
              size="sm"
              style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
              testID="status-clear"
              onPress={async () => {
                setMsg(null);
                await clearStatus();
              }}
            />
          </>
        ) : (
          <Text tone="secondary" style={{ marginTop: 4 }}>
            Noch kein Status – such dir unten einen Spruch aus.
          </Text>
        )}
      </Card>
      {msg && (
        <Text variant="small" tone="warning" testID="status-msg">
          {msg}
        </Text>
      )}

      <Section title="Wie lange?">
        <Segmented options={DURATIONS} value={duration} onChange={setDuration} testIDPrefix="status-duration" />
      </Section>

      {STATUS_GROUPS.map((g) => (
        <Section key={g.title} title={g.title}>
          <View style={{ gap: spacing.sm }}>
            {g.items.map((p) => (
              <Card key={p.text} padding={spacing.md} onPress={() => apply(p.emoji, p.text)} testID={`status-preset-${p.emoji}`} accessibilityLabel={p.text}>
                <Row>
                  <Text variant="h2">{p.emoji}</Text>
                  <Text style={{ flex: 1 }}>{p.text}</Text>
                </Row>
              </Card>
            ))}
          </View>
        </Section>
      ))}

      <Section title="Eigener Status">
        <Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {STATUS_EMOJIS.map((e) => (
              <Pressable
                key={e}
                onPress={() => setEmoji(e)}
                accessibilityRole="button"
                accessibilityLabel={`Emoji ${e}`}
                accessibilityState={{ selected: e === emoji }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: e === emoji ? colors.accentSoft : colors.surface2,
                  borderWidth: 1,
                  borderColor: e === emoji ? colors.accent : 'transparent',
                }}
              >
                <Text variant="h3">{e}</Text>
              </Pressable>
            ))}
          </View>
          <Input
            containerStyle={{ marginTop: spacing.md }}
            value={text}
            onChangeText={setText}
            placeholder="z. B. Zweiter Shake, gleiches Glück"
            maxLength={STATUS_MAX_TEXT}
            hint={`${text.length}/${STATUS_MAX_TEXT}`}
            testID="status-custom-text"
          />
          <Button title={`${emoji} Status setzen`} style={{ marginTop: spacing.md }} disabled={!text.trim()} onPress={() => apply(emoji, text)} testID="status-custom-save" />
        </Card>
      </Section>
    </Screen>
  );
}
