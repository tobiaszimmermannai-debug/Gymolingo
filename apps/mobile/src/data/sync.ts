/**
 * Connects the core sync engine to the local store and Supabase.
 */
import NetInfo from '@react-native-community/netinfo';
import { syncAll, type LocalAdapter, type RemoteAdapter, type SyncRow } from '@gymolingo/core';
import { supabase } from '@/lib/supabase';
import { applyRemoteRows, markClean, setCursor, setSyncStatus, useDB } from './store';
import { TABLES, type TableName } from './tables';

const localAdapter: LocalAdapter = {
  getDirty(table) {
    const s = useDB.getState();
    const t = table as TableName;
    const d = s.dirty[t] ?? {};
    return Object.keys(d)
      .map((id) => s.tables[t][id] as unknown as SyncRow)
      .filter((r): r is SyncRow => !!r && r.user_id === s.accountUserId);
  },
  markClean(table, rows) {
    markClean(table as TableName, rows);
  },
  getRow(table, id) {
    return useDB.getState().tables[table as TableName][id] as unknown as SyncRow | undefined;
  },
  isDirty(table, id) {
    return !!useDB.getState().dirty[table as TableName]?.[id];
  },
  upsertFromRemote(table, rows) {
    applyRemoteRows(table as TableName, rows as never[]);
  },
  getCursor(table) {
    return useDB.getState().cursors[table as TableName] ?? null;
  },
  setCursor(table, cursor) {
    setCursor(table as TableName, cursor);
  },
};

/** Rejects after `ms` – network calls must never block the sync state forever. */
function withTimeout<T>(p: PromiseLike<T>, ms = 12000): Promise<T> {
  return Promise.race([Promise.resolve(p), new Promise<T>((_, reject) => setTimeout(() => reject(new Error('network timeout')), ms))]);
}

const remoteAdapter: RemoteAdapter = {
  async push(table, rows) {
    if (!supabase) throw new Error('Backend nicht konfiguriert');
    const { error } = await withTimeout(supabase.from(table).upsert(rows, { onConflict: 'id' }));
    if (error) throw new Error(`${error.code ?? ''} ${error.message}`.trim());
  },
  async pull(table, since, limit) {
    if (!supabase) throw new Error('Backend nicht konfiguriert');
    let q = supabase.from(table).select('*').order('server_updated_at', { ascending: true }).limit(limit);
    if (since) q = q.gt('server_updated_at', since);
    const { data, error } = await withTimeout(q);
    if (error) throw new Error(`${error.code ?? ''} ${error.message}`.trim());
    return (data ?? []) as SyncRow[];
  },
};

let running: Promise<void> | null = null;

export async function syncNow(): Promise<{ ok: boolean; message?: string }> {
  const s = useDB.getState();
  if (!supabase || !s.accountUserId) {
    setSyncStatus({ syncState: 'disabled' });
    return { ok: false, message: 'Kein Konto verbunden' };
  }
  if (running) {
    await running;
    return { ok: useDB.getState().syncState !== 'error' };
  }
  let result: { ok: boolean; message?: string } = { ok: true };
  running = (async () => {
    // navigator.onLine / OS connectivity: skip network work when definitely offline
    const offlineNow = typeof navigator !== 'undefined' && 'onLine' in navigator ? navigator.onLine === false : (await NetInfo.fetch().catch(() => null))?.isConnected === false;
    if (offlineNow) {
      setSyncStatus({ syncState: 'offline', syncError: null });
      result = { ok: false, message: 'offline' };
      return;
    }
    setSyncStatus({ syncState: 'syncing', syncError: null });
    try {
      const { data } = await withTimeout(supabase!.auth.getSession(), 15000);
      if (!data.session) {
        setSyncStatus({ syncState: 'error', syncError: 'Sitzung abgelaufen – bitte erneut anmelden' });
        result = { ok: false, message: 'Sitzung abgelaufen' };
        return;
      }
      const report = await syncAll(TABLES, localAdapter, remoteAdapter);
      if (report.errors.length) {
        const offline = report.errors.every((e) => /fetch|network|timeout|disconnected/i.test(e.message));
        const msg = report.errors.map((e) => `${e.table}: ${e.message}`).join('; ');
        setSyncStatus({ syncState: offline ? 'offline' : 'error', syncError: msg });
        result = { ok: false, message: msg };
      } else {
        setSyncStatus({ syncState: 'idle', syncError: null, lastSyncAt: report.finishedAt });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSyncStatus({ syncState: 'offline', syncError: msg });
      result = { ok: false, message: msg };
    }
  })();
  try {
    await running;
  } finally {
    running = null;
  }
  return result;
}

let debounce: ReturnType<typeof setTimeout> | null = null;
/** Schedules a sync shortly after local changes (batches rapid edits like set logging). */
export function requestSync(delayMs = 4000) {
  if (!supabase || !useDB.getState().accountUserId) return;
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => void syncNow(), delayMs);
}
