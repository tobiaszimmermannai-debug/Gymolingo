/**
 * KI-Coach edge function.
 *  - action "chat": answers a question using a factual snapshot of the user's data
 *  - action "weekly_report": interprets the deterministic weekly statistics
 * All numbers are computed by @gymolingo/core (bundled in _shared/core.js).
 * Without ANTHROPIC_API_KEY the same data is answered by the rule-based coach.
 */
import {
  answerOffline,
  buildCoachContext,
  buildCoachUserMessage,
  buildWeeklyReport,
  COACH_SYSTEM_PROMPT,
  renderWeeklyReportText,
  startOfWeek,
  WEEKLY_REPORT_PROMPT,
} from '../_shared/core.js';
import { anthropicClient, complete, describeError, MODEL } from '../_shared/anthropic.ts';
import { json, preflight } from '../_shared/http.ts';
import { loadUserData, userClient } from '../_shared/userData.ts';

const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: { heading: { type: 'string' }, body: { type: 'string' } },
        required: ['heading', 'body'],
        additionalProperties: false,
      },
    },
  },
  required: ['sections'],
  additionalProperties: false,
};

const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const sb = userClient(req);
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return json({ error: 'Nicht angemeldet' }, 401);

  let body: { action?: string; message?: string; history?: { role: string; content: string }[]; today?: string; weekStart?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Ungültige Anfrage' }, 400);
  }
  const today = isDate(body.today) ? body.today : new Date().toISOString().slice(0, 10);

  let data;
  try {
    data = await loadUserData(sb, auth.user.id, today);
  } catch (e) {
    return json({ error: `Daten konnten nicht geladen werden: ${e instanceof Error ? e.message : e}` }, 500);
  }
  if (!data) return json({ error: 'Profil nicht gefunden – bitte zuerst synchronisieren.' }, 404);
  const { data: customRows } = await sb.from('custom_exercises').select('*').eq('deleted', false);
  const custom = new Map((customRows ?? []).map((c: Record<string, unknown>) => [c.id as string, { ...c, increment_kg: Number(c.increment_kg) }]));
  const lookup = (id: string) => custom.get(id) as never;

  const client = anthropicClient();

  if (body.action === 'chat') {
    const message = String(body.message ?? '').trim().slice(0, 2000);
    if (!message) return json({ error: 'Leere Nachricht' }, 400);
    const ctx = buildCoachContext(data, today, lookup);
    if (!client) return json({ reply: answerOffline(ctx, message), source: 'rules' });
    const history = (body.history ?? [])
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .slice(-10)
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content.slice(0, 4000) }));
    while (history.length && history[0].role !== 'user') history.shift();
    try {
      const r = await complete(client, {
        system: COACH_SYSTEM_PROMPT,
        messages: [...history, { role: 'user', content: buildCoachUserMessage(ctx, message) }],
        effort: 'low',
      });
      if (r.refused || !r.text) return json({ reply: answerOffline(ctx, message), source: 'rules' });
      return json({ reply: r.text, source: 'ai', model: r.model });
    } catch (e) {
      const err = describeError(e);
      // graceful degradation: the rule-based coach still answers from the same data
      return json({ reply: answerOffline(ctx, message), source: 'rules', warning: err.message });
    }
  }

  if (body.action === 'weekly_report') {
    const weekStart = startOfWeek(isDate(body.weekStart) ? body.weekStart : today);
    const stats = buildWeeklyReport(data, weekStart, { lookup });
    const rules = renderWeeklyReportText(stats);
    if (!client) return json({ sections: rules.sections, title: rules.title, stats, source: 'rules' });
    try {
      const r = await complete(client, {
        system: `${COACH_SYSTEM_PROMPT}\n\n${WEEKLY_REPORT_PROMPT}`,
        messages: [{ role: 'user', content: `<wochenstatistik>\n${JSON.stringify(stats)}\n</wochenstatistik>\n\nNutzer: ${data.profile.display_name || 'Athlet'}, Ziel: ${data.profile.goal}.` }],
        effort: 'medium',
        jsonSchema: REPORT_SCHEMA,
      });
      if (r.refused || !r.text) return json({ sections: rules.sections, title: rules.title, stats, source: 'rules' });
      const parsed = JSON.parse(r.text) as { sections: { heading: string; body: string }[] };
      if (!Array.isArray(parsed.sections) || parsed.sections.length < 3) throw new Error('Unvollständiger Bericht');
      return json({ sections: parsed.sections, title: rules.title, stats, source: 'ai', model: r.model ?? MODEL });
    } catch (e) {
      return json({ sections: rules.sections, title: rules.title, stats, source: 'rules', warning: describeError(e).message });
    }
  }

  return json({ error: 'Unbekannte Aktion' }, 400);
});
