import { describe, expect, it } from 'vitest';
import { dailyWeights, movingAverage, smoothedTrend, linearSlope, weightSummary, bmi } from '../src/body/trend';
import { weight } from './fixtures';
import { addDays } from '../src/dates';

describe('weight trend', () => {
  it('one value per date – latest update wins', () => {
    const pts = dailyWeights([weight('2026-01-01', 80, { updated_at: '2026-01-01T07:00:00Z' }), weight('2026-01-01', 81, { updated_at: '2026-01-01T08:00:00Z' }), weight('2026-01-02', 0)]);
    expect(pts).toEqual([{ date: '2026-01-01', weight: 81 }]);
  });
  it('moving average over calendar days', () => {
    const pts = [
      { date: '2026-01-01', weight: 80 },
      { date: '2026-01-02', weight: 82 },
      { date: '2026-01-09', weight: 78 },
    ];
    const ma = movingAverage(pts, 7);
    expect(ma[1].weight).toBe(81);
    expect(ma[2].weight).toBe(78); // 01-02 is outside the 7-day window of 01-09
  });
  it('slope in kg/day and weekly summary', () => {
    const entries = Array.from({ length: 30 }, (_, i) => weight(addDays('2026-01-01', i), 90 - i * 0.1));
    expect(linearSlope(dailyWeights(entries))!).toBeCloseTo(-0.1, 5);
    const s = weightSummary(entries, '2026-01-30');
    expect(s.weeklyRate30).toBeCloseTo(-0.7, 2);
    expect(s.avg7).toBeCloseTo(87.4, 1);
    expect(s.daysLogged30).toBe(30);
    expect(smoothedTrend(dailyWeights(entries)).length).toBe(30);
  });
  it('no trend with too little data', () => {
    const s = weightSummary([weight('2026-01-01', 80), weight('2026-01-03', 79)], '2026-01-05');
    expect(s.weeklyRate30).toBeNull();
    expect(bmi(80, 180)).toBe(24.7);
  });
});
