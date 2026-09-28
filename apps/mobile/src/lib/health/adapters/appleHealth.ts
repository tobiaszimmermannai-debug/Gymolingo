// @ts-nocheck – optional adapter. Enable it as described in docs/HEALTH_INTEGRATION.md
// (requires `@kingstinct/react-native-healthkit` and a development build).
import HealthKit, { HKQuantityTypeIdentifier } from '@kingstinct/react-native-healthkit';
import type { HealthProvider } from '../index';

function dayBounds(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return { from: new Date(y, m - 1, d, 0, 0, 0), to: new Date(y, m - 1, d, 23, 59, 59) };
}

export const appleHealthProvider: HealthProvider = {
  source: 'apple_health',
  label: 'Apple Health',
  async isAvailable() {
    return HealthKit.isHealthDataAvailable();
  },
  async requestPermissions() {
    return HealthKit.requestAuthorization([], [HKQuantityTypeIdentifier.stepCount, HKQuantityTypeIdentifier.bodyMass]);
  },
  async getSteps(date) {
    const { from, to } = dayBounds(date);
    const res = await HealthKit.queryStatisticsForQuantity(HKQuantityTypeIdentifier.stepCount, ['cumulativeSum'], { filter: { startDate: from, endDate: to } });
    return res?.sumQuantity?.quantity != null ? Math.round(res.sumQuantity.quantity) : null;
  },
  async getLatestWeight() {
    const s = await HealthKit.getMostRecentQuantitySample(HKQuantityTypeIdentifier.bodyMass, 'kg');
    return s ? { date: s.startDate.toISOString().slice(0, 10), kg: s.quantity } : null;
  },
};
