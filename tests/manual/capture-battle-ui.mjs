// One-off gallery capture for the NON-OCCLUDING battle UI (#161 slice 2). Boots the game headless,
// teleports beside a sail, squares up, weakens the foe a touch so the fight prompt is fully lit,
// lets the battle camera frame the ship centre-screen, and shoots the frame — showing the docked
// fight panel at the LOWER band with the ship + foe VISIBLE in the clear centre (the owner's fix:
// "the popup covers my ship" → prompts now frame the action instead of blocking it).
// Usage: node tests/manual/capture-battle-ui.mjs studio/qa/gallery/<tag>-battle-ui.png
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 8802;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const out = process.argv[2] || path.join(ROOT, 'studio', 'qa', 'gallery', 'battle-ui.png');

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
    const s0 = tw.state.pos; let bi = -1, bd = Infinity;
    for (let i = 0; i < tw.npcs.length; i++) { const d = Math.hypot(tw.npcs[i].pos[0] - s0[0], tw.npcs[i].pos[1] - s0[2]); if (d < bd) { bd = d; bi = i; } }
    const fp = tw.npcs[bi].pos;
    tw.qaTeleport(fp[0], fp[1] - 110);       // just off her beam so both hulls frame together
    tw.step(0.05);
    const engaged = tw.engageBattle();
    tw.battleWeaken?.();                       // dent her hull so the bars + BOARD prompt read fully
    // Let the battle camera settle its quarter-view framing + the hud paint the docked panel.
    for (let i = 0; i < 12; i++) tw.step(0.1);
    tw.qaRender();
    const check = tw.battleUICentreClear();
    return { engaged, clear: check.clear, shown: check.panels.filter((p) => p.shown).map((p) => p.id), zone: check.zone };
  });
  await new Promise((r) => setTimeout(r, 150));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out });
  console.log('captured', out, JSON.stringify(info));
} finally {
  await browser.close();
  server.close();
}
