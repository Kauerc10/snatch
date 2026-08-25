# SNATCH! v0.3 — The Claw Update Design

**Date:** 2026-08-25  
**Status:** Approved  
**Source:** Fusion of the official SNATCH v0.2 and the user-provided AI Studio prototype.

## Goal

Keep the official SNATCH visual language and competitive Daily rules, while adopting the stronger physical-claw game feel from the AI Studio prototype.

## Core interaction

The player keeps the existing pull-back gesture. Releasing no longer resolves an invisible instant raycast. The claw visibly travels from the canonical base, can contact a moving target, latches the first valid target, retracts faster than it extended, carries the loot back, and only scores after settling at the base.

State sequence:

`idle -> aiming -> outbound -> returning -> settled -> idle`

A successful outbound leg carries a target during `returning`; an empty shot returns without loot.

## Competitive determinism

The authoritative shot outcome is computed at release using a framework-free deterministic simulator (`src/claw.js`). It samples a fixed logical timeline at 120 Hz, predicts deterministic target positions from the Daily seed, and measures distance in aspect-correct 9:16 space. Rendering replays that result and cannot change the outcome based on device frame rate.

The Daily still uses one official local attempt, reserved when the ranked run starts. The run keeps its original UTC date through completion and sharing. A shot committed before the timer expires may finish its physical return before the round result is shown.

## What comes from each prototype

### Keep from official SNATCH

- dark arcade / acid-lime / violet identity;
- canonical 9:16 arena on every device;
- pull-back input;
- BAG vs BANKED;
- HEAT, BUST and Risk Payout;
- 60-second Daily seed shared by all players;
- ONE MORE and ranked fairness rules.

### Adopt from AI Studio prototype

- visible outbound claw travel;
- cable extension and retraction;
- loot visibly attached to the returning claw;
- reward on delivery rather than on release;
- stronger object identity and rarity feedback;
- escalating tension audio and edge vignette;
- more tactile hit feedback.

### Explicitly reject for ranked Daily

- bonus time per grab;
- x32/x64 progression in this milestone;
- random bombs/lasers;
- upgrades that change claw speed;
- paid/rewarded revives;
- fake global activity.

## Feedback layer

Targets render as compact loot capsules with emoji identity, value, rarity label, rarity color and glow. The last four at-risk deliveries appear in a mini-BAG tray. Hits emit deterministic particles, optional vibration and short screen shake. HOT and CRITICAL HEAT add a heartbeat and edge vignette. Reduced-motion users do not receive pulsing or shake animation.

## File boundaries

- `src/core.js`: pure scoring/challenge rules and aspect-correct collision utility.
- `src/claw.js`: deterministic flight, contact, latch, retraction and settling.
- `src/input.js`: pointer mapping and pull-back shot vector.
- `src/risk.js`: HEAT tier and pressure payout.
- `app.js`: orchestration and presentation only.

`polish.js` and `v02.css` are retired because their responsibilities are folded into focused v0.3 modules/styles rather than kept as runtime monkey-patches.

## Acceptance criteria

1. A hit cannot add BAG value before the claw returns to base.
2. The same shot, seed and target timeline resolves identically across runs.
3. Return duration is shorter than equivalent outbound duration.
4. ONE MORE uses the same physical claw system and no random success roll.
5. Daily reservation/date and late-BUST regressions remain fixed.
6. Mobile 390×844 and desktop 1440×900 render without clipping or runtime errors.
7. Existing core/risk/input tests remain green and new claw tests cover determinism and 9:16 collision.
