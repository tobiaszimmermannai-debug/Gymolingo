import { useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { isValidBarcode, todayISO, type MealType } from '@gymolingo/core';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { Card } from '@/ui/Card';
import { colors, radius, spacing } from '@/ui/theme';
import { lookupBarcode } from '@/features/foods';
import { haptic } from '@/lib/haptics';

/**
 * Barcode scanner (EAN-13/EAN-8/UPC) → Open Food Facts lookup.
 * Manual entry is always available (e.g. when the camera is not permitted).
 */
export default function Scan() {
  const { date = todayISO(), meal = 'lunch' } = useLocalSearchParams<{ date?: string; meal?: MealType }>();
  const [perm, requestPerm] = useCameraPermissions();
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'notfound' | 'error'>('idle');
  const busy = useRef(false);

  const handle = async (raw: string) => {
    const c = raw.replace(/\D/g, '');
    if (busy.current || c.length < 8) return;
    busy.current = true;
    setCode(c);
    setStatus('loading');
    try {
      const food = await lookupBarcode(c);
      if (!food) {
        setStatus('notfound');
        busy.current = false;
        return;
      }
      haptic('success');
      router.replace(`/nutrition/food?ref=${encodeURIComponent(food.ref)}&date=${date}&meal=${meal}`);
    } catch {
      setStatus('error');
      busy.current = false;
    }
  };

  return (
    <Screen title="Barcode scannen" back testID="scan-screen">
      {perm?.granted ? (
        <View style={{ height: 300, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: '#000' }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
            onBarcodeScanned={status === 'loading' ? undefined : (r) => void handle(r.data)}
          />
          <View pointerEvents="none" style={{ position: 'absolute', left: '12%', right: '12%', top: '38%', height: 80, borderWidth: 2, borderColor: colors.accent, borderRadius: radius.md }} />
        </View>
      ) : (
        <Card>
          <Text variant="h3">Kamera-Zugriff</Text>
          <Text tone="secondary" style={{ marginTop: 4 }}>
            Zum Scannen benötigt Gymolingo Zugriff auf die Kamera. Alternativ kannst du die Nummer unter dem Barcode eintippen.
          </Text>
          <Button title="Kamera erlauben" icon="camera-outline" style={{ marginTop: spacing.md }} onPress={() => requestPerm()} testID="grant-camera" />
        </Card>
      )}

      <Input testID="barcode-input" label="Barcode manuell eingeben" value={code} onChangeText={setCode} keyboardType="number-pad" placeholder="z. B. 4000417025005" error={code.length >= 8 && !isValidBarcode(code) ? 'Prüfziffer passt nicht – bitte Nummer kontrollieren.' : null} />
      <Button title="Suchen" onPress={() => handle(code)} disabled={code.replace(/\D/g, '').length < 8} testID="barcode-search" />

      {status === 'loading' && <ActivityIndicator color={colors.accent} />}
      {status === 'notfound' && (
        <Card variant="outline" testID="barcode-notfound">
          <Text variant="bodyMedium">Produkt nicht gefunden</Text>
          <Text variant="small" tone="secondary" style={{ marginTop: 4 }}>
            {code} ist (noch) nicht in Open Food Facts. Lege es mit den Werten von der Verpackung an – beim nächsten Scan wird es direkt erkannt.
          </Text>
          <Button title="Produkt anlegen" style={{ marginTop: spacing.md }} onPress={() => router.replace(`/nutrition/custom-food?date=${date}&meal=${meal}&barcode=${code}`)} />
        </Card>
      )}
      {status === 'error' && (
        <Text tone="warning" variant="small">
          Keine Verbindung zu Open Food Facts. Prüfe deine Internetverbindung oder lege das Produkt manuell an.
        </Text>
      )}
    </Screen>
  );
}
