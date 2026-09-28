# Gymolingo – Development Status

> Persistente Aufgabenliste des autonomen Entwicklungs-Loops.
> **Beim nächsten Durchlauf zuerst diese Datei und den Code lesen, dann bei „Nächste konkrete Aufgabe" weitermachen.**

Status-Legende: ⬜ offen · 🟨 in Arbeit · 🟩 implementiert · ✅ implementiert & getestet

Letzte Aktualisierung: 2026-09-28

## Architektur (Kurzfassung)

| Bereich | Entscheidung |
|---|---|
| App | Expo SDK 57, React Native 0.86, Expo Router, TypeScript, Web-Export für Tests |
| Domänenlogik | `packages/core` – reines TypeScript, deterministisch, Vitest (Targets, Progression, Streaks, XP, Reminder, Wochenbericht, Sync) |
| Daten | Local-first Zustand-Store (`apps/mobile/src/data`), persistiert in SQLite-KV (nativ) / IndexedDB (Web) |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions), RLS auf allen Tabellen |
| Sync | Outbox + Pull-Cursor (`server_updated_at`), Last-Write-Wins auf `updated_at` (Client + DB-Trigger), Soft-Deletes |
| KI | Nur serverseitig (Edge Functions, `ANTHROPIC_API_KEY` als Secret). Statistiken kommen aus `@gymolingo/core`, das Modell interpretiert nur |
| Lebensmittel | Eigene deutsche Basis-DB (~140 Einträge, Durchschnittswerte) + Open Food Facts (Suche, Barcode) + eigene Lebensmittel/Rezepte |
| Tests | Vitest (core), pgTAP via psql (`scripts/test-db.sh`), Playwright E2E gegen den Web-Build |

## Anforderungen & Status

### 1. Design & Navigation
- ✅ Premium Dark Mode, Anthrazit/Schwarz, Lime-Akzent, Inter-Typografie
- ✅ Karten, Fortschrittsringe, Balken, interaktive SVG-Diagramme (Tooltip per Tippen/Ziehen)
- ✅ Mobile-first, max. Inhaltsbreite für Tablet/Web
- ✅ Tab-Navigation: Home, Training, Nutrition, Progress, Community
- 🟩 Animationen: dezente Press-States/Haptik; keine aufwendigen Übergangsanimationen

### 2. Profil & Onboarding
- ✅ Onboarding (Alter, Geschlecht, Größe, Gewicht, Erfahrung, Ziel, Häufigkeit, Plan-Art, Equipment, Alltag, Ernährungsform, Allergien, Ziele)
- ✅ Berechnung Kalorien/Makros (Mifflin-St Jeor, Aktivitätsfaktor, Zielanpassung) mit Erklärung, editierbar
- ✅ Startplan-Generator passend zu Frequenz/Equipment/Ziel
- ✅ Profil & Ziele nachträglich bearbeiten, Neuberechnung
- 🟩 Registrierung/Login (Supabase Auth, E-Mail+Passwort), Gast → Konto-Übernahme – E2E gegen lokales Supabase **offen**

### 3. Gym Tracking
- ✅ Pläne erstellen/bearbeiten (Tage, Übungen, Sätze, Wdh.-Bereich, RIR, Pause, Gewichtsschritt, Reihenfolge, fester Wochentag)
- ✅ Übungsdatenbank (~65 Übungen, deutsch) + eigene Übungen
- ✅ Live-Training: Start/Pause/Fortsetzen/Abschließen/Verwerfen, Sätze, Gewicht, Wdh., RIR, Satztypen (Aufwärm/Drop/Failure), Pausentimer
- ✅ Vorbelegung mit letzten Gewichten/Wdh.
- ✅ Progressive Überlastung (Double Progression, RIR-bewusst, Gewichtsschritte, Plateau/Deload, Begründung)
- ✅ Verlauf, Detailansicht, Bearbeiten abgeschlossener Sätze, PRs (Gewicht, e1RM, Wdh.)
- ✅ Statistiken: e1RM-Verlauf, Volumen, Sätze/Muskelgruppe

### 4. Nutrition
- ✅ Suche (deutsche Basis-DB, eigene, Rezepte, Open Food Facts), Portionen, Mahlzeiten
- ✅ Kalorien/Makros/Ballaststoffe, verbleibend, Tages- & Wochenverlauf
- ✅ Eigene Lebensmittel (Plausibilitätsprüfung), Rezepte, Mahlzeit wiederholen, Schnelleintrag
- 🟩 Barcode-Scanner (expo-camera, EAN/UPC) + manuelle Eingabe; OFF-Abfrage ist in dieser Sandbox netzwerkseitig blockiert → nur mit Mocks getestet
- 🟩 KI-Foto-Erkennung: UI fertig, Edge Function **in Arbeit**
- ✅ Schätzungen gekennzeichnet (~) und korrigierbar
- ✅ Individuelle Ernährungstipps aus echten Daten

### 5. Gewicht, Schritte, Body
- ✅ Schnelle Gewichtseingabe, Tageswert, 7-Tage-Schnitt, 30-Tage-Trend, Körperfett
- ✅ Körpermaße mit Verlauf
- 🟩 Fortschrittsbilder (lokal + privater Storage-Bucket) – Upload gegen Supabase noch nicht E2E getestet
- ✅ Abendlicher Check-in mit Schrittzahl (manuell)
- 🟩 Apple Health / Health Connect: Abstraktion + Adapter vorbereitet (`src/lib/health`), Aktivierung siehe `docs/HEALTH_INTEGRATION.md` (benötigt Dev-Build)

### 6. Reminder & Motivation
- ✅ Reminder-Engine (core, getestet): Morgen, Gewicht, Ernährung, Vor/Nach Training, Protein, Abend-Eskalation, Wochenbericht
- ✅ Ruhezeiten, Tageslimit, Intensität (sanft/normal/hartnäckig), nicht beschämende Texte
- 🟩 Lokale Push-Notifications (expo-notifications) + Web-Notification-API; In-App-Aufgabenliste auf Home
- ⬜ Server-Push (Expo Push Service) für Nutzer, die die App tagelang nicht öffnen (optional)

### 7. Streaks & Gamification
- ✅ Separate Streaks (Training plan-basiert, Ernährung, Protein, Schritte, Check-in, Gewicht)
- ✅ Joker (2/Monat), Pausen für Urlaub/Krankheit
- ✅ XP, Level, Badges (inkl. 7/30/60/100-Tage-Meilensteine), wöchentliche Challenges, PRs

### 8. Community
- ✅ DB: Freundschaften, Challenges, Ranglisten, Freundesprofil mit Privatsphäre-Filter (pgTAP getestet)
- ✅ Privatsphäre-Einstellungen (Gewicht/KFA/Ernährung/Fotos standardmäßig privat)
- ⬜ Community-Screens (Suche, Anfragen, Freundesliste, Profil, Rangliste, private Challenges) – **nächste Aufgabe nach KI-Coach**

### 9. KI-Coach
- ✅ Deterministische Coach-Statistiken + Offline-Coach (regelbasiert) in core
- ✅ Wochenbericht (7 Abschnitte, 3 Empfehlungen) regelbasiert in core
- 🟨 Edge Functions `coach` (Chat + Wochenbericht) und `meal-photo` mit Anthropic API
- ⬜ Coach-Chat-Screen + Wochenbericht-Screen

### 10. Progress-Dashboard
- ✅ Zeiträume 7T/30T/90T/6M/1J/Alles, Vergleich zur Vorperiode, Gewicht, Kraft, Volumen, Muskelgruppen, Kalorien, Protein, Schritte, Serien, PRs

### 11. Technik
- ✅ Monorepo, TypeScript strict, Supabase-Migrationen, RLS, keine API-Keys im Frontend
- ✅ Offline-fähige Erfassung, LWW-Sync-Engine (getestet)
- 🟩 Sync gegen echtes Supabase (lokal) – E2E **offen**
- ✅ DSGVO: Export (JSON), Konto-/Datenlöschung, Privacy by default

### 12. Tests
- ✅ core: 96 Unit-Tests (Vitest)
- ✅ DB: 30 pgTAP-Assertions (RLS, LWW, Community, Privatsphäre)
- ✅ E2E (Playwright, Web-Build): Onboarding, Training+Progression+PR, Nutrition, Körper/Check-in/Progress/Erfolge/Settings/Export/Löschen
- ⬜ E2E mit Backend: Registrierung, Login, Sync zwischen zwei Browsern, Freunde

## Fehlende API-Schlüssel / Konfiguration

| Schlüssel | Wo | Wofür |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `apps/mobile/.env` | Konto, Sync, Community, KI (ohne: lokaler Modus) |
| `ANTHROPIC_API_KEY` | Supabase Secret (`supabase secrets set`) | KI-Coach, KI-Wochenbericht, Foto-Erkennung (ohne: regelbasierter Coach) |
| EAS `projectId` | `app.json` | nur für Server-Push-Tokens (optional) |

## Bekannte Einschränkungen / Fehler
- Sandbox-Netzwerk blockiert `world.openfoodfacts.org` und `docs.expo.dev` → OFF nur per Unit-Test (Mock) verifiziert.
- Native Builds (iOS/Android) konnten in der Sandbox nicht erzeugt werden; getestet wird der Web-Build. Native-spezifische Module (Kamera, Notifications, SQLite-KV, FileSystem) sind typgeprüft.
- `supabase test db` kann das pg_prove-Image nicht laden → `scripts/test-db.sh` führt dieselben pgTAP-Dateien via psql aus.

## Letzter erfolgreich getesteter Stand
- Commit nach „Add body tracking, check-in, progress dashboard …": core 96/96, DB 30/30, E2E 11/11 grün.

## Nächste konkrete Aufgabe
1. `claude-api`-Referenz laden, Edge Functions `coach` + `meal-photo` implementieren (Deno), `packages/core` per esbuild nach `supabase/functions/_shared/core.js` bündeln.
2. Coach-Screens (`/coach`, `/coach/report`) mit Fallback auf regelbasierten Coach.
3. Community-Screens.
4. Web-Build mit lokalem Supabase: E2E für Registrierung/Login/Sync/Freunde.
