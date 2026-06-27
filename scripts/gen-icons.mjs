// Rasterise the PWA app icon (assets/icons/icon.svg) into the PNG sizes the manifest +
// iOS "Add to Home Screen" need. Re-run after editing icon.svg:  node scripts/gen-icons.mjs
// Uses the puppeteer already pinned for the headless playtest — no new dependency.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ICONS = path.join(ROOT, 'assets', 'icons');
const svg = fs.readFileSync(path.join(ICONS, 'icon.svg'), 'utf8');

// name → square px size. 192/512 are the manifest essentials; 180 is the iOS apple-touch icon.
const SIZES = { 'icon-192.png': 192, 'icon-512.png': 512, 'apple-touch-180.png': 180 };

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
try {
  for (const [name, size] of Object.entries(SIZES)) {
    const page = await browser.newPage();
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    const html = `<!doctype html><meta charset="utf-8"><style>*{margin:0;padding:0}
      html,body{width:${size}px;height:${size}px;overflow:hidden}
      svg{width:${size}px;height:${size}px;display:block}</style>${svg}`;
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const out = path.join(ICONS, name);
    await page.screenshot({ path: out, omitBackground: false, clip: { x: 0, y: 0, width: size, height: size } });
    await page.close();
    console.log(`wrote ${path.relative(ROOT, out)} (${size}x${size})`);
  }
} finally {
  await browser.close();
}
