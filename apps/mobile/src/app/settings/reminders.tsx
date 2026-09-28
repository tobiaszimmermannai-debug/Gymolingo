import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { planRemindersForDay, type ReminderIntensity } from '@gymolingo/core';
import { Screen, Row, Section } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { CommitInput } from '@/ui/CommitInput';
import { Segmented } from '@/ui/Chip';
import { ToggleRow } from '@/ui/Toggle';
import { Divider } from '@/ui/Screen';
import { spacing } from '@/ui/theme';
import { useReminderSettings } from '@/data/hooks';
import { saveReminderSettings } from '@/data/actions';
import { useTodayState } from '@/features/today';
import { notificationPermission, notificationsSupported, requestNotificationPermission } from '@/lib/notifications';

const TIME = /^([01]?\d|2[0-3]):[0-5]\d$/;

export default function ReminderSettingsScreen() {
  const s = useReminderSettings();
  const t = useTodayState();
  const [perm, setPerm] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  useEffect(() => {
    notificationPermission().then(setPerm);
  }, []);
  const preview = useMemo(() => planRemindersForDay(s, { ...t.reminderState, projected: true }, null), [s, t.reminderState]);
  const time = (key: 'morning_time' | 'evening_time' | 'weight_time' | 'quiet_start' | 'quiet_end', label: string) => (
    <CommitInput containerStyle={{ flex: 1 }} label={label} value={s[key]} onCommit={(v) => TIME.test(v.trim()) && saveReminderSettings({ [key]: v.trim().padStart(5, '0') })} placeholder="HH:MM" />
  );

  return (
    <Screen title="Erinnerungen" back testID="reminder-settings">
      <Card>
        <ToggleRow testID="reminders-enabled" label="Erinnerungen aktiv" description="Push-Benachrichtigungen und Aufgaben in der App" value={s.enabled} onChange={(v) => saveReminderSettings({ enabled: v })} />
        {perm !== 'granted' && s.enabled && (
          <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
            <Text variant="small" tone="warning">
              {notificationsSupported ? (perm === 'denied' ? 'Benachrichtigungen sind in den Systemeinstellungen deaktiviert.' : 'Benachrichtigungen sind noch nicht erlaubt.') : 'Dieser Browser unterstützt keine Benachrichtigungen – Aufgaben erscheinen in der App.'}
            </Text>
            {notificationsSupported && perm === 'undetermined' && <Button title="Benachrichtigungen erlauben" size="sm" onPress={async () => setPerm((await requestNotificationPermission()) ? 'granted' : 'denied')} />}
          </View>
        )}
      </Card>

      <Section title="Kategorien">
        <Card>
          <ToggleRow label="☀️ Morgens" description="Tagesziele, heutiges Training, Motivation, offene Wochenziele" value={s.morning_enabled} onChange={(v) => saveReminderSettings({ morning_enabled: v })} />
          <ToggleRow label="⚖️ Gewicht" description="Morgendliche Waage-Erinnerung (nur wenn Gewichtstracking aktiv)" value={s.weight_enabled} onChange={(v) => saveReminderSettings({ weight_enabled: v })} />
          <ToggleRow label="💪 Vor dem Training" description={`${s.pre_workout_minutes} Minuten vor deiner Trainingszeit`} value={s.pre_workout_enabled} onChange={(v) => saveReminderSettings({ pre_workout_enabled: v })} />
          <ToggleRow label="🏁 Nach dem Training" description="Erinnert an nicht abgeschlossene Trainings" value={s.post_workout_enabled} onChange={(v) => saveReminderSettings({ post_workout_enabled: v })} />
          <ToggleRow label="🍽️ Ernährung" description="Fehlende Einträge und offenes Protein" value={s.nutrition_enabled} onChange={(v) => saveReminderSettings({ nutrition_enabled: v })} />
          <ToggleRow label="🌙 Abends" description="Schritte, Check-in, Tagesabschluss" value={s.evening_enabled} onChange={(v) => saveReminderSettings({ evening_enabled: v })} />
          <ToggleRow label="🔥 Serien-Hinweise" description="Freundlicher Hinweis, wenn eine Serie heute noch offen ist" value={s.streak_enabled} onChange={(v) => saveReminderSettings({ streak_enabled: v })} />
          <ToggleRow label="📊 Wochenbericht" description="Sonntags" value={s.weekly_report_enabled} onChange={(v) => saveReminderSettings({ weekly_report_enabled: v })} />
        </Card>
      </Section>

      <Section title="Zeiten">
        <Card>
          <Row>
            {time('morning_time', 'Morgens')}
            {time('weight_time', 'Waage')}
            {time('evening_time', 'Abends')}
          </Row>
          <CommitInput
            containerStyle={{ marginTop: spacing.sm }}
            label="Minuten vor dem Training"
            value={String(s.pre_workout_minutes)}
            keyboardType="number-pad"
            onCommit={(v) => {
              const n = parseInt(v, 10);
              if (n >= 0 && n <= 240) saveReminderSettings({ pre_workout_minutes: n });
            }}
          />
          <Divider />
          <Text variant="smallMedium" style={{ marginTop: spacing.md }}>
            Ruhezeiten – hier gibt es nie Benachrichtigungen
          </Text>
          <Row style={{ marginTop: spacing.sm }}>
            {time('quiet_start', 'Von')}
            {time('quiet_end', 'Bis')}
          </Row>
        </Card>
      </Section>

      <Section title="Intensität">
        <Card>
          <Segmented
            testIDPrefix="intensity"
            options={[
              { value: 'gentle', label: 'Sanft' },
              { value: 'normal', label: 'Normal' },
              { value: 'persistent', label: 'Hartnäckig' },
            ]}
            value={s.intensity}
            onChange={(v) => saveReminderSettings({ intensity: v as ReminderIntensity })}
          />
          <Text variant="small" tone="secondary" style={{ marginTop: spacing.sm }}>
            {s.intensity === 'gentle'
              ? 'Eine Abend-Erinnerung, keine Nachfragen.'
              : s.intensity === 'normal'
                ? 'Abends eine Nachfrage nach 60 Minuten, falls noch offen.'
                : 'Bis zu zwei freundliche Nachfragen bei offenen Zielen – aber nie in den Ruhezeiten.'}
          </Text>
          <CommitInput
            containerStyle={{ marginTop: spacing.md }}
            label="Maximal pro Tag"
            value={String(s.max_per_day)}
            keyboardType="number-pad"
            onCommit={(v) => {
              const n = parseInt(v, 10);
              if (n >= 0 && n <= 12) saveReminderSettings({ max_per_day: n });
            }}
          />
        </Card>
      </Section>

      <Section title="Vorschau für heute">
        <Card padding={spacing.md} testID="reminder-preview">
          {preview.length === 0 && (
            <Text variant="small" tone="muted">
              Keine Erinnerungen geplant.
            </Text>
          )}
          {preview.map((r) => (
            <View key={r.id} style={{ paddingVertical: 6 }}>
              <Text variant="smallMedium">
                {r.time} · {r.title}
              </Text>
              <Text variant="small" tone="secondary">
                {r.body}
              </Text>
            </View>
          ))}
        </Card>
      </Section>
    </Screen>
  );
}
