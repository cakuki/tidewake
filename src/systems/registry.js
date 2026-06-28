// Self-registering systems registry (#120, DL #4). main.js's update() has grown into a long hand-
// wired list of per-system tick calls; that list is exactly the thing that rots as the world grows.
// This is the small backbone that fixes it: each system registers its per-frame `update` with an
// explicit `order`, and the registry dispatches them in that DETERMINISTIC order every frame. main.js
// stays thin, and a future slice (battle #100 owning its own sub-loop, fixed-timestep #36) plugs a
// system in with one register() call instead of editing the loop.
//
// The one load-bearing guarantee is ORDER: dispatch is sorted by `order` ascending, ties broken by
// REGISTRATION order (stable) — so migrating a system onto the registry preserves the old call
// sequence byte-for-byte. Pure: no THREE, no DOM, no globals — fully unit-testable.
//
// `when(ctx)` (#130, DL #5): a system may declare the condition it runs under — `run` evaluates it
// each frame with the SAME frame ctx and skips the tick when it returns falsy. This turns the
// scattered inline `if (!paused)` / `mode.is(...)` guards in the old hand-wired loop into a
// DECLARATION on the system itself, so future slices (battle #100) gate by mode without re-growing
// `update()` with branches. A system with no `when` always runs (unchanged from #120).
export function createSystemsRegistry() {
  const entries = [];
  let seq = 0;          // monotonic registration counter → the stable tie-breaker
  let ordered = null;   // cached sorted view, invalidated on register/clear

  function sorted() {
    if (!ordered) {
      // Sort by order, then by registration seq so equal orders keep their wiring sequence.
      ordered = entries.slice().sort((a, b) => (a.order - b.order) || (a.seq - b.seq));
    }
    return ordered;
  }

  return {
    // Register one system's per-frame tick. `order` spaces systems so a new one can slot between
    // two existing ones without renumbering. Guards a missing name / non-function update / a
    // duplicate name (a double-wire is a bug, not a silent overwrite).
    register({ name, order = 0, when = null, update } = {}) {
      if (!name || typeof name !== 'string') throw new Error('systems registry: a system needs a string name');
      if (typeof update !== 'function') throw new Error('systems registry: system ' + name + ' needs an update function');
      if (when != null && typeof when !== 'function') throw new Error('systems registry: system ' + name + ' when must be a function');
      if (entries.some((e) => e.name === name)) throw new Error('systems registry: system ' + name + ' is already registered');
      entries.push({ name, order, when, update, seq: seq++ });
      ordered = null;
      return this;
    },
    // Dispatch every system in deterministic order, handing each the SAME frame ctx. A system that
    // declares a `when(ctx)` predicate ticks only when it returns truthy (the mode/condition gate);
    // one with no predicate always runs. Returns ctx.
    run(ctx) {
      const list = sorted();
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (e.when && !e.when(ctx)) continue;
        e.update(ctx);
      }
      return ctx;
    },
    // Introspection: the system names in dispatch order, and the count (QA / future tooling).
    get names() { return sorted().map((e) => e.name); },
    get count() { return entries.length; },
    clear() { entries.length = 0; ordered = null; seq = 0; },
  };
}
