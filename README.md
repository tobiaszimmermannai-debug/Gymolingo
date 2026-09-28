# Gymolingo 💪

Gym-, Ernährungs- und Fortschritts-App mit persönlichem Coach – Training wie Strong/Hevy, Ernährung wie MyFitnessPal, Motivation wie Duolingo.
Mobile-first mit **Expo / React Native** (iOS, Android, Web), **local-first** Datenspeicherung und optionalem **Supabase**-Backend.

> **Kostenlos betreibbar:** Die App funktioniert vollständig ohne Server und ohne kostenpflichtige Dienste.
> Die KI (Anthropic API) ist standardmäßig **aus**; Coach und Wochenbericht rechnen dann direkt auf dem Gerät mit deinen echten Daten.
> Details: [docs/KOSTENLOS_BETREIBEN.md](docs/KOSTENLOS_BETREIBEN.md)

## Funktionen

| Bereich | Inhalt |
|---|---|
| **Home** | Tagesziele (Kalorien, Makros, Schritte), heutiges Training mit Zielgewichten, offene Aufgaben, Streaks, Wochen-Challenges, Coach |
| **Training** | Pläne (Generator + Editor), ~65 Übungen + eigene, Live-Training (Pause, Pausentimer, RIR, Satztypen), Vorbelegung mit letzten Werten, **progressive Überlastung** mit Begründung, Plateau-/Deload-Erkennung, PRs, Verlauf, e1RM- und Volumen-Statistiken |
| **Ernährung** | Deutsche Basis-Datenbank (~140 Lebensmittel), Open Food Facts (Suche + Barcode), eigene Lebensmittel, Rezepte, Mahlzeit wiederholen, Schnelleintrag, Korrektur von Schätzungen, persönliche Tipps |
| **Körper** | Gewicht (7-Tage-Schnitt, 30-Tage-Trend, Körperfett), Maße, private Fortschrittsbilder, abendlicher Check-in mit Schritten |
| **Progress** | 7T / 30T / 90T / 6M / 1J / Alles, Vergleich zur Vorperiode, Kraft, Volumen, Muskelgruppen, Kalorien, Protein, Schritte, Serien, Rekorde |
| **Motivation** | Reminder-Engine (Ruhezeiten, Tageslimit, Intensität, nicht beschämend), 6 Streaks inkl. Joker & Urlaub/Krankheit, XP, Level, 46 Abzeichen, Wochen-Challenges |
| **Coach** | Chat & automatischer Wochenbericht (7 Abschnitte, 3 Empfehlungen) – alle Zahlen deterministisch berechnet; KI optional |
| **Community** | Freunde, Ranglisten, private Challenges, Freundesprofile – Privatsphäre pro Datentyp, sensible Daten standardmäßig privat |
| **Datenschutz** | Local-first, RLS auf allen Tabellen, JSON-Export, Konto-/Datenlöschung |

## Projektstruktur

```
apps/mobile        Expo-App (Expo Router, TypeScript)
  src/app          Screens (Datei = Route)
  src/data         Local-first Store, Persistenz, Sync-Adapter, Aktionen
  src/features     Feature-Logik (Heute-Status, Coach, Community, Fotos, DSGVO …)
  src/ui           Designsystem (Dark Mode, Lime-Akzent, SVG-Charts)
packages/core      Reine Domänenlogik (getestet): Ziele, Progression, Streaks, XP,
                   Reminder, Wochenbericht, Coach-Kontext, Sync-Engine, Demo-Daten
supabase           Migrationen (Schema, RLS, Community-RPCs), pgTAP-Tests, Edge Functions (KI, optional)
e2e                Playwright-Tests gegen den Web-Build (lokal & mit Backend)
scripts            Test-/Build-/Seed-Hilfsskripte
```

## Schnellstart (lokal, ohne Server)

```bash
npm install
npm run web                 # Expo Dev Server im Browser
# oder auf dem Handy: cd apps/mobile && npx expo start  → QR-Code mit Expo Go scannen
```

## Mit Backend (Sync, Konto, Community)

```bash
npm run db:start            # lokales Supabase via Docker (kostenlos)
cp apps/mobile/.env.example apps/mobile/.env   # URL + Anon-Key aus `npx supabase status` eintragen
npm run db:seed-demo        # optional: Demo-Konto demo@gymolingo.dev / Demo12345! mit 12 Wochen Daten
npm run web
```

Für die Produktion: kostenloses Supabase-Projekt anlegen (Free-Plan), `npx supabase link` + `npx supabase db push`, dann URL/Anon-Key in `apps/mobile/.env` eintragen. Der Anon-Key ist öffentlich – alle Daten sind per Row-Level-Security geschützt.

## Tests

```bash
npm test                    # 101 Unit-Tests der Domänenlogik (Vitest)
npm run test:db             # pgTAP: RLS, Last-Write-Wins, Community & Privatsphäre (lokales Supabase nötig)
npm run build:web:test && npx playwright test --project=local        # E2E ohne Backend
npm run build:web:backend && npx playwright test --project=backend   # E2E mit lokalem Supabase
npm run typecheck
```

## Konfiguration

| Variable | Wo | Standard | Zweck |
|---|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `apps/mobile/.env` | leer → lokaler Modus | Konto, Sync, Community |
| `EXPO_PUBLIC_AI_ENABLED` | `apps/mobile/.env` | `false` | KI-Coach & Foto-Erkennung (**kostenpflichtig**, siehe unten) |
| `ANTHROPIC_API_KEY` | Supabase Secret | – | nur wenn KI aktiviert |
| `EXPO_PUBLIC_DEV_TOOLS` | Build-Umgebung | `false` | Demo-Daten-Button (nur Entwicklung/Tests) |

### Optional: KI aktivieren (verursacht API-Kosten)
```bash
npx supabase secrets set ANTHROPIC_API_KEY=...        # Schlüssel nie in die App!
npx supabase functions deploy coach meal-photo
echo "EXPO_PUBLIC_AI_ENABLED=true" >> apps/mobile/.env
```

## Technische Entscheidungen
- **Local-first:** jede Eingabe wird sofort lokal gespeichert (SQLite-KV nativ, IndexedDB im Web) und im Hintergrund synchronisiert – Training im Keller ohne Netz funktioniert.
- **Sync:** Outbox + Pull-Cursor, Last-Write-Wins auf `updated_at` (Client und DB-Trigger), Soft-Deletes.
- **Keine erfundenen Zahlen:** Alle Statistiken (Trends, e1RM, Bilanz, Streaks) kommen aus `packages/core`. Eine KI dürfte sie nur interpretieren.
- **Progression:** Doppelprogression mit RIR – erst Wiederholungen bis zum oberen Ende des Bereichs, dann kleinster realistischer Gewichtsschritt; Rückschritt erst bei wiederholter Unterperformance.

Weitere Details und aktueller Stand: [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md).
