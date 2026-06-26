# Parallel development protocol

How **multiple devs work at once** without stepping on each other or breaking `main`.
Tidewake ships several releases per hour; parallel slices keep flow high — but only with
strict claiming, isolation, and serialised merges. The Tech Lead carves non-overlapping
work; the Project Manager serialises the merges.

## 1. Claim before you start — always
Claiming an issue means moving it to **in progress immediately**, before any code:

```bash
gh issue edit <n> --add-label in-progress --add-assignee @me
```

If assignment isn't available (e.g. permissions), claim by comment instead:

```bash
gh issue comment <n> --body "Claiming this slice — starting now. (@me)"
gh issue edit <n> --add-label in-progress
```

No claim, no work. If an issue already has `in-progress`, it's taken — pick another.

## 2. Isolate: one worktree/branch per slice, non-overlapping files
Each parallel dev works in an **isolated git worktree** on its own branch
`slice/<issue>-<slug>`, touching a **non-overlapping set of files**. The **Tech Lead assigns
file ownership per slice** so two devs never edit the same module; **prefer new modules** over
editing shared ones.

```bash
git worktree add ../tidewake-<issue> -b slice/<issue>-<slug> origin/main
cd ../tidewake-<issue>
# ... implement only the files the Tech Lead assigned to this slice ...
```

Shared touch-points (e.g. `src/main.js` wiring, `index.html`) are coordination hot-spots —
if a slice must touch one, the Tech Lead flags it and the PM avoids dispatching a conflicting
slice in the same batch.

## 3. Dependency rule
**Don't start a slice whose dependency isn't merged.** If slice B builds on slice A's module,
B waits until A is on `main`. The PM names dependencies before parallel dispatch (see the
Project Manager doc) and only fans out slices that are truly independent.

## 4. Open a PR; the CI playtest gate must pass
```bash
git push -u origin slice/<issue>-<slug>
gh pr create --fill --base main --head slice/<issue>-<slug>
# link the issue so merge auto-closes it:
gh pr edit <pr> --body "Closes #<issue>"
```

The CI **playtest gate must be green** before merge (no console errors, renders, sails, in
budget). The Tech Lead reviews the PR. Merge to `main` triggers the release.

## 5. The PM serialises merges and resolves conflicts
The orchestrator / **Project Manager merges PRs one at a time**, never in parallel:

```bash
gh pr checks <pr>          # confirm the gate is green
gh pr merge <pr> --squash  # one at a time
```

After each merge, the next PR **rebases on the new `main`** before its turn:

```bash
git fetch origin && git rebase origin/main   # resolve any conflicts here, then push
```

If two slices conflict, the PM rebases the second on the first and the second dev (or PM)
resolves before merging.

## 6. On merge — clean up
```bash
gh issue edit <n> --remove-label in-progress   # if not auto-handled
gh issue close <n>                             # if not closed by "Closes #n"
git worktree remove ../tidewake-<issue>
git push origin --delete slice/<issue>-<slug>  # archive the branch
git branch -D slice/<issue>-<slug>
```

## Roles in this protocol
- **Tech Lead** — assigns non-overlapping file ownership per slice; reviews PRs; flags shared
  touch-points.
- **Project Manager** — enforces issue hygiene (claimed + `in-progress` + assigned), resolves
  dependencies before dispatch, **serialises merges**, closes issues, archives branches.
- **Software Developer** — claims first, works in an isolated worktree on assigned files only,
  keeps the slice green, opens a small PR, rebases when it's their merge turn.
