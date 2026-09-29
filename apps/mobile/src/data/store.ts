/**
 * Local-first data store (Zustand). Every write lands here first, is persisted
 * to the device (SQLite kv on native, IndexedDB on web) and marked dirty for
 * the sync engine. Rows mirror the Postgres tables exactly.
 */
import { create } from 'zustand';
import { AppState, Platform } from 'react-native';
import { randomUUID } from 'expo-crypto';
import type { BaseRow } from '@gymolingo/core';
import { kv } from './kv';
import { SINGLETON_TABLES, TABLES, type TableName, type TableTypes } from './tables';

export type Tables = { [K in TableName]: Record<string, TableTypes[K]> };
type DirtyMap = { [K in TableName]?: Record<string, string> };

export interface DBState {
  hydrated: boolean;
  userId: string;
  /** Supabase auth user id once the data belongs to an account. */
  accountUserId: string | null;
  installedAt: string;
  tables: Tables;
  dirty: DirtyMap;
  cursors: Partial<Record<TableName, string>>;
  lastSyncAt: string | null;
  syncState: 'idle' | 'syncing' | 'error' | 'offline' | 'disabled';
  syncError: string | null;
  /** Client-only UI state that should survive restarts. */
  prefs: {
    lastDemoSeed?: string;
    notificationsAsked?: boolean;
    healthSource?: 'none' | 'apple_health' | 'health_connect';
    restTimerSound?: boolean;
    lastAutoReport?: string;
    /** one-time switch of untouched privacy settings to the new defaults (only streaks + online status shared) */
    privacyDefaultsV2?: boolean;
    friendsCount?: number;
    /** user agreed that progress photos may be sent to the AI (Gemini) for body fat estimates */
    aiPhotoConsent?: boolean;
    /** server status: is a shared Gemini key configured on Supabase? */
    aiKey?: { configured: boolean; hint: string | null; fallback: boolean };
    /** Gemini key stored on this device only (never synced) */
    geminiKey?: string;
    /** key shared by the owner with all signed-in users (Supabase) */
    sharedAi?: { key: string; hint: string; ownerName: string; isOwner: boolean } | null;
    /** on-device AI limits: requests today, models blocked after a quota answer (ISO until) */
    aiUsage?: { day: string; count: number };
    aiBlocks?: Record<string, string>;
    /** friends' "zuletzt online" for the coach briefing */
    friendsActivity?: { fetchedAt: string; rows: { user_id: string; username: string | null; display_name: string; avatar_emoji: string; last_seen_at: string | null }[] };
  };
}

const PREFIX = 'gl:';
const META_KEY = `${PREFIX}meta`;
const tableKey = (t: TableName) => `${PREFIX}t:${t}`;

const emptyTables = (): Tables => Object.fromEntries(TABLES.map((t) => [t, {}])) as unknown as Tables;

export const useDB = create<DBState>(() => ({
  hydrated: false,
  userId: '',
  accountUserId: null,
  installedAt: new Date().toISOString(),
  tables: emptyTables(),
  dirty: {},
  cursors: {},
  lastSyncAt: null,
  syncState: 'idle',
  syncError: null,
  prefs: {},
}));

export const uuid = () => randomUUID();

let lastTs = 0;
/** Strictly increasing ISO timestamp (LWW needs distinct updated_at values). */
export function nowISO(): string {
  let t = Date.now();
  if (t <= lastTs) t = lastTs + 1;
  lastTs = t;
  return new Date(t).toISOString();
}

// ---------------------------------------------------------------- persistence

const changedTables = new Set<TableName>();
let metaChanged = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  // web: persist right after the current burst of writes (tabs can be closed any time);
  // native: small debounce, plus a flush when the app goes to the background
  saveTimer = setTimeout(() => void flush(), Platform.OS === 'web' ? 0 : 150);
}

export async function flush() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const s = useDB.getState();
  if (!s.hydrated) return;
  const tables = [...changedTables];
  changedTables.clear();
  const writeMeta = metaChanged;
  metaChanged = false;
  await Promise.all([
    ...tables.map((t) => kv.set(tableKey(t), JSON.stringify(Object.values(s.tables[t])))),
    writeMeta || tables.length
      ? kv.set(
          META_KEY,
          JSON.stringify({
            userId: s.userId,
            accountUserId: s.accountUserId,
            installedAt: s.installedAt,
            dirty: s.dirty,
            cursors: s.cursors,
            lastSyncAt: s.lastSyncAt,
            prefs: s.prefs,
          }),
        )
      : Promise.resolve(),
  ]);
}

AppState.addEventListener?.('change', (state) => {
  if (state !== 'active') void flush();
});
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  // web: persist pending writes when the tab is closed or reloaded
  window.addEventListener('pagehide', () => void flush());
  window.addEventListener('beforeunload', () => void flush());
}

export async function hydrate(): Promise<void> {
  const metaRaw = await kv.get(META_KEY);
  const meta = metaRaw ? JSON.parse(metaRaw) : null;
  const tables = emptyTables();
  await Promise.all(
    TABLES.map(async (t) => {
      const raw = await kv.get(tableKey(t));
      if (!raw) return;
      try {
        const rows = JSON.parse(raw) as BaseRow[];
        (tables as Record<string, Record<string, BaseRow>>)[t] = Object.fromEntries(rows.map((r) => [r.id, r]));
      } catch {
        // corrupted table – ignore, will be restored by sync
      }
    }),
  );
  useDB.setState({
    hydrated: true,
    userId: meta?.userId ?? uuid(),
    accountUserId: meta?.accountUserId ?? null,
    installedAt: meta?.installedAt ?? new Date().toISOString(),
    tables,
    dirty: meta?.dirty ?? {},
    cursors: meta?.cursors ?? {},
    lastSyncAt: meta?.lastSyncAt ?? null,
    prefs: meta?.prefs ?? {},
  });
  if (!meta) {
    metaChanged = true;
    scheduleSave();
  }
}

// ---------------------------------------------------------------- writes

function commit<K extends TableName>(table: K, rows: TableTypes[K][], markDirty = true) {
  useDB.setState((s) => {
    const next = { ...s.tables[table] } as Record<string, TableTypes[K]>;
    const dirty: Record<string, string> = { ...(s.dirty[table] ?? {}) };
    for (const r of rows) {
      next[r.id] = r;
      if (markDirty) dirty[r.id] = r.updated_at;
    }
    return { tables: { ...s.tables, [table]: next }, dirty: markDirty ? { ...s.dirty, [table]: dirty } : s.dirty };
  });
  changedTables.add(table);
  metaChanged = true;
  scheduleSave();
}

type NewRow<K extends TableName> = Omit<TableTypes[K], keyof BaseRow> & Partial<BaseRow>;

export function insert<K extends TableName>(table: K, data: NewRow<K>): TableTypes[K] {
  const ts = nowISO();
  const s = useDB.getState();
  const row = {
    ...data,
    id: data.id ?? uuid(),
    user_id: s.userId,
    created_at: data.created_at ?? ts,
    updated_at: ts,
    deleted: false,
  } as unknown as TableTypes[K];
  commit(table, [row]);
  return row;
}

export function insertMany<K extends TableName>(table: K, data: NewRow<K>[]): TableTypes[K][] {
  const s = useDB.getState();
  const rows = data.map((d) => {
    const ts = nowISO();
    return { ...d, id: d.id ?? uuid(), user_id: s.userId, created_at: d.created_at ?? ts, updated_at: ts, deleted: false } as unknown as TableTypes[K];
  });
  commit(table, rows);
  return rows;
}

export function update<K extends TableName>(table: K, id: string, patch: Partial<TableTypes[K]>): TableTypes[K] | undefined {
  const cur = useDB.getState().tables[table][id] as TableTypes[K] | undefined;
  if (!cur) return undefined;
  const row = { ...cur, ...patch, id: cur.id, user_id: cur.user_id, updated_at: nowISO() } as TableTypes[K];
  commit(table, [row]);
  return row;
}

export function remove<K extends TableName>(table: K, id: string) {
  return update(table, id, { deleted: true } as Partial<TableTypes[K]>);
}

/** Upsert of per-user singleton rows (id = user_id). */
export function upsertSingleton<K extends TableName>(table: K, patch: Partial<TableTypes[K]>, defaults: () => Omit<TableTypes[K], keyof BaseRow>): TableTypes[K] {
  const s = useDB.getState();
  const cur = s.tables[table][s.userId] as TableTypes[K] | undefined;
  if (cur) return update(table, s.userId, patch)!;
  return insert(table, { ...defaults(), ...patch, id: s.userId } as NewRow<K>);
}

export function setPrefs(patch: Partial<DBState['prefs']>) {
  useDB.setState((s) => ({ prefs: { ...s.prefs, ...patch } }));
  metaChanged = true;
  scheduleSave();
}

// ---------------------------------------------------------------- sync support

export function applyRemoteRows<K extends TableName>(table: K, rows: TableTypes[K][]) {
  useDB.setState((s) => {
    const next = { ...s.tables[table] } as Record<string, TableTypes[K]>;
    for (const r of rows) {
      const local = next[r.id] as unknown as Record<string, unknown> | undefined;
      // keep device-only fields (e.g. local_uri of photos)
      const localOnly = local ? Object.fromEntries(Object.entries(local).filter(([k]) => k.startsWith('local_'))) : {};
      const clean = { ...r } as Record<string, unknown>;
      delete clean.server_updated_at;
      next[r.id] = normalizeRemote({ ...clean, ...localOnly }) as unknown as TableTypes[K];
    }
    return { tables: { ...s.tables, [table]: next } };
  });
  changedTables.add(table);
  metaChanged = true;
  scheduleSave();
}

/** Postgres returns numerics as numbers but dates/timestamps with different precision – normalise. */
function normalizeRemote(r: Record<string, unknown>) {
  for (const k of Object.keys(r)) {
    const v = r[k];
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(\+00:00|Z)$/.test(v)) {
      r[k] = new Date(v).toISOString();
    }
  }
  return r;
}

export function markClean(table: TableName, rows: { id: string; updated_at: string }[]) {
  useDB.setState((s) => {
    const d = { ...(s.dirty[table] ?? {}) };
    for (const r of rows) if (d[r.id] === r.updated_at) delete d[r.id];
    return { dirty: { ...s.dirty, [table]: d } };
  });
  metaChanged = true;
  scheduleSave();
}

export function setCursor(table: TableName, cursor: string) {
  useDB.setState((s) => ({ cursors: { ...s.cursors, [table]: cursor } }));
  metaChanged = true;
  scheduleSave();
}

export function setSyncStatus(patch: Partial<Pick<DBState, 'syncState' | 'syncError' | 'lastSyncAt'>>) {
  useDB.setState(patch);
  if (patch.lastSyncAt) {
    metaChanged = true;
    scheduleSave();
  }
}

/**
 * Moves all local rows to a new owner (local guest → account). Singleton rows
 * are re-keyed (id = user_id). All rows become dirty so they are uploaded.
 */
export function reassignUser(newUserId: string) {
  useDB.setState((s) => {
    const tables = emptyTables() as Record<string, Record<string, BaseRow>>;
    const dirty: DirtyMap = {};
    for (const t of TABLES) {
      const rows = Object.values(s.tables[t]) as BaseRow[];
      const d: Record<string, string> = {};
      for (const r of rows) {
        const isSingleton = SINGLETON_TABLES.includes(t);
        const moved = { ...r, user_id: newUserId, id: isSingleton ? newUserId : r.id, updated_at: nowISO() };
        tables[t][moved.id] = moved;
        d[moved.id] = moved.updated_at;
      }
      dirty[t] = d;
      changedTables.add(t);
    }
    return { userId: newUserId, accountUserId: newUserId, tables: tables as unknown as Tables, dirty, cursors: {} };
  });
  metaChanged = true;
  scheduleSave();
}

/** Deletes all local data (sign-out without keeping data / account deletion). */
export async function wipeLocal(newUserId?: string) {
  await kv.clear(PREFIX);
  useDB.setState({
    hydrated: true,
    userId: newUserId ?? uuid(),
    accountUserId: newUserId ?? null,
    installedAt: new Date().toISOString(),
    tables: emptyTables(),
    dirty: {},
    cursors: {},
    lastSyncAt: null,
    syncState: 'idle',
    syncError: null,
    prefs: {},
  });
  metaChanged = true;
  await flush();
}

export function dirtyCount(): number {
  const d = useDB.getState().dirty;
  return Object.values(d).reduce((n, m) => n + Object.keys(m ?? {}).length, 0);
}
