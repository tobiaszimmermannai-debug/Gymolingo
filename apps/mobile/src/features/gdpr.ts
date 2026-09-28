/**
 * GDPR helpers: full data export (Art. 20) and account deletion (Art. 17).
 */
import { todayISO } from '@gymolingo/core';
import { useDB, wipeLocal, flush } from '@/data/store';
import { TABLES } from '@/data/tables';
import { supabase } from '@/lib/supabase';
import { syncNow } from '@/data/sync';
import { shareExport } from '@/lib/exportData';

export function buildExport(): string {
  const s = useDB.getState();
  const tables: Record<string, unknown[]> = {};
  for (const t of TABLES) {
    tables[t] = Object.values(s.tables[t]).map((r) => {
      const { local_uri: _l, ...rest } = r as unknown as Record<string, unknown>;
      return rest;
    });
  }
  return JSON.stringify(
    {
      app: 'Gymolingo',
      format: 'gymolingo-export-v1',
      exported_at: new Date().toISOString(),
      user_id: s.userId,
      account: !!s.accountUserId,
      note: 'Vollständiger Export aller in Gymolingo gespeicherten personenbezogenen Daten (DSGVO Art. 15/20). Fortschrittsbilder liegen als Dateien auf dem Gerät bzw. im privaten Speicher.',
      tables,
    },
    null,
    2,
  );
}

export async function exportAllData(): Promise<void> {
  if (useDB.getState().accountUserId) await syncNow().catch(() => undefined);
  await flush();
  await shareExport(`gymolingo-export-${todayISO()}.json`, buildExport());
}

/**
 * Deletes the account: removes private photos from storage, deletes the auth
 * user (all rows cascade in Postgres) and wipes the device.
 */
export async function deleteAccount(): Promise<{ ok: boolean; error?: string }> {
  const s = useDB.getState();
  if (supabase && s.accountUserId) {
    try {
      const { data: files } = await supabase.storage.from('progress-photos').list(s.accountUserId, { limit: 1000 });
      if (files?.length) await supabase.storage.from('progress-photos').remove(files.map((f) => `${s.accountUserId}/${f.name}`));
      const { error } = await supabase.rpc('delete_my_account');
      if (error) return { ok: false, error: error.message };
      await supabase.auth.signOut().catch(() => undefined);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
  await wipeLocal();
  return { ok: true };
}
