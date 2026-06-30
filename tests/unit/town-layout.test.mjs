// Town / port view layout contract (#146, owner 2026-06-30). The port view kept clipping on
// small/mobile viewports because the panel was a flat stack with a fixed max-height and no scroll
// region — the quayside content spilled past the box and the "Set Sail" plank slid off-screen,
// unreachable. The fix: the growable content lives in a scrollable BODY (.town-scroll) and the
// "Set Sail" plank stays a PINNED footer OUTSIDE it. This test locks that structure so a future
// edit can't silently flatten the panel back into a clipping stack.
//
// No jsdom in this repo, so we drive createTown() with a tiny fake panel that just captures the
// HTML it's handed. We assert on that markup, the same string the browser renders.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTown } from '../../src/ui/town.js';

function fakePanel() {
  return {
    innerHTML: '',
    _listeners: {},
    addEventListener(type, fn) { this._listeners[type] = fn; },
    setAttribute() {},
    classList: { _set: new Set(), add(c) { this._set.add(c); }, remove(c) { this._set.delete(c); }, toggle(c, on) { if (on) this._set.add(c); else this._set.delete(c); }, contains(c) { return this._set.has(c); } },
  };
}

function fakeRoot(panel) {
  return {
    querySelector: (sel) => (sel === '#town' ? panel : null),
    body: { classList: { contains: () => false } }, // not a touch device for this test
  };
}

function renderTown() {
  const panel = fakePanel();
  const root = fakeRoot(panel);
  const state = {
    port: 'Saltpurse Quay', coins: 120, cargo: {}, renown: 0, infamy: 0, standing: 0,
    harbour: null, threat: null,
  };
  const town = createTown({ root, getState: () => state });
  town.setOpen(true); // builds + renders the panel
  return panel.innerHTML;
}

test('#146: the port view renders a scrollable body (.town-scroll)', () => {
  const html = renderTown();
  assert.ok(html.includes('class="town-scroll"'), 'the growable port content must live in a .town-scroll body so it can never clip');
});

test('#146: the Set Sail plank is a PINNED footer OUTSIDE the scroll body', () => {
  const html = renderTown();
  // The leave button must immediately follow the scroll wrapper's close — i.e. it is a sibling
  // footer, not a child of the scrollable region — so it stays on screen however tall the port is.
  assert.match(
    html,
    /<div class="town-scroll">[\s\S]*<\/div>\s*<button id="town-leave"/,
    'Set Sail must sit after </div> of .town-scroll (a pinned footer), not inside the scroll body',
  );
});

test('#146: the market board lives INSIDE the scrollable body', () => {
  const html = renderTown();
  const scrollOpen = html.indexOf('class="town-scroll"');
  const leaveBtn = html.indexOf('id="town-leave"');
  const market = html.indexOf('town-market-h');
  assert.ok(scrollOpen >= 0 && market >= 0 && leaveBtn >= 0, 'all anchors present');
  assert.ok(market > scrollOpen && market < leaveBtn, 'the market (a growable section) must be inside the scroll body, above the pinned footer');
});
