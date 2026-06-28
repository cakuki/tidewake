# Product Manager — long-term memory

Durable lessons, vision notes, and roadmap rationale. Grows over time; keep entries short.

- 2026-06-27 — **Starting state**: v0 shipped. Playable sloop on an animated sea with
  scattered islands; sail/steer/orbit-camera; auto-released to GitHub Pages on every push.
- 2026-06-27 — **North-star fixed**: one boat → feared pirate **or** mayor/governor.
  Open-ended; player carves the legend. Tone: realistic world, witty swashbuckling characters.
- 2026-06-27 — **First priorities**: give sailing a *point* — the first reason to go somewhere
  (a port / a goal / a reward). Smallest slice that turns "sailing" into "adventure".
- 2026-06-27 — **Guardrail**: original work only; never reference or imitate a named franchise.
- 2026-06-27 (Retro 1) — **Still a sailing toy, not a game**: 4 loops in, great sailing but no
  gameplay verb. Next: dockable port (#12) → simplest trade → save/load (#11). Ship the smallest
  verb that lets a fresh player name a goal, ahead of more polish.
- 2026-06-27 (Research loop) — **Web-game truth: first ~5 min and ~4.45-min sessions decide
  retention.** First session must hand a fresh player a tiny completable goal + visible payoff;
  onboarding is invisible (do, don't read). Front-load fun after the port economy lands.
- 2026-06-27 (Retro 5 / session wrap) — **The complete arc is now LANDABLE.** Tuned reachable
  (`LEGEND_AT 2400`, #57), invisible onboarding (#60), sunny Caribbean look (#61), perf-gated (#52).
  All owner P1s + P2s #53/#54 shipped same session (PM Desk intake works). **Open owner P2:** #55
  art-sourcing research (do); **#56 mobile** + **#58 weather** are OWNER-DECISIONS — surface with
  options, never auto-do (#58 must not undo the sunny vibe). Next product direction: a *thin* layer
  of depth-with-drama (cannon combat #59) + cheap polish (#19/#15/#20/#21); breadth ~zero. See
  `studio/comms/queue.md` for the prioritised queue.
- 2026-06-27 (Research loop) — **Wealth must buy *identity*, not stuff.** A persisted Captain's
  Ledger / Notoriety track (feared pirate ↔ respected governor) makes coins matter immediately,
  gives a stateable goal, makes growth legible, and seeds the two-ending split — cheapest leverage
  before combat/crew/governance. Wildcard: ports that *react* to your legend = a story engine.
- 2026-06-27 (DL#2) — **Load time is retention for a web game**: keep total load < 3 s even on 3G;
  opening straight into action drove top-quartile HTML5 D1 ~48% (2× the hyper-casual benchmark). Our
  lever is a measured *time-to-first-sail* budget, not more content.
- 2026-06-27 (DL#2) — **The anecdote factory**: DF/RimWorld retain with zero authored plot because
  systemic rules + memory make each run a *tellable, shareable* story. Our spine is complete — next
  value is choices the world *remembers*, captured and handed back to the player. (Meier: "interesting
  choices" > more nouns.)
- 2026-06-27 (DL#2) 🧭 **Wildcard — "The Ballad of Your Voyage"**: auto-composed in-character logbook /
  mini-ballad at session end from real events (ports, best trade, the winning insult, ship sunk/talked
  down, rank climbed), one shareable image. Cheapest "every session is a story" hook; ready-made owner
  share content. → filed as backlog issue.
- 2026-06-28 (DL#3, mode-system pivot) — **A town is a menu until it has a *function you return for* —
  make town mode the GOVERNOR verb surface.** Pirate pole has reactive verbs; governor pole is still a
  number. Cheapest function: one repeatable town action (fund repair / invest harbour) that buys
  governor standing + changes a visible town detail.
- 2026-06-28 (DL#3) — **Modes are just screens until ONE persistent thing flows across all three**:
  sail earns → town invests → battle defends/raids → sail. Make the loop legible with one carried
  resource + one HUD line, else mode-select is a worse sandbox. Directed structure beats sandbox for
  the first session; let the **harbourmaster hand the next goal** (one templated job/visit) to close
  the loop and fix web-game FTUE churn inside town mode.
- 2026-06-28 (DL#3) — **Player impact = cheapest "alive" town, and it's a reactive verb**: spatialise
  the renown tier (pirate town boards up/flies your colours; governor town gains a built prop) — the
  3D embodiment of DL#1's flat reputation board, asset-light via greenlit #101 props.
- 2026-06-28 (DL#3) 🧭 **Wildcard — "Your Harbour"**: claim ONE home port, invest across sessions; it
  physically grows with governor renown (dock, lit lighthouse, your flag), persisted. The governor-pole
  monument (mirror of the pirate notoriety track) + an irresistible "my port, then vs now" share image.
- 2026-06-28 — **Owner set the delivery doctrine + chose the battle lane.** Battle epic **#135** =
  Option 2 (Maneuvering Battle) → then Option 4 (Three-Act Raid), shipped as **small gamer-testable
  slices**; I coordinate **deliver → test → evaluate** per slice. Three standing rules now in
  `docs/ROADMAP.md`: (1) **self-eval bar** — every slice has a testable outcome or a **human in the
  loop** (only the owner for now) + a duty to **improve the process itself**; (2) **BAU** — always keep
  shipping bug/UI fixes; (3) **focused-lane + lane-switch GATE** — *I own calling it*: don't leave a lane
  (e.g. battle → music) until it ships something **impressive AND gamer-testable**. Design source #100.
- 2026-06-28 — **Held (record-only, owner): Community Manager role** — post community updates + gather
  player feedback as a **4th test layer** beyond unit/UI/QA (scales "human in the loop" past just the
  owner). Pick up **after the weekly usage reset**; not triaged/filed yet. `inbox/2026-06-28-community-manager-role.md`.
