import { useMemo, useRef, useState } from 'react';
import { FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Row } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { IconButton } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { Chip, Badge } from '@/ui/Chip';
import { colors, radius, spacing } from '@/ui/theme';
import { useRows } from '@/data/hooks';
import { remove } from '@/data/store';
import { requestSync } from '@/data/sync';
import { sendCoachMessage, useCoachContext } from '@/features/coach';
import { aiAvailability } from '@/lib/ai';
import { confirm } from '@/lib/dialog';

const SUGGESTIONS = ['Was trainiere ich heute?', 'Wie viel Protein fehlt mir heute?', 'Wie ist mein Gewichtstrend?', 'Wie steigere ich meine Gewichte?', 'Tipps für mehr Schritte'];

export default function Coach() {
  const ctx = useCoachContext();
  const messages = useRows('coach_messages');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<FlatList>(null);
  const sorted = useMemo(() => [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at)), [messages]);
  const ai = aiAvailability() === 'ok';

  const send = async (q: string) => {
    const msg = q.trim();
    if (!msg || busy) return;
    setText('');
    setBusy(true);
    await sendCoachMessage(msg, ctx);
    setBusy(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  };

  return (
    <Screen
      title="Coach"
      subtitle={ai ? 'KI-Coach · nutzt nur deine gespeicherten Daten' : 'Dein Coach · rechnet mit deinen echten Daten'}
      back
      scroll={false}
      testID="coach-screen"
      right={
        <Row gap={spacing.sm}>
          <IconButton icon="document-text-outline" accessibilityLabel="Wochenbericht" testID="open-report" onPress={() => router.push('/coach/report')} />
          {sorted.length > 0 && (
            <IconButton
              icon="trash-outline"
              accessibilityLabel="Verlauf löschen"
              onPress={async () => {
                if (!(await confirm('Verlauf löschen?', 'Alle Coach-Nachrichten werden gelöscht.', 'Löschen', true))) return;
                sorted.forEach((m) => remove('coach_messages', m.id));
                requestSync();
              }}
            />
          )}
        </Row>
      }
      footer={
        <Row>
          <Input containerStyle={{ flex: 1 }} value={text} onChangeText={setText} placeholder="Frag deinen Coach …" onSubmitEditing={() => send(text)} testID="coach-input" returnKeyType="send" />
          <IconButton icon="arrow-up" background={colors.accent} color={colors.onAccent} accessibilityLabel="Senden" testID="coach-send" onPress={() => send(text)} />
        </Row>
      }
    >
      <FlatList
        ref={listRef}
        style={{ flex: 1 }}
        data={sorted}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
            <Card variant="accent">
              <Row style={{ alignItems: 'flex-start' }}>
                <Ionicons name="sparkles" size={20} color={colors.accent} />
                <Text variant="small" tone="secondary" style={{ flex: 1 }}>
                  Ich kenne deine Trainings, Ernährung, Gewichtsentwicklung und Schritte. Alle Zahlen werden direkt aus deinen Einträgen berechnet – ich erfinde keine Daten. Bei Schmerzen oder gesundheitlichen Fragen wende dich bitte an eine Ärztin oder einen Arzt.
                </Text>
              </Row>
            </Card>
            {ctx.data_gaps.length > 0 && (
              <Text variant="small" tone="muted">
                Datenlage: {ctx.data_gaps.join(' · ')}
              </Text>
            )}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {SUGGESTIONS.map((s) => (
                <Chip key={s} label={s} onPress={() => send(s)} testID={`coach-suggestion-${SUGGESTIONS.indexOf(s)}`} />
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const mine = item.role === 'user';
          return (
            <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '88%' }} testID={mine ? 'coach-msg-user' : 'coach-msg-assistant'}>
              <View style={{ backgroundColor: mine ? colors.accent : colors.surface2, borderRadius: radius.lg, borderBottomRightRadius: mine ? 4 : radius.lg, borderBottomLeftRadius: mine ? radius.lg : 4, padding: spacing.md }}>
                <Text color={mine ? colors.onAccent : colors.text}>{item.content.replace(/\*\*(.+?)\*\*/g, '$1')}</Text>
              </View>
              {!mine && <View style={{ marginTop: 4 }}>{item.source === 'ai' ? <Badge label="KI" /> : <Badge label="aus deinen Daten" tone="muted" />}</View>}
            </View>
          );
        }}
        ListFooterComponent={busy ? <Text variant="small" tone="muted">Coach denkt nach …</Text> : null}
      />
    </Screen>
  );
}

