/**
 * Health data integration (Apple Health / Android Health Connect).
 *
 * The app always supports manual entry. Native health sources are optional
 * adapters that register themselves (see ./adapters and docs/HEALTH_INTEGRATION.md):
 * they need native modules and therefore a development build (not Expo Go).
 */
import { todayISO } from '@gymolingo/core';
import { useDB } from '@/data/store';
import { logSteps } from '@/data/actions';

export type HealthSource = 'apple_health' | 'health_connect';

export interface HealthProvider {
  source: HealthSource;
  label: string;
  isAvailable(): Promise<boolean>;
  requestPermissions(): Promise<boolean>;
  /** Total steps of a local calendar day (YYYY-MM-DD). */
  getSteps(date: string): Promise<number | null>;
  /** Latest body weight in kg within the last days, if any. */
  getLatestWeight?(): Promise<{ date: string; kg: number } | null>;
}

let provider: HealthProvider | null = null;

export function registerHealthProvider(p: HealthProvider) {
  provider = p;
}

export function getHealthProvider(): HealthProvider | null {
  return provider;
}

/**
 * Imports today's (and yesterday's) steps from the health source, if the user
 * enabled it. Manual entries always take precedence in all statistics.
 */
export async function syncHealthSteps(): Promise<number | null> {
  const p = provider;
  const pref = useDB.getState().prefs.healthSource;
  if (!p || pref !== p.source || !(await p.isAvailable())) return null;
  const today = todayISO();
  const steps = await p.getSteps(today);
  if (steps !== null && steps >= 0) logSteps(today, steps, p.source);
  return steps;
}
