/**
 * Fun status messages for friends: one emoji + a short sport-meme line
 * ("🥤 Monster Zero White intus"). Presets are grouped for the picker;
 * a custom status uses any emoji and up to STATUS_MAX_TEXT characters.
 */
export interface StatusPreset {
  emoji: string;
  text: string;
}

export interface StatusGroup {
  title: string;
  items: StatusPreset[];
}

export const STATUS_MAX_TEXT = 60;

export const STATUS_GROUPS: StatusGroup[] = [
  {
    title: 'Treibstoff',
    items: [
      { emoji: '🥤', text: 'Monster Zero White intus – Pump incoming' },
      { emoji: '☕', text: 'Pre-Workout: 3 Espresso, 0 Schlaf' },
      { emoji: '🧃', text: 'Kreatin geladen – 5 g, wie jeden Tag' },
      { emoji: '🥛', text: 'Shaker leer, Proteinspeicher voll' },
      { emoji: '🍚', text: 'Meal Prep: 14 Dosen Reis mit Hähnchen' },
      { emoji: '🍕', text: 'Cheat Day – Makros? Nie gehört' },
    ],
  },
  {
    title: 'Gym',
    items: [
      { emoji: '🦵', text: 'Leg Day – Treppen sind heute der Endgegner' },
      { emoji: '💪', text: 'Pump so krass, T-Shirt zu klein' },
      { emoji: '📈', text: 'PR-Jagd – heute fällt ein Rekord' },
      { emoji: '🦍', text: 'Gorilla-Modus aktiviert' },
      { emoji: '🏋️', text: 'Nur noch ein Satz … sagte ich vor 5 Sätzen' },
      { emoji: '🪞', text: 'Spiegel-Check zwischen den Sätzen' },
      { emoji: '⚡', text: 'EMS gegrillt – Muskeln brutzeln noch' },
      { emoji: '🏃', text: 'Cardio? Ich dachte, das ist ein Tippfehler' },
    ],
  },
  {
    title: 'Danach',
    items: [
      { emoji: '😵‍💫', text: 'Muskelkater – Hinsetzen dauert 3 Minuten' },
      { emoji: '😴', text: 'Rest Day – Gains wachsen im Schlaf' },
      { emoji: '🛋️', text: 'Aktive Regeneration (Couch)' },
      { emoji: '🧊', text: 'Eisbad überlebt – knapp' },
    ],
  },
  {
    title: 'Tech-Modus',
    items: [
      { emoji: '💾', text: 'Gains gespeichert – Autosave an' },
      { emoji: '🔋', text: 'Akku 3 % – Lade Kohlenhydrate' },
      { emoji: '🐛', text: 'Bug im Knie – Patch folgt' },
      { emoji: '📊', text: 'Makros im Tabellenblatt optimiert' },
      { emoji: '🔄', text: 'Bulk v2.0 wird installiert …' },
      { emoji: '✂️', text: 'Cut läuft – bitte nicht mit Essen stören' },
      { emoji: '🚀', text: 'Deploy nach Gym: erfolgreich' },
      { emoji: '🤖', text: 'Der Coach sagt: noch ein Satz' },
    ],
  },
];

export const STATUS_PRESETS: StatusPreset[] = STATUS_GROUPS.flatMap((g) => g.items);

/** Emojis offered for a custom status. */
export const STATUS_EMOJIS = ['🥤', '💪', '🦵', '🔥', '⚡', '😴', '😵‍💫', '🏃', '🚴', '🏊', '🧘', '🍚', '🍕', '🥛', '☕', '📈', '🦍', '🐻', '🤖', '🚀', '🎧', '🧊', '🤕', '🎉'];

export type StatusDuration = 'today' | '3days' | 'forever';

export const STATUS_DURATION_LABELS: Record<StatusDuration, string> = {
  today: 'Heute',
  '3days': '3 Tage',
  forever: 'Bis ich es ändere',
};

/** When a status set now with this duration expires (null = never). "Heute" ends at local midnight. */
export function statusUntil(duration: StatusDuration, now: Date = new Date()): string | null {
  if (duration === 'forever') return null;
  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  if (duration === '3days') end.setDate(end.getDate() + 2);
  return end.toISOString();
}

/** A status is shown while it has an emoji and has not expired. */
export function isStatusActive(status: { emoji?: string | null; until?: string | null } | null | undefined, now: Date = new Date()): boolean {
  if (!status?.emoji) return false;
  return !status.until || new Date(status.until).getTime() > now.getTime();
}

/** Trims and caps a custom status text. */
export function cleanStatusText(text: string): string {
  return Array.from(text.replace(/\s+/g, ' ').trim()).slice(0, STATUS_MAX_TEXT).join('');
}
