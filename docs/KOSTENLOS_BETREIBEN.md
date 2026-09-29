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

### 2. KI (Google Gemini, Gratis-Stufe)
**Testphase (ein gemeinsamer Schlüssel):** Auf [aistudio.google.com/apikey](https://aistudio.google.com/apikey) einen Schlüssel erstellen (kein Zahlungsmittel hinterlegen!) und als GitHub-Secret `GEMINI_API_KEY` eintragen. Harte Grenzen verhindern jede Überschreitung: pro Person/Tag (`AI_DAILY_LIMIT`, 40), alle zusammen/Tag (`AI_GLOBAL_DAILY_LIMIT`, 150) und eine automatische Sperre, sobald Google „Kontingent erschöpft“ meldet (bis zum Reset keine weiteren Anfragen).

**Später (mehr Nutzer):** Jede Person (du und deine Freunde) erstellt nach dem ersten Login in der App unter *Einstellungen → KI (Google Gemini)* einen Schlüssel auf [aistudio.google.com/apikey](https://aistudio.google.com/apikey) und fügt ihn ein (2 Minuten, keine Kreditkarte).

### 3. GitHub-Repository einstellen
*Settings → Secrets and variables → Actions*

| Typ | Name | Wert |
|---|---|---|
| Secret | `SUPABASE_ACCESS_TOKEN` | Access Token aus Schritt 1.3 |
| Secret | `SUPABASE_DB_PASSWORD` | DB-Passwort aus Schritt 1.1 |
| Secret | `GEMINI_API_KEY` | Testphase: gemeinsamer Gratis-Schlüssel aus Schritt 2 |
| Variable | `SUPABASE_PROJECT_REF` | Project Ref |
| Variable | `SUPABASE_URL` | Project URL |
| Variable | `SUPABASE_ANON_KEY` | Publishable/Anon Key (öffentlich, durch RLS geschützt) |
| Variable | `AI_ENABLED` | `true` (KI-Funktionen in der App anzeigen) |
| Variable | `AI_DAILY_LIMIT` | optional, KI-Anfragen pro Nutzer/Tag (Standard 40) |
| Variable | `AI_GLOBAL_DAILY_LIMIT` | optional, KI-Anfragen aller Nutzer/Tag (Standard 150) |

### 4. GitHub Pages einschalten
*Settings → Pages → Source: **GitHub Actions***.

### 5. Ausrollen
*Actions* → **Deploy backend (Supabase)** → *Run workflow*, danach **Deploy PWA (GitHub Pages)** → *Run workflow*.
Die App liegt dann unter `https://<github-user>.github.io/Gymolingo/`. Künftige Änderungen am Haupt-Branch werden automatisch ausgerollt.

## PWA installieren
Seite im Handy-Browser öffnen → **„Zum Home-Bildschirm“** (iPhone: Teilen-Symbol; Android: Menü ⋮). Die App startet danach wie eine normale App, im Vollbild und nach dem ersten Besuch auch offline.

## KI & Kosten (Google Gemini) – kostenlos per eigenem Schlüssel
- **Jede Person nutzt ihren eigenen Gemini-Schlüssel** aus Google AI Studio (Gratis-Stufe, ohne Kreditkarte). Ohne hinterlegtes Zahlungsmittel kann Google nichts berechnen – ist das Tageskontingent aufgebraucht, antwortet der kostenlose Regel-Coach.
- Warum eigene Schlüssel? Googles Bedingungen verlangen für Apps, die man **anderen** Nutzern im EWR/CH/UK bereitstellt, ein Abrechnungskonto. Mit eigenem Schlüssel nutzt jede Person Gemini für sich selbst; für Nutzer in der EU gelten laut Google dabei auch im Gratis-Kontingent die Datenschutzregeln der bezahlten Dienste (keine Nutzung zum Training).
- Der Schlüssel wird in der App eingegeben, von Google geprüft und **verschlüsselt** (AES-GCM, `AI_KEY_SECRET` nur auf dem Server) gespeichert – die App bekommt ihn nie zurück.
- Modelle (automatisch aktuell): **Flash-Lite** für Coach, Wochenbericht (großes Gratis-Kontingent), **Flash** für Foto-Analysen mit automatischem Rückfall auf Flash-Lite. Änderbar per Secret `GEMINI_MODEL` / `GEMINI_VISION_MODEL`.
- Tageslimit pro Person: `AI_DAILY_LIMIT` (Standard 40). Bei 4 Personen und 100–120 Anfragen/Tag sind das ~30 pro Person – deutlich unter dem Gratis-Kontingent von Flash-Lite.
- Fotos (Mahlzeit, KFA) werden verkleinert (max. 1024 px) übertragen; für Körperfotos fragt die App vorher um Einwilligung.
- Gemeinsamer Server-Schlüssel (`GEMINI_API_KEY`): für die Testphase zu zweit. Persönliche Schlüssel in der App haben Vorrang.
- **Sperren statt Kosten:** Tageslimits pro Person und gesamt; meldet Google ein erschöpftes Kontingent, wird das Modell für diesen Schlüssel bis zum Reset gesperrt (Minutenlimit: bis zur angegebenen Wartezeit). Danach antwortet der Coach ohne KI.

## Auf dem eigenen Handy ohne Store
- **PWA** (siehe oben) – kostenlos, iPhone und Android.
- **Expo Go**: `cd apps/mobile && npx expo start` → QR-Code scannen.
- **Android-APK** lokal: `npx expo run:android --variant release` (Android Studio, kostenlos).

## Was würde Geld kosten?

| Baustein | Kosten | Status |
|---|---|---|
| Gemeinsamer Gemini-Schlüssel mit Abrechnung | nutzungsbasiert | nicht nötig – eigene Gratis-Schlüssel pro Person |
| Google Play Store | einmalig 25 US-$ | nur für Store-Veröffentlichung |
| Apple App Store | 99 US-$ pro Jahr | nur für Store-Veröffentlichung |
| Supabase Pro | monatlich | nicht nötig |

## Checkliste „0 €"
- [ ] Gemini nur über eigene Gratis-Schlüssel (kein Zahlungsmittel in Google Cloud / AI Studio hinterlegt)
- [ ] Gemini-Schlüssel stammt aus einem Google-Projekt **ohne** Abrechnungskonto (AI Studio zeigt „Free“)
- [ ] Supabase im Free-Plan, keine Kreditkarte hinterlegt
- [ ] Hosting über GitHub Pages (öffentliches Repository)
