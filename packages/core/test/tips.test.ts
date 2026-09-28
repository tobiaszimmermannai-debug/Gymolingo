import { describe, expect, it } from 'vitest';
import { nutritionTips } from '../src/nutrition/tips';
import { dateRange } from '../src/dates';
import { meal, profile } from './fixtures';

describe('nutrition tips', () => {
  it('suggests diet-appropriate protein sources when protein is low', () => {
    const meals = dateRange('2026-03-01', '2026-03-07').flatMap((d) => [meal(d, 1100, 40, { meal: 'breakfast', fiber_g: 5 }), meal(d, 1100, 50, { fiber_g: 8 })]);
    const tips = nutritionTips(profile({ diet_type: 'vegan', protein_target_g: 150 }), meals, '2026-03-08');
    const t = tips.find((x) => x.id === 'protein-avg')!;
    expect(t.title).toContain('Ø 90 g');
    expect(t.text).toContain('Tofu');
    expect(tips.length).toBeLessThanOrEqual(3);
  });
  it('asks for more consistent logging with sparse data', () => {
    const tips = nutritionTips(profile(), [meal('2026-03-05', 800, 40)], '2026-03-08');
    expect(tips[0].id).toBe('consistency');
  });
  it('evening protein reminder for today', () => {
    const tips = nutritionTips(profile({ protein_target_g: 180 }), [meal('2026-03-08', 800, 60)], '2026-03-08', 19);
    expect(tips.some((t) => t.id === 'protein-today' && t.title.includes('120 g'))).toBe(true);
  });
});
