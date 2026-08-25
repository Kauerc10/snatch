# SNATCH! v0.4 Gameplay Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild SNATCH as a real Phaser-powered arcade game with direct aim on mouse/touch, a deterministic fixed-step TypeScript simulation, and the existing Daily/BAG/BANKED/HEAT risk loop.

**Architecture:** Next.js/React owns the product shell and event-driven HUD. Phaser owns realtime presentation and pointer plumbing. A framework-free strict TypeScript simulation owns all authoritative movement, collision, spawning, scoring, risk, Daily timing, ONE MORE, and replay state so the same run can later be verified server-side.

**Tech Stack:** Next.js App Router, React 19, TypeScript strict, Phaser 4.2.x, Bun-compatible package metadata, Vitest, Playwright, Vercel.

**Spec:** `docs/superpowers/specs/2026-08-25-snatch-v04-gameplay-rebuild-design.md`

## Global Constraints

- Canonical authoritative world is exactly 540×960.
- Daily ranked duration is exactly 60,000 ms.
- Direct aim is universal: desktop follows cursor and left-click launches; touch aims directly and pointer-up launches.
- Input selects angle only; ranked claw reach and speeds are fixed ruleset constants.
- Authoritative simulation is fixed-step and contains no Phaser, React, DOM, storage, or Web Audio imports.
- A latched item scores only after the claw physically returns home.
- Empty return starts at 1.40× outbound speed; loaded return starts at 1.25× outbound speed.
- BAG/BANKED, x1→x2→x4→x8→x16, HEAT, BUST, Risk Payout, 60-second Daily and ONE MORE remain product invariants.
- Cash Out is a one-click/tap command and is unavailable while the claw is committed.
- Daily attempt is reserved at run start and runDate is frozen across UTC midnight.
- A committed launch may resolve after the 60-second deadline; uncommitted aim may not extend the deadline.
- Ranked gameplay has no ad/upgrade advantage.
- Hazards, Fuse, accounts, backend leaderboard and paid progression are excluded from the first v0.4 gameplay slice.

---

### Task 1: Scaffold the typed game application

**Files:**
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/globals.css`
- Create: `components/game/GameHost.tsx`
- Create: `lib/game/config.ts`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Modify: `package.json`
- Test: `tests/config.test.ts`

**Interfaces:**
- Produces `WORLD_WIDTH`, `WORLD_HEIGHT`, `FIXED_HZ`, `FIXED_DT_MS`, `ROUND_MS`, `CLAW_REACH`, `CLAW_OUTBOUND_PX_S`, `CLAW_RETURN_EMPTY_PX_S`, `CLAW_RETURN_LOADED_PX_S`, `AIM_MIN_RAD`, `AIM_MAX_RAD`.

- [ ] Write a failing config test asserting 540×960 world, 120 Hz simulation, 60 s round, return speeds greater than outbound, and a valid upward aim arc.
- [ ] Run the config test and confirm RED because `lib/game/config.ts` does not exist.
- [ ] Add strict TypeScript/Next/Phaser/Vitest/Playwright package metadata and the constants module.
- [ ] Run the config test and typecheck; confirm GREEN.
- [ ] Commit `chore: scaffold v0.4 game runtime`.

### Task 2: Build deterministic run state, PRNG and authored spawn director

**Files:**
- Create: `lib/game/sim/types.ts`
- Create: `lib/game/sim/rng.ts`
- Create: `lib/game/content/items.ts`
- Create: `lib/game/sim/spawnDirector.ts`
- Create: `lib/game/sim/createRun.ts`
- Test: `tests/simulation.test.ts`

**Interfaces:**
- Produces `createRun(config): GameRun`, `GameRun.step()`, `GameRun.dispatch(command)`, `GameRun.snapshot()`.
- Produces deterministic `SpawnDirector` output from `{seed, tick, heatTier}` and authored item definitions.

- [ ] Write failing tests proving identical seed+commands produce identical spawn IDs/positions and different seeds diverge.
- [ ] Run tests and confirm RED.
- [ ] Implement a serializable `RunState`, deterministic PRNG and authored pattern-based spawn director for COOL/WARM/HOT/CRITICAL.
- [ ] Run tests and confirm GREEN.
- [ ] Commit `feat: add deterministic run and spawn director`.

### Task 3: Implement direct aim, fixed-step claw movement and swept collision

**Files:**
- Create: `lib/game/sim/clawSystem.ts`
- Create: `lib/game/sim/collision.ts`
- Modify: `lib/game/sim/createRun.ts`
- Test: `tests/claw-system.test.ts`

**Interfaces:**
- Consumes commands `{type:'aim'; angle:number}` and `{type:'launch'}`.
- Produces claw phases `idle | outbound | returning-empty | returning-loaded` and exactly one latch per launch.
- Produces swept relative-motion contact in 540×960 pixel space.

- [ ] Write failing tests for angle clamping, fixed reach, no mid-flight steering, moving-target interception, no tunneling, first-contact priority, faster return, and score remaining zero at latch.
- [ ] Run and confirm RED.
- [ ] Implement fixed-step movement and swept relative segment-vs-circle collision.
- [ ] Run and confirm GREEN.
- [ ] Commit `feat: add direct-aim physical claw simulation`.

### Task 4: Add BAG/BANKED, HEAT, multiplier, Cash Out, BUST, Daily deadline and ONE MORE

**Files:**
- Create: `lib/game/sim/riskSystem.ts`
- Create: `lib/game/sim/replay.ts`
- Modify: `lib/game/sim/createRun.ts`
- Test: `tests/risk-run.test.ts`
- Test: `tests/replay.test.ts`

**Interfaces:**
- `cashout` transfers BAG→BANKED only while claw is idle.
- `secure` increments BAG/multiplier/HEAT only when loaded claw reaches home.
- Replay records tick-indexed launch/cashout commands and produces deterministic final hash.

- [ ] Write failing tests for secure-before-score, x1→x16 ladder, Risk Payout tiers, one-click Cash Out, BUST preserving BANKED, frozen runDate, deadline behavior, ONE MORE physical resolution and replay equality.
- [ ] Run and confirm RED.
- [ ] Implement risk/run lifecycle and replay log.
- [ ] Run and confirm GREEN.
- [ ] Commit `feat: restore snatch risk loop on deterministic core`.

### Task 5: Build Phaser presentation around simulation snapshots

**Files:**
- Create: `lib/game/phaser/createGame.ts`
- Create: `lib/game/phaser/GameScene.ts`
- Create: `lib/game/phaser/InputAdapter.ts`
- Create: `lib/game/phaser/AudioDirector.ts`
- Create: `lib/game/phaser/GameBridge.ts`
- Modify: `components/game/GameHost.tsx`
- Test: `tests/input-adapter.test.ts`

**Interfaces:**
- `GameBridge` exposes commands, event subscriptions and throttled HUD snapshots without rerendering React every tick.
- `InputAdapter` desktop: pointer move→aim, pointer down→launch. Touch: pointer down/move→direct aim, pointer up→launch with reticle offset only in presentation.

- [ ] Write failing pure tests for pointer→angle conversion on desktop/touch and aim arc clamping.
- [ ] Run and confirm RED.
- [ ] Implement dynamic client-only Phaser host, fixed-step accumulator, scene views for claw/cable/conveyor/loot, and event-driven bridge.
- [ ] Add rarity hit feedback, camera impulse, procedural placeholder loot and reduced-motion behavior.
- [ ] Run tests/typecheck and confirm GREEN.
- [ ] Commit `feat: render deterministic game through phaser`.

### Task 6: Build the polished product shell and HUD

**Files:**
- Create: `components/game/GameHud.tsx`
- Create: `components/game/ResultModal.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Test: `tests/ui-contract.test.tsx`

**Interfaces:**
- HUD reads throttled/event snapshots only.
- BANK is a single click/tap and disabled while claw is committed or BAG is zero.
- Desktop retains 9:16 arena with side context; mobile is arena-first and touch-native.

- [ ] Write failing UI contract tests for Daily hero copy, `BANK $X`, heat tier labels, result/ONE MORE states and no pull-back instruction.
- [ ] Run and confirm RED.
- [ ] Implement dark-violet/acid-lime SNATCH shell with minimal arena chrome, BAG tray, readable loot value/rarity, responsive desktop side panels and mobile controls.
- [ ] Run tests/typecheck and confirm GREEN.
- [ ] Commit `feat: polish v0.4 arcade shell`.

### Task 7: Browser gameplay, performance and benchmark gates

**Files:**
- Create: `tests/e2e/gameplay.spec.ts`
- Create: `tests/e2e/responsive.spec.ts`
- Modify: `playwright.config.ts`
- Modify: `README.md`

**Interfaces:**
- E2E covers the integrated Next+Phaser build rather than simulation alone.

- [ ] Add browser tests for: first launch within five seconds, desktop cursor direct aim, touch direct aim, moving loot latch/return/secure, one-click Cash Out, Daily deadline, BUST, ONE MORE and no horizontal overflow at 390×844 / 1440×900.
- [ ] Add a console-error gate and a simple frame-time smoke gate; do not assert a specific FPS, only absence of long-frame storms during a deterministic 10 s run.
- [ ] Run production build + browser suite and confirm GREEN.
- [ ] Manually compare moment-to-moment feel against the AI Studio benchmark: direct aim, launch responsiveness, return cadence and visible loot carry must be at least as legible/responsive.
- [ ] Commit `test: harden v0.4 gameplay rebuild`.

### Task 8: Retire v0.3 candidate, review, preview and production

**Files:**
- Modify: PR #4 metadata/comments only.
- Create: PR from `feat/v0.4-gameplay-rebuild` to `main`.

**Interfaces:**
- No code from PR #4 is merged independently; v0.4 supersedes it.

- [ ] Close PR #4 with a comment pointing to the approved v0.4 rebuild.
- [ ] Push the full v0.4 branch and open a PR with architecture, benchmark and fresh verification evidence.
- [ ] Trigger Codex review and address every valid P1/P2 with RED→GREEN tests.
- [ ] Create a Vercel preview and verify title, JS assets, primary interaction and HTTP 200.
- [ ] Squash merge only after tests/review/preview are green.
- [ ] Promote/verify production at the stable SNATCH Vercel alias and record the deployment ID in the PR.
