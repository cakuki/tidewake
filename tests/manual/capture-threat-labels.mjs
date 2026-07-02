// One-off gallery capture for OVER-SHIP THREAT LABELS (#165, epic #162 slice 3). Boots the game headless,
// poses a sloop, a middling scrapper and a man-o'-war on the same sea ahead of the player's bow, and lets
// the threat-labels system tag each with its class + threat glyph — so the frame shows the whole "pick your
// fight" read at a glance: a green "Merchant Sloop ·" prize beside a red "Warship Man-o'-War ☠☠☠☠" terror.
// Usage: node tests/manual/capture-threat-labels.mjs [out.png]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 8811;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const out = process.argv[2] || path.join(ROOT, 'studio', 'qa', 'gallery', 'threat-labels-165.png');

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
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction('window.__tidewake && window.__tidewake.ready === true', { timeout: 30000 });

  const info = await page.evaluate(async () => {
    const tw = window.__tidewake;
    const fleet = tw.npcs.map((n, i) => ({ i, cls: n.shipClass && n.shipClass.cls, tier: n.shipClass && n.shipClass.tier }));
    const sorted = fleet.filter((f) => f.tier > 0).sort((a, b) => a.tier - b.tier);
    const low = sorted[0] ? sorted[0].i : -1;                 // tamest prize
    const mid = sorted.length >= 3 ? sorted[1].i : -1;        // middling
    const high = sorted[sorted.length - 1] ? sorted[sorted.length - 1].i : -1; // deadliest afloat
    tw.qaTeleport(0, -40);
    for (let k = 0; k < 26; k++) tw.step(0.05);               // ease off the dock; chase cam settles ahead
    const P = tw.state.pos, px = P[0], pz = P[2], h = tw.state.heading; // state.pos is [x,y,z]
    const fwd = [Math.sin(h), Math.cos(h)], right = [Math.cos(h), -Math.sin(h)];
    const put = (idx, ahead, side) => { if (idx >= 0) tw.qaPlaceShip(idx, px + fwd[0] * ahead + right[0] * side, pz + fwd[1] * ahead + right[1] * side); };
    put(low, 130, -120);   // little prize, port bow
    put(mid, 190, -10);    // middling, ahead
    put(high, 150, 130);   // the towering terror, starboard bow
    tw.step(0.03);         // one tick so the meshes snap onto the swell + the chase cam holds behind
    const labels = tw.qaSyncThreatLabels();
    tw.qaRender();         // render with the natural chase camera
    return { fleet, low, mid, high, labels: labels.labels.filter((l) => l.shown).map((l) => ({ i: l.index, text: l.text, level: l.level })) };
  });
  await new Promise((r) => setTimeout(r, 200));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out });
  console.log('captured', out, JSON.stringify(info));
} finally {
  await browser.close();
  server.close();
}
