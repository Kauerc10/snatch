const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../src/core.js');

test('same seed emits the same RNG sequence', () => {
  const a = core.createRng('2026-08-24:snatch');
  const b = core.createRng('2026-08-24:snatch');
  assert.deepEqual([a(), a(), a(), a()], [b(), b(), b(), b()]);
});

test('different seeds emit different RNG sequences', () => {
  const a = core.createRng('alpha');
  const b = core.createRng('beta');
  assert.notDeepEqual([a(), a(), a()], [b(), b(), b()]);
});

test('multiplier follows the approved greed thresholds', () => {
  const cases = [[0,1],[2,1],[3,2],[5,2],[6,4],[9,4],[10,8],[14,8],[15,16],[99,16]];
  for (const [chain, expected] of cases) assert.equal(core.multiplierForChain(chain), expected);
});

test('successful grabs add multiplied value to BAG only', () => {
  const state = core.createState({ bag: 100, banked: 500, greedChain: 6, multiplier: 4 });
  const next = core.applySuccessfulGrab(state, { baseValue: 50, rarity: 'common' });
  assert.equal(next.bag, 300);
  assert.equal(next.banked, 500);
});

test('bust loses BAG but never BANKED', () => {
  const state = core.createState({ bag: 900, banked: 4200, heat: 99 });
  const next = core.applyMiss(state);
  assert.equal(next.bag, 0);
  assert.equal(next.banked, 4200);
  assert.equal(next.phase, 'lockdown');
});

test('cashout banks BAG and resets greed after 650ms commitment', () => {
  const state = core.createState({ bag: 900, banked: 1000, heat: 61, greedChain: 8, multiplier: 4 });
  const tooEarly = core.completeCashout(state, 649);
  assert.equal(tooEarly.bag, 900);
  assert.equal(tooEarly.banked, 1000);
  const done = core.completeCashout(state, 650);
  assert.equal(done.bag, 0);
  assert.equal(done.banked, 1900);
  assert.equal(done.multiplier, 1);
  assert.equal(done.greedChain, 0);
});

test('One More success doubles and banks current BAG', () => {
  const state = core.createState({ phase: 'one-more-attempt', banked: 1000, bag: 600 });
  const next = core.resolveOneMore(state, true);
  assert.equal(next.banked, 2200);
  assert.equal(next.bag, 0);
  assert.equal(next.phase, 'finished');
});

test('One More failure loses only BAG', () => {
  const state = core.createState({ phase: 'one-more-attempt', banked: 1000, bag: 600 });
  const next = core.resolveOneMore(state, false);
  assert.equal(next.banked, 1000);
  assert.equal(next.bag, 0);
  assert.equal(next.phase, 'finished');
});

test('challenge generation is deterministic and fills 60 seconds', () => {
  const a = core.buildChallenge('2026-08-24', 'seed-a');
  const b = core.buildChallenge('2026-08-24', 'seed-a');
  assert.deepEqual(a, b);
  assert.ok(a.spawns.length >= 35);
  assert.equal(a.roundMs, 60000);
  assert.ok(a.spawns.every((spawn) => spawn.atMs >= 0 && spawn.atMs < 60000));
});

test('segment-circle collision is deterministic', () => {
  const hit = core.segmentCircleHit({x: 0, y: 0}, {x: 1, y: 1}, {x: 0.5, y: 0.5}, 0.05);
  const miss = core.segmentCircleHit({x: 0, y: 0}, {x: 1, y: 0}, {x: 0.5, y: 0.5}, 0.05);
  assert.equal(hit, true);
  assert.equal(miss, false);
});

test('target motion is deterministic and remains inside logical arena', () => {
  const spawn = { atMs: 1000, lane: 2, motionSeed: 123456, direction: 1, itemId: 'radio-duck' };
  const a = core.targetPosition(spawn, 4500);
  const b = core.targetPosition(spawn, 4500);
  assert.deepEqual(a, b);
  assert.ok(a.x >= -0.2 && a.x <= 1.2);
  assert.ok(a.y >= 0.12 && a.y <= 0.68);
});

test('pickFirstHit chooses the nearest intercepted target', () => {
  const shot = { start: {x: 0.5, y: 0.88}, end: {x: 0.5, y: 0.1} };
  const targets = [
    { id: 'far', x: 0.5, y: 0.25, radius: 0.05 },
    { id: 'near', x: 0.5, y: 0.60, radius: 0.05 },
  ];
  assert.equal(core.pickFirstHit(shot, targets).id, 'near');
});
