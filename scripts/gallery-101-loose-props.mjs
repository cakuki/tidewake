// One-shot gallery capture for #101 (props phase 3) — "the port feels lived-in". Make landfall and the
// quay has glowing LANTERNS striding down the jetty + a little cluster of market STALLS at its foot, so
// a port reads as a PLACE people live rather than a bare marker. Frames a dressed port from seaward with
// the UI hidden so only the 3D quay shows. Writes studio/qa/gallery/loose-props-101.png. Not a gate — a
// QA/owner visual.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8807;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const OUT = path.join(ROOT, 'studio', 'qa', 'gallery', 'loose-props-101.png');

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(PORT, r));

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 760, deviceScaleFactor: 1 });
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction('window.__tidewake && window.__tidewake.ready === true', { timeout: 30000 });

  const meta = await page.evaluate(async () => {
    const tw = window.__tidewake;
    tw.newVoyage(); tw.step(0.1);
    // Drop just off the nearest port so its cluster draws (within the town-view cull radius).
    let best = null, bd = Infinity;
    for (const p of tw.ports) { const d = Math.hypot(p.pos[0] - tw.state.pos[0], p.pos[1] - tw.state.pos[2]); if (d < bd) { bd = d; best = p; } }
    tw.qaTeleport(best.pos[0] + 120, best.pos[1]); tw.step(0.2);
    const place = (tw.portPlacements || []).find((p) => p.name === best.name) || { x: best.pos[0], z: best.pos[1], angle: 0 };
    return { name: best.name, x: place.x, z: place.z, angle: place.angle, snap: tw.townProps };
  });

  // Hide every UI overlay so only the 3D quay shows, and frame the port from seaward looking landward.
  await page.evaluate((m) => {
    const tw = window.__tidewake;
    for (const el of Array.from(document.body.children)) { if (el.id !== 'app' && el.id !== 'juice-flash') el.style.display = 'none'; }
    document.body.classList.remove('town');
    tw._qaCam = { at: { x: m.x, y: 5, z: m.z + 12 }, az: m.angle, dist: 68, height: 30 };
  }, meta);

  // Warm up the swiftshader pipeline — the first screenshot after a camera change can come back blank.
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ type: 'png' }); // discarded
  await new Promise((r) => setTimeout(r, 400));

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await page.screenshot({ path: OUT, type: 'png', clip: { x: 90, y: 70, width: 820, height: 620 } });
  console.log('wrote', OUT, '· port:', meta.name, '· loose props drawn:', meta.snap.visible, 'of', meta.snap.count, '(' + meta.snap.kinds.join('+') + ')');
} finally {
  await browser.close();
  server.close();
}
