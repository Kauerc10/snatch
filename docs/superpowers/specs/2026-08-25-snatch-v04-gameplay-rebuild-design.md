# SNATCH! v0.4 — Gameplay Rebuild Design

**Date:** 2026-08-25  
**Status:** Approved architecture, pending written-spec review  
**Repository base:** `main` at `4cd0f0cd17f18d5fb40aa9bb9070289217350a69`  
**Benchmark:** user-provided AI Studio prototype (`snatch!.zip`)  
**Supersedes as implementation direction:** PR #4 (`feat/v0.3-physical-claw`)

## 1. Product goal

SNATCH must feel like a real arcade game before it grows into a social product.

The v0.4 rebuild keeps the strongest product decisions already proven in the official prototype — Daily Heist, BAG vs BANKED, HEAT, BUST, ONE MORE, canonical 9:16 playfield, risk/reward and the dark arcade identity — but rebuilds the realtime gameplay layer around the strongest quality of the AI Studio prototype: a claw that exists as a living object in the world and is immediately pleasant to aim and fire.

The primary success criterion is no longer “the deterministic claw system works.” It is:

> Within five seconds of opening a run, a player should understand how to aim, fire the claw, watch it physically interact with moving loot, and want to fire again.

The AI Studio prototype is the minimum benchmark for moment-to-moment feel. If a rewritten interaction is technically cleaner but feels worse, it does not ship.

---

## 2. Decisions already locked

### 2.1 Engine and application stack

Use:

- **TypeScript in strict mode** for gameplay, rules, UI contracts and tests.
- **Phaser 4.2.x** for realtime rendering, scene lifecycle, pointer input, cameras, tweens, particles and asset management.
- **Next.js App Router + React** for the product shell: landing, menus, Daily presentation, results, collection, leaderboard, account and future web features.
- **Bun** as package manager / local task runner unless a concrete compatibility problem appears.
- **Vitest** for pure simulation and component/unit tests.
- **Playwright** for browser/gameplay regressions and viewport QA.

Phaser 4.2.1 is a stable July 2026 release and officially supports integration with React and Next.js. The engine already provides the game-oriented rendering, input, camera, particle and scene primitives that the current hand-rolled Canvas runtime is starting to recreate.

No additional language such as Rust is introduced in v0.4. The authoritative simulation is small enough for TypeScript. WASM is only justified later if profiling shows a real CPU bottleneck or if server-scale replay verification makes it worthwhile.

### 2.2 Direct aim everywhere

The pull-back/slingshot gesture is removed.

**Desktop:**

- Pointer position continuously controls aim while the claw is idle.
- The player does not need to hold the mouse to aim.
- Left click commits a launch in the currently displayed direction.
- Pointer movement after launch cannot bend or redirect the committed shot.

**Touch:**

- Pointer down enters aim mode.
- Drag directly toward the intended shot direction.
- A visual reticle is rendered above the finger so the finger does not hide the true target.
- Pointer up commits the launch.
- The logical command produced is the same as desktop: an aim angle plus the fixed ruleset reach.

Both devices therefore share the same competitive command model while using ergonomics appropriate to the input device.

### 2.3 Fixed reach, not click-to-target

Input selects an **angle**, not a destination or item.

The claw has a fixed maximum reach defined by the ruleset. Clicking on a duck does not command “pick up this duck”; it commands “fire along this angle.” Loot keeps moving while the claw travels, so timing remains a skill.

The useful firing arc is clamped to the upper playfield. The exact limits are tuning constants and must be exposed in a centralized rules/config module rather than buried in scene code.

### 2.4 Realtime world simulation, not pre-resolved shots

The v0.3 design precomputed the outcome of a shot at release and rendered the known result. That preserves fairness but weakens the feeling that the claw and loot truly coexist.

v0.4 instead runs an **authoritative fixed-step simulation continuously** while the round is active.

- Visual rendering may run at the browser refresh rate.
- Authoritative simulation advances in fixed logical ticks.
- Initial target is **120 Hz logical simulation**, subject to profiling.
- A frame accumulator advances zero or more fixed ticks per rendered frame.
- Input commands are applied only on tick boundaries.
- The simulation state can be replayed without Phaser or a DOM.

The claw therefore genuinely travels through a moving deterministic world. A grab occurs because the claw and loot intersect during simulation, not because the outcome was decided before motion began.

---

## 3. Architecture

The rebuild separates product UI, realtime presentation and authoritative rules.

```text
Next.js / React product shell
│
├── Landing / Daily card / navigation
├── HUD chrome / results / share
├── Collection / settings / future account UI
└── GameHost
      │
      ├── read-only state snapshots
      └── player commands
              │
              ▼
        Phaser presentation runtime
        │
        ├── BootScene
        ├── GameScene
        ├── ClawView
        ├── ConveyorView
        ├── LootView pool
        ├── FX controller
        ├── Camera controller
        └── Input adapter
              │
              ▼
        Pure TypeScript game simulation
        │
        ├── RunState
        ├── FixedStepClock
        ├── ClawSystem
        ├── ConveyorSystem
        ├── SpawnDirector
        ├── CollisionSystem
        ├── RiskSystem
        ├── ScoreSystem
        ├── DailySeed / PRNG
        └── Replay / hash log
```

### 3.1 The Phaser scene is not the game state

The AI Studio benchmark currently keeps many rules directly inside one `MainScene`. v0.4 intentionally does not copy that coupling.

`GameScene` is responsible for:

- reading simulation state;
- creating/updating visual objects;
- camera effects;
- particles;
- sound triggers;
- converting Phaser pointer events into normalized player commands.

It must **not** own authoritative BAG, BANKED, HEAT, score, Daily seed, spawn decisions or collision truth.

This prevents another giant scene file from becoming the application.

### 3.2 Pure simulation package

The authoritative game module must run in:

- the browser;
- Vitest without canvas;
- a future server replay verifier.

It may not import Phaser, React, browser storage or Web Audio.

Representative API:

```ts
const run = createRun(config)
run.dispatch({ type: 'aim', angle })
run.dispatch({ type: 'launch' })
run.dispatch({ type: 'cashout' })
run.step(FIXED_DT)
const snapshot = run.snapshot()
```

Snapshots contain only serializable state required by presentation/UI.

### 3.3 React bridge

React must not re-render at 60 or 120 Hz.

The bridge exposes:

- event-driven updates for meaningful gameplay events (`grab`, `cashout`, `bust`, `tierChanged`, `roundEnded`);
- throttled snapshots for values such as timer / HEAT where smooth React updates are desirable;
- commands from UI back to the run (`cashout`, pause/settings, future mode actions).

A small external store using `useSyncExternalStore` or an equivalent typed adapter is preferred over routing every frame through React state.

---

## 4. Core input and claw feel

### 4.1 Idle and aim

When the claw is home:

- aim is immediately available;
- claw head rotates toward the aim angle;
- a projected dashed line previews the firing ray;
- a reticle communicates maximum reach;
- the aim line remains visually lightweight so moving loot stays dominant.

On desktop this preview follows the cursor continuously. On touch it appears only during the active gesture.

### 4.2 Launch

Launch must feel instantaneous after the command.

Target responsiveness:

- input-to-visible-launch should be no more than one rendered frame under normal conditions;
- no artificial pre-launch animation may delay control unless testing proves it improves feel;
- launch sound and a tiny recoil are fired immediately;
- the cable visibly extends from the base.

The claw travels at a fixed ruleset speed. No ranked upgrade may modify it.

### 4.3 Collision

Fast claw movement requires collision that cannot tunnel through small targets.

The simulation uses **swept relative-motion collision** per fixed tick:

1. store previous and next claw positions;
2. store previous and next loot positions;
3. evaluate relative segment-vs-circle contact over the tick;
4. choose the earliest valid contact time;
5. latch exactly one item;
6. transition immediately to return.

This is more robust than testing only the two end positions of a 120 Hz tick.

Collision geometry is defined in the canonical 540×960 world, removing the previous normalized-axis ambiguity.

### 4.4 Latch

On a successful contact:

- claw closes;
- 40–80 ms visual hit-stop may be used in presentation only; authoritative simulation keeps advancing unless playtesting proves a real simulation pause is desirable;
- rarity particles burst from the contact;
- camera receives a very short impulse;
- sound changes by rarity;
- the loot becomes attached to the claw presentation and is removed from conveyor ownership.

The item is still **not scored** at latch.

### 4.5 Return

Return is intentionally faster than outbound travel.

Initial tuning target:

- empty return: **1.40× outbound speed**;
- loaded return: **1.25× outbound speed**.

An empty miss should get out of the player's way quickly. A successful return remains slightly slower so the captured loot has time to read visually.

These are tuning constants, not permanent law.

### 4.6 Secure

Only when the claw reaches home:

- item enters BAG;
- score value is calculated;
- multiplier / chain changes;
- HEAT changes;
- mini-BAG updates;
- floating value moves toward the BAG HUD;
- next launch becomes available.

This retains the satisfying “I physically brought it home” behavior from the benchmark.

---

## 5. Conveyor and loot as a real game system

The conveyor is not a decoration that randomly emits circles.

### 5.1 Deterministic spawn director

For a Daily run, a seeded `SpawnDirector` creates deterministic patterns from the challenge seed and current stage/tier.

Pattern examples:

- evenly spaced commons;
- rare item embedded between commons;
- two lanes crossing at different Y values;
- short burst trains;
- opposite-direction streams;
- sinusoidal / bobbing movement profiles;
- a valuable item exposed for a short timing window.

The director chooses from authored pattern templates rather than making every spawn independently random. This creates recognizable moments that players and streamers can discuss.

### 5.2 HEAT becomes a difficulty director

HEAT continues to represent greed/risk, but the world now reacts to it.

Initial bands:

- **COOL:** readable patterns, normal conveyor speed, common-heavy loot.
- **WARM:** moderate speed increase and slightly denser patterns.
- **HOT:** stronger rare weighting, more cross-traffic, +10% Risk Payout.
- **CRITICAL:** fastest sanctioned pattern set, best rarity opportunity, +25% Risk Payout, strong audiovisual tension.

HEAT must increase opportunity as well as danger. High HEAT should feel tempting, not merely punitive.

The exact spawn table remains deterministic in ranked Daily. HEAT influences which pre-authored deterministic branch is selected from the seed/timeline; it does not introduce unseeded randomness.

### 5.3 No hazards in first rebuild slice

Bombs and lasers from the benchmark are intentionally excluded from the first v0.4 gameplay milestone.

Reason: moving loot + aim timing + BAG/BANKED + HEAT already form a complete skill/risk loop. Hazards add another failure language before the core interaction has been tuned.

They can return later as deterministic Daily events if playtesting shows the base game needs another axis of mastery.

---

## 6. Risk, multiplier and Cash Out

### 6.1 BAG / BANKED remains the product core

- Captured loot enters BAG only after physical secure.
- BANKED can never be lost by ordinary BUST.
- BAG is the amount currently exposed to risk.

### 6.2 Multiplier

Keep the simple readable ladder for now:

`x1 → x2 → x4 → x8 → x16`

No x32/x64 in the first v0.4 slice.

The multiplier should be easy to understand in a stream clip without explanation.

### 6.3 Cash Out becomes a one-click gameplay command

The 650 ms hold is removed.

On desktop and touch:

- `BANK $X` is a single click/tap when BAG > 0 and claw is home;
- Cash Out is unavailable while a claw is already committed;
- BANK transfers BAG to BANKED;
- multiplier resets;
- HEAT drops by a tuned amount rather than necessarily to zero;
- audiovisual tension releases immediately;
- the round continues.

The secure/cashout rhythm should create repeated pressure waves inside the same 60-second run.

### 6.4 BUST

The current exact BUST trigger can be tuned during the greybox phase, but these invariants remain:

- BANKED survives;
- current BAG is lost;
- the event is clearly telegraphed;
- the player returns to playable state after a short penalty/lockdown unless the round has ended;
- no paid or ad-based ranked revive.

---

## 7. Daily and deterministic fairness

Daily remains 60 seconds and uses one official local attempt in the pre-backend phase.

The previous correctness fixes remain contractual:

- ranked attempt is consumed at run start;
- run date is frozen at start and survives UTC midnight;
- an already committed launch may finish returning after the 60-second deadline;
- a player may not start or hold an uncommitted aim through the deadline to gain extra time;
- late BUST cannot trap the run at zero;
- ONE MORE uses the same realtime claw simulation.

### 7.1 Deterministic replay

Every ranked run records a compact command log:

```text
run config / ruleset version / seed
+ tick-indexed aim changes if needed
+ tick-indexed launch commands
+ tick-indexed cashouts
```

For replay verification, only commands that can affect authoritative state are stored. Pointer movement that never commits a launch does not need to be persisted unless future mechanics use it.

The simulation can replay the command log and produce:

- final score;
- BAG/BANKED history;
- item grab sequence;
- BUST events;
- a deterministic state hash.

This is the foundation for future server-side leaderboard verification.

---

## 8. ONE MORE

ONE MORE remains a final physical skill check.

At time expiry with BAG > 0:

- player sees `BANK $X` vs `DOUBLE TO $2X`;
- choosing ONE MORE opens a short fixed decision/firing window;
- the final target follows a deterministic movement profile;
- aim uses the same direct input system;
- one launch only;
- successful physical secure doubles and banks the pending BAG;
- miss or timeout loses the pending BAG.

No random roll decides success.

The target is removed from its world representation the moment it latches so it cannot appear twice during return.

---

## 9. Presentation and visual direction

Keep the official SNATCH visual identity rather than copying the benchmark's industrial-blue UI wholesale.

Direction:

- dark arcade / near-black violet environment;
- acid-lime used for action and safe banking;
- hot pink/red for destructive risk;
- cyan/violet rarity accents;
- moving conveyor with physical depth;
- loot readable as collectibles, not generic targets;
- limited chrome inside the 9:16 arena.

### 9.1 Loot personality

The richer item model from the benchmark is adopted:

- unique id;
- name;
- short description;
- flavor text;
- rarity;
- base value;
- visual token / eventual sprite;
- evolution relation for later collection/Fuse.

In-run readability is minimal: recognizable silhouette/icon + rarity + value. Full description/flavor belongs in collection/results, not over the gameplay field.

### 9.2 Assets

The first gameplay rebuild may use deliberately polished procedural/vector placeholders while mechanics are tuned.

Before public launch, key loot and the claw should graduate from raw emoji/capsules to original owned assets with clear silhouettes. The architecture must support sprite atlases without changing game rules.

---

## 10. Audio and game feel

Audio is a system, not a pile of `setTimeout` calls.

Use a dedicated `AudioDirector` with explicit cues:

- aim / ready;
- launch;
- empty return;
- latch by rarity;
- secure;
- multiplier rise;
- Cash Out;
- BUST;
- HOT / CRITICAL tension pulse;
- ONE MORE.

Tension scheduling reacts to state transitions and clock time. It must not recreate intervals every render frame.

Game feel tools allowed in presentation:

- camera shake;
- recoil;
- squash/stretch;
- short hit-stop;
- rarity particles;
- bloom/glow where performant;
- value-flight animation to HUD;
- haptics on supported touch devices.

`prefers-reduced-motion` removes or reduces nonessential shake, pulses and large movement effects without changing game rules.

---

## 11. Performance engineering

Target the game to run smoothly on mid-range mobile hardware, not only desktop.

Rules:

- canonical internal world: 540×960;
- Phaser Scale FIT / centered presentation;
- no React state update per simulation or render tick;
- pool frequently spawned loot views and transient FX where allocation becomes visible in profiling;
- texture atlases for production sprites;
- cap expensive particles by device/performance tier if needed;
- avoid DOM overlays that track many moving world objects;
- pause presentation appropriately when the document is hidden, but derive ranked elapsed time from the authoritative run clock so tab visibility cannot grant extra time;
- profile before introducing workers/WASM.

Performance acceptance target for the first public beta:

- stable near-60 FPS presentation on representative mid-range Android hardware under normal object counts;
- authoritative simulation does not fall behind real time under the supported maximum active-loot count;
- no unbounded object, timer, tween, listener or audio-node growth across repeated runs.

---

## 12. Proposed source layout

The exact scaffold may change slightly during the implementation plan, but responsibilities should remain equivalent.

```text
app/
  page.tsx
  play/
    page.tsx
components/
  game/
    GameHost.tsx
    GameHud.tsx
    ResultModal.tsx
src/
  game/
    rules/
      constants.ts
      items.ts
      rarity.ts
    simulation/
      createRun.ts
      RunState.ts
      FixedStepClock.ts
      ClawSystem.ts
      ConveyorSystem.ts
      SpawnDirector.ts
      CollisionSystem.ts
      RiskSystem.ts
      ScoreSystem.ts
      replay.ts
      prng.ts
    phaser/
      createPhaserGame.ts
      scenes/
        BootScene.ts
        GameScene.ts
      views/
        ClawView.ts
        LootView.ts
        ConveyorView.ts
      controllers/
        InputController.ts
        FxController.ts
        AudioDirector.ts
        CameraDirector.ts
    bridge/
      GameStore.ts
      commands.ts
      events.ts
tests/
  simulation/
  browser/
```

A monorepo is not required yet. The module boundaries are enough. If a backend/replay service becomes a separate deployable later, the pure simulation can then be promoted into a workspace package without rewriting its APIs.

---

## 13. Testing strategy

### 13.1 Pure simulation tests

Must cover at minimum:

- same seed + same command log = byte-equivalent important state / hash;
- fixed-step result is independent of render cadence;
- direct aim angle clamping;
- fixed reach;
- swept collision catches crossing moving targets and rejects visible misses;
- first contact only;
- no score before secure;
- empty and loaded return speed rules;
- BAG/BANKED invariants;
- HEAT tiers / Risk Payout;
- Cash Out reset/drop behavior;
- BUST invariants;
- deadline while idle / aiming / outbound / returning;
- UTC run-date preservation;
- ONE MORE success/miss/timeout;
- replay reproduces the original result.

Property-based tests are encouraged for determinism and invariants if they provide useful coverage without making failures unreadable.

### 13.2 Phaser integration tests

Validate contracts, not pixel-perfect implementation:

- scene displays state produced by simulation;
- pointer input produces the correct command angle;
- desktop pointer follows aim without holding;
- touch pointer uses direct aim and commits on release;
- launched claw cannot be redirected;
- latched view follows claw;
- returning loot is not duplicated;
- Cash Out button obeys authoritative availability.

### 13.3 Browser E2E

Playwright covers:

- first-run path;
- desktop direct aim → launch → grab → secure → bank;
- mobile direct aim → launch → grab → secure → bank;
- miss → fast empty return;
- HEAT escalation;
- BUST recovery;
- Daily attempt reservation;
- deadline with held touch/mouse aim;
- committed shot crossing deadline;
- ONE MORE;
- repeated run/restart without errors or listener leaks;
- 390×844 and 1440×900 visual QA.

---

## 14. Telemetry for tuning

The first rebuild needs instrumentation because game feel should be tuned from behavior, not taste alone.

Local/dev analytics events:

- run_started;
- aim_started (touch only);
- launch;
- launch_angle_bucket;
- claw_hit;
- claw_miss;
- secure;
- cashout;
- heat_tier_changed;
- bust;
- one_more_selected;
- one_more_result;
- run_finished.

Useful aggregate tuning metrics later:

- launches per minute;
- hit rate;
- average time between launches;
- average BAG at Cash Out;
- percentage of players reaching HOT / CRITICAL;
- BUST rate;
- ONE MORE take rate;
- replay rate after a run.

No fake social proof is introduced.

---

## 15. Migration strategy from the current repo

The rebuild starts from `main` (`v0.2.1`), not from PR #4.

Reason:

- `main` contains the proven product/risk rules and the four already-fixed Daily/collision regressions;
- PR #4 contains useful ideas and tests, but its central pre-resolved-claw architecture is intentionally superseded;
- selected PR #4 tests/concepts can be ported rather than merging code that will immediately be replaced.

The AI Studio prototype is used as a benchmark/reference, not copied wholesale. In particular, v0.4 rejects its ranked time bonuses, claw-speed upgrades, x32/x64 ladder, random hazards in the first slice, ad revive and Cash Out ending the whole run.

PR #4 should be closed as superseded once this spec is accepted for implementation, with a short comment linking to the v0.4 rebuild direction.

---

## 16. Milestones and gates

### Milestone A — Direct Aim Greybox

Only build:

- Next/React host;
- Phaser scene;
- pure fixed-step simulation;
- desktop/touch direct aim;
- physical claw;
- deterministic moving loot;
- secure-to-BAG;
- single-tap Cash Out;
- basic HEAT/BUST.

**Gate:** this greybox must feel at least as responsive and enjoyable as the AI Studio benchmark before adding meta systems.

### Milestone B — Daily Fairness

Add:

- seeded authored spawn patterns;
- 60-second Daily;
- replay command log/hash;
- all previous deadline/date protections;
- ONE MORE.

### Milestone C — Game Feel and Identity

Add:

- polished claw presentation;
- richer loot views;
- audio director;
- camera/particle feedback;
- HEAT-driven world presentation;
- original first-pass owned assets.

### Milestone D — Social Product

Only after gameplay gate passes:

- backend verification;
- leaderboard;
- percentiles;
- share links/cards;
- Daily global stats;
- collection/Fuse persistence.

---

## 17. Explicit non-goals for the first v0.4 implementation

Do not add yet:

- ads;
- purchases;
- login/account requirement;
- multiplayer;
- guilds/friends;
- server leaderboard;
- random bombs/lasers;
- gameplay-stat claw skins;
- x32/x64;
- bonus seconds per grab;
- paid/rewarded revive;
- collection/Fuse UI overhaul;
- Rust/WASM without profiling evidence.

The rebuild wins or loses on one thing first: **aim → launch → intercept → latch → return → secure → decide whether to bank or fire again.**

---

## 18. Acceptance criteria for v0.4 gameplay rebuild

The rebuild is ready to replace the current gameplay only when all of the following are true:

1. Desktop aim is direct and requires no drag/pull-back gesture.
2. Touch aim is direct and visually compensates for finger occlusion.
3. Both inputs reduce to the same authoritative launch-angle command.
4. The claw and loot are simulated continuously in a fixed-step deterministic world.
5. Render FPS cannot change ranked hit/miss outcomes.
6. A moving loot item can be intercepted naturally during claw travel.
7. Fast movement uses swept collision so valid contacts are not skipped.
8. Loot scores only after returning to base.
9. Empty return is noticeably faster than outbound; loaded return remains satisfying and readable.
10. Cash Out is a single click/tap, keeps the run alive and preserves BANKED/BAG semantics.
11. HEAT changes opportunity, pace and presentation rather than acting only as a red meter.
12. Daily remains 60 seconds with the previous reservation/date/deadline correctness guarantees.
13. ONE MORE is resolved by the same physical simulation.
14. Pure simulation can replay a command log to the same final state/hash.
15. React is not in the per-frame hot path.
16. Browser tests pass on mobile and desktop viewports without console errors or horizontal overflow.
17. Repeated runs do not leak scenes, listeners, timers, tweens or audio nodes.
18. Human playtest verdict: v0.4 greybox is at least as immediately enjoyable as the AI Studio benchmark.
