// Rewrites the static PWA files of a web export for hosting in a sub-folder
// (Expo's baseUrl covers the JS/assets; this covers index.html links + manifest)
// and adds 404.html as SPA fallback (GitHub Pages).
// Usage: node scripts/pwa-base.mjs apps/mobile/dist /Gymolingo
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';

const [dir, rawBase] = process.argv.slice(2);
if (!dir || !rawBase) throw new Error('Usage: node scripts/pwa-base.mjs <dist-dir> </base-path>');
const base = `/${rawBase.replace(/^\/|\/$/g, '')}`;
const esc = base.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const htmlPath = `${dir}/index.html`;
const html = readFileSync(htmlPath, 'utf8').replace(new RegExp(`(href|src)="/(?!${esc}/)`, 'g'), `$1="${base}/`);
writeFileSync(htmlPath, html);
copyFileSync(htmlPath, `${dir}/404.html`);

const mPath = `${dir}/manifest.webmanifest`;
const m = JSON.parse(readFileSync(mPath, 'utf8'));
m.start_url = `${base}/`;
m.scope = `${base}/`;
m.icons = m.icons.map((i) => ({ ...i, src: i.src.startsWith(`${base}/`) ? i.src : `${base}${i.src}` }));
writeFileSync(mPath, `${JSON.stringify(m, null, 2)}\n`);
console.log(`PWA files rewritten for base ${base}`);
