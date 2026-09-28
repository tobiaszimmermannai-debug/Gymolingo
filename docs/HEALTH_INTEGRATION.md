# Apple Health / Health Connect aktivieren

Schritte und Gewicht können optional aus Apple Health (iOS) bzw. Health Connect (Android) übernommen werden. Manuelle Einträge haben in allen Statistiken **immer Vorrang**. Standardmäßig ist die Integration aus, damit die App in Expo Go und im Web läuft.

Voraussetzung: **Development Build** (nicht Expo Go), da native Module nötig sind. Kostenlos lokal möglich (`npx expo run:ios|android`).

## 1. Pakete installieren
```bash
cd apps/mobile
npx expo install @kingstinct/react-native-healthkit          # iOS
npx expo install react-native-health-connect expo-health-connect expo-build-properties   # Android
```

## 2. Config-Plugins in `app.json`
```jsonc
"plugins": [
  ["@kingstinct/react-native-healthkit", {
    "NSHealthShareUsageDescription": "Gymolingo liest Schritte und Gewicht, um deine Tagesziele automatisch auszufüllen."
  }],
  "expo-health-connect",
  ["expo-build-properties", { "android": { "minSdkVersion": 26 } }]
]
```
Plugin-Optionen und Mindest-SDK-Versionen bitte in der jeweiligen Paket-Doku zur installierten Version prüfen.

## 3. Adapter registrieren
In `apps/mobile/src/lib/health/enable.ts`:
```ts
import { Platform } from 'react-native';
import { registerHealthProvider } from './index';
import { appleHealthProvider } from './adapters/appleHealth';
import { healthConnectProvider } from './adapters/healthConnect';

if (Platform.OS === 'ios') registerHealthProvider(appleHealthProvider);
if (Platform.OS === 'android') registerHealthProvider(healthConnectProvider);
```
Danach die `// @ts-nocheck`-Zeile in den Adaptern entfernen und `npx tsc --noEmit` ausführen – API-Namen können sich zwischen Paketversionen ändern.

## 4. In der App einschalten
Einstellungen → Schalter **„Schritte aus Apple Health / Health Connect"** (erscheint nur, wenn ein Adapter registriert ist). Die App fragt dann die Leseberechtigung an und übernimmt Schritte beim Start, beim Zurückkehren in die App und beim Abend-Check-in.

## Datenschutz
- Es werden nur **Schritte** und **Gewicht** gelesen, nichts geschrieben.
- Die Werte landen wie manuelle Einträge in der lokalen Datenbank (Quelle `apple_health` / `health_connect`) und werden nur mit Konto synchronisiert.
