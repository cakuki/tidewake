// One-off gallery capture for the dedicated BATTLE arena foe (#135, Option-4 final slice).
// Boots the game headless, teleports beside a sail, squares up, lets the foe MANEUVER for a few
// seconds (her dedicated duel helm seeks your beam / holds range), frames the duel and shoots it.
// Usage: node tests/manual/capture-arena-duel.mjs studio/qa/gallery/<tag>-arena-duel.png
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 8801;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const out = process.argv[2] || path.join(ROOT, 'studio', 'qa', 'gallery', 'arena-duel.png');

const server = await new Promise((resolve) => {
  const s = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  s.listen(PORT, () => resolve(s));
});
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction('window.__tidewake && window.__tidewake.ready === true', { timeout: 30000 });

  const info = await page.evaluate(async () => {
    const tw = window.__tidewake;
    // Nearest sail → drop in ~95u off her beam and square up.
    const s0 = tw.state.pos; let bi = -1, bd = Infinity;
    for (let i = 0; i < tw.npcs.length; i++) { const d = Math.hypot(tw.npcs[i].pos[0] - s0[0], tw.npcs[i].pos[1] - s0[2]); if (d < bd) { bd = d; bi = i; } }
    const fp = tw.npcs[bi].pos;
    tw.qaTeleport(fp[0] + 95, fp[1]);          // beside her, so both hulls frame together
    tw.step(0.05);
    const engaged = tw.engageBattle();
    // Let her run her dedicated duel helm — she comes about to hold range / seek your beam.
    const seen = new Set();
    for (let i = 0; i < 45; i++) { tw.step(0.1); if (tw.battle.foeHelm) seen.add(tw.battle.foeHelm); }
    // Frame the duel: pull back and up so BOTH the player sloop and the maneuvering foe are in shot.
    tw.qaFrameShip({ dist: 150, height: 78, az: 2.4, look: 4 });
    tw.qaRender();
    return { engaged, foeHelm: tw.battle.foeHelm, states: [...seen], foePos: tw.battle.foePos, shipPos: [tw.state.pos.x, tw.state.pos.z] };
  });
  await new Promise((r) => setTimeout(r, 150));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out });
  console.log('captured', out, JSON.stringify(info));
} finally {
  await browser.close();
  server.close();
}
