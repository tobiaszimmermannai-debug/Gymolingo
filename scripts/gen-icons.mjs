/**
 * Renders the app icon set from assets-src/mark.svg with the bundled Chromium
 * (no image tooling needed): `node scripts/gen-icons.mjs`.
 */
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const root = new URL('..', import.meta.url).pathname;
const out = `${root}apps/mobile/assets/images/`;
const markPath = readFileSync(`${root}assets-src/mark.svg`, 'utf8').match(/<path[^>]*\/>/)[0];
const BG = '#0B0C0E';
// Brand colors of the icon (blue). The app UI itself keeps its own theme.
const BLUE_TOP = '#3B82F6';
const BLUE_BOTTOM = '#1D4ED8';
const BLUE_MARK = '#3B82F6';
const WHITE = '#FFFFFF';

/** mark scaled to `scale` of the canvas, centered */
function svg({ size, scale, color = WHITE, bg = null, glow = false, radius = 0 }) {
  const m = markPath.replace('#FFFFFF', color);
  const s = scale; // 100-unit mark → scale * size px
  const off = (100 - 100 * (1 / s)) / 2;
  const vb = `${off} ${off} ${100 / s} ${100 / s}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${vb}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${BLUE_TOP}"/><stop offset="1" stop-color="${BLUE_BOTTOM}"/></linearGradient>
      <radialGradient id="glow" cx="50" cy="45" r="46" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.18"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
    </defs>
    ${bg ? `<rect x="${off}" y="${off}" width="${100 / s}" height="${100 / s}" rx="${radius / s}" fill="${bg === 'gradient' ? 'url(#bg)' : bg}"/>` : ''}
    ${glow ? '<circle cx="50" cy="50" r="42" fill="url(#glow)"/>' : ''}
    ${m}
  </svg>`;
}

const jobs = [
  ['icon.png', { size: 1024, scale: 0.62, bg: 'gradient', glow: true }],
  ['android-icon-foreground.png', { size: 1024, scale: 0.5 }],
  ['android-icon-background.png', { size: 1024, scale: 1, bg: 'gradient', color: 'transparent' }],
  ['android-icon-monochrome.png', { size: 1024, scale: 0.5, color: '#FFFFFF' }],
  ['splash-icon.png', { size: 1024, scale: 1, color: BLUE_MARK }],
  ['favicon.png', { size: 48, scale: 0.72, bg: 'gradient', radius: 22 }],
  ['../../public/icons/pwa-192.png', { size: 192, scale: 0.62, bg: 'gradient', glow: true }],
  ['../../public/icons/pwa-512.png', { size: 512, scale: 0.62, bg: 'gradient', glow: true }],
  ['../../public/icons/pwa-maskable-512.png', { size: 512, scale: 0.45, bg: 'gradient', glow: true }],
  ['../../public/icons/apple-touch-icon.png', { size: 180, scale: 0.62, bg: 'gradient', glow: true }],
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const page = await browser.newPage();
for (const [file, opts] of jobs) {
  await page.setViewportSize({ width: opts.size, height: opts.size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg(opts)}</body></html>`);
  await page.locator('svg').screenshot({ path: out + file, omitBackground: true });
  console.log('wrote', file);
}
await browser.close();
