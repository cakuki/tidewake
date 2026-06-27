// Unit: the PWA install contract (#63). The manifest + its <head> wiring are static
// artifacts, so we pin the fields a browser needs to offer "Add to Home Screen" and the
// icon files those fields point at. Catches a typo'd path / dropped icon before it ships.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

test('manifest has the fields a browser needs to offer install', () => {
  assert.ok(manifest.name && manifest.short_name, 'name + short_name');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.start_url, 'start_url');
  assert.match(manifest.theme_color, /^#[0-9a-fA-F]{6}$/);
  assert.match(manifest.background_color, /^#[0-9a-fA-F]{6}$/);
});

test('manifest ships a 192 + 512 + maskable icon, and the files exist', () => {
  const bySize = (s) => manifest.icons.filter((i) => i.sizes === s);
  assert.ok(bySize('192x192').length >= 1, 'a 192 icon');
  assert.ok(bySize('512x512').length >= 1, 'a 512 icon');
  assert.ok(manifest.icons.some((i) => /maskable/.test(i.purpose || '')), 'a maskable icon');
  for (const icon of manifest.icons) {
    assert.ok(fs.existsSync(path.join(ROOT, icon.src)), `icon file present: ${icon.src}`);
  }
});

test('index.html wires the manifest, theme-color and the iOS apple-touch icon', () => {
  assert.match(html, /<link[^>]+rel="manifest"[^>]+href="manifest\.webmanifest"/);
  assert.match(html, /<meta[^>]+name="theme-color"/);
  const appleHref = html.match(/rel="apple-touch-icon"[^>]+href="([^"]+)"/);
  assert.ok(appleHref, 'apple-touch-icon link present');
  assert.ok(fs.existsSync(path.join(ROOT, appleHref[1])), `apple-touch icon file exists: ${appleHref[1]}`);
});

test('index.html keeps a responsive, device-width viewport meta', () => {
  const viewport = html.match(/<meta[^>]+name="viewport"[^>]+content="([^"]+)"/);
  assert.ok(viewport, 'viewport meta present');
  assert.match(viewport[1], /width=device-width/);
});
