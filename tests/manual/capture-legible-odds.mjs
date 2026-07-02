// One-off gallery capture for LEGIBLE ODDS (#166, epic #162 slice 4). Boots the game headless, squares up
// to a sail, STEERS to bring the foe abeam so the aim line reads, then frames the duel so the fair-fight
// READ docked in the aim indicator's `.aim-odds` slot is on screen — the plain verdict + damage/±20%-margin
// sub-line + the margin BAND — so the frame shows "can I read whether I'm favoured?" at a glance.
// Usage: node tests/manual/capture-legible-odds.mjs studio/qa/gallery/<tag>.png
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 8814;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const out = process.argv[2] || path.join(ROOT, 'studio', 'qa', 'gallery', 'legible-odds-166.png');

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
    // STEER to bring the foe abeam to starboard so the aim line reads and the odds slot docks beside it.
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
    // Let the quarter-view battle camera settle so both your ship + the abeam foe are on screen, then
    // sync the target marker (which recomputes the docked odds read) and render.
    for (let i = 0; i < 12; i++) tw.step(0.05);
    tw.qaSyncTargetMarker();
    const o = tw.odds();
    tw.qaRender();
    return { engaged, foeIdx, live: { verdict: o.live.verdict, tier: o.live.tier, shown: o.live.shown, marginPct: o.live.marginPct } };
  });
  await new Promise((r) => setTimeout(r, 150));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out });
  console.log('captured', out, JSON.stringify(info));
} finally {
  await browser.close();
  server.close();
}
