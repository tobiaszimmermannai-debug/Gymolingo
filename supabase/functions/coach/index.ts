/**
 * KI-Coach edge function.
 *  - action "chat": answers a question using a factual snapshot of the user's data
 *  - action "weekly_report": interprets the deterministic weekly statistics
 * All numbers are computed by @gymolingo/core (bundled in _shared/core.mjs).
 * Without a Gemini key (personal or shared) or when the daily AI limit is reached,
 * the same data is answered by the rule-based coach.
 */
import { aiCoachReply, aiWeeklyReportSections, answerOffline, buildCoachContext, buildWeeklyReport, renderWeeklyReportText, startOfWeek } from '../_shared/core.mjs';
import { describeError } from '../_shared/gemini.ts';
import { aiRun } from '../_shared/guard.ts';
import { resolveGeminiKey } from '../_shared/userKey.ts';
import { consumeAiQuota } from '../_shared/quota.ts';
import { json, preflight } from '../_shared/http.ts';
import { loadUserData, userClient } from '../_shared/userData.ts';

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

  const key = await resolveGeminiKey(sb, auth.user.id);
  const aiAllowed = async () => !!key && (await consumeAiQuota(sb).catch(() => false));

  if (body.action === 'chat') {
    const message = String(body.message ?? '').trim().slice(0, 2000);
    if (!message) return json({ error: 'Leere Nachricht' }, 400);
    const ctx = buildCoachContext(data, today, lookup);
    if (!(await aiAllowed())) return json({ reply: answerOffline(ctx, message), source: 'rules' });
    try {
      const r = await aiCoachReply(await aiRun(sb, key!), ctx, message, body.history ?? []);
      if (!r) return json({ reply: answerOffline(ctx, message), source: 'rules' });
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
    if (!(await aiAllowed())) return json({ sections: rules.sections, title: rules.title, stats, source: 'rules' });
    try {
      const r = await aiWeeklyReportSections(await aiRun(sb, key!), stats, data.profile.display_name, data.profile.goal);
      if (!r) return json({ sections: rules.sections, title: rules.title, stats, source: 'rules' });
      return json({ sections: r.sections, title: rules.title, stats, source: 'ai', model: r.model });
    } catch (e) {
      return json({ sections: rules.sections, title: rules.title, stats, source: 'rules', warning: describeError(e).message });
    }
  }

  return json({ error: 'Unbekannte Aktion' }, 400);
});
