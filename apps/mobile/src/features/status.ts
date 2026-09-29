/**
 * Fun status ("🥤 Monster Zero White intus"): kept locally, pushed to the profile
 * when signed in so friends see it in the daily briefing and the community.
 */
import { cleanStatusText, isStatusActive, statusUntil, type StatusDuration } from '@gymolingo/core';
import { supabase } from '@/lib/supabase';
import { setPrefs, useDB } from '@/data/store';

export type StatusSync = 'synced' | 'local' | 'needs_update' | 'error';

/** Missing function/column = the Supabase update SQL has not been run yet. */
const needsDbUpdate = (code?: string) => code === 'PGRST202' || code === 'PGRST204' || code === '42883' || code === '42703';

async function push(): Promise<StatusSync> {
  const { accountUserId, prefs } = useDB.getState();
  if (!supabase || !accountUserId) return 'local';
  const s = prefs.status;
  const { error } = await supabase.rpc('set_status', {
    p_emoji: s?.emoji || null,
    p_text: s?.text || null,
    p_until: s?.until ?? null,
  });
  if (error) return needsDbUpdate(error.code) ? 'needs_update' : 'error';
  if (useDB.getState().prefs.status === s) setPrefs({ status: s?.emoji ? { ...s, pending: false } : null });
  return 'synced';
}

/** Sets the own status (emoji + text) for the chosen duration. */
export function setStatus(emoji: string, text: string, duration: StatusDuration): Promise<StatusSync> {
  setPrefs({
    status: {
      emoji,
      text: cleanStatusText(text),
      until: statusUntil(duration),
      pending: true,
    },
  });
  return push();
}

export function clearStatus(): Promise<StatusSync> {
  setPrefs({ status: { emoji: '', text: '', until: null, pending: true } });
  return push();
}

/** The own status while it is active, else null. */
export function useMyStatus() {
  const status = useDB((s) => s.prefs.status);
  return isStatusActive(status) ? status! : null;
}

/** Background sync: push a pending change, or load the status from the server on a new device. */
export async function syncStatus() {
  const { accountUserId, prefs } = useDB.getState();
  if (!supabase || !accountUserId) return;
  if (prefs.status?.pending) {
    await push();
    return;
  }
  if (prefs.status !== undefined) return;
  const { data, error } = await supabase.from('profiles').select('status_emoji, status_text, status_until').eq('id', accountUserId).maybeSingle();
  if (error || !data || useDB.getState().prefs.status !== undefined) return;
  setPrefs({
    status: data.status_emoji
      ? {
          emoji: data.status_emoji,
          text: data.status_text ?? '',
          until: data.status_until,
        }
      : null,
  });
}
