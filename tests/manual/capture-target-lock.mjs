// One-off gallery capture for TARGET LOCK (#161 slice 3). Boots the game headless, sails up beside a
// sail, squares up, lets the arena foe maneuver a beat, then frames the duel WIDE so both the ringed
// foe and the receded (dimmed) traffic read — the "I always know who I'm fighting" beat — and shoots it.
// Usage: node tests/manual/capture-target-lock.mjs studio/qa/gallery/<tag>-target-lock.png
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 8803;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const out = process.argv[2] || path.join(ROOT, 'studio', 'qa', 'gallery', 'target-lock-161.png');

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
    // Nearest sail → drop in ~95u off her beam and square up (both hulls frame together).
    const s0 = tw.state.pos; let bi = -1, bd = Infinity;
    for (let i = 0; i < tw.npcs.length; i++) { const d = Math.hypot(tw.npcs[i].pos[0] - s0[0], tw.npcs[i].pos[1] - s0[2]); if (d < bd) { bd = d; bi = i; } }
    const fp = tw.npcs[bi].pos;
    tw.qaTeleport(fp[0] + 95, fp[1]);
    tw.step(0.05);
    const engaged = tw.engageBattle();
    for (let i = 0; i < 30; i++) tw.step(0.1);   // let her run her duel helm a beat
    // Wide quarter framing so both hulls + any traffic are in shot; re-sync the ring to THIS camera.
    tw.qaFrameShip({ dist: 150, height: 78, az: 2.4, look: 4 });
    const lock = tw.qaSyncTargetMarker();
    tw.qaRender();
    return { engaged, foeIndex: tw.battle.foeIndex, lock: { active: lock.active, markerShown: lock.markerShown, onScreen: lock.onScreen, dimmed: lock.dimmed, foeOpacity: lock.foeOpacity } };
  });
  await new Promise((r) => setTimeout(r, 150));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out });
  console.log('captured', out, JSON.stringify(info));
} finally {
  await browser.close();
  server.close();
}
