/**
 * Development-only helpers (hidden in production builds): loads realistic
 * demo data into the local store for UI testing and screenshots.
 */
import { generateDemoData, todayISO } from '@gymolingo/core';
import { insertMany, update, useDB } from '@/data/store';
import { TABLES, type TableName } from '@/data/tables';
import { ensureSettingsRows } from '@/data/actions';

export const DEV_TOOLS = __DEV__ || process.env.EXPO_PUBLIC_DEV_TOOLS === 'true';

export function loadDemoData() {
  const s = useDB.getState();
  for (const p of Object.values(s.tables.workout_plans)) if (p.is_active && !p.deleted) update('workout_plans', p.id, { is_active: false });
  const data = generateDemoData({ userId: s.userId, today: todayISO(), weeks: 12, seed: 42 });
  for (const [table, rows] of Object.entries(data) as [TableName, never[]][]) {
    if (TABLES.includes(table)) insertMany(table, rows);
  }
  ensureSettingsRows();
}
