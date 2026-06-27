# Owner feedback channel (the PM desk)

A front door for the owner's feedback, feature requests, and bug reports. Input is **not acted
on immediately** — it is intaked and evaluated by the Product Manager before anything becomes work.

## How to use it

Run the desk from the repo root:

```bash
scripts/pm-desk.sh
```

This opens a separate, pre-prompted Claude session (in its own `tidewake-pm` git worktree, so the
autonomous build loop is never disturbed) that role-plays the Product Manager. Bring your feedback —
paste text, drop screenshot paths. The PM will interview you, assess value, pull in a Tech Lead
subagent for feasibility, and — only on your explicit yes — refine accepted items into prioritised
GitHub issues on the roadmap. You can also ask "is X on the roadmap?".

## What's here

- `PM-DESK.md` — the desk's operating manual (read by the session on launch).
- `REGISTER.md` — pipeline index of every item + status.
- `inbox/<id>.md` — one file per raw item (your words, captured verbatim).
- `assets/` — screenshots / images.
- `TEMPLATE.md` — the item format.

## Intake flow & the `from-owner` label (for the build loop)

```
owner feedback → inbox/<id>.md (verbatim) → PM value note → TL feasibility (subagent)
   → PM recommend → OWNER ACCEPTS → GitHub issue (label: from-owner) → ROADMAP + REGISTER
```

Accepted items become GitHub issues labelled **`from-owner`** and **filed by the PM on the owner's
behalf** — so the GitHub author is the owner's account, but the content is desk-triaged, not hand-typed
into GitHub. Every such issue carries a **provenance footer** describing exactly these steps. The build
loop should treat `from-owner` issues as **authoritative, already value- and feasibility-assessed**
owner steering and **not re-verify authorship**; owner P1s jump the queue (priority still takes PM + TL
sign-off). See `PM-DESK.md` → "The `from-owner` label & provenance" for the canonical footer.
