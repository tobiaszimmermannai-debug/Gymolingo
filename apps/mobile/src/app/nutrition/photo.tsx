import { useState } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { formatNumberDE, MEAL_LABELS_DE, MEAL_ORDER, todayISO, type MealType } from '@gymolingo/core';
import { Screen, Row } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { Button, IconButton } from '@/ui/Button';
import { Input, parseDecimal } from '@/ui/Input';
import { Badge, ChipGroup } from '@/ui/Chip';
import { colors, radius, spacing } from '@/ui/theme';
import { aiAvailability, analyzeMealPhoto, AiError, type PhotoEstimateItem } from '@/lib/ai';
import { prepareForAi } from '@/lib/imageResize';
import { insertMany, nowISO } from '@/data/store';
import { requestSync } from '@/data/sync';

const CONF_LABEL = { low: 'unsicher', medium: 'mittel', high: 'recht sicher' } as const;

/**
 * Optional AI meal recognition from a photo. Results are *estimates*: every
 * item is editable and stored with is_estimate = true.
 */
export default function PhotoMeal() {
  const { date = todayISO(), meal = 'lunch' } = useLocalSearchParams<{ date?: string; meal?: MealType }>();
  const [image, setImage] = useState<{ uri: string } | null>(null);
  const [hint, setHint] = useState('');
  const [items, setItems] = useState<PhotoEstimateItem[] | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [m, setM] = useState<MealType>(meal as MealType);
  const availability = aiAvailability();

  const pick = async (camera: boolean) => {
    setError(null);
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, allowsEditing: false };
    if (camera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return setError('Kamera-Zugriff wurde nicht erlaubt.');
    }
    const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets[0]) return;
    setImage({ uri: res.assets[0].uri });
    setItems(null);
  };

  const analyze = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);
    try {
      const small = await prepareForAi(image.uri); // ~1024 px JPEG keeps the upload small
      const r = await analyzeMealPhoto(small.data, small.mediaType, hint.trim() || undefined);
      setItems(r.items);
      setNote(r.note);
    } catch (e) {
      setError(e instanceof AiError ? e.message : 'Analyse fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      setLoading(false);
    }
  };

  const save = () => {
    if (!items?.length) return;
    insertMany(
      'meal_entries',
      items.map((i) => ({
        date,
        meal: m,
        food_ref: 'ai:photo',
        name: i.name,
        brand: null,
        amount_g: Math.max(1, i.grams),
        serving_label: 'Foto-Schätzung',
        kcal: Math.max(0, Math.round(i.kcal)),
        protein_g: Math.max(0, i.protein_g),
        carbs_g: Math.max(0, i.carbs_g),
        fat_g: Math.max(0, i.fat_g),
        fiber_g: null,
        source: 'ai' as const,
        is_estimate: true,
        estimate_note: `KI-Fotoschätzung (${CONF_LABEL[i.confidence]}) – Portionsgröße bitte prüfen`,
        logged_at: nowISO(),
      })),
    );
    requestSync();
    router.dismissTo('/nutrition' as never);
  };

  const setItem = (idx: number, patch: Partial<PhotoEstimateItem>) => setItems((arr) => arr!.map((x, i) => (i === idx ? { ...x, ...patch } : x)));

  if (availability !== 'ok') {
    return (
      <Screen title="Foto-Erkennung" back>
        <Card>
          <Text variant="h3">{availability === 'disabled' ? 'KI-Fotoerkennung ist deaktiviert' : 'KI-Fotoerkennung benötigt ein Konto'}</Text>
          <Text tone="secondary" style={{ marginTop: 6 }}>
            {availability === 'disabled'
              ? 'Diese Installation läuft im kostenlosen Modus ohne KI-Dienst. Nutze Suche, Barcode oder Schnelleintrag.'
              : availability === 'no_backend'
              ? 'Diese Installation ist ohne Server konfiguriert. Die Fotoanalyse läuft serverseitig (der API-Schlüssel liegt nie in der App).'
              : 'Melde dich an bzw. erstelle ein Konto, um Mahlzeiten per Foto schätzen zu lassen.'}
          </Text>
          {availability === 'no_account' && <Button title="Konto erstellen / anmelden" style={{ marginTop: spacing.md }} onPress={() => router.push('/auth')} />}
          <Button title="Stattdessen Schnelleintrag" variant="secondary" style={{ marginTop: spacing.sm }} onPress={() => router.replace(`/nutrition/quick?date=${date}&meal=${m}`)} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title="Mahlzeit per Foto" back footer={items?.length ? <Button title={`${items.length} Einträge speichern`} onPress={save} testID="save-photo-items" /> : undefined}>
      <Text variant="small" tone="secondary">
        Die KI schätzt Lebensmittel und Mengen. Fotos werden nur zur Analyse gesendet und nicht gespeichert. Prüfe die Werte – besonders Portionsgrößen und versteckte Fette (Öl, Soßen).
      </Text>
      {image ? (
        <Image source={{ uri: image.uri }} style={{ width: '100%', height: 240, borderRadius: radius.xl, backgroundColor: colors.surface }} resizeMode="cover" accessibilityLabel="Mahlzeitenfoto" />
      ) : (
        <View style={{ height: 180, borderRadius: radius.xl, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
          <Text tone="muted">Noch kein Foto ausgewählt</Text>
        </View>
      )}
      <Row>
        <Button title="Kamera" icon="camera-outline" variant="secondary" style={{ flex: 1 }} onPress={() => pick(true)} />
        <Button title="Galerie" icon="images-outline" variant="secondary" style={{ flex: 1 }} onPress={() => pick(false)} />
      </Row>
      <Input label="Hinweis (optional)" value={hint} onChangeText={setHint} placeholder="z. B. mit Olivenöl gebraten, 2 Eier" />
      <Button title="Analysieren" icon="sparkles" onPress={analyze} disabled={!image || loading} loading={loading} />
      {error && <Text tone="danger">{error}</Text>}
      {loading && <ActivityIndicator color={colors.accent} />}
      {items && (
        <>
          {note ? (
            <Text variant="small" tone="secondary">
              {note}
            </Text>
          ) : null}
          {items.map((i, idx) => (
            <Card key={idx} padding={spacing.md}>
              <Row>
                <Input containerStyle={{ flex: 1 }} value={i.name} onChangeText={(v) => setItem(idx, { name: v })} accessibilityLabel="Name" />
                <IconButton icon="close" size={32} accessibilityLabel="Entfernen" onPress={() => setItems((arr) => arr!.filter((_, j) => j !== idx))} />
              </Row>
              <Row style={{ marginTop: spacing.sm }}>
                <Badge label={`~ ${CONF_LABEL[i.confidence]}`} tone="warning" />
                <Text variant="small" tone="secondary">
                  {formatNumberDE(i.kcal, 0)} kcal · P {formatNumberDE(i.protein_g, 0)} · K {formatNumberDE(i.carbs_g, 0)} · F {formatNumberDE(i.fat_g, 0)}
                </Text>
              </Row>
              <Input
                containerStyle={{ marginTop: spacing.sm }}
                label="Menge"
                value={String(i.grams)}
                keyboardType="decimal-pad"
                suffix="g"
                onChangeText={(v) => {
                  const g = parseDecimal(v);
                  if (g === null || g <= 0) return;
                  const f = g / i.grams;
                  setItem(idx, { grams: g, kcal: i.kcal * f, protein_g: i.protein_g * f, carbs_g: i.carbs_g * f, fat_g: i.fat_g * f });
                }}
              />
            </Card>
          ))}
          <ChipGroup options={MEAL_ORDER.map((x) => ({ value: x, label: MEAL_LABELS_DE[x] }))} value={m} onChange={(v) => setM(v as MealType)} />
        </>
      )}
    </Screen>
  );
}
