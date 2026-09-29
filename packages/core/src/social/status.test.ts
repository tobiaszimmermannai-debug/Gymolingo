import { describe, expect, it } from 'vitest';
import { cleanStatusText, isStatusActive, STATUS_MAX_TEXT, STATUS_PRESETS, statusUntil } from './status';

describe('status presets', () => {
  it('contains the Monster Zero White classic and fits the limits', () => {
    expect(STATUS_PRESETS.some((p) => p.text.includes('Monster Zero White'))).toBe(true);
    for (const p of STATUS_PRESETS) {
      expect(Array.from(p.text).length).toBeLessThanOrEqual(STATUS_MAX_TEXT);
      expect(p.emoji.length).toBeLessThanOrEqual(16);
    }
    expect(new Set(STATUS_PRESETS.map((p) => p.text)).size).toBe(STATUS_PRESETS.length);
    expect(new Set(STATUS_PRESETS.map((p) => p.emoji)).size).toBe(STATUS_PRESETS.length);
  });
});

describe('statusUntil', () => {
  const now = new Date(2026, 8, 30, 14, 30);
  it('"today" ends at local midnight', () => {
    expect(new Date(statusUntil('today', now)!).getTime()).toBe(new Date(2026, 9, 1, 0, 0).getTime());
  });
  it('"3days" covers today and the next two days', () => {
    expect(new Date(statusUntil('3days', now)!).getTime()).toBe(new Date(2026, 9, 3, 0, 0).getTime());
  });
  it('"forever" never expires', () => {
    expect(statusUntil('forever', now)).toBeNull();
  });
});

describe('isStatusActive', () => {
  const now = new Date('2026-09-30T12:00:00Z');
  it('needs an emoji and an unexpired end', () => {
    expect(isStatusActive(null, now)).toBe(false);
    expect(isStatusActive({ emoji: '' }, now)).toBe(false);
    expect(isStatusActive({ emoji: '🥤', until: null }, now)).toBe(true);
    expect(isStatusActive({ emoji: '🥤', until: '2026-09-30T13:00:00Z' }, now)).toBe(true);
    expect(isStatusActive({ emoji: '🥤', until: '2026-09-30T11:00:00Z' }, now)).toBe(false);
  });
});

describe('cleanStatusText', () => {
  it('collapses whitespace and caps the length without splitting emojis', () => {
    expect(cleanStatusText('  Leg   Day \n heute ')).toBe('Leg Day heute');
    const long = '💪'.repeat(100);
    expect(Array.from(cleanStatusText(long))).toHaveLength(STATUS_MAX_TEXT);
  });
});
