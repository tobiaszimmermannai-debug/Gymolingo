import { describe, expect, it } from 'vitest';
import { syncAll, shouldApplyRemote, stripLocalFields, type LocalAdapter, type RemoteAdapter, type SyncRow } from '../src/sync/engine';

class MemLocal implements LocalAdapter {
  tables: Record<string, Record<string, SyncRow>> = {};
  dirty: Record<string, Record<string, string>> = {};
  cursors: Record<string, string> = {};
  write(table: string, row: SyncRow) {
    (this.tables[table] ??= {})[row.id] = row;
    (this.dirty[table] ??= {})[row.id] = row.updated_at;
  }
  getDirty(t: string) { return Object.keys(this.dirty[t] ?? {}).map((id) => this.tables[t][id]); }
  markClean(t: string, rows: { id: string; updated_at: string }[]) { for (const r of rows) if (this.dirty[t]?.[r.id] === r.updated_at) delete this.dirty[t][r.id]; }
  getRow(t: string, id: string) { return this.tables[t]?.[id]; }
  isDirty(t: string, id: string) { return !!this.dirty[t]?.[id]; }
  upsertFromRemote(t: string, rows: SyncRow[]) { for (const r of rows) (this.tables[t] ??= {})[r.id] = { ...this.tables[t][r.id], ...r }; }
  getCursor(t: string) { return this.cursors[t] ?? null; }
  setCursor(t: string, c: string) { this.cursors[t] = c; }
}

class MemRemote implements RemoteAdapter {
  rows: Record<string, Record<string, SyncRow>> = {};
  clock = 0;
  failTables = new Set<string>();
  async push(t: string, rows: SyncRow[]) {
    if (this.failTables.has(t)) throw new Error('boom');
    for (const r of rows) {
      const cur = this.rows[t]?.[r.id];
      if (cur && cur.updated_at > r.updated_at) continue; // LWW like the DB trigger
      (this.rows[t] ??= {})[r.id] = { ...r, server_updated_at: `2026-01-01T00:00:${String(++this.clock).padStart(2, '0')}Z` };
    }
  }
  async pull(t: string, since: string | null, limit: number) {
    return Object.values(this.rows[t] ?? {})
      .filter((r) => !since || (r.server_updated_at ?? '') > since)
      .sort((a, b) => ((a.server_updated_at ?? '') < (b.server_updated_at ?? '') ? -1 : 1))
      .slice(0, limit);
  }
}

const row = (id: string, updated: string, extra: Record<string, unknown> = {}): SyncRow => ({ id, user_id: 'u', updated_at: updated, deleted: false, ...extra });

describe('sync engine', () => {
  it('LWW decision', () => {
    expect(shouldApplyRemote(undefined, row('a', '2026-01-02'), false)).toBe(true);
    expect(shouldApplyRemote(row('a', '2026-01-03'), row('a', '2026-01-02'), false)).toBe(false);
    expect(shouldApplyRemote(row('a', '2026-01-01'), row('a', '2026-01-02'), true)).toBe(true);
    expect(shouldApplyRemote(row('a', '2026-01-02'), row('a', '2026-01-02'), true)).toBe(false);
  });

  it('two devices converge; newer edit wins; soft deletes propagate', async () => {
    const remote = new MemRemote();
    const a = new MemLocal();
    const b = new MemLocal();
    a.write('weights', row('w1', '2026-01-01T08:00:00Z', { weight_kg: 80 }));
    a.write('weights', row('w2', '2026-01-01T08:00:00Z', { weight_kg: 81 }));
    await syncAll(['weights'], a, remote);
    await syncAll(['weights'], b, remote);
    expect(Object.keys(b.tables.weights).sort()).toEqual(['w1', 'w2']);

    // offline edits on both devices, B's is newer
    a.write('weights', row('w1', '2026-01-02T08:00:00Z', { weight_kg: 79 }));
    b.write('weights', row('w1', '2026-01-03T08:00:00Z', { weight_kg: 78 }));
    b.write('weights', row('w2', '2026-01-03T08:00:00Z', { weight_kg: 81, deleted: true }));
    await syncAll(['weights'], b, remote);
    await syncAll(['weights'], a, remote);
    await syncAll(['weights'], b, remote);
    expect(a.tables.weights.w1.weight_kg).toBe(78);
    expect(b.tables.weights.w1.weight_kg).toBe(78);
    expect(a.tables.weights.w2.deleted).toBe(true);
    expect(a.getDirty('weights')).toHaveLength(0);
  });

  it('failed push keeps rows dirty and reports errors', async () => {
    const remote = new MemRemote();
    remote.failTables.add('sets');
    const a = new MemLocal();
    a.write('sessions', row('s1', '2026-01-01T08:00:00Z'));
    a.write('sets', row('x1', '2026-01-01T08:00:00Z', { session_id: 's1' }));
    const rep = await syncAll(['sessions', 'sets'], a, remote);
    expect(rep.pushed.sessions).toBe(1);
    expect(rep.errors).toEqual([{ table: 'sets', phase: 'push', message: 'boom' }]);
    expect(a.isDirty('sets', 'x1')).toBe(true);
  });

  it('edit during sync keeps the row dirty', async () => {
    const remote = new MemRemote();
    const a = new MemLocal();
    a.write('meals', row('m1', '2026-01-01T08:00:00Z'));
    const origPush = remote.push.bind(remote);
    remote.push = async (t, rows) => {
      await origPush(t, rows);
      a.write('meals', row('m1', '2026-01-01T09:00:00Z', { kcal: 5 }));
    };
    await syncAll(['meals'], a, remote);
    expect(a.isDirty('meals', 'm1')).toBe(true);
    expect(a.tables.meals.m1.kcal).toBe(5);
  });

  it('strips local-only fields', () => {
    expect(stripLocalFields(row('p', 't', { local_uri: 'file://x', _tmp: 1, server_updated_at: 'z', note: 'n' }))).toEqual(row('p', 't', { note: 'n' }));
  });
});
