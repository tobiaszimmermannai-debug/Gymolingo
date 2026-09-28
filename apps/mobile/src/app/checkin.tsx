import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatNumberDE, stepsByDate, STREAK_LABELS_DE, todayISO, type StreakKind } from '@gymolingo/core';
import { Screen, Row, Section } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Input, parseDecimal } from '@/ui/Input';
import { colors, radius, spacing } from '@/ui/theme';
import { logSteps, logWeight, saveCheckin } from '@/data/actions';
import { useTodayState } from '@/features/today';
import { getHealthProvider } from '@/lib/health';
import { haptic } from '@/lib/haptics';

const MOODS = ['😫', '😕', '😐', '🙂', '😄'];

/** Evening check-in: steps, optional weight, mood/energy/sleep → closes the day. */
export default function Checkin() {
  const t = useTodayState();
  const today = todayISO();
  const existing = t.data.checkins.find((c) => c.date === today);
  const stepEntry = stepsByDate(t.data.steps).get(today);
  const [steps, setSteps] = useState(stepEntry ? String(stepEntry.steps) : '');
  const [weight, setWeight] = useState('');
  const [mood, setMood] = useState<number | null>(existing?.mood ?? null);
  const [energy, setEnergy] = useState<number | null>(existing?.energy ?? null);
  const [sleep, setSleep] = useState(existing?.sleep_hours ? String(existing.sleep_hours).replace('.', ',') : '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [xpBefore] = useState(t.game.xpToday);
  const health = getHealthProvider();

  useEffect(() => {
    if (stepEntry && !steps) setSteps(String(stepEntry.steps));
  }, [stepEntry?.steps]);

  const importHealth = async () => {
    if (!health) return;
    if (!(await health.requestPermissions())) return setErr(`Kein Zugriff auf ${health.label}.`);
    const s = await health.getSteps(today);
    if (s !== null) setSteps(String(s));
  };

  const submit = () => {
    const s = steps.trim() ? parseDecimal(steps) : null;
    if (s !== null && (s < 0 || s > 200000)) return setErr('Bitte eine realistische Schrittzahl eingeben.');
    const w = weight.trim() ? parseDecimal(weight) : null;
    if (w !== null && (w < 20 || w > 400)) return setErr('Bitte ein Gewicht zwischen 20 und 400 kg eingeben.');
    const sl = sleep.trim() ? parseDecimal(sleep) : null;
    if (sl !== null && (sl < 0 || sl > 24)) return setErr('Schlaf zwischen 0 und 24 Stunden.');
    if (s === null) return setErr('Trage deine Schritte ein (Handy/Uhr zeigen sie an) – oder 0, wenn du es nicht weißt.');
    setErr(null);
    logSteps(today, Math.round(s));
    if (w !== null) logWeight(today, w);
    saveCheckin(today, { mood, energy, sleep_hours: sl, note: note.trim() || null });
    haptic('success');
    setDone(true);
  };

  const tomorrowTips = useMemo(() => {
    const tips: string[] = [];
    const p = t.profile;
    if (t.remaining.protein_g > 20) tips.push(`Protein: heute fehlten ${formatNumberDE(t.remaining.protein_g, 0)} g – plane morgen ein proteinreiches Frühstück (z. B. Skyr mit Haferflocken).`);
    const s = parseDecimal(steps) ?? 0;
    if (s < p.step_target) tips.push(`Schritte: ${formatNumberDE(p.step_target - s, 0)} fehlten – ein 20-Minuten-Spaziergang nach dem Mittagessen bringt ca. 2.500.`);
    if (t.nutrition.entries < 2) tips.push('Ernährung: trage morgen direkt nach jeder Mahlzeit ein – das dauert 20 Sekunden.');
    if (t.isTrainingDay && !t.workoutDone) tips.push('Training: heute war ein Trainingstag. Leg dir morgen die Sportsachen schon bereit.');
    if (!tips.length) tips.push('Alles im grünen Bereich – mach morgen genau so weiter! 💪');
    return tips.slice(0, 3);
  }, [t, steps]);

  if (done) {
    const kinds: StreakKind[] = ['training', 'nutrition', 'protein', 'steps', 'checkin'];
    return (
      <Screen title="Tag abgeschlossen" back testID="checkin-done">
        <Card variant="accent">
          <Text variant="display">🌙</Text>
          <Text variant="h1">Stark, {t.profile.display_name || 'du'}!</Text>
          <Text tone="secondary" style={{ marginTop: 4 }}>
            +{Math.max(0, t.game.xpToday - xpBefore) || t.game.xpToday} XP heute gesammelt. Gute Erholung!
          </Text>
        </Card>
        <Section title="Deine Serien">
          <Card padding={spacing.md}>
            {kinds.map((k) => (
              <Row key={k} style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
                <Text>{STREAK_LABELS_DE[k]}</Text>
                <Text variant="bodyMedium" tone={t.streaks[k].todayDone ? 'accent' : 'secondary'}>
                  {t.streaks[k].current} {t.streaks[k].current === 1 ? 'Tag' : 'Tage'} {t.streaks[k].todayDone ? '✓' : ''}
                </Text>
              </Row>
            ))}
          </Card>
        </Section>
        <Section title="Für morgen">
          {tomorrowTips.map((tip) => (
            <Card key={tip} padding={spacing.md}>
              <Text variant="small">{tip}</Text>
            </Card>
          ))}
          {t.nextDay && (
            <Text variant="small" tone="secondary">
              Nächstes geplantes Training: {t.nextDay.day.name}
            </Text>
          )}
        </Section>
        <Button title="Zur Startseite" onPress={() => router.dismissTo('/')} />
      </Screen>
    );
  }

  return (
    <Screen title="Abend-Check-in" subtitle="30 Sekunden für deinen Tagesabschluss" back testID="checkin-screen" footer={<Button title="Tag abschließen" icon="moon" onPress={submit} testID="submit-checkin" />}>
      <Card>
        <Row>
          <Ionicons name="footsteps-outline" size={22} color={colors.steps} />
          <Text variant="h3" style={{ flex: 1 }}>
            Schritte heute
          </Text>
          {health && <Button title={health.label} size="sm" variant="secondary" icon="heart-outline" onPress={importHealth} />}
        </Row>
        <Input testID="steps-input" containerStyle={{ marginTop: spacing.sm }} value={steps} onChangeText={setSteps} keyboardType="number-pad" suffix="Schritte" placeholder={`Ziel ${formatNumberDE(t.profile.step_target, 0)}`} />
        {stepEntry && stepEntry.source !== 'manual' && (
          <Text variant="small" tone="muted" style={{ marginTop: 4 }}>
            Automatisch aus {stepEntry.source === 'apple_health' ? 'Apple Health' : 'Health Connect'} – du kannst den Wert überschreiben.
          </Text>
        )}
      </Card>

      {t.profile.weight_tracking_enabled && !t.weighed && (
        <Card>
          <Text variant="h3">Gewicht (optional)</Text>
          <Text variant="small" tone="secondary">
            Heute morgen nicht gewogen? Abends ist das Gewicht meist 0,5–1 kg höher – trag es trotzdem ein, der Trend gleicht das aus.
          </Text>
          <Input containerStyle={{ marginTop: spacing.sm }} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" suffix="kg" accessibilityLabel="Gewicht" />
        </Card>
      )}

      {t.nutrition.entries < 3 && (
        <Card variant="outline" onPress={() => router.push('/nutrition')} accessibilityLabel="Ernährung ergänzen">
          <Row>
            <Ionicons name="restaurant-outline" size={20} color={colors.warning} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium">{t.nutrition.entries === 0 ? 'Noch keine Mahlzeiten eingetragen' : `Erst ${t.nutrition.entries} Einträge heute`}</Text>
              <Text variant="small" tone="secondary">
                Fehlt noch etwas? Tippe hier zum Ergänzen – auch grobe Schätzungen helfen.
              </Text>
            </View>
          </Row>
        </Card>
      )}

      <Card>
        <Text variant="h3">Wie war dein Tag?</Text>
        <Row style={{ justifyContent: 'space-between', marginTop: spacing.sm }}>
          {MOODS.map((m, i) => (
            <Pressable key={m} onPress={() => setMood(i + 1)} accessibilityRole="button" accessibilityLabel={`Stimmung ${i + 1} von 5`} style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: mood === i + 1 ? colors.accentSoft : colors.surface2, borderWidth: 1, borderColor: mood === i + 1 ? colors.accent : 'transparent' }}>
              <Text variant="h2">{m}</Text>
            </Pressable>
          ))}
        </Row>
        <Text variant="smallMedium" tone="secondary" style={{ marginTop: spacing.md }}>
          Energie
        </Text>
        <Row gap={spacing.sm} style={{ marginTop: 6 }}>
          {[1, 2, 3, 4, 5].map((e) => (
            <Pressable key={e} onPress={() => setEnergy(e)} accessibilityRole="button" accessibilityLabel={`Energie ${e} von 5`} style={{ flex: 1, height: 36, borderRadius: radius.sm, backgroundColor: energy !== null && e <= energy ? colors.accent : colors.surface2 }} />
          ))}
        </Row>
        <Input containerStyle={{ marginTop: spacing.md }} label="Schlaf letzte Nacht" value={sleep} onChangeText={setSleep} keyboardType="decimal-pad" suffix="Std." />
        <Input containerStyle={{ marginTop: spacing.sm }} label="Notiz (optional)" value={note} onChangeText={setNote} placeholder="z. B. stressiger Tag, gut geschlafen …" multiline />
      </Card>
      {err && <Text tone="danger">{err}</Text>}
    </Screen>
  );
}
