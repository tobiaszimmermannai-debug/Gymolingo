import { describe, expect, it } from 'vitest';
import { ACTIVITIES, activityLabel, cardioKcal, catalogMet, countsAsTraining, isNetActivity, kcalPer30Min, levelLabel, searchActivities } from '../src';

describe('activity catalog', () => {
  it('has unique ids that fit the database pattern and sane METs', () => {
    expect(new Set(ACTIVITIES.map((a) => a.id)).size).toBe(ACTIVITIES.length);
    expect(ACTIVITIES.length).toBeGreaterThan(80);
    for (const a of ACTIVITIES) {
      expect(a.id).toMatch(/^[a-z0-9_]{2,32}$/);
      const mets = Array.isArray(a.met) ? a.met : [a.met];
      for (const m of mets) expect(m).toBeGreaterThanOrEqual(1.3), expect(m).toBeLessThanOrEqual(16);
      if (Array.isArray(a.met)) expect(a.met[0]).toBeLessThanOrEqual(a.met[2]);
    }
  });

  it('covers popular sports and everyday life – including sex', () => {
    for (const id of ['soccer', 'tennis', 'swim', 'bike', 'yoga', 'vacuuming', 'mowing', 'stairs', 'sex']) expect(activityLabel(id)).not.toBe('Aktivität');
    expect(levelLabel('sex', 'intense')).toBe('Leidenschaftlich');
  });

  it('sports count as training days, everyday activities do not', () => {
    expect(countsAsTraining('soccer')).toBe(true);
    expect(countsAsTraining('ems')).toBe(true);
    expect(countsAsTraining('walk')).toBe(false);
    expect(countsAsTraining('vacuuming')).toBe(false);
    expect(countsAsTraining('sex')).toBe(false);
    expect(countsAsTraining('does_not_exist')).toBe(false);
  });

  it('search finds synonyms without accents', () => {
    expect(searchActivities('fussball').map((a) => a.id)).toContain('soccer');
    expect(searchActivities('Federball').map((a) => a.id)).toContain('badminton');
    expect(searchActivities('saugen').map((a) => a.id)).toContain('vacuuming');
    expect(searchActivities('')).toHaveLength(ACTIVITIES.length);
  });
});

describe('calories', () => {
  it('sports count gross: soccer match 90 min at 85 kg = 10 MET × 85 × 1.5', () => {
    expect(cardioKcal({ activity: 'soccer', intensity: 'intense', duration_min: 90, distance_km: null }, 85)).toBe(1275);
    expect(catalogMet('tennis', 'light')).toBe(6.0);
  });

  it('everyday activities count only the extra above rest (MET − 1)', () => {
    expect(isNetActivity('vacuuming')).toBe(true);
    // (3.3 − 1) × 85 kg × 20/60 h = 65.2
    expect(cardioKcal({ activity: 'vacuuming', intensity: 'medium', duration_min: 20, distance_km: null }, 85)).toBe(65);
    // (3.5 − 1) × 85 × 25/60 = 88.5
    expect(cardioKcal({ activity: 'sex', intensity: 'intense', duration_min: 25, distance_km: null }, 85)).toBe(89);
  });

  it('cycling uses the speed when a distance is given', () => {
    // 20 km in 60 min → 20 km/h → 8.0 MET
    expect(cardioKcal({ activity: 'bike', intensity: 'light', duration_min: 60, distance_km: 20 }, 80)).toBe(640);
    // no distance → level (light 4.0)
    expect(cardioKcal({ activity: 'bike', intensity: 'light', duration_min: 60, distance_km: null }, 80)).toBe(320);
  });

  it('unknown ids from newer app versions still get a moderate estimate', () => {
    expect(cardioKcal({ activity: 'teleport', intensity: 'medium', duration_min: 60, distance_km: null }, 70)).toBe(280);
  });

  it('list value = 30 min at medium level', () => {
    expect(kcalPer30Min('swim', 80)).toBe(332);
  });
});
