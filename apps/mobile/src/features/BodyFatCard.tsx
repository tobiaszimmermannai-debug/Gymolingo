import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { formatDateDE, formatNumberDE, latestNavyBodyFat, navyRequiredFields } from '@gymolingo/core';
import { Card } from '@/ui/Card';
import { Text } from '@/ui/Text';
import { Button } from '@/ui/Button';
import { Row } from '@/ui/Screen';
import { spacing } from '@/ui/theme';
import { useProfileOrDefault, useRows } from '@/data/hooks';
import { setPrefs, useDB } from '@/data/store';
import { aiAvailability, AiError, type BodyFatEstimate } from '@/lib/ai';
import { confirm, notify } from '@/lib/dialog';
import { applyBodyFat, estimateFromPhotos, photosForEstimate, type BodyFatSource } from './bodyFat';

const FIELD_DE = { waist_cm: 'Taille', neck_cm: 'Hals', hips_cm: 'Hüfte' } as const;
const CONF_DE = { low: 'niedrig', medium: 'mittel', high: 'hoch' } as const;

/** Body fat estimate card: Navy formula (always) + optional AI photo estimate. */
export function BodyFatCard({ withPhotos = false }: { withPhotos?: boolean }) {
  const p = useProfileOrDefault();
  const measurements = useRows('body_measurements');
  const photos = useRows('progress_photos');
  const consent = useDB((s) => !!s.prefs.aiPhotoConsent);
  const navy = useMemo(() => latestNavyBodyFat(measurements, p.sex, p.height_cm), [measurements, p.sex, p.height_cm]);
  const usable = useMemo(() => photosForEstimate(photos), [photos]);
  const ai = aiAvailability();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BodyFatEstimate | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = (pct: number, source: BodyFatSource) => {
    if (applyBodyFat(pct, source) === 'saved') notify('Gespeichert', `${formatNumberDE(pct, 1)} % Körperfett beim heutigen Gewicht eingetragen (als Schätzung markiert).`);
  };

  const runAi = async () => {
    setError(null);
    if (!consent) {
      const ok = await confirm(
        'Fotos an die KI senden?',
        'Für die Schätzung werden bis zu 3 verkleinerte Fortschrittsfotos an Google Gemini übertragen. Gymolingo speichert sie dafür nicht zusätzlich; Google verarbeitet sie gemäß den Gemini-API-Bedingungen. Du kannst die Einwilligung jederzeit hier widerrufen.',
        'Einverstanden',
      );
      if (!ok) return;
      setPrefs({ aiPhotoConsent: true });
    }
    setBusy(true);
    try {
      setResult(await estimateFromPhotos(usable));
    } catch (e) {
      setError(e instanceof AiError || e instanceof Error ? e.message : 'Schätzung fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  const missing = navyRequiredFields(p.sex).map((f) => FIELD_DE[f]);
  return (
    <Card testID="bodyfat-card">
      <Text variant="h3">Körperfett schätzen</Text>
      <Text variant="small" tone="secondary" style={{ marginTop: 4 }}>
        Schätzungen liegen typischerweise ±3–5 Prozentpunkte daneben – ideal, um den Verlauf zu verfolgen. Miss immer unter gleichen Bedingungen.
      </Text>

      <View style={{ marginTop: spacing.md, gap: 6 }}>
        <Text variant="smallMedium">Aus Körpermaßen (Navy-Formel · kostenlos, offline)</Text>
        {p.sex === 'diverse' ? (
          <Text variant="small" tone="muted">
            Die Navy-Formel ist nach Geschlecht kalibriert – für „divers“ gibt es keinen verlässlichen Wert.
          </Text>
        ) : !p.height_cm ? (
          <Text variant="small" tone="muted">
            Trage deine Größe im Profil ein.
          </Text>
        ) : navy ? (
          <Row style={{ justifyContent: 'space-between' }}>
            <Text testID="bf-navy-value">
              <Text variant="h2">≈ {formatNumberDE(navy.pct, 1)} %</Text>
              <Text variant="small" tone="muted">{`  Maße vom ${formatDateDE(navy.date)}`}</Text>
            </Text>
            <Button title="Übernehmen" size="sm" variant="secondary" testID="bf-apply-navy" onPress={() => apply(navy.pct, 'navy')} />
          </Row>
        ) : (
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="small" tone="muted" style={{ flex: 1 }}>
              Miss {missing.join(', ')} (Maßband, morgens, entspannt).
            </Text>
            {withPhotos && <Button title="Maße eintragen" size="sm" variant="secondary" onPress={() => router.push('/body/measurements')} />}
          </Row>
        )}
      </View>

      {withPhotos && ai !== 'disabled' && ai !== 'no_backend' && (
        <View style={{ marginTop: spacing.md, gap: 6 }}>
          <Text variant="smallMedium">Aus Fotos (KI · Google Gemini)</Text>
          {ai === 'no_account' ? (
            <Text variant="small" tone="muted">
              Melde dich an (Einstellungen → Konto), um die KI-Schätzung zu nutzen.
            </Text>
          ) : usable.length === 0 ? (
            <Text variant="small" tone="muted">
              Nimm zuerst ein Foto auf – am besten von vorne und seitlich, eng anliegende Kleidung, gutes Licht.
            </Text>
          ) : (
            <Button
              title={`Aus ${usable.length} Foto${usable.length > 1 ? 's' : ''} schätzen`}
              icon="sparkles-outline"
              variant="secondary"
              loading={busy}
              testID="bf-ai"
              onPress={runAi}
            />
          )}
          {error && (
            <Text variant="small" tone="danger" testID="bf-ai-error">
              {error}
            </Text>
          )}
          {result && !result.usable && (
            <Text variant="small" tone="warning" testID="bf-ai-unusable">
              {result.cues || 'Die Fotos lassen keine Schätzung zu.'}
            </Text>
          )}
          {result?.usable && result.body_fat_pct !== undefined && (
            <View style={{ gap: 4 }} testID="bf-ai-result">
              <Row style={{ justifyContent: 'space-between' }}>
                <Text>
                  <Text variant="h2">≈ {formatNumberDE(result.body_fat_pct, 1)} %</Text>
                  <Text variant="small" tone="muted">{`  ${formatNumberDE(result.range_low ?? 0, 0)}–${formatNumberDE(result.range_high ?? 0, 0)} % · Sicherheit ${CONF_DE[result.confidence ?? 'low']}`}</Text>
                </Text>
                <Button title="Übernehmen" size="sm" variant="secondary" testID="bf-apply-ai" onPress={() => apply(result.body_fat_pct!, 'ai')} />
              </Row>
              {!!result.cues && (
                <Text variant="small" tone="secondary">
                  {result.cues}
                </Text>
              )}
              {!!result.photo_tips && (
                <Text variant="small" tone="muted">
                  Tipp: {result.photo_tips}
                </Text>
              )}
            </View>
          )}
          {consent && (
            <Text variant="small" tone="muted" onPress={() => setPrefs({ aiPhotoConsent: false })} accessibilityRole="button" testID="bf-revoke">
              Einwilligung zur Foto-Übertragung widerrufen
            </Text>
          )}
        </View>
      )}
    </Card>
  );
}
