# SNATCH! v0.3 Claw Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace instant shot resolution with a deterministic physical claw loop while preserving Daily fairness and the v0.2 risk model.

**Architecture:** Add a framework-free claw simulator between input and scoring. `app.js` asks the simulator for an immutable flight resolution at release and only applies score/HEAT after the rendered claw settles. Fold old v0.2 runtime hardening into focused core/app code and retire monkey-patch files.

**Tech Stack:** Vanilla JavaScript; Canvas 2D; Node test runner; Python Playwright; Vercel static hosting.

**Spec:** `docs/superpowers/specs/2026-08-25-snatch-v03-claw-update-design.md`

## Global Constraints

- Canonical arena stays 9:16 on mobile and desktop.
- Daily ranked duration stays 60,000 ms.
- Cash Out commitment stays 650 ms.
- Ranked Daily receives no gameplay advantage from monetization or upgrades.
- Deterministic target motion and shot outcomes must not depend on render FPS.
- Preserve previous Codex fixes for Daily reservation, UTC date, late BUST and 9:16 collision.

---

### Task 1: Deterministic physical claw core

**Files:**
- Create: `src/claw.js`
- Test: `tests/claw.test.cjs`

**Interfaces:**
- Consumes: normalized `shot`, target descriptors and deterministic `targetAt(target, elapsedMs)`.
- Produces: `resolveShot(options)` with `hit`, `latchAtMs`, `returnDurationMs`, `settleAtMs`, `positionAt(timeMs)`.

- [x] Write failing tests for repeatability, moving-target interception, 9:16 miss, first-contact priority and faster retraction.
- [x] Verify RED before implementation.
- [x] Implement the minimal fixed-step simulator.
- [x] Run tests and verify GREEN.

### Task 2: Integrate claw lifecycle with scoring

**Files:**
- Modify: `app.js`
- Test: `tests/claw_integration.test.cjs`

**Interfaces:**
- Consumes: `SnatchClaw.resolveShot`.
- Produces: physical `aiming/outbound/returning/settled` runtime loop and physical ONE MORE.

- [x] Write failing integration assertions proving the bundle loads the claw and score is applied from settling.
- [x] Replace instant raycast scoring with outbound/latch/return/settle orchestration.
- [x] Resolve ONE MORE through the same claw path without random success.
- [x] Keep timer-end handling pending until committed flight/lockdown resolves.

### Task 3: Fold 9:16 hardening into core

**Files:**
- Modify: `src/core.js`
- Modify: `tests/core.test.cjs`

- [x] Add a failing aspect-correction collision test.
- [x] Correct segment/projection math in 9:16 aspect space.
- [x] Verify core suite GREEN.

### Task 4: Game feel and responsive HUD

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `app.js`

- [x] Add physical cable/claw rendering and attached loot.
- [x] Add loot capsules, rarity glow and mini-BAG tray.
- [x] Add heartbeat, HEAT vignette, hit particles and reduced-motion handling.
- [x] Keep Cash Out disabled while the claw is away from base.

### Task 5: Regression and browser coverage

**Files:**
- Modify: `tests/browser_smoke.py`
- Modify: `tests/browser_interaction.py`
- Modify: `tests/risk_hud.py`
- Modify: `tests/review_regressions.py`
- Create: `tests/browser_helpers.py`

- [x] Verify physical delivery does not score immediately after release.
- [x] Verify delivery then Cash Out updates BAG/BANKED and mini-BAG.
- [x] Verify HEAT tier HUD after physical misses.
- [x] Re-run reservation, UTC, collision and late-BUST cases.

### Task 6: Retire v0.2 monkey patches and ship

**Files:**
- Delete: `polish.js`
- Delete: `v02.css`
- Modify: `package.json`
- Modify: `README.md`
- Keep: `vercel.json`

- [x] Run `npm test` and confirm zero failures.
- [x] Run `npm run test:browser` and confirm zero failures.
- [ ] Capture fresh mobile and desktop screenshots and check console errors.
- [ ] Push branch, open PR and inspect diff/review feedback.
- [ ] Deploy preview and verify HTTP 200 + primary interaction.
- [ ] Merge only after verification, then deploy production and verify stable alias.
