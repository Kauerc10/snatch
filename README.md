# SNATCH! v0.4 — Gameplay Rebuild

SNATCH is a browser-first arcade Daily Heist about timing, greed and knowing when to bank what you stole.

## v0.4 direction

The AI Studio prototype is the benchmark for moment-to-moment claw feel. The official rebuild keeps the stronger SNATCH product/visual decisions while moving realtime play to Phaser and keeping authoritative rules in a pure fixed-step TypeScript simulation.

### Controls

- **Desktop:** move the mouse to aim directly, click to launch.
- **Touch:** touch/drag directly toward the shot, release to launch.
- The pointer chooses an **angle**, not an item. Loot keeps moving while the claw travels.
- **BANK $X:** one click/tap when the claw is home.

### Core loop

`aim → launch → intercept → latch → return → secure → risk → BANK or keep going`

The canonical world is 540×960, the simulation runs at 120 logical Hz, and the Daily is 60 seconds. BAG is exposed; BANKED survives BUST. ONE MORE uses the exact same physical claw simulation.

## Architecture

- `lib/game/sim/*` — authoritative deterministic simulation. No Phaser/React/DOM.
- `lib/game/phaser/*` — scene presentation, pointer adapter, audio and FX.
- `components/game/*` — React HUD and game host.
- `app/*` — product shell and Daily entry flow.

## Commands

```bash
npm install
npm run test
npm run typecheck
npm run dev
npm run test:e2e
npm run build
```

## Docs

- `docs/superpowers/specs/2026-08-25-snatch-v04-gameplay-rebuild-design.md`
- `docs/superpowers/plans/2026-08-25-snatch-v04-gameplay-rebuild.md`
