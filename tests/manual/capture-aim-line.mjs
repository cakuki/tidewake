// One-off gallery capture for AIM-ANGLE FEEDBACK (#161 slice 5). Boots the game headless, squares up to
// a sail, STEERS to bring the foe dead abeam so the firing solution reads ON TARGET (the aim line lights
// green + tightens), then frames the duel WIDE so the whole aim line from ship→foe reads, and shoots it.
// Usage: node tests/manual/capture-aim-line.mjs studio/qa/gallery/<tag>-aim-line.png
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 8804;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const out = process.argv[2] || path.join(ROOT, 'studio', 'qa', 'gallery', 'aim-line-161.png');

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
    const norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const s0 = tw.state.pos; let bi = -1, bd = Infinity;
    for (let i = 0; i < tw.npcs.length; i++) { const d = Math.hypot(tw.npcs[i].pos[0] - s0[0], tw.npcs[i].pos[1] - s0[2]); if (d < bd) { bd = d; bi = i; } }
    const fp = tw.npcs[bi].pos;
    tw.qaTeleport(fp[0] + 95, fp[1]);
    tw.step(0.05);
    const engaged = tw.engageBattle();
    const foeIdx = tw.battle.foeIndex;
    // STEER to bring the foe dead abeam to starboard so the aim line lights ON TARGET (green + tight).
    for (let i = 0; i < 120 && tw.battle.active; i++) {
      const s = tw.state, foe = tw.npcs[foeIdx];
      if (!foe) break;
      const bearing = Math.atan2(foe.pos[0] - s.pos[0], foe.pos[1] - s.pos[2]);
      const err = norm((bearing - Math.PI / 2) - s.heading);
      tw.release('a'); tw.release('d');
      if (tw.battleAim().inArc && Math.abs(err) < 0.03) break;
      if (err > 0) tw.press('a'); else tw.press('d');
      tw.step(0.1);
    }
    tw.release('a'); tw.release('d');
    // Let the natural quarter-view battle camera settle so BOTH your ship (framed) and the abeam foe
    // (off the quarter) are on screen — the whole ship→foe aim line reads. Re-sync the ring + aim.
    for (let i = 0; i < 10; i++) tw.step(0.05);
    tw.qaSyncTargetMarker();
    const aim = tw.aimIndicator();
    tw.qaRender();
    return { engaged, foeIdx, aim: { level: aim.level, onTarget: aim.onTarget, spreadDeg: aim.spreadDeg, beamShown: aim.beamShown, onScreen: aim.onScreen } };
  });
  await new Promise((r) => setTimeout(r, 150));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out });
  console.log('captured', out, JSON.stringify(info));
} finally {
  await browser.close();
  server.close();
}
