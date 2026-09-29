/**
 * "Zuletzt online": the app pings the server while it is open and loads when
 * friends/testers were last online (shown in the coach's daily briefing).
 */
import { supabase } from '@/lib/supabase';
import { setPrefs, useDB } from '@/data/store';

let lastPing = 0;
let lastFetch = 0;

/** Marks the user as online (at most every 4 minutes). */
export async function touchLastSeen() {
  if (!supabase || !useDB.getState().accountUserId || Date.now() - lastPing < 4 * 60_000) return;
  lastPing = Date.now();
  const { error } = await supabase.rpc('touch_last_seen');
  if (error) lastPing = 0;
}

/** Refreshes friends' last-online times (at most once a minute unless forced). */
export async function refreshFriendsActivity(force = false) {
  if (!supabase || !useDB.getState().accountUserId || (!force && Date.now() - lastFetch < 60_000)) return;
  lastFetch = Date.now();
  const { data, error } = await supabase.rpc('friends_activity');
  if (error || !Array.isArray(data)) {
    lastFetch = 0;
    return;
  }
  setPrefs({ friendsActivity: { fetchedAt: new Date().toISOString(), rows: data } });
}
