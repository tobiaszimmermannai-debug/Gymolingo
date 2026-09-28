// @ts-nocheck – optional adapter. Enable it as described in docs/HEALTH_INTEGRATION.md
// (requires `react-native-health-connect` + `expo-health-connect` and a development build).
import { aggregateRecord, getSdkStatus, initialize, readRecords, requestPermission, SdkAvailabilityStatus } from 'react-native-health-connect';
import type { HealthProvider } from '../index';

function dayBounds(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return { startTime: new Date(y, m - 1, d, 0, 0, 0).toISOString(), endTime: new Date(y, m - 1, d, 23, 59, 59).toISOString() };
}

export const healthConnectProvider: HealthProvider = {
  source: 'health_connect',
  label: 'Health Connect',
  async isAvailable() {
    const status = await getSdkStatus();
    if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) return false;
    return initialize();
  },
  async requestPermissions() {
    const granted = await requestPermission([
      { accessType: 'read', recordType: 'Steps' },
      { accessType: 'read', recordType: 'Weight' },
    ]);
    return granted.length > 0;
  },
  async getSteps(date) {
    const r = await aggregateRecord({ recordType: 'Steps', timeRangeFilter: { operator: 'between', ...dayBounds(date) } });
    return typeof r?.COUNT_TOTAL === 'number' ? r.COUNT_TOTAL : null;
  },
  async getLatestWeight() {
    const end = new Date();
    const start = new Date(end.getTime() - 14 * 86400000);
    const { records } = await readRecords('Weight', { timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() } });
    const last = records[records.length - 1];
    return last ? { date: last.time.slice(0, 10), kg: last.weight.inKilograms } : null;
  },
};
