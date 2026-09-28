import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { addDays, formatDateDE, startOfWeek, todayISO, type Recommendation } from '@gymolingo/core';
import { Screen, Row } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { Button, IconButton } from '@/ui/Button';
import { Badge } from '@/ui/Chip';
import { spacing } from '@/ui/theme';
import { useRows } from '@/data/hooks';
import { autoReportWeek, ensureWeeklyReport } from '@/features/coach';

export default function WeeklyReport() {
  const [week, setWeek] = useState(autoReportWeek());
  const [busy, setBusy] = useState(false);
  const reports = useRows('ai_reports');
  const report = useMemo(() => reports.find((r) => r.week_start === week), [reports, week]);
  const current = startOfWeek(todayISO());

  useEffect(() => {
    if (!report && week <= current) {
      setBusy(true);
      ensureWeeklyReport(week).finally(() => setBusy(false));
    }
  }, [week, report, current]);

  const content = report?.content as { title?: string; sections?: { heading: string; body: string }[] } | undefined;
  const recs = ((report?.stats as { recommendations?: Recommendation[] } | undefined)?.recommendations ?? []) as Recommendation[];

  return (
    <Screen title="Wochenbericht" back testID="report-screen">
      <Row style={{ justifyContent: 'space-between' }}>
        <IconButton icon="chevron-back" accessibilityLabel="Vorherige Woche" onPress={() => setWeek(addDays(week, -7))} />
        <Text variant="h3">
          {formatDateDE(week)} – {formatDateDE(addDays(week, 6))}
        </Text>
        <IconButton icon="chevron-forward" accessibilityLabel="Nächste Woche" onPress={() => week < current && setWeek(addDays(week, 7))} />
      </Row>
      {week === current && (
        <Text variant="small" tone="muted" align="center">
          Laufende Woche – der Bericht aktualisiert sich bis Sonntag.
        </Text>
      )}
      {busy && !report && <Text tone="secondary">Bericht wird erstellt …</Text>}
      {report && content?.sections && (
        <>
          <Row gap={spacing.sm}>
            <Badge label={report.source === 'ai' ? 'KI-Interpretation' : 'Berechnet aus deinen Daten'} tone={report.source === 'ai' ? 'accent' : 'muted'} />
          </Row>
          {content.sections.map((s) => (
            <Card key={s.heading} padding={spacing.md} testID="report-section">
              <Text variant="h3">{s.heading}</Text>
              <Text tone="secondary" style={{ marginTop: 6 }}>
                {s.body}
              </Text>
            </Card>
          ))}
          {recs.length > 0 && report.source === 'ai' && (
            <View style={{ gap: spacing.sm }}>
              <Text variant="caption" tone="muted">
                Grundlage der Empfehlungen
              </Text>
              {recs.map((r) => (
                <Text key={r.id} variant="small" tone="muted">
                  • {r.title}
                </Text>
              ))}
            </View>
          )}
          <Button
            title="Neu berechnen"
            variant="secondary"
            icon="refresh"
            loading={busy}
            testID="regenerate-report"
            onPress={async () => {
              setBusy(true);
              await ensureWeeklyReport(week, true);
              setBusy(false);
            }}
          />
        </>
      )}
    </Screen>
  );
}
