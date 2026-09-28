import { describe, expect, it } from 'vitest';
import { latestNavyBodyFat, navyBodyFat } from '../src/body/bodyFat';
import type { BodyMeasurement } from '../src/types';

const m = (date: string, v: Partial<BodyMeasurement>): BodyMeasurement =>
  ({ id: date, user_id: 'u', date, waist_cm: null, chest_cm: null, hips_cm: null, arm_cm: null, thigh_cm: null, neck_cm: null, note: null, deleted: false, created_at: '', updated_at: '', ...v }) as BodyMeasurement;

describe('navy body fat', () => {
  it('male: 180 cm, waist 85, neck 38 → ~16 %', () => {
    expect(navyBodyFat({ sex: 'male', height_cm: 180, waist_cm: 85, neck_cm: 38 })).toBeCloseTo(16.1, 1);
  });
  it('female needs hips: 165 cm, waist 72, hips 98, neck 32 → ~27 %', () => {
    expect(navyBodyFat({ sex: 'female', height_cm: 165, waist_cm: 72, neck_cm: 32 })).toBeNull();
    expect(navyBodyFat({ sex: 'female', height_cm: 165, waist_cm: 72, neck_cm: 32, hips_cm: 98 })).toBeCloseTo(27.4, 1);
  });
  it('bigger waist → more body fat', () => {
    const a = navyBodyFat({ sex: 'male', height_cm: 180, waist_cm: 85, neck_cm: 38 })!;
    const b = navyBodyFat({ sex: 'male', height_cm: 180, waist_cm: 95, neck_cm: 38 })!;
    expect(b).toBeGreaterThan(a + 4);
  });
  it('implausible or missing input → null', () => {
    expect(navyBodyFat({ sex: 'male', height_cm: 180, waist_cm: 35, neck_cm: 38 })).toBeNull();
    expect(navyBodyFat({ sex: 'male', height_cm: null, waist_cm: 85, neck_cm: 38 })).toBeNull();
    expect(navyBodyFat({ sex: 'diverse', height_cm: 180, waist_cm: 85, neck_cm: 38 })).toBeNull();
  });
  it('uses the latest complete measurement', () => {
    const rows = [m('2026-01-01', { waist_cm: 95, neck_cm: 38 }), m('2026-02-01', { waist_cm: 85, neck_cm: 38 }), m('2026-03-01', { waist_cm: 80 })];
    expect(latestNavyBodyFat(rows, 'male', 180)).toEqual({ date: '2026-02-01', pct: 16.1 });
    expect(latestNavyBodyFat(rows, 'female', 165)).toBeNull();
  });
});
