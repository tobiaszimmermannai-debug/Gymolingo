import { describe, expect, it } from 'vitest';
import { formatLastSeen } from '../src/format';

describe('formatLastSeen', () => {
  const now = new Date(2026, 8, 29, 18, 0);
  const at = (d: number, h: number, m: number) => new Date(2026, 8, d, h, m).toISOString();
  it('relative wording', () => {
    expect(formatLastSeen(null, now)).toBe('noch nie online');
    expect(formatLastSeen(at(29, 17, 58), now)).toBe('gerade online');
    expect(formatLastSeen(at(29, 17, 20), now)).toBe('vor 40 Min.');
    expect(formatLastSeen(at(29, 8, 12), now)).toBe('heute 08:12');
    expect(formatLastSeen(at(28, 21, 40), now)).toBe('gestern 21:40');
    expect(formatLastSeen(at(26, 9, 0), now)).toBe('vor 3 Tagen');
    expect(formatLastSeen(new Date(2026, 7, 12, 9, 0).toISOString(), now)).toBe('am 12.08.');
  });
});
