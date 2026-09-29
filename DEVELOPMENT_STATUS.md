# Gymolingo – Development Status

> Persistente Aufgabenliste des autonomen Entwicklungs-Loops.
> **Beim nächsten Durchlauf zuerst diese Datei und den Code lesen, dann bei „Nächste konkrete Aufgabe" weitermachen.**

Status-Legende: ⬜ offen · 🟨 in Arbeit · 🟩 implementiert · ✅ implementiert & getestet

Letzte Aktualisierung: 2026-09-30

## Architektur (Kurzfassung)

| Bereich | Entscheidung |
|---|---|
| App | Expo SDK 57, React Native 0.86, Expo Router, TypeScript, Web-Export für Tests |
| Domänenlogik | `packages/core` – reines TypeScript, deterministisch, Vitest (Targets, Progression, Streaks, XP, Reminder, Wochenbericht, Sync) |
| Daten | Local-first Zustand-Store (`apps/mobile/src/data`), persistiert in SQLite-KV (nativ) / IndexedDB (Web) |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions), RLS auf allen Tabellen |
| Sync | Outbox + Pull-Cursor (`server_updated_at`), Last-Write-Wins auf `updated_at` (Client + DB-Trigger), Soft-Deletes |
| KI | **Google Gemini** (REST-Client + Prompts in `packages/core/src/ai`, von App und Edge Functions geteilt). Standard: **Schlüssel auf dem Gerät** (Einstellungen → KI), App ruft Google direkt – 25 Anfragen/Tag/Person, Circuit Breaker bei 429. Optional Server-Modus (Edge Functions, `GEMINI_API_KEY`, Limits 25/75). Ohne KI: regelbasierter Coach auf dem Gerät. Statistiken immer aus `@gymolingo/core` |
| Lebensmittel | Eigene deutsche Basis-DB (~140 Einträge, Durchschnittswerte) + Open Food Facts (Suche, Barcode) + eigene Lebensmittel/Rezepte |
| Tests | Vitest (core), pgTAP via psql (`scripts/test-db.sh`), Playwright E2E gegen den Web-Build |

## Anforderungen & Status

### 1. Design & Navigation
- ✅ Premium Dark Mode, Anthrazit/Schwarz, Lime-Akzent, Inter-Typografie
- ✅ Karten, Fortschrittsringe, Balken, interaktive SVG-Diagramme (Tooltip per Tippen/Ziehen)
- ✅ Mobile-first, max. Inhaltsbreite für Tablet/Web
- ✅ App-Icon, adaptives Android-Icon, Splash, Favicon, PWA-Icons (`node scripts/gen-icons.mjs` aus `assets-src/mark.svg`)
- ✅ PWA: Manifest, Service Worker (Offline-Start), deutsches `index.html` (`apps/mobile/public`)
- ✅ Tab-Navigation: Home, Training, Nutrition, Progress, Community
- 🟩 Animationen: dezente Press-States/Haptik; keine aufwendigen Übergangsanimationen

### 2. Profil & Onboarding
- ✅ Onboarding (Alter, Geschlecht, Größe, Gewicht, Erfahrung, Ziel, Häufigkeit, Plan-Art, Equipment, Alltag, Ernährungsform, Allergien, Ziele)
- ✅ Berechnung Kalorien/Makros (Mifflin-St Jeor, Aktivitätsfaktor, Zielanpassung) mit Erklärung, editierbar
- ✅ Startplan-Generator passend zu Frequenz/Equipment/Ziel
- ✅ Profil & Ziele nachträglich bearbeiten, Neuberechnung
- ✅ Registrierung/Login (Supabase Auth, E-Mail+Passwort), Gast → Konto-Übernahme, Wiederherstellung auf Zweitgerät (E2E gegen lokales Supabase)

### 3. Gym Tracking
- ✅ Pläne erstellen/bearbeiten (Tage, Übungen, Sätze, Wdh.-Bereich, RIR, Pause, Gewichtsschritt, Reihenfolge, fester Wochentag)
- ✅ Übungsdatenbank (~65 Übungen, deutsch) + eigene Übungen
- ✅ Live-Training: Start/Pause/Fortsetzen/Abschließen/Verwerfen, Sätze, Gewicht, Wdh., RIR, Satztypen (Aufwärm/Drop/Failure), Pausentimer
- ✅ Vorbelegung mit letzten Gewichten/Wdh.
- ✅ Progressive Überlastung (Double Progression, RIR-bewusst, Gewichtsschritte, Plateau/Deload, Begründung)
- ✅ Verlauf, Detailansicht, Bearbeiten abgeschlossener Sätze, PRs (Gewicht, e1RM, Wdh.)
- ✅ Statistiken: e1RM-Verlauf, Volumen, Sätze/Muskelgruppe

### 3b. Ausdauer & EMS
- ✅ Spazieren, Joggen, Laufen, EMS-Training (Training-Tab → „Ausdauer & EMS“): Dauer, Distanz (optional), Stufe Leicht/Mittel/Intensiv; kcal nach MET (Compendium 2011, Tempo aus Distanz) bzw. EMS-Studienwerten (MET 3,5/4,5/5,5); Pace & km/h; eigener Wert (Uhr) überschreibbar
- ✅ Zählt für Trainings-Serie/Wochenquote (Joggen/Laufen/EMS, nicht Spazieren), XP, Tagesbriefing, Progress, Wochenbericht, Coach-Kontext; optional „Verbrauch zum Kalorienziel addieren“ (als Kohlenhydrate)

### 4. Nutrition
- ✅ Suche (deutsche Basis-DB, eigene, Rezepte, Open Food Facts), Portionen, Mahlzeiten
- ✅ Kalorien/Makros/Ballaststoffe, verbleibend, Tages- & Wochenverlauf
- ✅ Eigene Lebensmittel (Plausibilitätsprüfung), Rezepte, Mahlzeit wiederholen, Schnelleintrag
- 🟩 Barcode-Scanner (expo-camera, EAN/UPC) + manuelle Eingabe; OFF-Abfrage ist in dieser Sandbox netzwerkseitig blockiert → nur mit Mocks getestet; ODbL-Namensnennung in App
- 🟩 KI-Foto-Erkennung (Gemini): UI + Edge Function `meal-photo`, Bild auf 1024 px verkleinert; gegen simulierte Gemini-API getestet (`npm run test:edge`), mit echtem Key nicht getestet
- ✅ Schätzungen gekennzeichnet (~) und korrigierbar
- ✅ Individuelle Ernährungstipps aus echten Daten

### 5. Gewicht, Schritte, Body
- ✅ Schnelle Gewichtseingabe, Tageswert, 7-Tage-Schnitt, 30-Tage-Trend, Körperfett
- ✅ Körpermaße mit Verlauf
- ✅ KFA-Schätzung aus Fotos (KI, startet automatisch nach neuem Foto; Einwilligung, Spanne, Sicherheit) + Navy-Formel als Alternative; Übernahme als markierte Schätzung (~)
- ✅ Fortschrittsbilder (lokal + privater Storage-Bucket, Cloud-Symbol nach Upload) – E2E: Upload, Anzeige auf Zweitgerät per Signed URL, nicht öffentlich, Löschung mit Konto
- ✅ Abendlicher Check-in mit Schrittzahl (manuell)
- 🟩 Apple Health / Health Connect: Abstraktion, Adapter, Einstellungs-Schalter vorbereitet (`src/lib/health`), Aktivierung siehe `docs/HEALTH_INTEGRATION.md` (benötigt Dev-Build, nicht getestet)

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
- ✅ Privatsphäre-Einstellungen: **standardmäßig nur Streaks und „zuletzt online“ geteilt** (Nutzerwunsch), alles andere opt-in; unveränderte alte Einstellungen werden einmalig umgestellt
- ✅ Community-Screens (Benutzername, Suche, Anfragen, Freundesliste, Freundesprofil, Ranglisten, private Challenges) – E2E mit Backend inkl. Privatsphäre-Durchsetzung

### 9. KI-Coach
- ✅ Deterministische Coach-Statistiken + Offline-Coach (regelbasiert) in core
- ✅ Wochenbericht (7 Abschnitte, 3 Empfehlungen) regelbasiert in core
- ✅ Tagesbriefing auf Home (heutiger Fokus, offene Kalorien/Protein, gefährdete Serie, Tester zuletzt online + Status)
- ✅ Fun-Status-Meldungen (Nutzerwunsch): 26 Sport-Meme-/Tech-Sprüche („🥤 Monster Zero White intus – Pump incoming“) oder eigener Text (Emoji + max. 60 Zeichen), Dauer Heute/3 Tage/unbegrenzt; Chip auf Home, Anzeige bei Freunden im Tagesbriefing und in der Community-Freundesliste; lokal gespeichert, bei Konto per `set_status()` synchronisiert
- ✅ Coach-Chat (Offline-Coach kennt heutigen Plan) + Wochenbericht-Screen, automatischer Bericht 1×/Tag, Live-Neuberechnung, Leerzustand für Wochen ohne Daten (öffnet nie eine Woche vor dem Start)
- ✅ Edge Functions `coach`, `meal-photo`, `body-fat`, `ai-key` auf Gemini (persönliche Schlüssel, JSON-Schema, Safety/429-Fallback, Flash→Flash-Lite, Tageslimit) – 38 Checks gegen lokales Supabase + Mock-Gemini (inkl. Sperre bei Kontingent-Ende)

### 10. Progress-Dashboard
- ✅ Zeiträume 7T/30T/90T/6M/1J/Alles, Vergleich zur Vorperiode, Gewicht, Kraft, Volumen, Muskelgruppen, Kalorien, Protein, Schritte, Serien, PRs

### 11. Technik
- ✅ Monorepo, TypeScript strict, Supabase-Migrationen, RLS, keine API-Keys im Frontend
- ✅ Offline-fähige Erfassung, LWW-Sync-Engine (getestet)
- ✅ Sync gegen echtes Supabase (lokal): Zwei-Geräte-Sync, Offline-Erfassung + späterer Sync (früher Abbruch, Timeouts, onLine-Check)
- ✅ Performance mit 2 Jahren Daten (Streaks/XP/Bericht < 35 ms, `useDeferredValue` auf Home)
- ✅ DSGVO: Export (JSON), Konto-/Datenlöschung, Privacy by default

### 12. Tests
- ✅ core: 134 Unit-Tests (Vitest, inkl. Gemini-Client/Circuit Breaker, Ausdauer/EMS, Status)
- ✅ DB: 69 pgTAP-Assertions (RLS, LWW, Community, Privatsphäre, KI-Limits, KI-Schlüssel, Sperren, Online-Status, Gruppen-Schlüssel, Status); `setup.sql` (11 Migrationen)
- ✅ Edge Functions: 38 Checks (`npm run test:edge`)
- ✅ E2E lokal (15, inkl. Status-Meldungen, Lauf/EMS, inkl. KFA Navy und KI mit Geräte-Schlüssel gegen simuliertes Google: Coach, KFA aus Foto, Zähler, Sperre): Onboarding, Training+Progression+PR, Nutrition, Körper/Check-in/Progress/Erfolge/Settings/Export/Löschen, Coach, PWA-Offline-Start
- ✅ E2E Backend (5): Registrierung/Wiederherstellung/Zwei-Geräte-Sync, Freunde/Privatsphäre-Voreinstellung/Challenges + „zuletzt online“ + Status + Gruppen-Schlüssel (räumt Freigabe am Ende auf), Kontolöschung, Offline-Sync, Fortschrittsbilder
- ✅ GitHub Actions: CI (Typecheck + Unit-Tests), Deploy PWA (GitHub Pages, Unterordner `/Gymolingo`), Deploy Backend (Supabase, nur wenn konfiguriert)

## Fehlende API-Schlüssel / Konfiguration

| Schlüssel | Wo | Wofür |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `apps/mobile/.env` | Konto, Sync, Community (ohne: lokaler Modus). Free-Plan reicht |
| `EXPO_PUBLIC_AI_ENABLED` | `apps/mobile/.env` | `true` schaltet KI-Funktionen ein – **kostenpflichtig**, Standard `false` |
| Eigener Gemini-Schlüssel | App → Einstellungen → KI (pro Person) | KI-Coach, Wochenbericht, Mahlzeitfoto, KFA aus Fotos (ohne: regelbasierter Coach) |
| `AI_KEY_SECRET` | Supabase Secret (vom Deploy-Workflow erzeugt) | Verschlüsselung der persönlichen Schlüssel |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, Variablen `SUPABASE_PROJECT_REF/URL/ANON_KEY` | GitHub Actions | Deploy von Backend und PWA (siehe `docs/KOSTENLOS_BETREIBEN.md`) |
| EAS `projectId` | `app.json` | nur für Server-Push-Tokens (optional) |

## Bekannte Einschränkungen / Fehler
- Sandbox-Netzwerk blockiert `world.openfoodfacts.org` und `docs.expo.dev` → OFF nur per Unit-Test (Mock) verifiziert.
- Native Builds (iOS/Android) konnten in der Sandbox nicht erzeugt werden; getestet wird der Web-Build. Native-spezifische Module (Kamera, Notifications, SQLite-KV, FileSystem) sind typgeprüft.
- `supabase test db` kann das pg_prove-Image nicht laden → `scripts/test-db.sh` führt dieselben pgTAP-Dateien via psql aus.

## Entscheidungen
- Gemini-Schlüssel: Google gibt seit 2026 „AQ.“-Auth-Keys aus, alte „AIza“-Keys werden seit 09/2026 abgelehnt → Format-Prüfung akzeptiert beide (`looksLikeGeminiKey`), eingefügter Text wird bereinigt, Google-Fehlertext wird verständlich angezeigt; Prüfung per `models?pageSize=1`.
- **0 € Betrieb** (Nutzerwunsch): KI standardmäßig aus, alles läuft lokal; Supabase optional im Free-Plan. Siehe `docs/KOSTENLOS_BETREIBEN.md`.
- **KI = Google Gemini, kostenlos per „Bring your own key“** (Nutzerwunsch: 4 Personen, 100–120 Anfragen/Tag, 0 €). Grund: Google verlangt für Apps, die anderen EWR-Nutzern bereitgestellt werden, ein Abrechnungskonto; mit eigenem Schlüssel nutzt jede Person die Gratis-Stufe selbst. Kein Zahlungsmittel hinterlegt → keine Kosten möglich.
- Testphase (Nutzerwunsch): bis zu 3 Tester mit **demselben Gratis-Schlüssel**, eingetragen in der App (kein GitHub/Server nötig); 25 Anfragen/Person/Tag; Sperre sofort bei Google-429 (Tageskontingent bis Reset, Minutenlimit für RetryInfo-Dauer). Server-Modus: 25/Person, 75 gesamt (`ai_usage_global`), `ai_model_blocks`.
- Einrichtung vereinfacht (Nutzer kam mit Secrets/Tokens nicht zurecht): `supabase/setup.sql` (aus Migrationen generiert, CI prüft Aktualität) im SQL Editor ausführen; öffentliche URL/Key in `config/backend.env`; Pages 1 Klick.
- **Ein Gemini-Schlüssel für alle** (Nutzerwunsch): Besitzer gibt seinen Geräte-Schlüssel frei (`shared_ai_key`, `set_shared_ai_key`/`get_shared_ai_key`), **alle angemeldeten Nutzer** erhalten ihn automatisch (Limit 25/Person/Tag bleibt; Migration 08).
- Status-Meldungen: `profiles.status_emoji/status_text/status_until`, `set_status()` (kürzt auf 80 Zeichen), `friends_activity()` liefert aktive Status (unabhängig von `share_online_status` – der Status ist bewusst gesetzt). Migration idempotent; Update für bestehende Projekte: `supabase/updates/2026-09-30-status.sql`. Ohne Update speichert die App lokal und meldet „Datenbank-Update nötig“.
- „Zuletzt online“: `profiles.last_seen_at`, `touch_last_seen()`, `friends_activity()` (nur Freunde, abschaltbar via `share_online_status`), Anzeige im **Tagesbriefing** auf Home.
- Edge Functions prüfen den Nutzer selbst (`verify_jwt = false`, `auth.getUser`) – kompatibel mit neuen Supabase-Signaturschlüsseln; `apikey` wird aus der Anfrage übernommen.
- App-Icon blau (Verlauf #3B82F6→#1D4ED8, weißes G); App-Oberfläche bleibt Anthrazit/Lime.
- KFA: primär aus Fotos (startet automatisch nach neuem Foto, Einwilligung einmalig), Navy-Formel als Alternative ohne KI.
- Hosting der PWA auf GitHub Pages (Repo öffentlich) mit `EXPO_BASE_URL=/Gymolingo`; `scripts/pwa-base.mjs` passt index.html/Manifest an und legt 404.html als SPA-Fallback an.
- Trends/PRs/Plateaus mit reinem Epley-e1RM; RIR-bereinigter e1RM nur für die Größe von Gewichtssprüngen. Kraftveränderung = Median der Sitzungsbestwerte.
- Wochenbericht wird live aus den Daten berechnet; gespeichert nur, wenn die Woche Daten hat; KI-Text bleibt, bis er erzwungen neu erzeugt wird.
- Web persistiert sofort (IndexedDB), nativ mit 150 ms Debounce + Flush bei App-Wechsel.
- Demo-Daten (`generateDemoData`, 12 Wochen, deterministisch) für visuelle QA: `EXPO_PUBLIC_DEV_TOOLS=true` oder `npm run db:seed-demo`.

## Letzter erfolgreich getesteter Stand
- Stand „Status-Meldungen": core 134/134, DB 69/69, E2E lokal 15/15, E2E Backend 5/5, Typecheck grün (Edge unverändert 38/38).

## Nächste konkrete Aufgabe
1. **Supabase live eingerichtet** (Deploy-Check 29.09.: alle Tabellen/Funktionen vorhanden, E-Mail-Bestätigung aus). Nutzer muss `supabase/updates/2026-09-30-status.sql` einmal ausführen (Deploy-Check meldet „Status-Meldungen“). Nächstes: Live-Test mit echten Konten (Registrierung, Sync, Freunde, zuletzt online, Gruppen-KI-Schlüssel) – Rückmeldungen des Nutzers abarbeiten.
2. Visuelle QA fortsetzen: `VISUAL=1 SHOT_DIR=… npx playwright test e2e/visual.spec.ts --project=local` (Demo-Daten, Leerzustände + langer Name, Tablet) – zuletzt geprüft: Home, Training, Progress, Bericht, Community.
3. Optional: Server-Push (Expo Push) – nur falls kostenlos gewünscht; lokale Notifications decken den Bedarf.
