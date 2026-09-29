/** Locale-independent German number formatting (Hermes/Node safe). */
export function formatNumberDE(n: number, maxDecimals = 1): string {
  if (!Number.isFinite(n)) return '–';
  const factor = Math.pow(10, maxDecimals);
  const rounded = Math.round(n * factor) / factor;
  const [int, dec] = String(Math.abs(rounded)).split('.');
  const withSep = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${rounded < 0 ? '−' : ''}${withSep}${dec ? ',' + dec : ''}`;
}

export function formatKg(n: number): string {
  return `${formatNumberDE(n, 2)} kg`;
}

export function formatSigned(n: number, maxDecimals = 1, unit = ''): string {
  const s = formatNumberDE(Math.abs(n), maxDecimals);
  const sign = n > 0 ? '+' : n < 0 ? '−' : '±';
  return `${sign}${s}${unit ? ' ' + unit : ''}`;
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (x: number) => String(x).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** "gerade online", "vor 12 Min.", "heute 08:12", "gestern 21:40", "vor 3 Tagen", "am 12.08." */
export function formatLastSeen(iso: string | null, now = new Date()): string {
  if (!iso) return 'noch nie online';
  const t = new Date(iso);
  const mins = Math.floor((now.getTime() - t.getTime()) / 60000);
  if (mins < 5) return 'gerade online';
  if (mins < 60) return `vor ${mins} Min.`;
  const hhmm = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(now) - day(t)) / 86400000);
  if (days === 0) return `heute ${hhmm}`;
  if (days === 1) return `gestern ${hhmm}`;
  if (days < 30) return `vor ${days} Tagen`;
  return `am ${String(t.getDate()).padStart(2, '0')}.${String(t.getMonth() + 1).padStart(2, '0')}.`;
}
