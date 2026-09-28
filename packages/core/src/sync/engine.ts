/**
 * Offline-first sync engine (last-write-wins on `updated_at`).
 *
 * - All writes go to the local store first and are marked dirty.
 * - `syncAll` pushes dirty rows table by table (parents before children), then
 *   pulls rows changed on the server since the last cursor
 *   (`server_updated_at`, set by a DB trigger).
 * - Conflicts: the row with the newer `updated_at` wins. The DB enforces the
 *   same rule with a trigger, so an old offline edit can never overwrite a
 *   newer one from another device.
 * - Deletions are soft (`deleted = true`) so they propagate like updates.
 */

export interface SyncRow {
  id: string;
  user_id: string;
  updated_at: string;
  deleted: boolean;
  server_updated_at?: string | null;
  [key: string]: unknown;
}

export interface LocalAdapter {
  getDirty(table: string): SyncRow[];
  /** Clears the dirty flag only if the row was not modified again in the meantime. */
  markClean(table: string, rows: Pick<SyncRow, 'id' | 'updated_at'>[]): void;
  getRow(table: string, id: string): SyncRow | undefined;
  isDirty(table: string, id: string): boolean;
  upsertFromRemote(table: string, rows: SyncRow[]): void;
  getCursor(table: string): string | null;
  setCursor(table: string, cursor: string): void;
}

export interface RemoteAdapter {
  push(table: string, rows: SyncRow[]): Promise<void>;
  /** Rows with server_updated_at > since, ascending, at most `limit`. */
  pull(table: string, since: string | null, limit: number): Promise<SyncRow[]>;
}

export interface SyncReport {
  pushed: Record<string, number>;
  pulled: Record<string, number>;
  errors: { table: string; phase: 'push' | 'pull'; message: string }[];
  startedAt: string;
  finishedAt: string;
}

/** Decides whether an incoming remote row should replace the local one. */
export function shouldApplyRemote(local: SyncRow | undefined, remote: SyncRow, localDirty: boolean): boolean {
  if (!local) return true;
  if (remote.updated_at > local.updated_at) return true;
  if (remote.updated_at < local.updated_at) return false;
  // same timestamp: server copy is authoritative unless we have unsent changes
  return !localDirty;
}

export function mergeRemoteRows(local: LocalAdapter, table: string, rows: SyncRow[]): SyncRow[] {
  const accepted: SyncRow[] = [];
  for (const r of rows) {
    if (shouldApplyRemote(local.getRow(table, r.id), r, local.isDirty(table, r.id))) accepted.push(r);
  }
  if (accepted.length) local.upsertFromRemote(table, accepted);
  return accepted;
}

const PUSH_BATCH = 200;
const PULL_LIMIT = 500;

/**
 * @param overlapMs the first pull of each table starts slightly before the stored
 * cursor. Concurrent transactions can commit rows with a server timestamp older
 * than rows already seen; re-reading a small window catches them (merging is
 * idempotent thanks to LWW).
 */
export async function syncAll(
  tables: string[],
  local: LocalAdapter,
  remote: RemoteAdapter,
  now: () => Date = () => new Date(),
  overlapMs = 30_000,
): Promise<SyncReport> {
  const report: SyncReport = { pushed: {}, pulled: {}, errors: [], startedAt: now().toISOString(), finishedAt: '' };

  // 1) push in dependency order
  for (const table of tables) {
    const dirty = local.getDirty(table);
    if (!dirty.length) continue;
    try {
      for (let i = 0; i < dirty.length; i += PUSH_BATCH) {
        const batch = dirty.slice(i, i + PUSH_BATCH).map(stripLocalFields);
        await remote.push(table, batch);
        local.markClean(table, batch);
        report.pushed[table] = (report.pushed[table] ?? 0) + batch.length;
      }
    } catch (e) {
      report.errors.push({ table, phase: 'push', message: errorMessage(e) });
      // children of a failed parent would fail as well – continue anyway,
      // the DB rejects orphans and they stay dirty for the next attempt.
    }
  }

  // 2) pull
  for (const table of tables) {
    try {
      const stored = local.getCursor(table);
      let cursor = stored ? new Date(new Date(stored).getTime() - overlapMs).toISOString() : null;
      for (;;) {
        const rows = await remote.pull(table, cursor, PULL_LIMIT);
        if (!rows.length) break;
        const accepted = mergeRemoteRows(local, table, rows);
        report.pulled[table] = (report.pulled[table] ?? 0) + accepted.length;
        const last = rows[rows.length - 1].server_updated_at;
        if (last) {
          cursor = last;
          if (!stored || last > stored) local.setCursor(table, last);
        }
        if (rows.length < PULL_LIMIT || !last) break;
      }
    } catch (e) {
      report.errors.push({ table, phase: 'pull', message: errorMessage(e) });
    }
  }
  report.finishedAt = now().toISOString();
  return report;
}

/** Removes client-only fields (prefixed with `_` or `local_`) before pushing. */
export function stripLocalFields(row: SyncRow): SyncRow {
  const out: SyncRow = { ...row };
  for (const k of Object.keys(out)) {
    if (k.startsWith('_') || k.startsWith('local_') || k === 'server_updated_at') delete out[k];
  }
  return out;
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return String(e);
}
