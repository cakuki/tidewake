# Game Designer — long-term memory

Durable design lessons, tuning notes, and fun hypotheses. Grows over time; keep entries short.

- 2026-06-27 — **Starting state**: v0 = sail a sloop, ride the swell, steer toward islands.
  Sailing with the wind is faster than beating into it (the one real mechanic so far).
- 2026-06-27 — **Tone contract**: realistic sea/sailing/world; warm witty swashbuckling
  characters and dialogue. Adventure-game humour over grim sim. Fun first.
- 2026-06-27 — **North-star journey**: one boat → feared pirate **or** mayor/governor;
  progression must branch player *identity*, not just pad time.
- 2026-06-27 — **First priorities**: find the first reason to sail somewhere (a destination
  with payoff). Prototype the smallest loop that creates a real choice; juice the sailing feel.
- 2026-06-27 (Retro 2) — **State now**: three named ports are dockable (arrival toast) and the
  voyage persists, but **arriving still has no reward** — no economy, no choice. Next: a port
  economy (#26) — buy-low/sell-high cargo, per-port price spreads, coin balance, hold cap.
  Tune so a first profitable route is discoverable in <2 min. This is the first *interesting
  decision* and the spend-side root of combat/crew/governance.
- 2026-06-27 (Deep-learning loop) — **Design backbone from research**: state ONE big fantasy and let
  rules (prices + reputation) generate the small goals (Burgess); build factions as a few reactive
  numbers/"narrative atoms" not scripted missions (Levine); keep progression *bushy* with parallel
  routes that each reveal world/character (Gilbert); make mutiny *earned* via a crew-morale system fed
  by rationing/fairness/time-at-sea (Bounty/Hermione history), not random.
- 2026-06-27 (Deep-learning loop) — 🎲 **Wildcard "Insult Broadside"**: comedic naval combat where
  crews trade insults across the waves; a sharp jab drops enemy morale (surrender/flee), a weak one
  shakes your own crew (feeds mutiny). Wit as a bloodless combat verb. Backlog issue filed (design+feature).
- 2026-06-27 (Retro 5 / session wrap) — **My tuning pass made the arc reachable.** `LEGEND_AT`
  dropped to **2400** (from ~12,800, #57) — fast early ranks, a stretched-but-reachable legend felt
  in one ~4.45-min web session; pairs with invisible onboarding (#60: first goal + first-win beat).
  Keep owning the per-block "is the curve fun in a real session?" pass. Next design frontier =
  *depth with drama*: **ship-vs-ship cannon combat (#59)** as a real *choice* alongside the bloodless
  Insult Broadside (talk them down OR open the gun ports) — design-first, perf-gated. Atmosphere
  (#58 weather) is high-charm but an OWNER-DECISION — must not undo the sunny vibe (#61). Breadth
  (more ports/goods) stays near-zero; the spine needs drama, not nouns.
- 2026-06-27 (Retro 2) — **I drive every cycle now**: the loop has a mandatory CREATIVE SPARK
  beat. Loops 4-6 ran without me — fixed. Give each slice one authored beat: port personalities
  (Gullet's Rest gouges you; Barnacle Bottom honest-and-broke), harbourmaster banter, comic
  price events ("a glut of salt cod"). Charm rides with mechanics, never after them.
- 2026-06-27 (DL#2) — **Deception was a real, legal, dramatic age-of-sail mechanic**: a letter of
  marque made the same raid privateer-honour or pirate-crime; false colours were standard. Maps directly
  onto Infamy ↔ Standing — one *interesting choice* (which flag, is it a lie?) feeds both poles.
- 2026-06-27 (DL#2) — **Juice must echo the mechanic, never mask it** (Nijman "Art of Screenshake"):
  hit-stop (3–5 frames), screenshake, soft camera punch, brief time-dilation make cannon/insult hits
  land — but keep short, event-tied, and toggle-able (#73). Best feedback is diegetic: the enemy crew's
  morale *visibly* breaking IS the juice.
- 2026-06-27 (DL#2) 🎲 **Wildcard — "False Colours & a Letter of Marque"**: fly a nation's flag / raise
  false colours; commissioned raiding builds Standing, indiscriminate/uncommissioned builds Infamy; the
  world reacts (navy hunts / ports cheer). Strategic + moral + comedic (the smug flag-drop reveal). → filed.
- 2026-06-28 (DL#3) — **The MODE SYSTEM is a fantasy-shifter; design the transitions and the ashore verbs,
  not just the screens.** Grounded in #95/#67/#96/#94. Four leverage points: (1) **"Make landfall"** is the
  drama — juice the *transition* (eased camera + #94 music swell + a "we've made port" punch); each mode owns
  its camera/control/sound grammar; town is a *place*, not a pop-up (diegetic-UI lens). (2) A hub must be a
  goal-**dispenser** (Burgess) — cheapest ashore verb = **Tavern "listen for word"**: 1–2 procedural rumours
  from live world-state + reputation that point you back to sea with purpose (answers owner's "more to do
  ashore than buy/sell"). (3) Make "the world keeps living underneath" *legible* — **linger has a cost**: a
  "while you were ashore…" digest (one real consequence: price drift / spared ship returns / rival sacks a
  port) on the Leave-Port button. (4) **Spend existing reputation at the town door** — landfall reception
  reads Infamy↔Standing (WANTED poster of your own deeds vs WELCOME banner, guard posture; text/tint only).
- 2026-06-28 (DL#3) 🎲 **Wildcard — "The port remembers you"**: persistent per-town state shaped by your
  deeds — sack/extort → shuttered & hostile next visit (gouged prices); trade fair → it prospers (friendly
  face, standing discount, eventually your name on the dock). Reactive *across visits* (Levine atoms) on the
  new persistent town mode; asset-light text/tint/props. The town you revisit becomes a ledger of who you've
  become — the pirate↔governor branch made visible. → candidate backlog issue.
