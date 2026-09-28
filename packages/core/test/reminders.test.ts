import { describe, expect, it } from 'vitest';
import { planRemindersForDay, isQuiet, openTasks, DEFAULT_REMINDER_SETTINGS, type ReminderDayState } from '../src/reminders/engine';

const state = (over: Partial<ReminderDayState> = {}): ReminderDayState => ({
  date: '2026-03-10',
  displayName: 'Tobi',
  isTrainingDay: true,
  plannedWorkoutName: 'Push A',
  workoutHint: 'Bankdrücken: 80 kg × 9/8/8',
  workoutDone: false,
  activeWorkoutStartedMin: null,
  mealsLogged: 0,
  calorieTarget: 2300,
  caloriesRemaining: 2300,
  proteinTarget: 180,
  proteinRemaining: 180,
  stepsLogged: false,
  stepTarget: 10000,
  weighed: false,
  weightTrackingEnabled: true,
  checkinDone: false,
  streakAtRisk: { label: 'Check-in', days: 12 },
  openChallenges: ['5 Tage Proteinziel'],
  paused: false,
  preferredWorkoutTime: '18:00',
  isWeeklyReportDay: false,
  ...over,
});

describe('reminder engine', () => {
  it('quiet hours wrap midnight', () => {
    expect(isQuiet(23 * 60, '22:00', '07:00')).toBe(true);
    expect(isQuiet(6 * 60, '22:00', '07:00')).toBe(true);
    expect(isQuiet(12 * 60, '22:00', '07:00')).toBe(false);
    expect(isQuiet(13 * 60, '12:00', '14:00')).toBe(true);
  });

  it('respects the daily maximum and sorts by time', () => {
    const r = planRemindersForDay(DEFAULT_REMINDER_SETTINGS, state(), null);
    expect(r.length).toBe(DEFAULT_REMINDER_SETTINGS.max_per_day);
    const times = r.map((x) => x.time);
    expect([...times].sort()).toEqual(times);
    // highest priorities are kept: evening tier 1 and pre-workout
    expect(r.some((x) => x.category === 'evening' && x.tier === 1)).toBe(true);
    expect(r.some((x) => x.category === 'pre_workout' && x.time === '17:00')).toBe(true);
  });

  it('never schedules inside quiet hours; follow-ups are clamped', () => {
    const r = planRemindersForDay({ ...DEFAULT_REMINDER_SETTINGS, intensity: 'persistent', max_per_day: 20, evening_time: '21:00' }, state(), null);
    const evening = r.filter((x) => x.category === 'evening');
    expect(evening.map((x) => x.time)).toEqual(['21:00', '21:50']);
    for (const x of r) expect(isQuiet(Number(x.time.slice(0, 2)) * 60 + Number(x.time.slice(3)), '22:00', '07:00')).toBe(false);
  });

  it('removes reminders for completed goals', () => {
    const r = planRemindersForDay({ ...DEFAULT_REMINDER_SETTINGS, max_per_day: 20 }, state({ workoutDone: true, checkinDone: true, stepsLogged: true, weighed: true, mealsLogged: 4, proteinRemaining: 0 }), null);
    expect(r.map((x) => x.category)).toEqual(['morning']);
  });

  it('only future reminders when now is given; nothing when disabled or paused', () => {
    const r = planRemindersForDay(DEFAULT_REMINDER_SETTINGS, state(), 19 * 60);
    expect(r.every((x) => x.time > '19:00')).toBe(true);
    expect(planRemindersForDay({ ...DEFAULT_REMINDER_SETTINGS, enabled: false }, state(), null)).toEqual([]);
    expect(planRemindersForDay(DEFAULT_REMINDER_SETTINGS, state({ paused: true }), null)).toEqual([]);
  });

  it('gentle intensity sends a single evening reminder; copy is non-shaming', () => {
    const r = planRemindersForDay({ ...DEFAULT_REMINDER_SETTINGS, intensity: 'gentle', max_per_day: 20 }, state(), null);
    expect(r.filter((x) => x.category === 'evening')).toHaveLength(1);
    const text = r.map((x) => `${x.title} ${x.body}`).join(' ').toLowerCase();
    for (const bad of ['versagt', 'faul', 'enttäusch', 'schäm', 'schuld']) expect(text).not.toContain(bad);
  });

  it('unfinished workout reminder 2h after start', () => {
    const r = planRemindersForDay({ ...DEFAULT_REMINDER_SETTINGS, max_per_day: 20 }, state({ activeWorkoutStartedMin: 18 * 60 }), null);
    expect(r.find((x) => x.category === 'post_workout')?.time).toBe('20:00');
  });

  it('open tasks', () => {
    const t = openTasks(state({ mealsLogged: 2, proteinRemaining: 40, caloriesRemaining: 900 }));
    expect(t.map((x) => x.id)).toEqual(['workout', 'nutrition', 'weight', 'checkin']);
    expect(t[1].subtitle).toContain('40 g Protein');
  });
});
