# Gymolingo kostenlos betreiben

Ziel: Entwicklung **und** Betrieb ohne laufende Kosten. Alles, was Geld kostet, ist optional und standardmäßig aus.

## Was ist standardmäßig aktiv – und kostet nichts?

| Baustein | Kosten | Hinweis |
|---|---|---|
| App im **lokalen Modus** (ohne Server) | 0 € | Alle Daten auf dem Gerät (SQLite / IndexedDB). Training, Ernährung, Körper, Streaks, XP, Progress funktionieren komplett. |
| **Coach & Wochenbericht** | 0 € | Regelbasiert auf dem Gerät, rechnet nur mit echten Daten (`packages/core`). |
| **Reminder** | 0 € | Lokale Benachrichtigungen (expo-notifications / Web Notification API) – kein Push-Server nötig. |
| **Open Food Facts** (Suche, Barcode) | 0 € | Offene Datenbank (ODbL); Namensnennung ist in der App enthalten. |
| Deutsche Basis-Lebensmittel, Übungen | 0 € | Im App-Code enthalten. |

## Optional und trotzdem kostenlos

### Konto, Sync & Community – Supabase Free-Plan
- Kostenloses Projekt auf supabase.com anlegen (keine Kreditkarte nötig).
- `npx supabase link --project-ref <ref>` → `npx supabase db push`
- In `apps/mobile/.env`: `EXPO_PUBLIC_SUPABASE_URL` und `EXPO_PUBLIC_SUPABASE_ANON_KEY` eintragen.
- Grenzen des Free-Plans (Stand Entwicklung, bitte auf supabase.com prüfen): begrenzte DB-/Storage-Größe; inaktive Projekte werden nach einiger Zeit **pausiert** (per Klick im Dashboard wieder aktivierbar, Daten bleiben erhalten). Die App arbeitet währenddessen lokal weiter und synchronisiert später.
- Keine Kosten entstehen automatisch: Free-Projekte haben kein Überschreitungs-Billing ohne Upgrade.

### Web-App / PWA hosten
```bash
npm run build:web     # → apps/mobile/dist
```
Die Web-Version ist eine **PWA**: installierbar („Zum Home-Bildschirm“) und startet nach dem ersten Besuch auch offline (Service Worker `public/sw.js`). Den Ordner `dist` z. B. auf **GitHub Pages**, **Cloudflare Pages** oder **Netlify** (jeweils Gratis-Stufe) hochladen. Wichtig: SPA-Fallback auf `index.html` einrichten (Cloudflare/Netlify: `_redirects` mit `/* /index.html 200`; GitHub Pages: `404.html` = Kopie von `index.html`).

### Auf dem eigenen Handy nutzen
- **Expo Go** (kostenlos): `cd apps/mobile && npx expo start` → QR-Code scannen.
- **Android-APK** lokal bauen: `npx expo run:android --variant release` (Android Studio, kostenlos) oder EAS Build im Gratis-Kontingent.
- **iOS** auf dem eigenen Gerät: `npx expo run:ios --device` mit kostenlosem Apple-Account (Signatur 7 Tage gültig).

## Was würde Geld kosten? (alles aus)

| Baustein | Kosten | Status |
|---|---|---|
| KI-Coach / KI-Wochenbericht / Foto-Erkennung (Anthropic API) | nutzungsbasiert pro Anfrage | **aus** (`EXPO_PUBLIC_AI_ENABLED=false`, kein API-Key hinterlegt) |
| Supabase Pro | monatlich | nicht nötig |
| Apple App Store | Jahresgebühr Apple Developer Program | nur für Veröffentlichung im Store |
| Google Play Store | einmalige Registrierungsgebühr | nur für Veröffentlichung im Store |
| Eigene Domain | jährlich | optional, Subdomain der Hoster reicht |

Ohne `ANTHROPIC_API_KEY` beantworten die Edge Functions automatisch regelbasiert – selbst wenn jemand `EXPO_PUBLIC_AI_ENABLED=true` setzt, entstehen ohne Schlüssel keine KI-Kosten.

## Checkliste „0 €"
- [ ] `apps/mobile/.env` enthält **kein** `EXPO_PUBLIC_AI_ENABLED=true`
- [ ] Kein `ANTHROPIC_API_KEY` als Supabase-Secret gesetzt
- [ ] Supabase (falls genutzt) im Free-Plan, keine Kreditkarte hinterlegt
- [ ] Hosting im Gratis-Tarif (oder nur lokal / Expo Go)
