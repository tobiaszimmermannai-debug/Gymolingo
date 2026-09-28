import { describe, expect, it } from 'vitest';
import { buildWeeklyReport, renderWeeklyReportText } from '../src/coach/report';
import { buildCoachContext } from '../src/coach/context';
import { answerOffline } from '../src/coach/offline';
import { buildDailyActivities, buildStreakInput, stepsByDate } from '../src/data/aggregate';
import { computeAllStreaks } from '../src/streaks/streaks';
import { addDays, dateRange } from '../src/dates';
import { emptyData, workout, meal, weight, steps, checkin } from './fixtures';

function richData() {
  const w = [
    workout('2026-02-23', 'bench-press', 80, [8, 8, 7], 2),
    workout('2026-02-25', 'squat', 100, [6, 6, 6], 2),
    workout('2026-03-02', 'bench-press', 80, [9, 8, 8], 2),
    workout('2026-03-04', 'squat', 102.5, [6, 6, 5], 1),
    workout('2026-03-06', 'bench-press', 82.5, [8, 8, 7], 2),
  ];
  const meals = dateRange('2026-03-02', '2026-03-08').flatMap((d, i) => (i < 5 ? [meal(d, 1100, 70), meal(d, 1000, 80)] : []));
  const weights = dateRange('2026-02-06', '2026-03-08').map((d, i) => weight(d, 86 - i * 0.05));
  const st = dateRange('2026-03-02', '2026-03-08').map((d, i) => steps(d, 7000 + i * 500));
  return emptyData({
    sessions: w.map((x) => x.session),
    sets: w.flatMap((x) => x.sets),
    meals,
    weights,
    steps: st,
    checkins: dateRange('2026-03-02', '2026-03-06').map((d) => checkin(d, { sleep_hours: 6.2 })),
  });
}

describe('weekly report', () => {
  const data = richData();
  const r = buildWeeklyReport(data, '2026-03-04');

  it('computes facts from data', () => {
    expect(r.weekStart).toBe('2026-03-02');
    expect(r.weekEnd).toBe('2026-03-08');
    expect(r.consistency.workoutsDone).toBe(3);
    expect(r.consistency.workoutsPlanned).toBe(3);
    expect(r.consistency.adherencePct).toBe(100);
    expect(r.nutrition.daysLogged).toBe(5);
    expect(r.nutrition.avgKcal).toBe(2100);
    expect(r.nutrition.avgProtein).toBe(150);
    expect(r.steps.daysLogged).toBe(7);
    expect(r.steps.avg).toBe(8500);
    expect(r.recovery.avgSleep).toBe(6.2);
    expect(r.strength.prs.length).toBeGreaterThan(0);
    expect(r.weight.weeklyRate30).toBeCloseTo(-0.35, 1);
  });

  it('exactly 3 prioritized recommendations incl. protein gap', () => {
    expect(r.recommendations).toHaveLength(3);
    expect(r.recommendations.map((x) => x.id)).toContain('protein');
  });

  it('renders 7 sections', () => {
    const t = renderWeeklyReportText(r);
    expect(t.sections).toHaveLength(7);
    expect(t.sections[2].body).toContain('2.100 kcal');
  });

  it('empty data produces a sensible report without invented numbers', () => {
    const e = buildWeeklyReport(emptyData(), '2026-03-04');
    expect(e.nutrition.avgKcal).toBeNull();
    expect(e.weight.avg7).toBeNull();
    const txt = renderWeeklyReportText(e);
    expect(txt.sections[3].body).toBe('Keine Gewichtsdaten in dieser Woche.');
    expect(e.recommendations.length).toBeGreaterThan(0);
  });
});

describe('aggregates, streak input and coach', () => {
  const data = richData();
  it('daily activities', () => {
    const acts = buildDailyActivities(data, '2026-03-02', '2026-03-08');
    const mon = acts.find((a) => a.date === '2026-03-02')!;
    expect(mon.workouts).toBe(1);
    expect(mon.workingSets).toBe(3);
    expect(mon.nutritionLogged).toBe(true);
    expect(mon.checkin).toBe(true);
    expect(mon.prs).toBe(1);
  });
  it('manual steps win over health data', () => {
    const m = stepsByDate([steps('2026-03-02', 5000), steps('2026-03-02', 9000, { source: 'apple_health' })]);
    expect(m.get('2026-03-02')!.steps).toBe(5000);
  });
  it('streaks from data', () => {
    const s = computeAllStreaks(buildStreakInput(data, '2026-03-08', '2026-02-23'));
    // week 1 had only 2 of 3 workouts → streak broke on Saturday; week 2 fully kept
    expect(s.training.current).toBe(7);
    expect(s.checkin.best).toBe(5);
  });
  it('coach context and offline answers use only stored facts', () => {
    const ctx = buildCoachContext(data, '2026-03-08');
    expect(ctx.key_lifts.map((l) => l.exercise)).toEqual(expect.arrayContaining(['Bankdrücken (Langhantel)', 'Kniebeuge (Langhantel)']));
    expect(ctx.weight.latest).toBeCloseTo(84.5, 1);
    expect(answerOffline(ctx, 'Wie viel Protein fehlt mir heute?')).toContain('180 g');
    expect(answerOffline(ctx, 'Was soll ich beim Bankdrücken machen?')).toContain('Vorschlag');
    expect(answerOffline(ctx, 'Wie ist mein Gewichtstrend?')).toContain('7-Tage-Schnitt');
    const empty = buildCoachContext(emptyData(), '2026-03-08');
    expect(answerOffline(empty, 'Gewicht?')).toContain('noch keine Gewichtsdaten');
    expect(empty.data_gaps.length).toBeGreaterThan(0);
  });
  it('dates helper sanity', () => {
    expect(addDays('2026-03-31', 1)).toBe('2026-04-01');
  });
});
