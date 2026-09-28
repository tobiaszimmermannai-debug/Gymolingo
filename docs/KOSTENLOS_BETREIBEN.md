# Gymolingo kostenlos betreiben

Ziel: Entwicklung **und** Betrieb ohne laufende Kosten. Alles, was Geld kosten könnte, ist optional und standardmäßig aus.

## Standard (0 €)

| Baustein | Hinweis |
|---|---|
| App im **lokalen Modus** | Alle Daten auf dem Gerät. Training, Ernährung, Körper, Streaks, XP, Progress funktionieren komplett. |
| **Coach & Wochenbericht** | Regelbasiert auf dem Gerät, rechnet nur mit echten Daten. |
| **KFA aus Körpermaßen** | Navy-Formel (Hals, Taille, bei Frauen Hüfte) – offline. |
| **Reminder** | Lokale Benachrichtigungen, kein Push-Server. |
| **Open Food Facts** | Offene Datenbank (ODbL), Namensnennung in der App. |

## Einrichtung komplett im Browser (ca. 15 Minuten)

### 1. Supabase (Free-Plan) – Konto, Sync, Community
1. Auf [supabase.com](https://supabase.com) ein **neues Projekt** anlegen (Free, keine Kreditkarte). Region z. B. Frankfurt. **Datenbank-Passwort notieren.**
2. Werte notieren:
   - **Project Ref**: steht in der Projekt-URL `https://supabase.com/dashboard/project/<ref>`
   - **Project URL** und **Publishable/Anon Key**: *Project Settings → API Keys*
3. **Access Token** erstellen: *Account → Access Tokens → Generate new token*.
4. *Authentication → URL Configuration*: **Site URL** = `https://<github-user>.github.io/Gymolingo/`
5. Tipp: *Authentication → Sign In / Providers → Email*: „Confirm email“ ausschalten, solange nur du und Freunde die App nutzen – der Gratis-E-Mail-Versand von Supabase ist stark begrenzt.

### 2. Gemini-Schlüssel (optional, für KI)
Auf [aistudio.google.com](https://aistudio.google.com) → **Get API key** → Schlüssel erstellen. Siehe Abschnitt „KI & Kosten“ unten.

### 3. GitHub-Repository einstellen
*Settings → Secrets and variables → Actions*

| Typ | Name | Wert |
|---|---|---|
| Secret | `SUPABASE_ACCESS_TOKEN` | Access Token aus Schritt 1.3 |
| Secret | `SUPABASE_DB_PASSWORD` | DB-Passwort aus Schritt 1.1 |
| Secret | `GEMINI_API_KEY` | optional, aus Schritt 2 |
| Variable | `SUPABASE_PROJECT_REF` | Project Ref |
| Variable | `SUPABASE_URL` | Project URL |
| Variable | `SUPABASE_ANON_KEY` | Publishable/Anon Key (öffentlich, durch RLS geschützt) |
| Variable | `AI_ENABLED` | `true`, wenn KI genutzt werden soll |
| Variable | `AI_DAILY_LIMIT` | optional, KI-Anfragen pro Nutzer/Tag (Standard 30) |

### 4. GitHub Pages einschalten
*Settings → Pages → Source: **GitHub Actions***.

### 5. Ausrollen
*Actions* → **Deploy backend (Supabase)** → *Run workflow*, danach **Deploy PWA (GitHub Pages)** → *Run workflow*.
Die App liegt dann unter `https://<github-user>.github.io/Gymolingo/`. Künftige Änderungen am Haupt-Branch werden automatisch ausgerollt.

## PWA installieren
Seite im Handy-Browser öffnen → **„Zum Home-Bildschirm“** (iPhone: Teilen-Symbol; Android: Menü ⋮). Die App startet danach wie eine normale App, im Vollbild und nach dem ersten Besuch auch offline.

## KI & Kosten (Google Gemini)
- Die KI läuft **nur serverseitig** (Supabase Edge Functions). Der Schlüssel liegt als Secret auf Supabase, nie in der App.
- Modell: `gemini-flash-latest` (änderbar per Secret `GEMINI_MODEL`).
- Jeder Nutzer hat ein **Tageslimit** (`AI_DAILY_LIMIT`, Standard 30). Ist es erreicht oder das Gemini-Kontingent erschöpft, antwortet der kostenlose Regel-Coach.
- **Wichtig (Nutzungsbedingungen von Google, Stand Recherche 09/2026):** Die kostenlose Stufe darfst du für dich selbst nutzen. Wenn du die App **anderen Nutzern im EWR, der Schweiz oder UK** bereitstellst, verlangen die Gemini-Bedingungen einen Cloud-Projekt-**Abrechnungskonto** („Paid Services“). Dann fallen pro Anfrage kleine Kosten an → in der Google Cloud ein **Budget mit Benachrichtigung** setzen und `AI_DAILY_LIMIT` niedrig halten. Bitte vor der Veröffentlichung die aktuellen Bedingungen auf ai.google.dev prüfen.
- Fotos (Mahlzeit, KFA) werden verkleinert (max. 1024 px) übertragen; für Körperfotos fragt die App vorher um Einwilligung.

## Auf dem eigenen Handy ohne Store
- **PWA** (siehe oben) – kostenlos, iPhone und Android.
- **Expo Go**: `cd apps/mobile && npx expo start` → QR-Code scannen.
- **Android-APK** lokal: `npx expo run:android --variant release` (Android Studio, kostenlos).

## Was würde Geld kosten?

| Baustein | Kosten | Status |
|---|---|---|
| Gemini API für andere Nutzer (EWR/CH/UK) | nutzungsbasiert, sehr gering bei Flash-Modellen | aus, bis `AI_ENABLED=true` + Schlüssel |
| Google Play Store | einmalig 25 US-$ | nur für Store-Veröffentlichung |
| Apple App Store | 99 US-$ pro Jahr | nur für Store-Veröffentlichung |
| Supabase Pro | monatlich | nicht nötig |

## Checkliste „0 €"
- [ ] `AI_ENABLED` nicht gesetzt oder kein `GEMINI_API_KEY` → Regel-Coach
- [ ] Supabase im Free-Plan, keine Kreditkarte hinterlegt
- [ ] Hosting über GitHub Pages (öffentliches Repository)
