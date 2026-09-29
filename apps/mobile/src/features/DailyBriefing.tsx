import { useCallback } from 'react';
import { View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CARDIO_LABELS_DE, formatLastSeen, formatNumberDE } from '@gymolingo/core';
import { Card } from '@/ui/Card';
import { Text } from '@/ui/Text';
import { Row } from '@/ui/Screen';
import { colors, spacing } from '@/ui/theme';
import { useDB } from '@/data/store';
import { refreshFriendsActivity } from './presence';
import type { useTodayState } from './today';

type Today = ReturnType<typeof useTodayState>;

/** The coach's daily briefing on Home: today's focus from real data + when friends/testers were last online. */
export function DailyBriefing({ t }: { t: Today }) {
  const account = useDB((s) => s.accountUserId);
  const friends = useDB((s) => s.prefs.friendsActivity?.rows);
  useFocusEffect(
    useCallback(() => {
      void refreshFriendsActivity();
    }, [account]),
  );

  const lines: { icon: keyof typeof Ionicons.glyphMap; text: string; testID?: string }[] = [];
  if (t.workoutDone) lines.push({ icon: 'checkmark-circle-outline', text: 'Training heute erledigt – stark!' });
  else if (t.activeSession) lines.push({ icon: 'barbell-outline', text: 'Dein Training läuft noch – bring es zu Ende.' });
  else if (t.isTrainingDay && t.nextDay) lines.push({ icon: 'barbell-outline', text: `Heute: ${t.nextDay.day.name}${t.firstSuggestion ? ` – ${t.firstSuggestion.exercise} ${t.firstSuggestion.text}` : ''}` });
  else lines.push({ icon: 'bed-outline', text: 'Heute ist Ruhetag – Erholung gehört zum Plan.' });
  if (t.cardioToday.length)
    lines.push({
      icon: 'walk-outline',
      text: `Aktivität heute: ${t.cardioToday.map((c) => `${CARDIO_LABELS_DE[c.activity]} ${formatNumberDE(c.duration_min, 0)} min`).join(', ')} – ca. ${formatNumberDE(t.burnedKcal, 0)} kcal verbrannt${t.profile.add_exercise_calories ? ' (zum Kalorienziel addiert)' : ''}.`,
    });
  if (t.remaining.kcal > 0) lines.push({ icon: 'restaurant-outline', text: `Noch ${formatNumberDE(t.remaining.kcal, 0)} kcal und ${formatNumberDE(Math.max(0, t.remaining.protein_g), 0)} g Protein offen.` });
  else lines.push({ icon: 'restaurant-outline', text: 'Kalorienziel für heute erreicht.' });
  const risk = t.reminderState.streakAtRisk;
  if (risk) lines.push({ icon: 'flame-outline', text: `${risk.label}-Serie (${risk.days} Tage) heute sichern.` });

  return (
    <Card onPress={() => router.push('/coach')} testID="home-coach-card" accessibilityLabel="Tagesbriefing – Coach öffnen">
      <Row>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="sparkles" size={20} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyMedium">Tagesbriefing vom Coach</Text>
          <Text variant="small" tone="secondary">
            Tippen, um den Coach zu fragen
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Row>
      <View style={{ gap: 6, marginTop: spacing.md }}>
        {lines.map((l) => (
          <Row key={l.text} gap={spacing.sm} style={{ alignItems: 'flex-start' }}>
            <Ionicons name={l.icon} size={16} color={colors.textSecondary} style={{ marginTop: 2 }} />
            <Text variant="small" style={{ flex: 1 }}>
              {l.text}
            </Text>
          </Row>
        ))}
      </View>
      {account && (
        <View style={{ marginTop: spacing.md, gap: 4 }} testID="briefing-friends">
          <Text variant="caption" tone="muted">
            Tester: zuletzt online & Status
          </Text>
          {friends?.length ? (
            friends.map((f) => (
              <View key={f.user_id}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text variant="small">
                    {f.avatar_emoji} {f.display_name || f.username || 'Freund'}
                  </Text>
                  <Text variant="small" tone={f.last_seen_at && Date.now() - new Date(f.last_seen_at).getTime() < 5 * 60_000 ? 'success' : 'secondary'}>
                    {f.last_seen_at ? formatLastSeen(f.last_seen_at) : 'nicht geteilt'}
                  </Text>
                </Row>
                {f.status_emoji && (
                  <Text variant="small" tone="secondary" numberOfLines={1} style={{ marginLeft: 22 }} testID="briefing-friend-status">
                    {f.status_emoji} {f.status_text}
                  </Text>
                )}
              </View>
            ))
          ) : (
            <Text variant="small" tone="secondary">
              Füge deine Tester unter Community als Freunde hinzu – dann siehst du hier, wann sie zuletzt online waren.
            </Text>
          )}
        </View>
      )}
    </Card>
  );
}
