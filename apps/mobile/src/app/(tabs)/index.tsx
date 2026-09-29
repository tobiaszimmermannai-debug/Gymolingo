import { View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { formatDateDE, formatNumberDE, weightSummary, STREAK_LABELS_DE, WEEKDAY_LONG_DE, weekdayIndex, type StreakKind } from '@gymolingo/core';
import { Screen, Row, Section } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { Button, IconButton } from '@/ui/Button';
import { ProgressRing } from '@/ui/ProgressRing';
import { ProgressBar } from '@/ui/ProgressBar';
import { colors, radius, spacing } from '@/ui/theme';
import { useTodayState } from '@/features/today';
import { startWorkoutForDay } from '@/features/workoutStart';
import { useExerciseLookup, useRows } from '@/data/hooks';
import { BADGE_MAP } from '@gymolingo/core';
import { SyncBadge } from '@/features/SyncBadge';
import { DailyBriefing } from '@/features/DailyBriefing';
import { useMyStatus } from '@/features/status';

const STREAK_ICONS: Record<StreakKind, string> = { training: '🏋️', nutrition: '📒', protein: '🥩', steps: '👟', checkin: '🌙', weight: '⚖️' };

export default function Home() {
  const t = useTodayState();
  const lookup = useExerciseLookup();
  const p = t.profile;
  const w = weightSummary(t.data.weights, t.today);
  const kcalPct = p.calorie_target ? t.nutrition.totals.kcal / p.calorie_target : 0;
  const streakKinds: StreakKind[] = ['training', 'nutrition', 'protein', 'steps', 'checkin', ...(p.weight_tracking_enabled ? (['weight'] as StreakKind[]) : [])];
  const bestNow = streakKinds.reduce((m, k) => Math.max(m, t.streaks[k].current), 0);
  const unseen = useRows('user_achievements').filter((a) => !a.seen && BADGE_MAP[a.badge_id]);
  const hour = new Date().getHours();
  const greeting = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Hallo' : 'Guten Abend';
  const status = useMyStatus();

  return (
    <Screen tabBarPadding testID="home-screen">
      <Row style={{ paddingTop: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Text variant="small" tone="secondary" numberOfLines={1}>
            {WEEKDAY_LONG_DE[weekdayIndex(t.today)]}, {formatDateDE(t.today)} · {greeting}
          </Text>
          <Text variant="h1" numberOfLines={1}>
            {p.display_name || 'Hallo'} 👋
          </Text>
        </View>
        <SyncBadge />
        <Pressable testID="level-badge" onPress={() => router.push('/achievements')} style={{ backgroundColor: colors.accentSoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 }} accessibilityRole="button" accessibilityLabel={`Level ${t.game.level.level}`}>
          <Text variant="smallMedium" tone="accent">
            Lv {t.game.level.level}
          </Text>
        </Pressable>
        <IconButton icon="settings-outline" accessibilityLabel="Einstellungen" testID="open-settings" onPress={() => router.push('/settings')} />
      </Row>
      <Pressable
        testID="home-status"
        onPress={() => router.push('/status')}
        accessibilityRole="button"
        accessibilityLabel={status ? `Status: ${status.text}` : 'Status setzen'}
        style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%', marginTop: -spacing.sm, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surface2, borderWidth: 1, borderColor: status ? colors.border : 'transparent' }}
      >
        <Text variant="small">{status ? status.emoji : '😎'}</Text>
        <Text variant="small" tone={status ? 'default' : 'secondary'} numberOfLines={1} style={{ flexShrink: 1 }}>
          {status ? status.text : 'Status setzen'}
        </Text>
      </Pressable>

      {/* Streaks */}
      <Pressable onPress={() => router.push('/achievements')} accessibilityRole="button" accessibilityLabel="Streaks und Erfolge">
        <LinearGradient colors={['rgba(198,244,50,0.16)', 'rgba(198,244,50,0.03)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: 'rgba(198,244,50,0.22)' }}>
          <Row>
            <Text variant="display">🔥</Text>
            <View style={{ flex: 1 }}>
              <Text variant="h2" testID="best-streak">
                {bestNow} {bestNow === 1 ? 'Tag' : 'Tage'} Serie
              </Text>
              <Text variant="small" tone="secondary">
                +{t.game.xpToday} XP heute · {t.game.level.title}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </Row>
          <Row gap={6} wrap style={{ marginTop: spacing.md }}>
            {streakKinds.map((k) => {
              const s = t.streaks[k];
              return (
                <View key={k} accessibilityLabel={`${STREAK_LABELS_DE[k]}: ${s.current} Tage`} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: s.todayDone ? colors.accentSoft : colors.surface2, borderWidth: 1, borderColor: s.atRisk ? colors.warning : 'transparent' }}>
                  <Text variant="small">{STREAK_ICONS[k]}</Text>
                  <Text variant="smallMedium" tone={s.todayDone ? 'accent' : 'default'}>
                    {s.current}
                  </Text>
                </View>
              );
            })}
          </Row>
        </LinearGradient>
      </Pressable>

      {unseen.length > 0 && (
        <Card variant="accent" onPress={() => router.push('/achievements')} testID="new-badges" accessibilityLabel="Neue Abzeichen ansehen">
          <Row>
            <Text variant="h1">{BADGE_MAP[unseen[0].badge_id].icon}</Text>
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium">Neues Abzeichen{unseen.length > 1 ? ` (+${unseen.length - 1} weitere)` : ''}: {BADGE_MAP[unseen[0].badge_id].title}</Text>
              <Text variant="small" tone="secondary">
                {BADGE_MAP[unseen[0].badge_id].description}
              </Text>
            </View>
          </Row>
        </Card>
      )}

      {/* Nutrition today */}
      <Card onPress={() => router.push('/nutrition')} testID="home-nutrition-card" accessibilityLabel="Ernährung heute">
        <Row gap={spacing.lg}>
          <ProgressRing size={118} stroke={11} progress={kcalPct} overColor={colors.warning}>
            <Text variant="number" testID="kcal-remaining">
              {formatNumberDE(Math.abs(t.remaining.kcal), 0)}
            </Text>
            <Text variant="caption" tone="secondary">
              {t.remaining.kcal >= 0 ? 'kcal übrig' : 'kcal drüber'}
            </Text>
          </ProgressRing>
          <View style={{ flex: 1, gap: spacing.md }}>
            <Macro label="Protein" value={t.nutrition.totals.protein_g} target={p.protein_target_g} color={colors.protein} />
            <Macro label="Kohlenhydrate" value={t.nutrition.totals.carbs_g} target={p.carbs_target_g} color={colors.carbs} />
            <Macro label="Fett" value={t.nutrition.totals.fat_g} target={p.fat_target_g} color={colors.fat} />
          </View>
        </Row>
        <Row style={{ marginTop: spacing.md, justifyContent: 'space-between' }}>
          <Text variant="small" tone="secondary">
            {formatNumberDE(t.nutrition.totals.kcal, 0)} / {formatNumberDE(p.calorie_target, 0)} kcal gegessen
          </Text>
          <Text variant="smallMedium" tone={t.remaining.protein_g > 0 ? 'accent' : 'success'}>
            {t.remaining.protein_g > 0 ? `Noch ${formatNumberDE(t.remaining.protein_g, 0)} g Protein` : 'Protein erreicht ✓'}
          </Text>
        </Row>
      </Card>

      {/* Training today */}
      <Card variant={t.isTrainingDay && !t.workoutDone ? 'elevated' : 'default'} testID="home-training-card">
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="caption" tone="secondary">
              {t.activeSession ? 'Training läuft' : t.workoutDone ? 'Heute erledigt' : t.isTrainingDay ? 'Heute geplant' : 'Ruhetag'}
            </Text>
            <Text variant="h2">{t.activeSession?.name ?? t.nextDay?.day.name ?? 'Kein Plan'}</Text>
            {t.firstSuggestion && !t.workoutDone && !t.activeSession && (
              <Text variant="small" tone="secondary">
                Ziel {t.firstSuggestion.exercise}: <Text variant="smallMedium" tone="accent">{t.firstSuggestion.text}</Text>
              </Text>
            )}
            {!t.isTrainingDay && !t.workoutDone && !t.activeSession && (
              <Text variant="small" tone="secondary">
                Regeneration ist Teil des Plans. {t.streaks.trainingMeta.weekDone}/{t.streaks.trainingMeta.weekQuota} Trainings diese Woche.
              </Text>
            )}
          </View>
          <Text variant="display">{t.workoutDone ? '✅' : t.isTrainingDay || t.activeSession ? '💪' : '😴'}</Text>
        </Row>
        <View style={{ marginTop: spacing.md }}>
          {t.activeSession ? (
            <Button testID="continue-workout" title="Training fortsetzen" icon="play" onPress={() => router.push('/workout/active')} />
          ) : t.workoutDone ? (
            <Button title="Trainingsverlauf" variant="secondary" icon="time-outline" onPress={() => router.push('/workout/history')} />
          ) : t.nextDay ? (
            <Button
              testID="start-workout"
              title={t.isTrainingDay ? 'Training starten' : 'Trotzdem trainieren'}
              variant={t.isTrainingDay ? 'primary' : 'secondary'}
              icon="play"
              onPress={() => {
                startWorkoutForDay(t.nextDay!.day.name, t.nextDay!.day.id, t.nextDay!.exercises, lookup);
                router.push('/workout/active');
              }}
            />
          ) : (
            <Button title="Trainingsplan erstellen" variant="secondary" icon="add" onPress={() => router.push('/training')} />
          )}
        </View>
      </Card>

      {/* Steps + weight */}
      <Row style={{ alignItems: 'stretch' }}>
        <Card style={{ flex: 1 }} onPress={() => router.push('/checkin')} testID="home-steps-card" accessibilityLabel="Schritte">
          <Text variant="caption" tone="secondary">
            Schritte
          </Text>
          <Text variant="number" style={{ marginTop: 4 }}>
            {t.steps !== null ? formatNumberDE(t.steps, 0) : '–'}
          </Text>
          <View style={{ marginTop: 8 }}>
            <ProgressBar progress={(t.steps ?? 0) / Math.max(1, p.step_target)} color={colors.steps} height={6} />
          </View>
          <Text variant="small" tone="muted" style={{ marginTop: 6 }}>
            Ziel {formatNumberDE(p.step_target, 0)}
          </Text>
        </Card>
        <Card style={{ flex: 1 }} onPress={() => router.push('/body/weight')} testID="home-weight-card" accessibilityLabel="Gewicht">
          <Text variant="caption" tone="secondary">
            Gewicht Ø 7 Tage
          </Text>
          <Text variant="number" style={{ marginTop: 4 }}>
            {w.avg7 !== null ? `${formatNumberDE(w.avg7, 1)} kg` : '–'}
          </Text>
          <Text variant="small" tone={w.avg7 !== null && w.avg7Prev !== null ? 'secondary' : 'muted'} style={{ marginTop: 8 }}>
            {w.avg7 !== null && w.avg7Prev !== null
              ? `${w.avg7 - w.avg7Prev >= 0 ? '+' : '−'}${formatNumberDE(Math.abs(w.avg7 - w.avg7Prev), 1)} kg zur Vorwoche`
              : t.weighed
                ? 'Heute gewogen ✓'
                : 'Heute noch nicht gewogen'}
          </Text>
        </Card>
      </Row>

      {/* Open tasks */}
      <Section title="Heute zu tun">
        <Card padding={spacing.sm}>
          {t.tasks.map((task, i) => (
            <Pressable
              key={task.id}
              testID={`task-${task.id}`}
              onPress={() => router.push(task.route as never)}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.sm, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border, opacity: pressed ? 0.7 : 1 })}
              accessibilityRole="button"
              accessibilityLabel={task.title}
            >
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: task.done ? colors.accentSoft : colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
                <Text>{task.done ? '✓' : task.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium" style={task.done ? { textDecorationLine: 'line-through', color: colors.textSecondary } : undefined}>
                  {task.title}
                </Text>
                <Text variant="small" tone="secondary" numberOfLines={1}>
                  {task.subtitle}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          ))}
        </Card>
      </Section>

      {/* Weekly challenges */}
      <Section title="Wochen-Challenges" action={<Text variant="small" tone="secondary">+{t.game.xpThisWeek} XP diese Woche</Text>}>
        {t.game.currentChallenges.map((c) => (
          <Card key={c.id} padding={spacing.md} variant={c.completed ? 'accent' : 'default'} testID={`challenge-${c.metric}`}>
            <Row>
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium">
                  {c.completed ? '✅ ' : ''}
                  {c.title}
                </Text>
                <Text variant="small" tone="secondary">
                  {c.description}
                </Text>
              </View>
              <Text variant="smallMedium" tone={c.completed ? 'accent' : 'secondary'}>
                {formatNumberDE(Math.min(c.progress, c.target), 0)}/{formatNumberDE(c.target, 0)}
              </Text>
            </Row>
            <View style={{ marginTop: spacing.sm }}>
              <ProgressBar progress={c.progress / c.target} height={6} />
            </View>
          </Card>
        ))}
      </Section>

      <DailyBriefing t={t} />
    </Screen>
  );
}

function Macro({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="smallMedium">{label}</Text>
        <Text variant="small" tone="secondary">
          {formatNumberDE(value, 0)} / {formatNumberDE(target, 0)} g
        </Text>
      </Row>
      <ProgressBar progress={target ? value / target : 0} color={color} height={6} overColor={label === 'Protein' ? color : colors.warning} />
    </View>
  );
}
