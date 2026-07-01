// One-off gallery capture for SHIP CLASSES (#163, epic #162 foundation). Boots the game headless, then
// poses a sloop, a frigate and a man-o'-war on the same sea flanking the player's own hull, and frames
// them WIDE from astern so the size ladder reads at a glance — a man-o'-war visibly dwarfing a darting
// sloop, the sea's new pecking order. Usage: node tests/manual/capture-ship-classes.mjs [out.png]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 8807;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const out = process.argv[2] || path.join(ROOT, 'studio', 'qa', 'gallery', 'ship-classes-163.png');

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
    const fleet = tw.npcs.map((n, i) => ({ i, cls: n.shipClass && n.shipClass.cls, scale: n.shipClass && n.shipClass.sizeScale }));
    const idxOf = (c) => { const f = fleet.find((x) => x.cls === c); return f ? f.i : -1; };
    const small = idxOf('sloop'), mid = idxOf('frigate'), big = idxOf('manowar');
    // Nudge her a touch off the exact dock point (clears the cast-off fade → bright daylight) and let the
    // chase camera settle. A short run — too brief for an ambient founderer to pop a modal.
    tw.qaTeleport(0, -40);
    for (let k = 0; k < 26; k++) tw.step(0.05);
    // Pose the three classes flanking the player just ahead of her bow (her own hull is the scale anchor),
    // all at a similar range so pure size — man-o'-war ≫ frigate ≫ sloop — reads directly. Placed along
    // the player's live heading so they sit inside the natural over-the-bow chase frame.
    const P = tw.state.pos, px = P[0], pz = P[2], h = tw.state.heading; // state.pos is [x, y, z]
    const fwd = [Math.sin(h), Math.cos(h)], right = [Math.cos(h), -Math.sin(h)];
    const put = (idx, ahead, side) => { if (idx >= 0) tw.qaPlaceShip(idx, px + fwd[0] * ahead + right[0] * side, pz + fwd[1] * ahead + right[1] * side); };
    put(small, 60, -110); // little sloop, far side (reads small)
    put(mid, 120, -55);   // frigate, mid — clear of the player's hull
    put(big, 85, 120);    // man-o'-war, near side (towers)
    tw.step(0.03); // one tick so the meshes snap onto the swell + the chase cam holds behind the player
    tw.qaRender(); // render with the natural chase camera (last positioned by the step above)
    const scr = (i) => (i >= 0 ? tw.qaShipScreen(i) : null);
    return { fleet, small, mid, big, player: [px, pz], heading: h, npcPos: tw.npcs.map((n) => n.pos), screens: { small: scr(small), mid: scr(mid), big: scr(big) } };
  });
  await new Promise((r) => setTimeout(r, 200));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out });
  console.log('captured', out, JSON.stringify(info));
} finally {
  await browser.close();
  server.close();
}
