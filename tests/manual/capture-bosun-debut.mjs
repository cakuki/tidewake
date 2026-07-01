// One-off gallery capture for The Bosun's First Duel (#157). Boots the game headless on a COLD save,
// teleports beside a sail, squares up (the scaffolded SOFT debut fires), beats her into the boarding
// window so the bosun calls the BOARD verb aloud, frames the fight, and shoots the banner + battle HUD.
// Usage: node tests/manual/capture-bosun-debut.mjs studio/qa/gallery/<tag>-bosun-first-duel.png
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 8803;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const out = process.argv[2] || path.join(ROOT, 'studio', 'qa', 'gallery', 'bosun-first-duel-157.png');

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
    tw.newVoyage(); tw.step(0.1);              // a brand-new captain — the debut is armed
    const s0 = tw.state.pos; let bi = -1, bd = Infinity;
    for (let i = 0; i < tw.npcs.length; i++) { const d = Math.hypot(tw.npcs[i].pos[0] - s0[0], tw.npcs[i].pos[1] - s0[2]); if (d < bd) { bd = d; bi = i; } }
    const fp = tw.npcs[bi].pos;
    tw.qaTeleport(fp[0] + 80, fp[1]);          // beside her, both hulls in frame
    tw.step(0.05);
    const engaged = tw.engageBattle();         // the soft debut squares up + the bosun opens
    tw.step(0.2);
    // Beat her into the boarding window so the bosun CALLS the board verb aloud (the phase-2 cue).
    tw.battleWeaken(0.22); tw.step(0.2);
    const cue = tw.debutCue;
    tw.qaFrameShip({ dist: 150, height: 78, az: 2.4, look: 4 });
    tw.qaRender();
    return { engaged, debut: tw.battle.debut, enemyHull: tw.battle.enemyHull, maxHull: tw.battle.maxHull, canBoard: tw.battle.canBoard, cue };
  });
  await new Promise((r) => setTimeout(r, 200));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out });
  console.log('captured', out, JSON.stringify(info));
} finally {
  await browser.close();
  server.close();
}
