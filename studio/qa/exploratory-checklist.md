# Tidewake — Exploratory QA Checklist (PLAY THE GAME)

> **Owner directive (2026-07-02, verbatim):** _"HAVE QA PLAY THE FUCKING GAME. And QA should not
> only test simple things. But sometimes play, go around, take screenshots and investigate. I cannot
> be the only one who can look at a harbour and think the quality is so low."_

This is the **per-release exploratory pass**. It is **not** the automated gate and **not** the
regression `CHECKLIST.md` — it is where QA **plays and roams the live build like a player**, takes
screenshots, and **judges visible quality by eye.** A green gate is **necessary but NOT sufficient**:
a slice that passes gates but looks low-quality has **NOT passed QA.**

Run it in a **real browser** (Chrome DevTools MCP — the headless swiftshader renderer draws the 3D
scene dark, so visual judgement needs a real browser). File every quality issue you find as a `bug`
(or `art`) issue **with the screenshot attached**, routed to the owning role.

---

## How to run it

1. Boot the live build; **actually play** — don't just spot-check one screen.
2. **Roam every mode** below; at each, **take at least one screenshot** and save/attach it.
3. For each element, ask the quality bar: **"Does this look like a real game, or a cheap prototype?"**
   Score it honestly (real game / rough / prototype). Anything below "real game" → file a bug.
4. **Go off the happy path** — sail into islands, beach the ship, spin the camera, linger, spam
   inputs. Investigate anything that looks off; chase it down instead of waiting for a gate to trip.
5. Re-check the **recurring owner complaints** list every time (below).
6. Record the verdict + shots in the release handoff; add any new recurring complaint to this file.

---

## Roam each mode — screenshot each

- [ ] **Sail (open sea)** — screenshot at spawn, at full speed (wake visible), mid-turn, and from a
  second camera angle. Does the sea look alive and believable, or flat/one-tone?
- [ ] **Harbour / approach** — sail up to a port, trigger auto-harbour, look at the harbour itself.
  Does it read as a real harbour, or a "playdough" blob? Screenshot it.
- [ ] **Town / market** — disembark into the town/market mode. Is the layout, UI, and art coherent
  and charming, or a placeholder panel? Screenshot it.
- [ ] **Battle / combat** — enter a battle; fire; watch an enemy take damage/sink. Are there visible
  cannons, muzzle flash, projectiles, hit/sink feedback? Does combat *feel* like a fight? Screenshot it.

## Quality bar per element — "real game or prototype?"

- [ ] **Ships** — hero ship AND NPC ships: solid, proportioned, textured? (Not pencil-thin / flat / untextured.)
- [ ] **Harbours** — structured, detailed, believable? (Not smeared "playdough" masses.)
- [ ] **Sea / materials** — moving, layered, light-reactive; palette matches the sunny Caribbean look? (Not one flat tone.)
- [ ] **UI / HUD** — instantly readable, legible, charming; version stamp correct? (Not muddy or placeholder.)
- [ ] **Combat feel** — visible + audible feedback on every action; progression payoff is *seen/heard/felt*.
- [ ] **Audio / music** — varied and context-shaped; not a single repetitive one-tone loop.

---

## Standing recurring owner complaints — ALWAYS re-check

These are quality issues the owner has repeatedly caught. Re-verify **every release**, even if a
gate is green; if any reappears, file a bug with a screenshot immediately.

- [ ] **Pencil NPC ships** — NPC/enemy ships look flat, thin, or unfinished vs. the hero ship.
- [ ] **Playdough harbours** — harbours look like smeared blobs rather than real structures.
- [ ] **One-tone music** — music is a single repetitive loop, not varied / context-aware.
- [ ] **Ships through islands** — ship clips through / sails inside island geometry (collision fails).
- [ ] **Ugly beaching** — running aground looks broken (ship half-buried, jitter, no arcade slow-to-stop).

_Add new recurring complaints here as they surface — this list only grows. Never delete a case;
mark `~~retired~~` with a date + reason if an element is removed._
