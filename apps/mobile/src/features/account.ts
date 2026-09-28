/**
 * Account lifecycle: guest (local only) → registered account (synced).
 */
import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase, isBackendConfigured } from '@/lib/supabase';
import { flush, reassignUser, useDB, wipeLocal } from '@/data/store';
import { syncNow } from '@/data/sync';

interface AuthState {
  session: Session | null;
  email: string | null;
  initialized: boolean;
}

export const useAuth = create<AuthState>(() => ({ session: null, email: null, initialized: !isBackendConfigured }));

function translateAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-Mail oder Passwort ist falsch.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Für diese E-Mail gibt es bereits ein Konto. Bitte melde dich an.';
  if (m.includes('password should be at least') || m.includes('weak')) return 'Das Passwort ist zu schwach (mindestens 8 Zeichen, Buchstaben und Zahlen).';
  if (m.includes('email not confirmed')) return 'Bitte bestätige zuerst deine E-Mail-Adresse.';
  if (m.includes('invalid email') || m.includes('unable to validate email')) return 'Bitte gib eine gültige E-Mail-Adresse ein.';
  if (m.includes('fetch') || m.includes('network')) return 'Keine Verbindung zum Server. Bitte prüfe deine Internetverbindung.';
  return msg;
}

/**
 * Binds local data to the signed-in account.
 * - guest data → moved to the account (merged with existing cloud data, newer wins)
 * - data of another account on this device → wiped first (privacy)
 */
async function attachAccount(userId: string) {
  const s = useDB.getState();
  if (s.accountUserId === userId) return;
  if (s.accountUserId && s.accountUserId !== userId) {
    await wipeLocal(userId);
  } else {
    reassignUser(userId);
  }
  await flush();
}

export async function initAuth() {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  useAuth.setState({ session: data.session, email: data.session?.user.email ?? null, initialized: true });
  if (data.session) {
    await attachAccount(data.session.user.id);
    void syncNow();
  }
  supabase.auth.onAuthStateChange((_event, session) => {
    useAuth.setState({ session, email: session?.user.email ?? null });
  });
}

export async function signUp(email: string, password: string, displayName: string): Promise<{ ok: boolean; error?: string; needsConfirmation?: boolean }> {
  if (!supabase) return { ok: false, error: 'Kein Backend konfiguriert.' };
  if (password.length < 8) return { ok: false, error: 'Das Passwort muss mindestens 8 Zeichen lang sein.' };
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { display_name: displayName } } });
  if (error) return { ok: false, error: translateAuthError(error.message) };
  if (!data.session) return { ok: true, needsConfirmation: true };
  await attachAccount(data.session.user.id);
  const r = await syncNow();
  return { ok: true, error: r.ok ? undefined : r.message };
}

export async function signIn(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Kein Backend konfiguriert.' };
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.session) return { ok: false, error: translateAuthError(error?.message ?? 'Anmeldung fehlgeschlagen') };
  await attachAccount(data.session.user.id);
  await syncNow();
  return { ok: true };
}

export async function resetPassword(email: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Kein Backend konfiguriert.' };
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
  return error ? { ok: false, error: translateAuthError(error.message) } : { ok: true };
}

/** Uploads pending changes, signs out and removes all personal data from this device. */
export async function signOut(): Promise<void> {
  if (supabase) {
    await syncNow().catch(() => undefined);
    await supabase.auth.signOut().catch(() => undefined);
  }
  await wipeLocal();
}
