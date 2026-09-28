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
