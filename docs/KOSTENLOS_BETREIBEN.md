# Gymolingo kostenlos betreiben

Ziel: Entwicklung **und** Betrieb ohne laufende Kosten. Nichts davon braucht eine Kreditkarte.

## Standard (0 €)

| Baustein | Hinweis |
|---|---|
| App im **lokalen Modus** | Alle Daten auf dem Gerät. Training, Ernährung, Körper, Streaks, XP, Progress funktionieren komplett. |
| **Coach & Wochenbericht** | Regelbasiert auf dem Gerät, rechnet nur mit echten Daten. |
| **KI (Google Gemini)** | Gratis-Kontingent: Schlüssel wird in der App eingetragen (siehe unten). |
| **KFA aus Körpermaßen** | Navy-Formel – offline. |
| **Reminder** | Lokale Benachrichtigungen, kein Push-Server. |
| **Open Food Facts** | Offene Datenbank (ODbL), Namensnennung in der App. |

## Einrichtung (ca. 10 Minuten, alles im Browser)

### 1. App online stellen (GitHub Pages, 1 Klick)
Repository → *Settings → Pages* → Source: **GitHub Actions**. Danach *Actions → Deploy PWA → Run workflow*.
Die App liegt dann unter `https://<github-user>.github.io/Gymolingo/` – auf dem Handy öffnen → „Zum Home-Bildschirm“.

### 2. KI: Gemini-Schlüssel in der App
[aistudio.google.com/apikey](https://aistudio.google.com/apikey) → Schlüssel erstellen (kein Zahlungsmittel hinterlegen) → in der App *Einstellungen → KI (Google Gemini)* einfügen. Alle Tester dürfen **denselben Schlüssel** eintragen.
- Der Schlüssel liegt nur auf dem jeweiligen Gerät, die App ruft Google direkt auf – kein Server nötig.
- **Harte Grenzen:** 25 KI-Anfragen pro Person und Tag; meldet Google ein erschöpftes Kontingent, sperrt die App die KI sofort bis zum Reset. Ohne Zahlungsmittel kann Google nichts berechnen.
- Modelle: Flash-Lite für Coach/Wochenbericht (großes Gratis-Kontingent), Flash für Fotos mit Rückfall auf Flash-Lite.

### 3. Supabase (Free) – Konten, Freunde, „zuletzt online“, Sync
1. [supabase.com/dashboard/new](https://supabase.com/dashboard/new): Projekt anlegen (Free, Region Frankfurt).
2. *SQL Editor → New query*: Inhalt von [`supabase/setup.sql`](../supabase/setup.sql) einfügen → **Run** (einmalig).
3. *Authentication → Sign In / Providers → Email*: „Confirm email“ ausschalten.
4. *Project Settings → API Keys*: **Project URL** und **Publishable key** in [`config/backend.env`](../config/backend.env) eintragen (beide öffentlich, durch Row-Level-Security geschützt) – oder Claude schicken. Beim nächsten Push wird die Web-App automatisch mit Backend gebaut.
5. *Authentication → URL Configuration*: Site URL = Adresse der Web-App.

Keine GitHub-Secrets, keine Access Tokens, keine Kommandozeile nötig.

## Optional: Server-Modus für die KI
Statt Schlüssel in der App: gemeinsamer Server-Schlüssel über die Edge Functions (`coach`, `meal-photo`, `body-fat`, `ai-key`).
Workflow *Deploy backend (Supabase)* mit Secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `GEMINI_API_KEY` und Variable `SUPABASE_PROJECT_REF`. Grenzen: `AI_DAILY_LIMIT` (25 pro Person), `AI_GLOBAL_DAILY_LIMIT` (75 gesamt), automatische Sperre bei Kontingent-Ende.

## Hinweis zu den Gemini-Bedingungen
Googles Bedingungen verlangen für Apps, die man **anderen** Nutzern im EWR/CH/UK bereitstellt, ein Abrechnungskonto. Für einen kleinen privaten Test ist das eure Entscheidung; für eine Veröffentlichung sollte jede Person ihren eigenen Schlüssel eintragen (geht in derselben Einstellung).

## Was würde Geld kosten?

| Baustein | Kosten | Status |
|---|---|---|
| Google Play Store | einmalig 25 US-$ | nicht geplant |
| Apple App Store | 99 US-$ pro Jahr | nicht geplant |
| Gemini mit Abrechnungskonto | nutzungsbasiert | nicht nötig |
| Supabase Pro | monatlich | nicht nötig |

## Checkliste „0 €"
- [ ] Gemini-Schlüssel ohne Abrechnungskonto (AI Studio zeigt „Free“)
- [ ] Supabase im Free-Plan, keine Kreditkarte hinterlegt
- [ ] Hosting über GitHub Pages (öffentliches Repository)
