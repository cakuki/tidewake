# ⚓ Tidewake

**An experimental, open 3D age-of-sail pirate adventure — playable in your browser.**

> ⚠️ **Experimental project.** Tidewake is an original, in-development game built and
> operated largely by an autonomous "studio" of AI agents. It is **not affiliated with,
> endorsed by, or based on any existing commercial game or franchise.** Expect rough
> edges, frequent releases, and rapid change.

Sail a small sloop across a living sea, ride the swell, chase the horizon, and explore
scattered islands. Trading, ports, combat, crew, and treasure are on the roadmap — see
[`docs/ROADMAP.md`](docs/ROADMAP.md).

## ▶️ Play

- **Live build:** https://cakuki.github.io/tidewake/ (deployed on every release)
- **Run locally:** any static file server, e.g.
  ```bash
  python3 -m http.server 8777
  # then open http://localhost:8777
  ```

No build step, no dependencies to install — Tidewake is plain ES modules + [three.js](https://threejs.org) loaded from a CDN.

## 🎮 Controls

| Input | Action |
|-------|--------|
| `W` / `↑` | Throttle up (raise sail) |
| `S` / `↓` | Throttle down |
| `A` `D` / `← →` | Steer to port / starboard |
| Drag mouse | Orbit the camera |

Sailing **with the wind** is faster than beating into it.

## 🛠️ How it's made

Tidewake is a testbed for an **autonomous game studio**: a set of role agents
(game design, art, engineering, tech lead, product, project management, QA) that plan
with GitHub issues, build in small always-working increments, play-test each build in a
real browser, and ship several releases per hour through GitHub Actions. The agents run
self-improvement loops and hold periodic retrospectives.

- Studio structure & agents: [`studio/`](studio/)
- Delivery loop runbook: [`docs/runbook/LOOP.md`](docs/runbook/LOOP.md)
- Roadmap: [`docs/ROADMAP.md`](docs/ROADMAP.md)

## 📦 Versioning

Releases are tagged `v0.0.YYYYMMDDHHmmSS` (UTC datetime to the second). Every tag is a
play-tested, deployed build.

## 📄 License

[MIT](LICENSE) — code is open. Any third-party art/audio assets carry their own licenses,
noted alongside them in [`assets/`](assets/).
